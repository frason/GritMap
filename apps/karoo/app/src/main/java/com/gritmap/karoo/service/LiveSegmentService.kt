package com.gritmap.karoo.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.Manifest
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Binder
import android.os.IBinder
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.gritmap.karoo.R
import com.gritmap.karoo.data.DatabaseProvider
import com.gritmap.karoo.physiology.H10BleClient
import com.gritmap.karoo.physiology.H10ApproachRecoveryPolicy
import com.gritmap.karoo.physiology.H10ApproachRecoveryPolicy.RetryDecision
import com.gritmap.karoo.physiology.H10CaptureController
import com.gritmap.karoo.physiology.H10ConnectionState
import com.gritmap.karoo.physiology.H10PreferredDeviceStore
import com.gritmap.karoo.physiology.H10ServiceCommands
import com.gritmap.karoo.physiology.H10ServiceState
import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.LiveDemoController
import com.gritmap.karoo.ui.state.LiveUiStore
import com.gritmap.karoo.ui.state.SensorStatus
import com.gritmap.karoo.ui.state.UnitSystem
import io.hammerhead.karooext.KarooSystemService
import io.hammerhead.karooext.models.DataType
import io.hammerhead.karooext.models.InRideAlert
import io.hammerhead.karooext.models.OnLocationChanged
import io.hammerhead.karooext.models.OnStreamState
import io.hammerhead.karooext.models.RideState
import io.hammerhead.karooext.models.StreamState
import io.hammerhead.karooext.models.UserProfile
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.delay
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.roundToInt

/**
 * Owns the live in-memory telemetry session. Deterministic matching and AI orchestration plug
 * into [onTelemetry]; no ordinary sensor tick performs a Room write.
 */
class LiveSegmentService : Service() {
    private val localBinder = Binder()
    private val exceptionHandler = CoroutineExceptionHandler { _, error ->
        LiveDiagnostics.record(
            this,
            "coroutine_error",
            "type=${error.javaClass.simpleName} message=${error.message}",
        )
    }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default + exceptionHandler)
    private val karooSystem by lazy { KarooSystemService(this) }
    private val eventSink get() = LiveSegmentServiceDependencies.attemptEventSink
    private val pacingEngine get() = LiveSegmentServiceDependencies.pacingGuidanceEngine
    private val coordinator by lazy {
        LiveSegmentCoordinator(
            database = DatabaseProvider.get(this),
            begin = ::beginAttempt,
            update = ::updateAttempt,
            finish = ::finishAttempt,
            approach = ::prepareH10ForApproach,
            diagnostic = { event, details -> LiveDiagnostics.record(this, event, details) },
        )
    }
    private var rideStateConsumerId: String? = null
    private var userProfileConsumerId: String? = null
    private val telemetryConsumerIds = mutableListOf<String>()
    private val telemetryUpdates = Channel<TelemetryUpdate>(Channel.CONFLATED)
    private var activeSession: ActiveAttemptSession? = null
    private var recording = false
    private var telemetry = LiveTelemetry(timestampMs = 0L)
    private var lastCheckpointMs = 0L
    private var lastInferenceMs = 0L
    private val inferenceInFlight = AtomicBoolean(false)
    private var observingKaroo = false
    private var locationCount = 0L
    private var lastLocationDiagnosticMs = 0L
    private var distanceUnitSystem = UnitSystem.IMPERIAL
    private var elevationUnitSystem = UnitSystem.IMPERIAL
    private lateinit var h10CaptureController: H10CaptureController
    private lateinit var h10BleClient: H10BleClient
    private lateinit var preferredH10Store: H10PreferredDeviceStore
    private var automaticH10Requested = false
    private var h10ReleaseJob: Job? = null
    private var h10RetryJob: Job? = null
    private val h10RecoveryPolicy = H10ApproachRecoveryPolicy()
    private val approachingSegmentIds = linkedSetOf<String>()
    private var lastAutomaticH10State: H10ConnectionState? = null
    private var lastRecordedH10GapCount = 0L
    private var lastH10PersistenceError: String? = null

    override fun onCreate() {
        super.onCreate()
        LiveSegmentServiceDependencies.attemptEventSink =
            RoomAttemptEventSink(DatabaseProvider.get(this))
        h10CaptureController = H10CaptureController(filesDir.toPath().resolve("physiology"))
        preferredH10Store = H10PreferredDeviceStore(this)
        h10BleClient = H10BleClient(
            context = this,
            onMeasurement = h10CaptureController::onMeasurement,
            elapsedRealtimeMs = SystemClock::elapsedRealtime,
            onConnectedDevice = { device -> preferredH10Store.saveAddress(device.address) },
        )
        scope.launch {
            h10BleClient.state.collectLatest { state ->
                H10ServiceState.publish(state)
                handleAutomaticH10State(state)
            }
        }
        scope.launch {
            h10CaptureController.state.collectLatest { state ->
                H10ServiceState.publish(state)
                if (state.rrGapCount > lastRecordedH10GapCount) {
                    lastRecordedH10GapCount = state.rrGapCount
                    LiveDiagnostics.record(
                        this@LiveSegmentService,
                        "h10_rr_gap",
                        "count=${state.rrGapCount} status=${state.status}",
                    )
                } else if (state.rrGapCount == 0L) {
                    lastRecordedH10GapCount = 0L
                }
                if (state.persistenceError != null && state.persistenceError != lastH10PersistenceError) {
                    lastH10PersistenceError = state.persistenceError
                    LiveDiagnostics.record(
                        this@LiveSegmentService,
                        "h10_capture_write_failed",
                        "error=${state.persistenceError.take(160)}",
                    )
                } else if (state.persistenceError == null) {
                    lastH10PersistenceError = null
                }
            }
        }
        createNotificationChannel()
        LiveDiagnostics.record(this, "service_created")
        scope.launch {
            for (update in telemetryUpdates) {
                if (!recording) continue
                try {
                    // Matching is intentionally single-threaded. A conflated channel keeps only
                    // the newest GPS tick if Room/projection work briefly takes longer than 1 Hz.
                    coordinator.process(update.sample, update.sensors)
                } catch (error: Exception) {
                    LiveDiagnostics.record(
                        this@LiveSegmentService,
                        "telemetry_processing_failed",
                        "type=${error.javaClass.simpleName} message=${error.message}",
                    )
                }
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder {
        ensureKarooObservation("bound")
        return localBinder
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureKarooObservation("started startId=$startId")
        handleH10Command(intent)
        return START_STICKY
    }

    override fun onDestroy() {
        activeSession?.let { session ->
            // Service teardown is a macro-event and must not be cancelled with the live scope.
            runBlocking(Dispatchers.IO) { eventSink.onSegmentExit(session, "service-destroyed") }
        }
        LiveUiStore.clear()
        telemetryUpdates.close()
        stopTelemetryConsumers()
        rideStateConsumerId?.let(karooSystem::removeConsumer)
        rideStateConsumerId = null
        userProfileConsumerId?.let(karooSystem::removeConsumer)
        userProfileConsumerId = null
        if (observingKaroo) karooSystem.disconnect()
        finalizeH10Capture("service-destroyed")
        h10BleClient.close()
        h10CaptureController.close()
        H10ServiceState.serviceStopped()
        scope.cancel()
        LiveDiagnostics.record(this, "service_destroyed")
        super.onDestroy()
    }

    /** Called by the deterministic matcher when a segment is entered. */
    fun beginAttempt(session: ActiveAttemptSession) {
        h10ReleaseJob?.cancel()
        prepareH10ForApproach(session.segmentId)
        h10CaptureController.updateCaptureIdentity(session.segmentId, session.attemptId)
        LiveDemoController.stop(clear = false)
        LiveDiagnostics.record(
            this,
            "attempt_started",
            "segment=${session.segmentId} attempt=${session.attemptId}",
        )
        activeSession = session
        lastCheckpointMs = session.startedAtMs
        lastInferenceMs = session.startedAtMs
        publish(session.uiState)
        val alertSent = karooSystem.dispatch(segmentEntryAlert(session))
        LiveDiagnostics.record(
            this,
            "segment_entry_alert",
            "segment=${session.segmentId} sent=$alertSent",
        )
        scope.launch(Dispatchers.IO) { eventSink.onSegmentEntry(session) }
        val engine = pacingEngine
        if (engine != null && session.ftpWatts != null && inferenceInFlight.compareAndSet(false, true)) {
            scope.launch {
                try {
                    engine.initialPlan(session)?.let(::publishPlanChangeIfMaterial)
                } finally {
                    inferenceInFlight.set(false)
                }
            }
        }
    }

    /** Called only after a validated plan materially changes. */
    fun publishPlanChange(state: LiveUiState) {
        val session = activeSession ?: return
        session.updateUiState(state)
        publish(state)
        scope.launch(Dispatchers.IO) { eventSink.onPlanChanged(session) }
    }

    private fun publishPlanChangeIfMaterial(state: LiveUiState) {
        val current = activeSession?.uiState ?: return
        if (current.pacingZones == state.pacingZones && current.recommendation == state.recommendation) return
        publishPlanChange(state)
    }

    fun finishAttempt(reason: String) {
        val session = activeSession ?: return
        LiveDiagnostics.record(
            this,
            "attempt_finished",
            "segment=${session.segmentId} attempt=${session.attemptId} reason=$reason",
        )
        val finalStatus = if (reason == "completed") {
            com.gritmap.karoo.ui.state.MatchStatus.COMPLETE
        } else {
            com.gritmap.karoo.ui.state.MatchStatus.ABANDONED
        }
        session.updateUiState(session.uiState.copy(matchStatus = finalStatus))
        if (reason == "completed") {
            val alertSent = karooSystem.dispatch(segmentCompletionAlert(session, telemetry.timestampMs))
            LiveDiagnostics.record(
                this,
                "segment_completion_alert",
                "segment=${session.segmentId} sent=$alertSent",
            )
        }
        activeSession = null
        lastInferenceMs = 0L
        scheduleH10Release(POST_SEGMENT_H10_GRACE_MS, "segment-ended")
        scope.launch(Dispatchers.IO) { eventSink.onSegmentExit(session, reason) }
        LiveUiStore.clear()
    }

    private fun observeKaroo() {
        observingKaroo = true
        karooSystem.connect {
            LiveDiagnostics.record(this, "karoo_connected")
        }
        rideStateConsumerId = karooSystem.addConsumer { state: RideState -> onRideState(state) }
        userProfileConsumerId = karooSystem.addConsumer { profile: UserProfile ->
            distanceUnitSystem = profile.preferredUnit.distance.toUnitSystem()
            elevationUnitSystem = profile.preferredUnit.elevation.toUnitSystem()
            val riderProfile = KarooRiderProfile(
                ftpWatts = profile.ftp,
                weightKg = profile.weight.toDouble(),
                maxHeartRateBpm = profile.maxHr.takeIf { it > 0 },
            )
            RiderProfileStore.publish(riderProfile)
            scope.launch(Dispatchers.IO) {
                DatabaseProvider.get(this@LiveSegmentService).riderHistoryDao().syncFromKaroo(
                    ftpWatts = riderProfile.ftpWatts,
                    weightKg = riderProfile.weightKg,
                    maxHeartRateBpm = riderProfile.maxHeartRateBpm,
                )
                LiveDiagnostics.record(
                    this@LiveSegmentService,
                    "karoo_rider_profile_synced",
                    "ftp=${riderProfile.ftpWatts}",
                )
            }
            LiveUiStore.publish(
                LiveUiStore.state.value.copy(
                    distanceUnitSystem = distanceUnitSystem,
                    elevationUnitSystem = elevationUnitSystem,
                ),
            )
        }
    }

    private fun ensureKarooObservation(origin: String) {
        if (!LiveServiceStarter.hasLocationPermission(this)) {
            LiveDiagnostics.record(this, "location_permission_missing", "origin=$origin")
            return
        }
        if (!observingKaroo) {
            LiveDiagnostics.record(this, "karoo_observation_requested", "origin=$origin")
            observeKaroo()
        }
    }

    private fun startTelemetryConsumers() {
        if (telemetryConsumerIds.isNotEmpty()) return
        telemetryConsumerIds += karooSystem.addConsumer { location: OnLocationChanged ->
            val now = System.currentTimeMillis()
            locationCount += 1
            telemetry = telemetry.copy(
                timestampMs = now,
                lat = location.lat,
                lng = location.lng,
                gpsUpdatedAtMs = now,
            )
            if (now - lastLocationDiagnosticMs >= LOCATION_DIAGNOSTIC_INTERVAL_MS) {
                lastLocationDiagnosticMs = now
                LiveDiagnostics.record(
                    this,
                    "gps_received",
                    "count=$locationCount recording=$recording lat=${"%.5f".format(location.lat)} " +
                        "lng=${"%.5f".format(location.lng)}",
                )
            }
            onTelemetry()
        }
        observeMetric(DataType.Type.POWER, DataType.Field.POWER) { value ->
            val now = System.currentTimeMillis()
            telemetry = telemetry.copy(timestampMs = now, powerWatts = value, powerUpdatedAtMs = now)
        }
        observeMetric(DataType.Type.HEART_RATE, DataType.Field.HEART_RATE) { value ->
            val now = System.currentTimeMillis()
            telemetry = telemetry.copy(timestampMs = now, heartRateBpm = value, heartRateUpdatedAtMs = now)
        }
        observeMetric(DataType.Type.CADENCE, DataType.Field.CADENCE) { value ->
            val now = System.currentTimeMillis()
            telemetry = telemetry.copy(timestampMs = now, cadenceRpm = value, cadenceUpdatedAtMs = now)
        }
        observeMetric(DataType.Type.SPEED, DataType.Field.SPEED) { value ->
            val now = System.currentTimeMillis()
            telemetry = telemetry.copy(timestampMs = now, speedMetersPerSecond = value, speedUpdatedAtMs = now)
        }
        observeMetric(DataType.Type.PRESSURE_ELEVATION_CORRECTION, DataType.Field.PRESSURE_ELEVATION) { value ->
            val now = System.currentTimeMillis()
            telemetry = telemetry.copy(timestampMs = now, elevationMeters = value, elevationUpdatedAtMs = now)
        }
        LiveDiagnostics.record(this, "telemetry_consumers_started", "count=${telemetryConsumerIds.size}")
    }

    private fun stopTelemetryConsumers() {
        if (telemetryConsumerIds.isEmpty()) return
        telemetryConsumerIds.forEach(karooSystem::removeConsumer)
        telemetryConsumerIds.clear()
        telemetry = LiveTelemetry(timestampMs = 0L)
        LiveDiagnostics.record(this, "telemetry_consumers_stopped")
    }

    private fun observeMetric(type: String, field: String, update: (Double?) -> Unit) {
        telemetryConsumerIds += karooSystem.addConsumer(OnStreamState.StartStreaming(type)) { event: OnStreamState ->
            val value = (event.state as? StreamState.Streaming)?.dataPoint?.values?.get(field)
            update(value)
        }
    }

    private fun onRideState(state: RideState) {
        LiveDiagnostics.record(this, "ride_state", "state=${state.javaClass.simpleName}")
        recording = state is RideState.Recording || state is RideState.Paused
        if (recording) {
            if (startForegroundCompat()) {
                startTelemetryConsumers()
            } else {
                recording = false
                stopTelemetryConsumers()
            }
        } else {
            activeSession?.let { finishAttempt("ride-ended") }
            finalizeH10Capture("ride-ended")
            automaticH10Requested = false
            h10ReleaseJob?.cancel()
            h10BleClient.disconnect()
            stopTelemetryConsumers()
            stopForeground(STOP_FOREGROUND_REMOVE)
        }
    }

    private fun onTelemetry() {
        if (!recording) return
        val sensors = SensorFreshness.status(telemetry)
        val sample = telemetry.sanitized(sensors)
        if (telemetryUpdates.trySend(TelemetryUpdate(sample, sensors)).isFailure) {
            LiveDiagnostics.record(this, "telemetry_update_rejected")
        }
    }

    private fun updateAttempt(sample: LiveTelemetry, state: LiveUiState, maxDeviationMeters: Double) {
        val session = activeSession ?: return
        session.recordDeviation(maxDeviationMeters)
        val drift = session.recordCardiacDrift(sample, state.progressFraction)
        val h10 = H10ServiceState.captureState.value
        val enriched = enrichLiveMetrics(state, session, sample).copy(
            cardiacDriftPct = drift.driftPct,
            cardiacDriftHistory = drift.history,
            cardiacEfficiencyWattsPerBpm = drift.efficiencyWattsPerBpm,
            cardiacDriftRatePctPer10Min = drift.driftRatePctPer10Min,
            cardiacDriftValidSeconds = drift.validSeconds,
            cardiacDriftPairedPct = drift.pairedPct,
            cardiacDriftPowerSteady = drift.powerSteady,
            h10EnhancedAvailable = h10.enhancedMetricsAllowed,
            h10DfaAlpha1 = h10.dfaAlpha1,
            h10RmssdMs = h10.rmssdMs,
            h10ValidRrPct = h10.validRrPct,
            h10DfaHistory = h10.dfaAlpha1History.map {
                com.gritmap.karoo.ui.state.H10DfaSample((it.elapsedMs / 1_000L).toInt(), it.value)
            },
        )
        session.recordTelemetryTick(sample, enriched)
        val published = enriched.copy(
            planAdherencePct = session.planAdherencePct(),
            powerExecutionHistory = session.powerExecutionSamples(),
            segmentSplitDeltasSeconds = session.recordCompletedSplits(
                enriched.progressMeters,
                enriched.elapsedAttemptSeconds ?: 0.0,
                enriched.totalDistanceMeters,
                enriched.plannedFinishSeconds,
            ),
        )
        session.updateUiState(published)
        publish(published)
        if (sample.timestampMs - lastCheckpointMs >= CHECKPOINT_INTERVAL_MS) {
            lastCheckpointMs = sample.timestampMs
            scope.launch(Dispatchers.IO) { eventSink.onCheckpoint(session) }
        }
        val engine = pacingEngine
        if (engine != null && state.sensorStatus.adaptiveGuidanceAvailable &&
            sample.timestampMs - lastInferenceMs >= INFERENCE_INTERVAL_MS &&
            inferenceInFlight.compareAndSet(false, true)
        ) {
            lastInferenceMs = sample.timestampMs
            scope.launch {
                try {
                    engine.adapt(session, sample)?.let(::publishPlanChangeIfMaterial)
                } finally {
                    inferenceInFlight.set(false)
                }
            }
        }
    }

    private fun publish(state: LiveUiState) {
        LiveUiStore.publish(
            state.copy(
                distanceUnitSystem = distanceUnitSystem,
                elevationUnitSystem = elevationUnitSystem,
            ),
        )
    }

    private fun startForegroundCompat(): Boolean {
        if (!LiveServiceStarter.hasLocationPermission(this)) {
            LiveDiagnostics.record(this, "foreground_blocked", "permission=location")
            return false
        }
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.karoo_ic_extension)
            .setContentTitle(getString(R.string.karoo_extension_name))
            .setContentText("Live segment matching active")
            .setOngoing(true)
            .build()
        return try {
            val serviceTypes = if (hasBluetoothConnectPermission()) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION or
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
            } else {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            }
            startForeground(
                NOTIFICATION_ID,
                notification,
                serviceTypes,
            )
            LiveDiagnostics.record(this, "foreground_started")
            true
        } catch (error: SecurityException) {
            LiveDiagnostics.record(
                this,
                "foreground_failed",
                "type=${error.javaClass.simpleName} message=${error.message}",
            )
            false
        }
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.karoo_extension_name),
            NotificationManager.IMPORTANCE_LOW,
        )
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun handleH10Command(intent: Intent?) {
        when (intent?.action) {
            H10ServiceCommands.ACTION_SCAN -> h10BleClient.startScan()
            H10ServiceCommands.ACTION_CONNECT -> {
                intent.getStringExtra(H10ServiceCommands.EXTRA_DEVICE_ADDRESS)?.let(h10BleClient::connect)
            }
            H10ServiceCommands.ACTION_DISCONNECT -> {
                h10ReleaseJob?.cancel()
                cancelAutomaticH10Recovery()
                finalizeH10Capture("manual-disconnect")
                h10BleClient.disconnect()
            }
            H10ServiceCommands.ACTION_START_CAPTURE -> {
                automaticH10Requested = true
                if (h10BleClient.state.value.connectionState == H10ConnectionState.CONNECTED &&
                    !h10CaptureController.state.value.capturing
                ) {
                    h10CaptureController.startCapture()
                    LiveDiagnostics.record(this, "h10_capture_started", "recording=$recording")
                }
            }
            H10ServiceCommands.ACTION_STOP_CAPTURE -> finalizeH10Capture("manual-stop")
        }
    }

    private fun finalizeH10Capture(reason: String) {
        if (!::h10CaptureController.isInitialized || !h10CaptureController.state.value.capturing) return
        runCatching { h10CaptureController.stopCapture() }
            .onSuccess { artifact ->
                LiveDiagnostics.record(
                    this,
                    "h10_capture_saved",
                    "reason=$reason samples=${artifact?.sampleCount ?: 0}",
                )
            }
            .onFailure { error ->
                h10CaptureController.checkpoint()
                LiveDiagnostics.record(
                    this,
                    "h10_capture_save_failed",
                    "reason=$reason type=${error.javaClass.simpleName} message=${error.message}",
                )
            }
    }

    private fun prepareH10ForApproach(segmentId: String) {
        if (!hasBluetoothConnectPermission()) {
            LiveDiagnostics.record(this, "h10_auto_skipped", "segment=$segmentId permission=bluetooth")
            return
        }
        val newApproach = approachingSegmentIds.add(segmentId)
        automaticH10Requested = true
        scheduleH10Release(APPROACH_H10_TIMEOUT_MS, "approach-timeout")
        if (newApproach) {
            LiveDiagnostics.record(
                this,
                "h10_approach_requested",
                "segment=$segmentId state=${h10BleClient.state.value.connectionState}",
            )
        }
        when (h10BleClient.state.value.connectionState) {
            H10ConnectionState.CONNECTED -> startAutomaticH10Capture(segmentId)
            H10ConnectionState.CONNECTING,
            H10ConnectionState.DISCOVERING,
            H10ConnectionState.SUBSCRIBING,
            H10ConnectionState.SCANNING,
            -> Unit
            else -> {
                val savedAddress = preferredH10Store.loadAddress()
                if (savedAddress != null) {
                    LiveDiagnostics.record(this, "h10_auto_reconnect", "segment=$segmentId")
                    h10BleClient.connectKnown(savedAddress)
                } else {
                    automaticH10Requested = false
                    LiveDiagnostics.record(
                        this,
                        "h10_auto_setup_required",
                        "segment=$segmentId reason=no-preferred-device fallback=karoo-hr",
                    )
                }
            }
        }
    }

    private fun handleAutomaticH10State(state: com.gritmap.karoo.physiology.H10BleState) {
        if (!automaticH10Requested) return
        if (lastAutomaticH10State != state.connectionState) {
            lastAutomaticH10State = state.connectionState
            LiveDiagnostics.record(
                this,
                "h10_auto_state",
                "state=${state.connectionState} status=${state.status.take(100)}",
            )
        }
        when (state.connectionState) {
            H10ConnectionState.CONNECTED -> {
                h10RetryJob?.cancel()
                h10RetryJob = null
                h10RecoveryPolicy.connected()
                startAutomaticH10Capture("auto")
            }
            H10ConnectionState.IDLE -> Unit
            H10ConnectionState.ERROR -> scheduleAutomaticH10Recovery("error")
            H10ConnectionState.DISCONNECTED -> scheduleAutomaticH10Recovery("disconnected")
            else -> Unit
        }
    }

    private fun scheduleAutomaticH10Recovery(reason: String) {
        if (!automaticH10Requested || h10RetryJob?.isActive == true) return
        when (val decision = h10RecoveryPolicy.nextRetry()) {
            is RetryDecision.Retry -> {
                LiveDiagnostics.record(
                    this,
                    "h10_auto_retry_scheduled",
                    "reason=$reason attempt=${decision.attempt} delayMs=${decision.delayMs}",
                )
                h10RetryJob = scope.launch {
                    delay(decision.delayMs)
                    if (!automaticH10Requested) return@launch
                    val savedAddress = preferredH10Store.loadAddress()
                    if (savedAddress == null) {
                        automaticH10Requested = false
                        LiveDiagnostics.record(
                            this@LiveSegmentService,
                            "h10_auto_setup_required",
                            "reason=preferred-device-cleared fallback=karoo-hr",
                        )
                        return@launch
                    }
                    LiveDiagnostics.record(
                        this@LiveSegmentService,
                        "h10_auto_retry_started",
                        "reason=$reason attempt=${decision.attempt} mode=known",
                    )
                    h10BleClient.connectKnown(savedAddress)
                }
            }
            RetryDecision.Exhausted -> LiveDiagnostics.record(
                this,
                "h10_auto_fallback",
                "reason=$reason retries=${h10RecoveryPolicy.failures} source=karoo-hr",
            )
        }
    }

    private fun startAutomaticH10Capture(source: String) {
        if (!h10CaptureController.state.value.capturing) {
            h10CaptureController.startCapture(segmentId = approachingSegmentIds.firstOrNull())
            LiveDiagnostics.record(this, "h10_auto_capture_started", "source=$source")
        }
    }

    private fun scheduleH10Release(delayMs: Long, reason: String) {
        h10ReleaseJob?.cancel()
        h10ReleaseJob = scope.launch {
            delay(delayMs)
            if (activeSession == null) releaseAutomaticH10(reason)
        }
    }

    private fun releaseAutomaticH10(reason: String) {
        cancelAutomaticH10Recovery()
        finalizeH10Capture(reason)
        h10BleClient.disconnect()
        LiveDiagnostics.record(this, "h10_auto_released", "reason=$reason")
    }

    private fun cancelAutomaticH10Recovery() {
        automaticH10Requested = false
        h10RetryJob?.cancel()
        h10RetryJob = null
        h10RecoveryPolicy.released()
        approachingSegmentIds.clear()
        lastAutomaticH10State = null
    }

    private fun hasBluetoothConnectPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED

    companion object {
        const val ACTION_ENSURE_RUNNING = "com.gritmap.karoo.service.ENSURE_RUNNING"
        private const val CHANNEL_ID = "gritmap-live-segments"
        private const val NOTIFICATION_ID = 701
        private const val CHECKPOINT_INTERVAL_MS = 30_000L
        private const val INFERENCE_INTERVAL_MS = 10_000L
        private const val LOCATION_DIAGNOSTIC_INTERVAL_MS = 10_000L
        private const val APPROACH_H10_TIMEOUT_MS = 3 * 60_000L
        private const val POST_SEGMENT_H10_GRACE_MS = 2 * 60_000L
    }
}

private data class TelemetryUpdate(
    val sample: LiveTelemetry,
    val sensors: SensorStatus,
)

internal fun enrichLiveMetrics(
    state: LiveUiState,
    session: ActiveAttemptSession,
    sample: LiveTelemetry,
): LiveUiState {
    val elapsedSeconds = ((sample.timestampMs - session.startedAtMs).coerceAtLeast(0L) / 1_000.0)
    val predictedFinish = if (
        elapsedSeconds >= 5.0 && state.progressMeters >= 30.0 && state.progressFraction > 0f
    ) {
        (elapsedSeconds / state.progressFraction).roundToInt().coerceAtMost(24 * 60 * 60)
    } else {
        null
    }
    val rollingPower = (session.recentSamples() + sample)
        .asSequence()
        .filter { it.timestampMs >= sample.timestampMs - THREE_SECOND_WINDOW_MS }
        .distinctBy { it.timestampMs }
        .mapNotNull { it.powerWatts }
        .averageOrNull()
        ?.roundToInt()
        ?.takeIf { state.sensorStatus.power }
    return state.copy(
        currentPowerWatts = sample.powerWatts?.takeIf { state.sensorStatus.power }?.roundToInt(),
        rollingPowerWatts3s = rollingPower,
        currentHeartRateBpm = sample.heartRateBpm
            ?.takeIf { state.sensorStatus.heartRate }
            ?.roundToInt(),
        predictedFinishSeconds = predictedFinish,
        elapsedAttemptSeconds = elapsedSeconds,
        wPrime = session.updateWPrime(sample, state),
    )
}

private fun Sequence<Double>.averageOrNull(): Double? {
    var count = 0
    var sum = 0.0
    for (value in this) {
        sum += value
        count++
    }
    return if (count == 0) null else sum / count
}

internal fun segmentEntryAlert(session: ActiveAttemptSession): InRideAlert {
    val state = session.uiState
    val detail = state.recommendation?.let {
        "${it.targetPowerWatts} W · ${it.instruction}"
    } ?: "${state.totalDistanceMeters.toInt()} m · Open GritMap Pacing Profile"
    return InRideAlert(
        id = "gritmap-segment-${session.attemptId}",
        icon = R.drawable.karoo_ic_extension,
        title = "${state.segmentName.ifBlank { session.segmentId }} started",
        detail = detail,
        autoDismissMs = 4_000L,
        backgroundColor = R.color.gritmap_alert_background,
        textColor = R.color.gritmap_alert_text,
    )
}

internal fun segmentCompletionAlert(session: ActiveAttemptSession, completedAtMs: Long): InRideAlert {
    val elapsedSeconds = ((completedAtMs - session.startedAtMs).coerceAtLeast(0L) / 1_000L).toInt()
    val metrics = buildList {
        add(formatAttemptDuration(elapsedSeconds))
        session.uiState.plannedFinishSeconds?.let { add("Plan ${formatAttemptDuration(it)}") }
        session.averagePowerWatts?.roundToInt()?.let { add("Avg $it W") }
        session.averageHeartRateBpm?.roundToInt()?.let { add("$it bpm") }
        session.planAdherencePct()?.let { add("$it% on plan") }
    }
    return InRideAlert(
        id = "gritmap-complete-${session.attemptId}",
        icon = R.drawable.karoo_ic_extension,
        title = "${session.uiState.segmentName.ifBlank { session.segmentId }} complete",
        detail = metrics.joinToString(" · "),
        autoDismissMs = 8_000L,
        backgroundColor = R.color.gritmap_alert_background,
        textColor = R.color.gritmap_alert_text,
    )
}

internal fun formatAttemptDuration(seconds: Int): String {
    val safe = seconds.coerceAtLeast(0)
    val hours = safe / 3_600
    val minutes = (safe % 3_600) / 60
    val remainingSeconds = safe % 60
    return if (hours > 0) {
        "%d:%02d:%02d".format(hours, minutes, remainingSeconds)
    } else {
        "%d:%02d".format(minutes, remainingSeconds)
    }
}

private fun UserProfile.PreferredUnit.UnitType.toUnitSystem(): UnitSystem =
    if (this == UserProfile.PreferredUnit.UnitType.IMPERIAL) UnitSystem.IMPERIAL else UnitSystem.METRIC

private const val THREE_SECOND_WINDOW_MS = 3_000L

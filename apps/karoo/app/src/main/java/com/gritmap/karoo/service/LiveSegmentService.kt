package com.gritmap.karoo.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.gritmap.karoo.R
import com.gritmap.karoo.data.DatabaseProvider
import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.LiveUiStore
import com.gritmap.karoo.ui.state.SensorStatus
import io.hammerhead.karooext.KarooSystemService
import io.hammerhead.karooext.models.DataType
import io.hammerhead.karooext.models.InRideAlert
import io.hammerhead.karooext.models.OnLocationChanged
import io.hammerhead.karooext.models.OnStreamState
import io.hammerhead.karooext.models.RideState
import io.hammerhead.karooext.models.StreamState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.roundToInt

/**
 * Owns the live in-memory telemetry session. Deterministic matching and AI orchestration plug
 * into [onTelemetry]; no ordinary sensor tick performs a Room write.
 */
class LiveSegmentService : Service() {
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
            diagnostic = { event, details -> LiveDiagnostics.record(this, event, details) },
        )
    }
    private val consumerIds = mutableListOf<String>()
    private var activeSession: ActiveAttemptSession? = null
    private var recording = false
    private var telemetry = LiveTelemetry(timestampMs = 0L)
    private var lastCheckpointMs = 0L
    private var lastInferenceMs = 0L
    private val inferenceInFlight = AtomicBoolean(false)
    private var observingKaroo = false
    private var locationCount = 0L
    private var lastLocationDiagnosticMs = 0L

    override fun onCreate() {
        super.onCreate()
        LiveSegmentServiceDependencies.attemptEventSink =
            RoomAttemptEventSink(DatabaseProvider.get(this))
        createNotificationChannel()
        LiveDiagnostics.record(this, "service_created")
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (LiveServiceStarter.hasLocationPermission(this)) {
            if (!observingKaroo) observeKaroo()
        } else {
            LiveDiagnostics.record(this, "location_permission_missing", "startId=$startId")
        }
        return START_STICKY
    }

    override fun onDestroy() {
        activeSession?.let { session ->
            // Service teardown is a macro-event and must not be cancelled with the live scope.
            runBlocking(Dispatchers.IO) { eventSink.onSegmentExit(session, "service-destroyed") }
        }
        LiveUiStore.clear()
        if (observingKaroo) karooSystem.disconnect()
        scope.cancel()
        LiveDiagnostics.record(this, "service_destroyed")
        super.onDestroy()
    }

    /** Called by the deterministic matcher when a segment is entered. */
    fun beginAttempt(session: ActiveAttemptSession) {
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
        session.accept(telemetry, state)
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
        session.accept(telemetry, session.uiState.copy(matchStatus = finalStatus))
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
        scope.launch(Dispatchers.IO) { eventSink.onSegmentExit(session, reason) }
        LiveUiStore.clear()
    }

    private fun observeKaroo() {
        observingKaroo = true
        karooSystem.connect {
            LiveDiagnostics.record(this, "karoo_connected")
        }
        consumerIds += karooSystem.addConsumer { state: RideState -> onRideState(state) }
        consumerIds += karooSystem.addConsumer { location: OnLocationChanged ->
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
    }

    private fun observeMetric(type: String, field: String, update: (Double?) -> Unit) {
        consumerIds += karooSystem.addConsumer(OnStreamState.StartStreaming(type)) { event: OnStreamState ->
            val value = (event.state as? StreamState.Streaming)?.dataPoint?.values?.get(field)
            update(value)
        }
    }

    private fun onRideState(state: RideState) {
        LiveDiagnostics.record(this, "ride_state", "state=${state.javaClass.simpleName}")
        recording = state is RideState.Recording || state is RideState.Paused
        if (recording) {
            if (!startForegroundCompat()) recording = false
        } else {
            activeSession?.let { finishAttempt("ride-ended") }
            stopForeground(STOP_FOREGROUND_REMOVE)
        }
    }

    private fun onTelemetry() {
        if (!recording) return
        val sensors = SensorFreshness.status(telemetry)
        scope.launch {
            try {
                coordinator.process(telemetry, sensors)
            } catch (error: Exception) {
                LiveDiagnostics.record(
                    this@LiveSegmentService,
                    "telemetry_processing_failed",
                    "type=${error.javaClass.simpleName} message=${error.message}",
                )
            }
        }
    }

    private fun updateAttempt(sample: LiveTelemetry, state: LiveUiState, maxDeviationMeters: Double) {
        val session = activeSession ?: return
        session.recordDeviation(maxDeviationMeters)
        val enriched = enrichLiveMetrics(state, session, sample)
        session.accept(sample, enriched)
        val published = enriched.copy(planAdherencePct = session.planAdherencePct())
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
        LiveUiStore.publish(state)
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
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
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

    companion object {
        private const val CHANNEL_ID = "gritmap-live-segments"
        private const val NOTIFICATION_ID = 701
        private const val CHECKPOINT_INTERVAL_MS = 30_000L
        private const val INFERENCE_INTERVAL_MS = 10_000L
        private const val LOCATION_DIAGNOSTIC_INTERVAL_MS = 10_000L
    }
}

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

private const val THREE_SECOND_WINDOW_MS = 3_000L

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
import com.gritmap.karoo.ui.OverlayWindowHost
import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.LiveUiStore
import com.gritmap.karoo.ui.state.SensorStatus
import io.hammerhead.karooext.KarooSystemService
import io.hammerhead.karooext.models.DataType
import io.hammerhead.karooext.models.OnLocationChanged
import io.hammerhead.karooext.models.OnStreamState
import io.hammerhead.karooext.models.RideState
import io.hammerhead.karooext.models.StreamState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Owns the live in-memory telemetry session. Deterministic matching and AI orchestration plug
 * into [onTelemetry]; no ordinary sensor tick performs a Room write.
 */
class LiveSegmentService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val karooSystem by lazy { KarooSystemService(this) }
    private val overlayHost by lazy { OverlayWindowHost(this) }
    private val eventSink get() = LiveSegmentServiceDependencies.attemptEventSink
    private val pacingEngine get() = LiveSegmentServiceDependencies.pacingGuidanceEngine
    private val coordinator by lazy {
        LiveSegmentCoordinator(
            database = DatabaseProvider.get(this),
            begin = ::beginAttempt,
            update = ::updateAttempt,
            finish = ::finishAttempt,
        )
    }
    private val consumerIds = mutableListOf<String>()
    private var activeSession: ActiveAttemptSession? = null
    private var recording = false
    private var telemetry = LiveTelemetry(timestampMs = 0L)
    private var lastCheckpointMs = 0L
    private var lastInferenceMs = 0L
    private val inferenceInFlight = AtomicBoolean(false)

    override fun onCreate() {
        super.onCreate()
        LiveSegmentServiceDependencies.attemptEventSink =
            RoomAttemptEventSink(DatabaseProvider.get(this))
        createNotificationChannel()
        observeKaroo()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        activeSession?.let { session ->
            // Service teardown is a macro-event and must not be cancelled with the live scope.
            runBlocking(Dispatchers.IO) { eventSink.onSegmentExit(session, "service-destroyed") }
        }
        overlayHost.hide()
        LiveUiStore.clear()
        karooSystem.disconnect()
        scope.cancel()
        super.onDestroy()
    }

    /** Called by the deterministic matcher when a segment is entered. */
    fun beginAttempt(session: ActiveAttemptSession) {
        activeSession = session
        lastCheckpointMs = session.startedAtMs
        lastInferenceMs = session.startedAtMs
        publish(session.uiState)
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
        val finalStatus = if (reason == "completed") {
            com.gritmap.karoo.ui.state.MatchStatus.COMPLETE
        } else {
            com.gritmap.karoo.ui.state.MatchStatus.ABANDONED
        }
        session.accept(telemetry, session.uiState.copy(matchStatus = finalStatus))
        activeSession = null
        lastInferenceMs = 0L
        scope.launch(Dispatchers.IO) { eventSink.onSegmentExit(session, reason) }
        scope.launch(Dispatchers.Main.immediate) { overlayHost.hide() }
        LiveUiStore.clear()
    }

    private fun observeKaroo() {
        karooSystem.connect()
        consumerIds += karooSystem.addConsumer { state: RideState -> onRideState(state) }
        consumerIds += karooSystem.addConsumer { location: OnLocationChanged ->
            val now = System.currentTimeMillis()
            telemetry = telemetry.copy(
                timestampMs = now,
                lat = location.lat,
                lng = location.lng,
                gpsUpdatedAtMs = now,
            )
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
        recording = state is RideState.Recording || state is RideState.Paused
        if (recording) {
            startForegroundCompat()
        } else {
            activeSession?.let { finishAttempt("ride-ended") }
            stopForeground(STOP_FOREGROUND_REMOVE)
        }
    }

    private fun onTelemetry() {
        if (!recording) return
        val sensors = SensorFreshness.status(telemetry)
        scope.launch {
            coordinator.process(telemetry, sensors)
        }
    }

    private fun updateAttempt(sample: LiveTelemetry, state: LiveUiState, maxDeviationMeters: Double) {
        val session = activeSession ?: return
        session.recordDeviation(maxDeviationMeters)
        session.accept(sample, state)
        publish(state)
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
        scope.launch(Dispatchers.Main.immediate) { overlayHost.show(state) }
    }

    private fun startForegroundCompat() {
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.karoo_ic_extension)
            .setContentTitle(getString(R.string.karoo_extension_name))
            .setContentText("Live segment matching active")
            .setOngoing(true)
            .build()
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
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
    }
}

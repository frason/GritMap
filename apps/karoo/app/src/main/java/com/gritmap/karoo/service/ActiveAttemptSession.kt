package com.gritmap.karoo.service

import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.pacing.CardiacDriftSnapshot
import com.gritmap.karoo.pacing.CardiacDriftTracker
import com.gritmap.karoo.pacing.WPrimeEngine
import com.gritmap.karoo.pacing.WPrimeParameters
import com.gritmap.karoo.ui.state.PowerExecutionSample
import com.gritmap.karoo.ui.state.WPrimePoint
import com.gritmap.karoo.ui.state.WPrimeState
import java.util.ArrayDeque

data class LiveTelemetry(
    val timestampMs: Long,
    val lat: Double? = null,
    val lng: Double? = null,
    val elevationMeters: Double? = null,
    val powerWatts: Double? = null,
    val heartRateBpm: Double? = null,
    val cadenceRpm: Double? = null,
    val speedMetersPerSecond: Double? = null,
    val gpsUpdatedAtMs: Long? = null,
    val elevationUpdatedAtMs: Long? = null,
    val powerUpdatedAtMs: Long? = null,
    val heartRateUpdatedAtMs: Long? = null,
    val cadenceUpdatedAtMs: Long? = null,
    val speedUpdatedAtMs: Long? = null,
) {
    /** Remove retained sensor values once freshness says they are unavailable. */
    fun sanitized(status: com.gritmap.karoo.ui.state.SensorStatus): LiveTelemetry = copy(
        lat = lat.takeIf { status.gps },
        lng = lng.takeIf { status.gps },
        elevationMeters = elevationMeters.takeIf { status.elevation },
        powerWatts = powerWatts.takeIf { status.power },
        heartRateBpm = heartRateBpm.takeIf { status.heartRate },
        cadenceRpm = cadenceRpm.takeIf { status.cadence },
        speedMetersPerSecond = speedMetersPerSecond.takeIf { status.speed },
    )
}

object SensorFreshness {
    const val MAX_AGE_MS = 3_000L

    fun status(sample: LiveTelemetry, nowMs: Long = sample.timestampMs) =
        com.gritmap.karoo.ui.state.SensorStatus(
            gps = sample.lat != null && sample.lng != null && fresh(sample.gpsUpdatedAtMs, nowMs),
            power = sample.powerWatts != null && fresh(sample.powerUpdatedAtMs, nowMs),
            heartRate = sample.heartRateBpm != null && fresh(sample.heartRateUpdatedAtMs, nowMs),
            cadence = sample.cadenceRpm != null && fresh(sample.cadenceUpdatedAtMs, nowMs),
            speed = sample.speedMetersPerSecond != null && fresh(sample.speedUpdatedAtMs, nowMs),
            elevation = sample.elevationMeters != null && fresh(sample.elevationUpdatedAtMs, nowMs),
        )

    private fun fresh(updatedAtMs: Long?, nowMs: Long) =
        updatedAtMs != null && nowMs - updatedAtMs in 0..MAX_AGE_MS
}

/**
 * Mutable, service-owned state for an active traversal. Samples are never persisted at 1 Hz.
 * Values older than [retentionMs] are folded into constant-space aggregates.
 */
class ActiveAttemptSession(
    val attemptId: String,
    val segmentId: String,
    val startedAtMs: Long,
    initialUiState: LiveUiState,
    val ftpWatts: Int? = null,
    val pacingPlanId: String? = null,
    private val retentionMs: Long = 120_000L,
) {
    private val samples = ArrayDeque<LiveTelemetry>()
    var uiState: LiveUiState = initialUiState
        private set

    var totalSampleCount: Long = 0
        private set
    var powerSampleCount: Long = 0
        private set
    var powerSumWatts: Double = 0.0
        private set
    var maxDeviationMeters: Double = 0.0
        private set
    private var heartRateCount = 0L
    private var heartRateSum = 0.0
    private var cadenceCount = 0L
    private var cadenceSum = 0.0
    private var speedCount = 0L
    private var speedSum = 0.0
    private var pacingSampleCount = 0L
    private var pacingSampleInRangeCount = 0L
    private val cardiacDriftTracker = CardiacDriftTracker()
    private val powerExecutionHistory = ArrayDeque<PowerExecutionSample>()
    private val wPrimeHistory = ArrayDeque<WPrimePoint>()
    private val wPrimeEngine = ftpWatts?.takeIf { it > 0 }?.let {
        WPrimeEngine(WPrimeParameters.estimatedFromFtp(it))
    }
    private var lastRecordedTimestampMs: Long? = null

    /** Records exactly one physical telemetry tick. UI or plan changes must not call this. */
    fun recordTelemetryTick(sample: LiveTelemetry, stateAtTick: LiveUiState = uiState): Boolean {
        if (sample.timestampMs == lastRecordedTimestampMs) return false
        lastRecordedTimestampMs = sample.timestampMs
        samples.addLast(sample)
        totalSampleCount++
        sample.powerWatts?.let { power ->
            powerSampleCount++
            powerSumWatts += power
            stateAtTick.recommendation?.targetPowerWatts?.takeIf {
                stateAtTick.sensorStatus.power
            }?.let { target ->
                pacingSampleCount++
                val tolerance = maxOf(15.0, target * 0.1)
                if (kotlin.math.abs(power - target) <= tolerance) pacingSampleInRangeCount++
                recordPowerExecution(
                    PowerExecutionSample(
                        distanceMeters = stateAtTick.progressMeters,
                        actualWatts = stateAtTick.rollingPowerWatts3s ?: power.toInt(),
                        targetWatts = target,
                    ),
                )
            }
        }
        sample.heartRateBpm?.let { heartRateCount++; heartRateSum += it }
        sample.cadenceRpm?.let { cadenceCount++; cadenceSum += it }
        sample.speedMetersPerSecond?.let { speedCount++; speedSum += it }
        val cutoff = sample.timestampMs - retentionMs
        while (samples.isNotEmpty() && samples.first().timestampMs < cutoff) samples.removeFirst()
        return true
    }

    fun recordDeviation(value: Double) {
        if (value.isFinite()) maxDeviationMeters = maxOf(maxDeviationMeters, value)
    }

    fun recentSamples(): List<LiveTelemetry> = samples.toList()

    fun powerExecutionSamples(): List<PowerExecutionSample> = powerExecutionHistory.toList()

    fun updateUiState(value: LiveUiState) {
        uiState = value
    }

    fun recordCardiacDrift(sample: LiveTelemetry, progressFraction: Float): CardiacDriftSnapshot =
        cardiacDriftTracker.add(sample, progressFraction)

    fun updateWPrime(sample: LiveTelemetry, state: LiveUiState): WPrimeState? {
        val engine = wPrimeEngine ?: return null
        val power = sample.powerWatts?.takeIf { state.sensorStatus.power } ?: return state.wPrime
        engine.update(sample.timestampMs, power)
        var snapshot = engine.stateForPlan(
            state.progressMeters,
            state.totalDistanceMeters,
            state.plannedFinishSeconds,
            state.pacingZones,
            wPrimeHistory.toList(),
            power,
            state.recommendation?.targetPowerWatts?.toDouble(),
        )
        val point = WPrimePoint(
            state.progressFraction,
            snapshot.actualRemainingPct,
            snapshot.plannedRemainingPct,
        )
        val previous = wPrimeHistory.lastOrNull()
        if (previous == null || point.progressFraction - previous.progressFraction >= 0.005f) {
            wPrimeHistory.addLast(point)
            while (wPrimeHistory.size > MAX_W_PRIME_SAMPLES) wPrimeHistory.removeFirst()
            snapshot = snapshot.copy(history = wPrimeHistory.toList())
        }
        return snapshot
    }

    fun planAdherencePct(): Int? = if (pacingSampleCount == 0L) null else {
        (pacingSampleInRangeCount * 100.0 / pacingSampleCount).toInt().coerceIn(0, 100)
    }

    private fun recordPowerExecution(sample: PowerExecutionSample) {
        val previous = powerExecutionHistory.lastOrNull()
        if (previous != null && sample.distanceMeters <= previous.distanceMeters) return
        if (previous != null && sample.distanceMeters - previous.distanceMeters < 3.0) return
        powerExecutionHistory.addLast(sample)
        while (powerExecutionHistory.size > MAX_EXECUTION_SAMPLES) powerExecutionHistory.removeFirst()
    }

    val averagePowerWatts: Double?
        get() = if (powerSampleCount == 0L) null else powerSumWatts / powerSampleCount

    val averageHeartRateBpm: Double?
        get() = if (heartRateCount == 0L) null else heartRateSum / heartRateCount

    val averageCadenceRpm: Double?
        get() = if (cadenceCount == 0L) null else cadenceSum / cadenceCount

    val averageSpeedMetersPerSecond: Double?
        get() = if (speedCount == 0L) null else speedSum / speedCount

    companion object {
        private const val MAX_EXECUTION_SAMPLES = 600
        private const val MAX_W_PRIME_SAMPLES = 240
    }
}

interface AttemptEventSink {
    suspend fun onSegmentEntry(session: ActiveAttemptSession)
    suspend fun onPlanChanged(session: ActiveAttemptSession)
    suspend fun onCheckpoint(session: ActiveAttemptSession)
    suspend fun onSegmentExit(session: ActiveAttemptSession, reason: String)
}

object NoOpAttemptEventSink : AttemptEventSink {
    override suspend fun onSegmentEntry(session: ActiveAttemptSession) = Unit
    override suspend fun onPlanChanged(session: ActiveAttemptSession) = Unit
    override suspend fun onCheckpoint(session: ActiveAttemptSession) = Unit
    override suspend fun onSegmentExit(session: ActiveAttemptSession, reason: String) = Unit
}

/** App startup may replace this with a Room-backed macro-event sink. */
object LiveSegmentServiceDependencies {
    @Volatile
    var attemptEventSink: AttemptEventSink = NoOpAttemptEventSink

    @Volatile
    var pacingGuidanceEngine: LivePacingGuidanceEngine? = null
}

package com.gritmap.karoo.service

import com.gritmap.karoo.ui.state.LiveUiState
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
)

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

    fun accept(sample: LiveTelemetry, updatedUiState: LiveUiState = uiState) {
        samples.addLast(sample)
        totalSampleCount++
        sample.powerWatts?.let {
            powerSampleCount++
            powerSumWatts += it
        }
        sample.heartRateBpm?.let { heartRateCount++; heartRateSum += it }
        sample.cadenceRpm?.let { cadenceCount++; cadenceSum += it }
        sample.speedMetersPerSecond?.let { speedCount++; speedSum += it }
        val cutoff = sample.timestampMs - retentionMs
        while (samples.isNotEmpty() && samples.first().timestampMs < cutoff) samples.removeFirst()
        uiState = updatedUiState
    }

    fun recordDeviation(value: Double) {
        if (value.isFinite()) maxDeviationMeters = maxOf(maxDeviationMeters, value)
    }

    fun recentSamples(): List<LiveTelemetry> = samples.toList()

    val averagePowerWatts: Double?
        get() = if (powerSampleCount == 0L) null else powerSumWatts / powerSampleCount

    val averageHeartRateBpm: Double?
        get() = if (heartRateCount == 0L) null else heartRateSum / heartRateCount

    val averageCadenceRpm: Double?
        get() = if (cadenceCount == 0L) null else cadenceSum / cadenceCount

    val averageSpeedMetersPerSecond: Double?
        get() = if (speedCount == 0L) null else speedSum / speedCount
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

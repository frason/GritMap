package com.gritmap.karoo.matching

import com.gritmap.karoo.domain.TelemetrySample
import java.util.ArrayDeque

data class AggregateMetrics(
    val sampleCount: Long,
    val averagePowerWatts: Double?,
    val averageHeartRateBpm: Double?,
    val averageCadenceRpm: Double?,
    val averageSpeedMetersPerSecond: Double?,
)

class ActiveAttemptSession(private val rollingWindowMs: Long = 120_000) {
    private val rolling = ArrayDeque<TelemetrySample>()
    private var count = 0L
    private var powerCount = 0L; private var powerSum = 0.0
    private var heartRateCount = 0L; private var heartRateSum = 0.0
    private var cadenceCount = 0L; private var cadenceSum = 0.0
    private var speedCount = 0L; private var speedSum = 0.0

    val rollingSamples: List<TelemetrySample> get() = rolling.toList()

    fun add(sample: TelemetrySample) {
        rolling.addLast(sample); count++
        sample.powerWatts?.let { powerSum += it; powerCount++ }
        sample.heartRateBpm?.let { heartRateSum += it; heartRateCount++ }
        sample.cadenceRpm?.let { cadenceSum += it; cadenceCount++ }
        sample.speedMetersPerSecond?.let { speedSum += it; speedCount++ }
        val cutoff = sample.timestampMs - rollingWindowMs
        while (rolling.isNotEmpty() && rolling.first.timestampMs < cutoff) rolling.removeFirst()
    }

    fun aggregates() = AggregateMetrics(count,
        powerSum.averageOrNull(powerCount), heartRateSum.averageOrNull(heartRateCount),
        cadenceSum.averageOrNull(cadenceCount), speedSum.averageOrNull(speedCount))

    private fun Double.averageOrNull(n: Long): Double? = if (n == 0L) null else this / n
}

sealed interface PersistenceEvent {
    data object SegmentEntry : PersistenceEvent
    data object FullPlanCreated : PersistenceEvent
    data object RecommendationChanged : PersistenceEvent
    data object RecoveryCheckpoint : PersistenceEvent
    data object SegmentExit : PersistenceEvent
    data object RideTerminated : PersistenceEvent
    data object ServiceShutdown : PersistenceEvent
    data object TelemetryTick : PersistenceEvent
    data object UnchangedInference : PersistenceEvent
}

object AttemptWritePolicy {
    fun shouldWrite(event: PersistenceEvent): Boolean = when (event) {
        PersistenceEvent.SegmentEntry,
        PersistenceEvent.FullPlanCreated,
        PersistenceEvent.RecommendationChanged,
        PersistenceEvent.RecoveryCheckpoint,
        PersistenceEvent.SegmentExit,
        PersistenceEvent.RideTerminated,
        PersistenceEvent.ServiceShutdown -> true
        PersistenceEvent.TelemetryTick,
        PersistenceEvent.UnchangedInference -> false
    }
}


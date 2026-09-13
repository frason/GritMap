package com.gritmap.karoo.pacing

import com.gritmap.karoo.service.LiveTelemetry
import com.gritmap.karoo.ui.state.CardiacDriftSample
import java.util.ArrayDeque

data class CardiacDriftSnapshot(
    val driftPct: Double?,
    val history: List<CardiacDriftSample>,
)

/**
 * Live power-to-HR efficiency trend. This is intentionally labelled drift rather than formal
 * aerobic decoupling: short segments and HR response lag limit physiological interpretation.
 */
class CardiacDriftTracker(
    private val baselineDurationMs: Long = 45_000L,
    private val rollingWindowMs: Long = 30_000L,
    private val maximumHistorySamples: Int = 180,
) {
    private data class PairSample(val timestampMs: Long, val powerWatts: Double, val heartRateBpm: Double)

    private val rollingSamples = ArrayDeque<PairSample>()
    private val history = ArrayDeque<CardiacDriftSample>()
    private var firstValidTimestampMs: Long? = null
    private var lastTimestampMs: Long? = null
    private var baselineEfficiency: Double? = null

    fun add(sample: LiveTelemetry, progressFraction: Float): CardiacDriftSnapshot {
        val power = sample.powerWatts?.takeIf { it.isFinite() && it >= 0.0 }
        val heartRate = sample.heartRateBpm?.takeIf { it.isFinite() && it > 0.0 }
        if (power == null || heartRate == null || sample.timestampMs == lastTimestampMs) return snapshot()
        lastTimestampMs = sample.timestampMs
        val paired = PairSample(sample.timestampMs, power, heartRate)
        val first = firstValidTimestampMs ?: sample.timestampMs.also { firstValidTimestampMs = it }

        rollingSamples.addLast(paired)
        val cutoff = sample.timestampMs - rollingWindowMs
        while (rollingSamples.isNotEmpty() && rollingSamples.first().timestampMs < cutoff) {
            rollingSamples.removeFirst()
        }

        // Wait for HR response, then freeze the first complete rolling window as baseline.
        if (baselineEfficiency == null && sample.timestampMs - first >= baselineDurationMs) {
            baselineEfficiency = efficiency(rollingSamples)
        }

        val baseline = baselineEfficiency
        val current = efficiency(rollingSamples)
        if (baseline != null && current != null && baseline > 0.0) {
            val drift = ((baseline - current) / baseline * 100.0).coerceIn(-25.0, 25.0)
            history.addLast(CardiacDriftSample(progressFraction.coerceIn(0f, 1f), drift))
            while (history.size > maximumHistorySamples) history.removeFirst()
        }
        return snapshot()
    }

    private fun snapshot() = CardiacDriftSnapshot(history.lastOrNull()?.driftPct, history.toList())

    private fun efficiency(samples: Collection<PairSample>): Double? {
        if (samples.isEmpty()) return null
        val averageHeartRate = samples.sumOf { it.heartRateBpm } / samples.size
        if (averageHeartRate <= 0.0) return null
        return (samples.sumOf { it.powerWatts } / samples.size) / averageHeartRate
    }
}

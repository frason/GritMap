package com.gritmap.karoo.pacing

import com.gritmap.karoo.service.LiveTelemetry
import com.gritmap.karoo.ui.state.CardiacDriftSample
import java.util.ArrayDeque
import kotlin.math.pow

data class CardiacDriftSnapshot(
    val driftPct: Double?,
    val history: List<CardiacDriftSample>,
    val efficiencyWattsPerBpm: Double?,
    val driftRatePctPer10Min: Double?,
    val validSeconds: Int,
    val pairedPct: Int,
    val powerSteady: Boolean,
)

/**
 * Live power-to-HR efficiency trend. This is intentionally labelled drift rather than formal
 * aerobic decoupling: short segments and HR response lag limit physiological interpretation.
 */
class CardiacDriftTracker(
    private val baselineDurationMs: Long = 180_000L,
    private val rollingWindowMs: Long = 120_000L,
    private val minimumWindowSamples: Int = 60,
    private val minimumPowerWatts: Double = 100.0,
    private val minimumHeartRateBpm: Double = 80.0,
    private val historyIntervalMs: Long = 15_000L,
    private val smoothingAlpha: Double = 0.05,
    private val deadbandPct: Double = 0.3,
    private val gapResetMs: Long = 10_000L,
    private val maximumHistorySamples: Int = 180,
) {
    private data class PairSample(val timestampMs: Long, val powerWatts: Double, val heartRateBpm: Double)

    private val rollingSamples = ArrayDeque<PairSample>()
    private val history = ArrayDeque<CardiacDriftSample>()
    private var firstValidTimestampMs: Long? = null
    private var lastTimestampMs: Long? = null
    private var lastHistoryTimestampMs: Long? = null
    private var baselineEfficiency: Double? = null
    private var baselinePower: Double? = null
    private var baselineHeartRate: Double? = null
    private var responsePower: Double? = null
    private var responseHeartRate: Double? = null
    private var smoothedDriftPct: Double? = null
    private var invalidSinceMs: Long? = null
    private var pairedTimeMs = 0L
    private var lastPairedTimestampMs: Long? = null
    private var totalSamples = 0
    private var pairedSamples = 0

    fun add(sample: LiveTelemetry, progressFraction: Float): CardiacDriftSnapshot {
        if (lastTimestampMs?.let { sample.timestampMs <= it } == true) return snapshot()
        val previousTimestamp = lastTimestampMs
        lastTimestampMs = sample.timestampMs
        totalSamples++
        if (previousTimestamp != null && sample.timestampMs - previousTimestamp > gapResetMs) {
            rollingSamples.clear(); history.clear()
            firstValidTimestampMs = null; lastHistoryTimestampMs = null
            baselineEfficiency = null; baselinePower = null; baselineHeartRate = null
            responsePower = null; responseHeartRate = null; smoothedDriftPct = null
            lastPairedTimestampMs = null; pairedTimeMs = 0L
            totalSamples = 1; pairedSamples = 0
        }

        // Coasting, stops, and implausibly low HR make instantaneous power/HR efficiency
        // meaningless and were the main source of large live spikes.
        val power = sample.powerWatts?.takeIf { it.isFinite() && it >= minimumPowerWatts }
        val heartRate = sample.heartRateBpm?.takeIf { it.isFinite() && it >= minimumHeartRateBpm }
        val cutoff = sample.timestampMs - rollingWindowMs
        while (rollingSamples.isNotEmpty() && rollingSamples.first().timestampMs < cutoff) rollingSamples.removeFirst()
        if (power == null || heartRate == null) {
            val invalidStart = invalidSinceMs ?: sample.timestampMs.also { invalidSinceMs = it }
            if (sample.timestampMs - invalidStart > gapResetMs) {
                rollingSamples.clear(); history.clear(); firstValidTimestampMs = null
                baselineEfficiency = null; baselinePower = null; baselineHeartRate = null
                responsePower = null; responseHeartRate = null; smoothedDriftPct = null
                lastHistoryTimestampMs = null; pairedTimeMs = 0L
            }
            lastPairedTimestampMs = null
            if (rollingSamples.size < minimumWindowSamples) smoothedDriftPct = null
            return snapshot()
        }
        invalidSinceMs = null
        lastPairedTimestampMs?.let { pairedTimeMs += (sample.timestampMs - it).coerceIn(0L, 2_000L) }
        lastPairedTimestampMs = sample.timestampMs
        pairedSamples++
        val paired = PairSample(sample.timestampMs, power, heartRate)
        val first = firstValidTimestampMs ?: sample.timestampMs.also { firstValidTimestampMs = it }

        rollingSamples.addLast(paired)
        while (rollingSamples.isNotEmpty() && rollingSamples.first().timestampMs < cutoff) {
            rollingSamples.removeFirst()
        }

        // Wait for HR response, then freeze the first complete rolling window as baseline.
        if (baselineEfficiency == null && pairedTimeMs >= baselineDurationMs &&
            rollingSamples.size >= minimumWindowSamples && powerCoefficientOfVariation(rollingSamples) <= 0.12
        ) {
            baselineEfficiency = efficiency(rollingSamples)
            baselinePower = averagePower(rollingSamples)
            baselineHeartRate = averageHeartRate(rollingSamples)
        }

        val baseline = baselineEfficiency
        val current = if (rollingSamples.size >= minimumWindowSamples) efficiency(rollingSamples) else null
        if (current != null && responsePower == null) {
            responsePower = averagePower(rollingSamples)
            responseHeartRate = averageHeartRate(rollingSamples)
        }
        val comparablePower = baselinePower?.let {
            it > 0.0 && kotlin.math.abs(averagePower(rollingSamples) / it - 1.0) <= 0.15
        } == true
        if (baseline != null && current != null && baseline > 0.0 && comparablePower &&
            powerCoefficientOfVariation(rollingSamples) <= 0.12) {
            val raw = ((baseline - current) / baseline * 100.0).coerceIn(-25.0, 25.0)
            val previous = smoothedDriftPct
            val smoothed = if (previous == null) raw else previous + (1.0 - (1.0 - smoothingAlpha).pow(
                ((sample.timestampMs - (previousTimestamp ?: sample.timestampMs)) / 1000.0).coerceAtLeast(0.0))) * (raw - previous)
            val stable = if (kotlin.math.abs(smoothed) < deadbandPct) 0.0 else smoothed
            smoothedDriftPct = stable
        } else if (baseline != null) {
            smoothedDriftPct = null
        }
        val responsePowerValue = responsePower
        val responseHeartRateValue = responseHeartRate
        val lastHistory = lastHistoryTimestampMs
        if (current != null && responsePowerValue != null && responseHeartRateValue != null &&
            (lastHistory == null || sample.timestampMs - lastHistory >= historyIntervalMs)
        ) {
            val powerIndex = averagePower(rollingSamples) / responsePowerValue.coerceAtLeast(1.0) * 100.0
            val heartRateIndex = averageHeartRate(rollingSamples) / responseHeartRateValue.coerceAtLeast(1.0) * 100.0
            val responseDrift = 100.0 - powerIndex / heartRateIndex.coerceAtLeast(1.0) * 100.0
            val elapsedSeconds = ((sample.timestampMs - first) / 1_000L).toInt().coerceAtLeast(0)
            history.addLast(
                CardiacDriftSample(
                    progressFraction = progressFraction.coerceIn(0f, 1f),
                    driftPct = smoothedDriftPct ?: responseDrift,
                    elapsedSeconds = elapsedSeconds,
                    powerIndex = powerIndex,
                    heartRateIndex = heartRateIndex,
                ),
            )
            lastHistoryTimestampMs = sample.timestampMs
            while (history.size > maximumHistorySamples) history.removeFirst()
        }
        return snapshot()
    }

    private fun snapshot(): CardiacDriftSnapshot {
        val samples = rollingSamples.toList()
        val efficiency = if (samples.size >= minimumWindowSamples) efficiency(samples) else null
        val historyList = history.toList()
        val rate = if (historyList.size >= 2) {
            val first = historyList.first()
            val last = historyList.last()
            val minutes = (last.elapsedSeconds - first.elapsedSeconds) / 60.0
            if (minutes > 0.0) (last.driftPct - first.driftPct) / minutes * 10.0 else null
        } else null
        val validSeconds = (pairedTimeMs / 1_000L).toInt()
        val pairedPct = if (totalSamples == 0) 0 else (pairedSamples * 100 / totalSamples).coerceIn(0, 100)
        return CardiacDriftSnapshot(
            driftPct = smoothedDriftPct,
            history = historyList,
            efficiencyWattsPerBpm = efficiency,
            driftRatePctPer10Min = rate,
            validSeconds = validSeconds,
            pairedPct = pairedPct,
            powerSteady = powerCoefficientOfVariation(samples) <= 0.12,
        )
    }

    private fun efficiency(samples: Collection<PairSample>): Double? {
        if (samples.isEmpty()) return null
        val averageHeartRate = samples.sumOf { it.heartRateBpm } / samples.size
        if (averageHeartRate <= 0.0) return null
        return (samples.sumOf { it.powerWatts } / samples.size) / averageHeartRate
    }

    private fun averagePower(samples: Collection<PairSample>): Double =
        samples.sumOf { it.powerWatts } / samples.size.coerceAtLeast(1)

    private fun averageHeartRate(samples: Collection<PairSample>): Double =
        samples.sumOf { it.heartRateBpm } / samples.size.coerceAtLeast(1)

    private fun powerCoefficientOfVariation(samples: Collection<PairSample>): Double {
        if (samples.size < minimumWindowSamples) return Double.POSITIVE_INFINITY
        val mean = averagePower(samples)
        if (mean <= 0.0) return Double.POSITIVE_INFINITY
        val variance = samples.sumOf { (it.powerWatts - mean) * (it.powerWatts - mean) } / samples.size
        return kotlin.math.sqrt(variance) / mean
    }
}

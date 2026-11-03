package com.gritmap.karoo.pacing

import com.gritmap.karoo.service.LiveTelemetry
import com.gritmap.karoo.ui.state.CardiacDriftSample
import com.gritmap.karoo.ui.state.CardiacBaselineState
import com.gritmap.karoo.ui.state.CardiacReadiness
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
    val baselineState: CardiacBaselineState,
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
    private companion object {
        const val MAXIMUM_POWER_CV = 0.12
        const val MAXIMUM_RELATIVE_POWER_CHANGE = 0.15
    }

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
    private var inputReadiness: CardiacReadiness? = null
    private var restartCount = 0
    private var restartedAtMs: Long? = null
    private var establishedAtMs: Long? = null

    private fun recordReset(timestampMs: Long) {
        // The old invalid-input path clears on every tick after ten seconds. Notify once,
        // only when actual progress/reference is discarded, rather than restarting forever.
        if (rollingSamples.isNotEmpty() || pairedTimeMs > 0 || baselineEfficiency != null) {
            restartCount++
            restartedAtMs = timestampMs
        }
        establishedAtMs = null
    }

    fun add(sample: LiveTelemetry, progressFraction: Float): CardiacDriftSnapshot {
        if (lastTimestampMs?.let { sample.timestampMs <= it } == true) return snapshot()
        val previousTimestamp = lastTimestampMs
        lastTimestampMs = sample.timestampMs
        totalSamples++
        if (previousTimestamp != null && sample.timestampMs - previousTimestamp > gapResetMs) {
            recordReset(sample.timestampMs)
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
        inputReadiness = when {
            sample.powerWatts?.isFinite() != true -> CardiacReadiness.NO_POWER
            sample.heartRateBpm?.isFinite() != true -> CardiacReadiness.NO_HR
            power == null -> CardiacReadiness.LOW_POWER
            heartRate == null -> CardiacReadiness.LOW_HR
            else -> null
        }
        val cutoff = sample.timestampMs - rollingWindowMs
        while (rollingSamples.isNotEmpty() && rollingSamples.first().timestampMs < cutoff) rollingSamples.removeFirst()
        if (power == null || heartRate == null) {
            val invalidStart = invalidSinceMs ?: sample.timestampMs.also { invalidSinceMs = it }
            if (sample.timestampMs - invalidStart > gapResetMs) {
                recordReset(sample.timestampMs)
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
            rollingSamples.size >= minimumWindowSamples && powerCoefficientOfVariation(rollingSamples) <= MAXIMUM_POWER_CV
        ) {
            baselineEfficiency = efficiency(rollingSamples)
            establishedAtMs = sample.timestampMs
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
            it > 0.0 && kotlin.math.abs(averagePower(rollingSamples) / it - 1.0) <= MAXIMUM_RELATIVE_POWER_CHANGE
        } == true
        if (baseline != null && current != null && baseline > 0.0 && comparablePower &&
            powerCoefficientOfVariation(rollingSamples) <= MAXIMUM_POWER_CV) {
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
            powerSteady = powerCoefficientOfVariation(samples) <= MAXIMUM_POWER_CV,
            baselineState = baselineState(samples),
        )
    }

    private fun baselineState(samples: Collection<PairSample>): CardiacBaselineState {
        val established = baselineEfficiency != null
        val reason = inputReadiness ?: when {
            samples.size < minimumWindowSamples -> CardiacReadiness.MORE_SAMPLES
            powerCoefficientOfVariation(samples) > MAXIMUM_POWER_CV -> CardiacReadiness.VARIABLE_POWER
            !established -> CardiacReadiness.COLLECTING
            baselinePower?.let { kotlin.math.abs(averagePower(samples) / it - 1.0) > MAXIMUM_RELATIVE_POWER_CHANGE } == true ->
                CardiacReadiness.DIFFERENT_EFFORT
            else -> CardiacReadiness.READY
        }
        val now = lastTimestampMs ?: 0L
        fun recent(timestamp: Long?) = timestamp?.let { now - it in 0 until 5_000L } == true
        return CardiacBaselineState(
            remainingSeconds = ((baselineDurationMs - pairedTimeMs).coerceAtLeast(0L)
                .let { (it + 999L) / 1_000L }).toInt(),
            established = established,
            readiness = reason,
            restartCount = restartCount,
            justRestarted = recent(restartedAtMs),
            justEstablished = established && recent(establishedAtMs),
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

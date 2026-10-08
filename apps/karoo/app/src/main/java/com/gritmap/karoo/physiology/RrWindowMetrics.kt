package com.gritmap.karoo.physiology

import kotlin.math.sqrt

data class RrWindowMetrics(
    val validSampleCount: Int,
    val meanRrMs: Double,
    val heartRateFromRrBpm: Double,
    val rmssdMs: Double?,
    val sdnnMs: Double?,
    val dfaAlpha1: Double?,
)

/** Diagnostic statistics only; these values are not medical conclusions or pacing authority. */
object RrWindowMetricsCalculator {
    fun calculate(observations: List<RrObservation>): RrWindowMetrics? {
        val intervals = observations.asSequence()
            .filter { it.valid }
            .map { it.rrIntervalMs.toDouble() }
            .toList()
        if (intervals.isEmpty()) return null
        val mean = intervals.average()
        val consecutiveSquaredDifferences = observations.zipWithNext().mapNotNull { (first, second) ->
            if (!first.valid || !second.valid) return@mapNotNull null
            val difference = second.rrIntervalMs.toDouble() - first.rrIntervalMs.toDouble()
            difference * difference
        }
        val rmssd = if (consecutiveSquaredDifferences.isNotEmpty()) {
            sqrt(consecutiveSquaredDifferences.average())
        } else {
            null
        }
        val sdnn = if (intervals.size >= 2) {
            val squaredDeviations = intervals.sumOf { value ->
                val difference = value - mean
                difference * difference
            }
            sqrt(squaredDeviations / (intervals.size - 1))
        } else {
            null
        }
        return RrWindowMetrics(
            validSampleCount = intervals.size,
            meanRrMs = mean,
            heartRateFromRrBpm = 60_000.0 / mean,
            rmssdMs = rmssd,
            sdnnMs = sdnn,
            dfaAlpha1 = DfaAlpha1Calculator.calculate(observations),
        )
    }
}

/**
 * Short-term detrended fluctuation exponent over the latest approximately two-minute RR window.
 * Invalid beats break the usable suffix: the calculation never bridges a known dropout.
 */
object DfaAlpha1Calculator {
    private const val MINIMUM_DURATION_MS = 110_000L
    private const val MINIMUM_INTERVALS = 100

    fun calculate(observations: List<RrObservation>): Double? {
        val lastInvalid = observations.indexOfLast { !it.valid }
        val clean = observations.drop(lastInvalid + 1).filter { it.valid }
        if (clean.size < MINIMUM_INTERVALS) return null
        if (clean.last().elapsedMs - clean.first().elapsedMs < MINIMUM_DURATION_MS) return null

        val values = clean.map { it.rrInterval1024.toDouble() / 1024.0 }
        val mean = values.average()
        var running = 0.0
        val integrated = DoubleArray(values.size) { index ->
            running += values[index] - mean
            running
        }
        val points = (4..16).mapNotNull { scale ->
            val fluctuation = fluctuation(integrated, scale)
            fluctuation?.takeIf { it > 0.0 && it.isFinite() }?.let {
                kotlin.math.ln(scale.toDouble()) to kotlin.math.ln(it)
            }
        }
        if (points.size < 4) return null
        val xMean = points.map { it.first }.average()
        val yMean = points.map { it.second }.average()
        val denominator = points.sumOf { (x, _) -> (x - xMean) * (x - xMean) }
        if (denominator <= 0.0) return null
        return (points.sumOf { (x, y) -> (x - xMean) * (y - yMean) } / denominator)
            .takeIf { it.isFinite() }
    }

    private fun fluctuation(series: DoubleArray, scale: Int): Double? {
        val boxCount = series.size / scale
        if (boxCount < 2) return null
        var squaredError = 0.0
        var sampleCount = 0
        fun addBox(start: Int) {
            val xMean = (scale - 1) / 2.0
            var yMean = 0.0
            for (i in 0 until scale) yMean += series[start + i]
            yMean /= scale
            var numerator = 0.0
            var denominator = 0.0
            for (i in 0 until scale) {
                numerator += (i - xMean) * (series[start + i] - yMean)
                denominator += (i - xMean) * (i - xMean)
            }
            val slope = if (denominator > 0.0) numerator / denominator else 0.0
            val intercept = yMean - slope * xMean
            for (i in 0 until scale) {
                val residual = series[start + i] - (intercept + slope * i)
                squaredError += residual * residual
                sampleCount++
            }
        }
        for (box in 0 until boxCount) addBox(box * scale)
        for (box in 0 until boxCount) addBox(series.size - (box + 1) * scale)
        return if (sampleCount > 0) kotlin.math.sqrt(squaredError / sampleCount) else null
    }
}

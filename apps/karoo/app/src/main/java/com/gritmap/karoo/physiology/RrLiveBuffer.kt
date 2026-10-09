package com.gritmap.karoo.physiology

import java.util.ArrayDeque

/** Bounded live RR state. Lifetime counters remain O(1); only the recent calculation window is kept. */
class RrLiveBuffer(
    private val maximumWindowMs: Long = 120_000L,
    private val maximumSamples: Int = 512,
    private val minimumValidPct: Int = 95,
    private val minimumConsecutiveValidMs: Long = 120_000L,
    private val minimumWindowSamples: Int = 2,
) {
    init {
        require(maximumWindowMs > 0L)
        require(maximumSamples > 0)
        require(minimumValidPct in 0..100)
        require(minimumConsecutiveValidMs >= 0L)
        require(minimumWindowSamples > 0)
    }

    private val window = ArrayDeque<RrObservation>()
    private var totalCount = 0L
    private var validCount = 0L
    private var consecutiveValidStartMs: Long? = null
    private var consecutiveValidDurationMs = 0L

    fun add(observation: RrObservation): RrQualitySnapshot {
        totalCount++
        if (observation.valid) {
            validCount++
            val start = consecutiveValidStartMs ?: observation.elapsedMs.also {
                consecutiveValidStartMs = it
            }
            consecutiveValidDurationMs = (observation.elapsedMs - start).coerceAtLeast(0L)
        } else {
            consecutiveValidStartMs = null
            consecutiveValidDurationMs = 0L
        }

        window.addLast(observation)
        val cutoff = observation.elapsedMs - maximumWindowMs
        while (window.isNotEmpty() &&
            (window.size > maximumSamples || window.first().elapsedMs < cutoff)
        ) {
            window.removeFirst()
        }
        return snapshot()
    }

    fun snapshot(): RrQualitySnapshot {
        val windowValidCount = window.count { it.valid }
        val validPct = if (window.isEmpty()) 0 else (windowValidCount * 100) / window.size
        return RrQualitySnapshot(
            window = window.toList(),
            totalCount = totalCount,
            validCount = validCount,
            artifactCount = totalCount - validCount,
            validPct = validPct,
            consecutiveValidDurationMs = consecutiveValidDurationMs,
            enhancedMetricsAllowed = window.size >= minimumWindowSamples &&
                validPct >= minimumValidPct &&
                consecutiveValidDurationMs >= minimumConsecutiveValidMs,
        )
    }
}

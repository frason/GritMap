package com.gritmap.karoo.physiology

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RrLiveBufferTest {
    @Test
    fun `bounds the live window while retaining lifetime quality counters`() {
        val buffer = RrLiveBuffer(
            maximumWindowMs = 5_000L,
            maximumSamples = 4,
            minimumValidPct = 75,
            minimumConsecutiveValidMs = 2_000L,
        )

        repeat(10) { index ->
            buffer.add(
                RrObservation(
                    elapsedMs = index * 1_000L,
                    rrIntervalMs = 800,
                    valid = index != 4,
                    artifactReason = if (index == 4) {
                        RrArtifactReason.SOURCE_MARKED_INVALID
                    } else {
                        RrArtifactReason.NONE
                    },
                ),
            )
        }

        val result = buffer.snapshot()
        assertEquals(4, result.window.size)
        assertEquals(listOf(6_000L, 7_000L, 8_000L, 9_000L), result.window.map { it.elapsedMs })
        assertEquals(10L, result.totalCount)
        assertEquals(9L, result.validCount)
        assertEquals(100, result.validPct)
        assertEquals(4_000L, result.consecutiveValidDurationMs)
        assertTrue(result.enhancedMetricsAllowed)
    }

    @Test
    fun `quality percentage follows recent window rather than lifetime`() {
        val buffer = RrLiveBuffer(
            maximumSamples = 4,
            minimumValidPct = 75,
            minimumConsecutiveValidMs = 0L,
        )
        repeat(8) { index -> buffer.add(RrObservation(index.toLong(), 800, true)) }
        repeat(4) { index ->
            buffer.add(
                RrObservation(
                    elapsedMs = (8 + index).toLong(),
                    rrIntervalMs = 0,
                    valid = false,
                    artifactReason = RrArtifactReason.INTERVAL_OUT_OF_RANGE,
                ),
            )
        }

        val result = buffer.snapshot()
        assertEquals(12L, result.totalCount)
        assertEquals(8L, result.validCount)
        assertEquals(0, result.validPct)
        assertFalse(result.enhancedMetricsAllowed)
    }

    @Test
    fun `invalid observation immediately freezes enhanced metrics`() {
        val buffer = RrLiveBuffer(minimumValidPct = 50, minimumConsecutiveValidMs = 1_000L)
        buffer.add(RrObservation(0L, 800, true))
        assertTrue(buffer.add(RrObservation(1_000L, 805, true)).enhancedMetricsAllowed)

        val result = buffer.add(
            RrObservation(2_000L, 0, false, RrArtifactReason.INTERVAL_OUT_OF_RANGE),
        )

        assertFalse(result.enhancedMetricsAllowed)
        assertEquals(0L, result.consecutiveValidDurationMs)
    }
}

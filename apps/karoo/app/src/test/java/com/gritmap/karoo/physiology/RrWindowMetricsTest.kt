package com.gritmap.karoo.physiology

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RrWindowMetricsTest {
    @Test
    fun `computes standard diagnostics from valid RR only`() {
        val metrics = requireNotNull(
            RrWindowMetricsCalculator.calculate(
                listOf(
                    RrObservation(0L, 800, true),
                    RrObservation(800L, 1, false, RrArtifactReason.INTERVAL_OUT_OF_RANGE),
                    RrObservation(1_600L, 820, true),
                    RrObservation(2_400L, 780, true),
                ),
            ),
        )

        assertEquals(3, metrics.validSampleCount)
        assertEquals(800.0, metrics.meanRrMs, 0.001)
        assertEquals(75.0, metrics.heartRateFromRrBpm, 0.001)
        assertEquals(40.0, metrics.rmssdMs!!, 0.001)
        assertEquals(20.0, metrics.sdnnMs!!, 0.001)
    }

    @Test
    fun `needs two valid beats for variability diagnostics`() {
        val metrics = requireNotNull(
            RrWindowMetricsCalculator.calculate(listOf(RrObservation(0L, 1_000, true))),
        )
        assertEquals(60.0, metrics.heartRateFromRrBpm, 0.001)
        assertNull(metrics.rmssdMs)
        assertNull(metrics.sdnnMs)
    }

    @Test
    fun `variability never bridges an explicit dropout gap`() {
        val metrics = requireNotNull(
            RrWindowMetricsCalculator.calculate(
                listOf(
                    RrObservation(1_000L, 800, true),
                    RrObservation(2_000L, 1_200, false, RrArtifactReason.GAP_AFTER_DROPOUT),
                    RrObservation(3_000L, 1_000, true),
                    RrObservation(4_000L, 1_020, true),
                ),
            ),
        )

        assertEquals(3, metrics.validSampleCount)
        assertEquals(20.0, metrics.rmssdMs!!, 0.001)
        assertNull(metrics.dfaAlpha1)
    }

    @Test
    fun `dfa alpha one needs an approximately two minute clean suffix`() {
        val short = syntheticRr(count = 80, stepMs = 900)
        assertNull(DfaAlpha1Calculator.calculate(short))

        val enough = syntheticRr(count = 150, stepMs = 900)
        val value = requireNotNull(DfaAlpha1Calculator.calculate(enough))
        assertTrue(value.isFinite())
        assertTrue(value in 0.1..2.5)
    }

    @Test
    fun `dfa alpha one does not publish before the two minute qualification`() {
        assertNull(DfaAlpha1Calculator.calculate(syntheticRr(count = 132, stepMs = 900)))
        assertTrue(requireNotNull(DfaAlpha1Calculator.calculate(syntheticRr(count = 134, stepMs = 900))).isFinite())
    }

    @Test
    fun `dfa alpha one refuses to bridge a recent dropout`() {
        val observations = syntheticRr(count = 150, stepMs = 900).toMutableList()
        observations[100] = observations[100].copy(
            valid = false,
            artifactReason = RrArtifactReason.GAP_AFTER_DROPOUT,
        )
        assertNull(DfaAlpha1Calculator.calculate(observations))
    }

    private fun syntheticRr(count: Int, stepMs: Int): List<RrObservation> =
        (0 until count).map { index ->
            val interval = 900 + ((index * 37) % 23) - 11
            RrObservation(index * stepMs.toLong(), interval, true)
        }
}

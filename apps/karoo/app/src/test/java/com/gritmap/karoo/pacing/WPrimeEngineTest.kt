package com.gritmap.karoo.pacing

import com.gritmap.karoo.ui.state.Effort
import com.gritmap.karoo.ui.state.PacingZone
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WPrimeEngineTest {
    private val parameters = WPrimeParameters(
        criticalPowerWatts = 285.0,
        capacityJoules = 20_000.0,
        recoveryTauSeconds = 546.0,
        estimated = true,
    )

    @Test
    fun `power above CP depletes linearly and recovery is exponential`() {
        val engine = WPrimeEngine(parameters)
        engine.update(0L, 385.0)
        // Live updates are intentionally capped to five seconds for gap stability.
        assertEquals(19_500.0, engine.update(10_000L, 385.0), 0.001)
        val recovered = engine.update(15_000L, 0.0)
        assertTrue(recovered > 19_500.0)
        assertTrue(recovered < 20_000.0)
    }

    @Test
    fun `plan state includes expected and projected finish reserve`() {
        val engine = WPrimeEngine(parameters)
        engine.update(0L, 335.0)
        engine.update(5_000L, 335.0)
        val state = engine.stateForPlan(
            progressMeters = 500.0,
            totalDistanceMeters = 1_000.0,
            plannedFinishSeconds = 400,
            zones = listOf(PacingZone(0.0, 1_000.0, 310, Effort.HOLD)),
            history = emptyList(),
            actualPowerWatts = 335.0,
            plannedPowerWatts = 310.0,
        )

        assertNotNull(state.plannedBalanceJoules)
        assertNotNull(state.projectedFinishBalanceJoules)
        assertTrue(state.actualRemainingPct < 100f)
        assertTrue(state.projectedFinishPct!! < state.actualRemainingPct)
        assertTrue(state.estimated)
        assertEquals(-50.0, state.actualBalanceChangeJoulesPerSecond, 0.001)
        assertTrue(state.depletingTooFast)
        assertEquals(2f / 6f, state.flowAnimationPhase, 0.001f)
    }
}

package com.gritmap.karoo.ui.state

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class LiveUiStateTest {
    @Test
    fun `progress is safely clamped and missing sensors disable adaptation`() {
        val state = LiveUiState(progressMeters = 120.0, totalDistanceMeters = 100.0)

        assertEquals(1f, state.progressFraction)
        assertFalse(state.sensorStatus.adaptiveGuidanceAvailable)
        assertEquals("Waiting for GPS, power, HR, cadence, speed, elevation", state.sensorStatus.warning)
    }

    @Test
    fun `energy flow distinguishes burning during planned recovery`() {
        val state = reserve(actualRate = -5.0, plannedRate = 16.0)

        assertEquals(EnergyFlowStatus.BURNING_DURING_RECOVERY, state.energyFlowStatus)
    }

    @Test
    fun `energy flow distinguishes excessive drain and slow recovery`() {
        assertEquals(
            EnergyFlowStatus.DRAINING_TOO_FAST,
            reserve(actualRate = -39.0, plannedRate = -24.0).energyFlowStatus,
        )
        assertEquals(
            EnergyFlowStatus.RECOVERING_TOO_SLOW,
            reserve(actualRate = 4.0, plannedRate = 18.0).energyFlowStatus,
        )
    }

    private fun reserve(actualRate: Double, plannedRate: Double) = WPrimeState(
        capacityJoules = 20_000.0,
        actualBalanceJoules = 10_000.0,
        plannedBalanceJoules = 12_000.0,
        plannedFinishBalanceJoules = 2_000.0,
        projectedFinishBalanceJoules = 1_000.0,
        criticalPowerWatts = 270.0,
        estimated = true,
        actualBalanceChangeJoulesPerSecond = actualRate,
        plannedBalanceChangeJoulesPerSecond = plannedRate,
    )
}

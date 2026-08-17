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
}

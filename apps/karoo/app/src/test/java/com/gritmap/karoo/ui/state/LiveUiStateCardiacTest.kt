package com.gritmap.karoo.ui.state

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LiveUiStateCardiacTest {
    @Test
    fun `presentation graduates from response through emerging to drift`() {
        val response = LiveUiState(
            currentHeartRateBpm = 140,
            rollingPowerWatts3s = 240,
            cardiacDriftValidSeconds = 120,
        )
        assertEquals(CardiacPresentationMode.HR_RESPONSE, response.cardiacPresentationMode)
        assertEquals(
            CardiacPresentationMode.EMERGING_DRIFT,
            response.copy(cardiacDriftPct = 1.2, cardiacDriftValidSeconds = 240).cardiacPresentationMode,
        )
        assertEquals(
            CardiacPresentationMode.CARDIAC_DRIFT,
            response.copy(cardiacDriftPct = 2.1, cardiacDriftValidSeconds = 360).cardiacPresentationMode,
        )
    }

    @Test
    fun `H10 context requires a long effort and high quality qualified RR`() {
        val short = LiveUiState(
            plannedFinishSeconds = 300,
            h10EnhancedAvailable = true,
            h10DfaAlpha1 = 0.72,
            h10ValidRrPct = 99,
        )
        assertFalse(short.h10ContextEligible)
        assertFalse(short.h10ContextQualified)

        val long = short.copy(plannedFinishSeconds = 600)
        assertTrue(long.h10ContextEligible)
        assertTrue(long.h10ContextQualified)
        assertFalse(long.copy(h10ValidRrPct = 94).h10ContextQualified)
    }
}

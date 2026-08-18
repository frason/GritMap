package com.gritmap.karoo.service

import com.gritmap.karoo.ui.state.GuidanceIcon
import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.Recommendation
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SegmentEntryAlertTest {
    @Test
    fun `entry alert summarizes segment without a pacing plan`() {
        val alert = segmentEntryAlert(session())

        assertEquals("Coco Jumbo started", alert.title)
        assertEquals("533 m · Open GritMap Pacing Profile", alert.detail)
        assertEquals(4_000L, alert.autoDismissMs)
        assertTrue(alert.id.endsWith("attempt-1"))
    }

    @Test
    fun `entry alert includes validated target when available`() {
        val alert = segmentEntryAlert(
            session(
                Recommendation(260, "Hold steady", GuidanceIcon.HOLD),
            ),
        )

        assertEquals("260 W · Hold steady", alert.detail)
    }

    private fun session(recommendation: Recommendation? = null) = ActiveAttemptSession(
        attemptId = "attempt-1",
        segmentId = "coco-jumbo",
        startedAtMs = 1L,
        initialUiState = LiveUiState(
            segmentName = "Coco Jumbo",
            totalDistanceMeters = 533.0,
            recommendation = recommendation,
        ),
    )
}

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

    @Test
    fun `completion alert summarizes elapsed time and available effort metrics`() {
        val session = session(Recommendation(260, "Hold steady", GuidanceIcon.HOLD))
        val active = session.uiState.copy(
            sensorStatus = com.gritmap.karoo.ui.state.SensorStatus(power = true),
        )
        session.accept(LiveTelemetry(2_000L, powerWatts = 250.0, heartRateBpm = 140.0), active)
        session.accept(LiveTelemetry(3_000L, powerWatts = 270.0, heartRateBpm = 150.0), active)

        val alert = segmentCompletionAlert(session, completedAtMs = 169_001L)

        assertEquals("Coco Jumbo complete", alert.title)
        assertEquals("2:49 · Avg 260 W · 145 bpm · 100% on plan", alert.detail)
        assertEquals(8_000L, alert.autoDismissMs)
        assertTrue(alert.id.startsWith("gritmap-complete-"))
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

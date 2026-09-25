package com.gritmap.karoo.service

import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.GuidanceIcon
import com.gritmap.karoo.ui.state.Recommendation
import com.gritmap.karoo.ui.state.SensorStatus
import org.junit.Assert.assertEquals
import org.junit.Test

class ActiveAttemptSessionTest {
    @Test
    fun `long effort keeps only bounded recent telemetry`() {
        val session = ActiveAttemptSession("attempt", "segment", 0L, LiveUiState.Idle)

        repeat(1_801) { second ->
            session.recordTelemetryTick(LiveTelemetry(timestampMs = second * 1_000L, powerWatts = 200.0))
        }

        assertEquals(121, session.recentSamples().size)
        assertEquals(1_801L, session.totalSampleCount)
        assertEquals(200.0, session.averagePowerWatts!!, 0.0)
    }

    @Test
    fun `distance execution history is ordered and bounded`() {
        val session = ActiveAttemptSession("attempt", "segment", 0L, LiveUiState.Idle)
        val base = LiveUiState(
            recommendation = Recommendation(250, "Hold", GuidanceIcon.HOLD),
            rollingPowerWatts3s = 245,
            sensorStatus = SensorStatus(power = true),
        )

        repeat(800) { index ->
            session.recordTelemetryTick(
                LiveTelemetry(timestampMs = index * 1_000L, powerWatts = 245.0),
                base.copy(progressMeters = index * 4.0),
            )
        }

        val history = session.powerExecutionSamples()
        assertEquals(600, history.size)
        assertEquals(800.0, history.first().distanceMeters, 0.0)
        assertEquals(3_196.0, history.last().distanceMeters, 0.0)
        assertEquals(245, history.last().actualWatts)
        assertEquals(250, history.last().targetWatts)
    }

    @Test
    fun `retains the pacing plan id it was started with`() {
        val withPlan = ActiveAttemptSession(
            "attempt", "segment", 0L, LiveUiState.Idle,
            pacingPlanId = "diablo-northgate-junction-40m30-ftp280",
        )
        assertEquals("diablo-northgate-junction-40m30-ftp280", withPlan.pacingPlanId)

        // No baseline plan was active (e.g. a provisional-only attempt) -- must not silently
        // fabricate an id, matching the "missing sensor data stays missing" convention.
        val withoutPlan = ActiveAttemptSession("attempt", "segment", 0L, LiveUiState.Idle)
        assertEquals(null, withoutPlan.pacingPlanId)
    }
}

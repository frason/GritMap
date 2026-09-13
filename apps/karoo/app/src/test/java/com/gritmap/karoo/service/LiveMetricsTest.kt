package com.gritmap.karoo.service

import com.gritmap.karoo.ui.state.GuidanceIcon
import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.Recommendation
import com.gritmap.karoo.ui.state.SensorStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LiveMetricsTest {
    @Test
    fun `prediction and power delta derive from meaningful progress`() {
        val session = session()
        val result = enrichLiveMetrics(
            state(progress = 100.0),
            session,
            LiveTelemetry(timestampMs = 31_000L, powerWatts = 247.0),
        )

        assertEquals(247, result.currentPowerWatts)
        assertEquals(247, result.rollingPowerWatts3s)
        assertEquals(-13, result.powerDeltaWatts)
        assertEquals(150, result.predictedFinishSeconds)
    }

    @Test
    fun `three second power and watts per HR use recent live samples`() {
        val session = session()
        val liveState = state(progress = 100.0).copy(
            sensorStatus = SensorStatus(power = true, heartRate = true),
        )
        session.recordTelemetryTick(LiveTelemetry(timestampMs = 27_000L, powerWatts = 100.0), liveState)
        session.recordTelemetryTick(LiveTelemetry(timestampMs = 29_000L, powerWatts = 200.0), liveState)

        val result = enrichLiveMetrics(
            liveState,
            session,
            LiveTelemetry(timestampMs = 31_000L, powerWatts = 300.0, heartRateBpm = 150.0),
        )

        // The 27-second sample falls outside the inclusive 28–31 second rolling window.
        assertEquals(250, result.rollingPowerWatts3s)
        assertEquals(150, result.currentHeartRateBpm)
        assertEquals(1.666, result.wattsPerHeartRate!!, 0.001)
    }

    @Test
    fun `finish prediction waits for enough progress`() {
        val result = enrichLiveMetrics(
            state(progress = 20.0),
            session(),
            LiveTelemetry(timestampMs = 31_000L, powerWatts = 260.0),
        )

        assertNull(result.predictedFinishSeconds)
    }

    @Test
    fun `adherence counts only power samples with a target`() {
        val session = session()
        val targetState = state(progress = 50.0)
        session.recordTelemetryTick(LiveTelemetry(1_000L, powerWatts = 260.0), targetState)
        session.recordTelemetryTick(LiveTelemetry(2_000L, powerWatts = 300.0), targetState)
        session.recordTelemetryTick(LiveTelemetry(3_000L, powerWatts = 250.0), LiveUiState())

        assertEquals(50, session.planAdherencePct())
    }

    @Test
    fun `FTP estimate produces W prime state when live power is available`() {
        val session = ActiveAttemptSession("a", "s", 1_000L, LiveUiState(), ftpWatts = 285)
        val state = state(progress = 100.0).copy(
            plannedFinishSeconds = 300,
            pacingZones = listOf(
                com.gritmap.karoo.ui.state.PacingZone(
                    0.0,
                    500.0,
                    300,
                    com.gritmap.karoo.ui.state.Effort.HOLD,
                ),
            ),
        )
        val first = enrichLiveMetrics(state, session, LiveTelemetry(1_000L, powerWatts = 350.0))
        val second = enrichLiveMetrics(state, session, LiveTelemetry(2_000L, powerWatts = 350.0))

        assertTrue(first.wPrime!!.estimated)
        assertTrue(second.wPrime!!.actualBalanceJoules < first.wPrime!!.actualBalanceJoules)
        assertEquals(270.75, second.wPrime!!.criticalPowerWatts, 0.001)
    }

    private fun session() = ActiveAttemptSession("a", "s", 1_000L, LiveUiState())

    private fun state(progress: Double) = LiveUiState(
        progressMeters = progress,
        totalDistanceMeters = 500.0,
        recommendation = Recommendation(260, "Hold", GuidanceIcon.HOLD),
        sensorStatus = SensorStatus(power = true),
    )
}

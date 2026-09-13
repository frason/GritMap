package com.gritmap.karoo.service

import com.gritmap.karoo.ui.state.GuidanceIcon
import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.Recommendation
import com.gritmap.karoo.ui.state.SensorStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TelemetryAccountingTest {
    private val activeState = LiveUiState(
        recommendation = Recommendation(200, "Hold", GuidanceIcon.HOLD),
        sensorStatus = SensorStatus(power = true, heartRate = true),
    )

    @Test
    fun `eight callback-shaped updates per second account as sixty physical ticks`() {
        val session = ActiveAttemptSession("attempt", "segment", 0L, activeState)

        repeat(60) { second ->
            val tick = LiveTelemetry(
                timestampMs = second * 1_000L,
                powerWatts = 200.0,
                heartRateBpm = 140.0,
            )
            repeat(8) { callback ->
                val admitted = session.recordTelemetryTick(tick, activeState)
                if (callback == 0) assertTrue(admitted) else assertFalse(admitted)
            }
        }

        assertEquals(60L, session.totalSampleCount)
        assertEquals(60L, session.powerSampleCount)
        assertEquals(200.0, session.averagePowerWatts!!, 0.0)
        assertEquals(140.0, session.averageHeartRateBpm!!, 0.0)
        assertEquals(100, session.planAdherencePct())
    }

    @Test
    fun `state-only changes never create telemetry samples`() {
        val session = ActiveAttemptSession("attempt", "segment", 0L, LiveUiState())

        repeat(20) { session.updateUiState(activeState.copy(progressMeters = it.toDouble())) }

        assertEquals(0L, session.totalSampleCount)
        assertNull(session.averagePowerWatts)
        assertNull(session.averageHeartRateBpm)
    }

    @Test
    fun `stale retained power and HR cannot enter aggregates`() {
        val now = 10_000L
        val retained = LiveTelemetry(
            timestampMs = now,
            lat = 1.0,
            lng = 2.0,
            powerWatts = 300.0,
            heartRateBpm = 170.0,
            gpsUpdatedAtMs = now,
            powerUpdatedAtMs = now - SensorFreshness.MAX_AGE_MS - 1,
            heartRateUpdatedAtMs = now - SensorFreshness.MAX_AGE_MS - 1,
        )
        val status = SensorFreshness.status(retained)

        val admitted = retained.sanitized(status)
        val session = ActiveAttemptSession("attempt", "segment", 0L, activeState)
        session.recordTelemetryTick(admitted, activeState.copy(sensorStatus = status))

        assertEquals(1L, session.totalSampleCount)
        assertEquals(0L, session.powerSampleCount)
        assertNull(session.averagePowerWatts)
        assertNull(session.averageHeartRateBpm)
    }
}

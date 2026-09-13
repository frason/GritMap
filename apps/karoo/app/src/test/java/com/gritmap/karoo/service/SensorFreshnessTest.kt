package com.gritmap.karoo.service

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SensorFreshnessTest {
    @Test
    fun `all required sensors must be recent before adaptation`() {
        val now = 10_000L
        val sample = LiveTelemetry(
            timestampMs = now,
            lat = 1.0,
            lng = 2.0,
            elevationMeters = 3.0,
            powerWatts = 200.0,
            heartRateBpm = 150.0,
            cadenceRpm = 90.0,
            speedMetersPerSecond = 8.0,
            gpsUpdatedAtMs = now,
            elevationUpdatedAtMs = now,
            powerUpdatedAtMs = now,
            heartRateUpdatedAtMs = now,
            cadenceUpdatedAtMs = now,
            speedUpdatedAtMs = now,
        )

        assertTrue(SensorFreshness.status(sample).adaptiveGuidanceAvailable)
        assertFalse(
            SensorFreshness.status(sample.copy(powerUpdatedAtMs = now - 3_001)).adaptiveGuidanceAvailable,
        )
    }

    @Test
    fun `sanitizing removes retained stale sensors but keeps fresh GPS`() {
        val now = 20_000L
        val retained = LiveTelemetry(
            timestampMs = now,
            lat = 37.0,
            lng = -122.0,
            powerWatts = 250.0,
            heartRateBpm = 150.0,
            gpsUpdatedAtMs = now,
            powerUpdatedAtMs = now - 3_001L,
            heartRateUpdatedAtMs = now - 3_001L,
        )

        val sanitized = retained.sanitized(SensorFreshness.status(retained))

        assertEquals(37.0, sanitized.lat!!, 0.0)
        assertNull(sanitized.powerWatts)
        assertNull(sanitized.heartRateBpm)
    }
}

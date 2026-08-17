package com.gritmap.karoo.service

import org.junit.Assert.assertFalse
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
}

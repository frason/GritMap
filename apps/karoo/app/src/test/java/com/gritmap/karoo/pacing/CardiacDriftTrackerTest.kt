package com.gritmap.karoo.pacing

import com.gritmap.karoo.service.LiveTelemetry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CardiacDriftTrackerTest {
    @Test
    fun `builds baseline then reports worsening rolling efficiency`() {
        val tracker = CardiacDriftTracker()
        var snapshot = tracker.add(sample(0, 200.0, 100.0), 0f)
        for (second in 1..45) snapshot = tracker.add(sample(second, 200.0, 100.0), second / 80f)

        assertEquals(0.0, snapshot.driftPct!!, 0.001)
        for (second in 46..80) snapshot = tracker.add(sample(second, 200.0, 110.0), second / 80f)

        assertEquals(9.09, snapshot.driftPct!!, 0.05)
        assertEquals(1f, snapshot.history.last().progressFraction, 0f)
    }

    @Test
    fun `waits for paired readings and bounds history`() {
        val tracker = CardiacDriftTracker(
            baselineDurationMs = 2_000L,
            rollingWindowMs = 1_000L,
            maximumHistorySamples = 3,
        )
        assertNull(tracker.add(sample(0, 200.0, null), 0f).driftPct)
        var snapshot = tracker.add(sample(1, 200.0, 100.0), 0f)
        for (second in 2..10) snapshot = tracker.add(sample(second, 200.0, 105.0), second / 10f)

        assertEquals(3, snapshot.history.size)
        assertTrue(snapshot.history.all { it.progressFraction in 0f..1f })
    }

    private fun sample(second: Int, power: Double?, heartRate: Double?) = LiveTelemetry(
        timestampMs = second * 1_000L,
        powerWatts = power,
        heartRateBpm = heartRate,
    )
}

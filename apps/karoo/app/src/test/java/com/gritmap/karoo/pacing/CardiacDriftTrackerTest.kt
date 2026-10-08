package com.gritmap.karoo.pacing

import com.gritmap.karoo.service.LiveTelemetry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CardiacDriftTrackerTest {
    @Test
    fun `builds baseline then reports worsening rolling efficiency`() {
        val tracker = CardiacDriftTracker(
            baselineDurationMs = 45_000L,
            rollingWindowMs = 30_000L,
            minimumWindowSamples = 20,
            historyIntervalMs = 1_000L,
            smoothingAlpha = 1.0,
            deadbandPct = 0.0,
        )
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
            minimumWindowSamples = 2,
            historyIntervalMs = 1_000L,
            smoothingAlpha = 1.0,
            deadbandPct = 0.0,
            maximumHistorySamples = 3,
        )
        assertNull(tracker.add(sample(0, 200.0, null), 0f).driftPct)
        var snapshot = tracker.add(sample(1, 200.0, 100.0), 0f)
        for (second in 2..10) snapshot = tracker.add(sample(second, 200.0, 105.0), second / 10f)

        assertEquals(3, snapshot.history.size)
        assertTrue(snapshot.history.all { it.progressFraction in 0f..1f })
    }

    @Test
    fun `default tracker waits for a physiologically useful baseline`() {
        val tracker = CardiacDriftTracker()
        var snapshot = tracker.add(sample(0, 240.0, 145.0), 0f)
        for (second in 1 until 180) {
            snapshot = tracker.add(sample(second, 240.0, 145.0), second / 600f)
        }
        assertNull(snapshot.driftPct)

        snapshot = tracker.add(sample(180, 240.0, 145.0), 0.3f)
        assertEquals(0.0, snapshot.driftPct!!, 0.001)
    }

    @Test
    fun `coasting and stopped readings do not create drift spikes`() {
        val tracker = CardiacDriftTracker(
            baselineDurationMs = 10_000L,
            rollingWindowMs = 10_000L,
            minimumWindowSamples = 6,
            historyIntervalMs = 1_000L,
            smoothingAlpha = 1.0,
            deadbandPct = 0.0,
        )
        var snapshot = tracker.add(sample(0, 250.0, 150.0), 0f)
        for (second in 1..12) snapshot = tracker.add(sample(second, 250.0, 150.0), second / 30f)
        assertEquals(0.0, snapshot.driftPct!!, 0.001)

        for (second in 13..18) snapshot = tracker.add(sample(second, 0.0, 105.0), second / 30f)
        assertEquals(0.0, snapshot.driftPct!!, 0.001)
    }

    @Test
    fun `history is sampled at a stable display cadence`() {
        val tracker = CardiacDriftTracker(
            baselineDurationMs = 5_000L,
            rollingWindowMs = 5_000L,
            minimumWindowSamples = 4,
            historyIntervalMs = 15_000L,
            smoothingAlpha = 1.0,
            deadbandPct = 0.0,
        )
        var snapshot = tracker.add(sample(0, 250.0, 150.0), 0f)
        for (second in 1..35) snapshot = tracker.add(sample(second, 250.0, 150.0), second / 40f)

        assertEquals(3, snapshot.history.size)
    }

    private fun sample(second: Int, power: Double?, heartRate: Double?) = LiveTelemetry(
        timestampMs = second * 1_000L,
        powerWatts = power,
        heartRateBpm = heartRate,
    )
}

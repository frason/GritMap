package com.gritmap.karoo.pacing

import com.gritmap.karoo.service.LiveTelemetry
import com.gritmap.karoo.ui.state.*
import org.junit.Assert.*
import org.junit.Test

class SectionWorkTrackerTest {
    private val zones = listOf(PacingZone(0.0, 100.0, 200, Effort.HOLD), PacingZone(100.0, 300.0, 300, Effort.PUSH))
    private fun state(distance: Double, power: Boolean = true) = LiveUiState(progressMeters = distance,
        totalDistanceMeters = 300.0, plannedFinishSeconds = 300, pacingZones = zones, sensorStatus = SensorStatus(power = power))

    @Test fun `above target builds actual work ahead of planned line`() {
        val tracker = SectionWorkTracker()
        tracker.add(LiveTelemetry(0, powerWatts = 250.0), state(0.0))
        val work = tracker.add(LiveTelemetry(4000, powerWatts = 250.0), state(4.0)).single()
        assertEquals(1000.0, work.actualJoules!!, .001)
        assertEquals(800.0, work.plannedJoules, .001)
        assertEquals(20000.0, work.estimatedBudgetJoules!!, .001)
    }
    @Test fun `boundary interval is split and each section uses its own target`() {
        val tracker = SectionWorkTracker()
        tracker.add(LiveTelemetry(0, powerWatts = 200.0), state(98.0))
        val work = tracker.add(LiveTelemetry(4000, powerWatts = 200.0), state(102.0))
        assertEquals(400.0, work[0].actualJoules!!, .001)
        assertEquals(400.0, work[0].plannedJoules, .001)
        assertEquals(400.0, work[1].actualJoules!!, .001)
        assertEquals(600.0, work[1].plannedJoules, .001)
        assertEquals(60000.0, work[1].estimatedBudgetJoules!!, .001)
    }
    @Test fun `coasting is zero work and stale power is not fabricated`() {
        val tracker = SectionWorkTracker()
        tracker.add(LiveTelemetry(0, powerWatts = 0.0), state(0.0))
        assertEquals(0.0, tracker.add(LiveTelemetry(1000, powerWatts = 0.0), state(0.0)).single().actualJoules!!, .0)
        assertNull(tracker.add(LiveTelemetry(2000, powerWatts = null), state(0.0, false)).single().actualJoules)
    }
    @Test fun `duplicates and large gaps cannot double count or invent work`() {
        val tracker = SectionWorkTracker()
        tracker.add(LiveTelemetry(0, powerWatts = 200.0), state(0.0))
        tracker.add(LiveTelemetry(1000, powerWatts = 200.0), state(1.0))
        assertEquals(200.0, tracker.add(LiveTelemetry(1000, powerWatts = 500.0), state(2.0)).single().actualJoules!!, .001)
        assertNull(tracker.add(LiveTelemetry(10000, powerWatts = 200.0), state(10.0)).single().actualJoules)
    }
    @Test fun `missing finish goal does not invent a work budget`() {
        val tracker = SectionWorkTracker()
        tracker.add(LiveTelemetry(0, powerWatts = 200.0), state(0.0).copy(plannedFinishSeconds = null))
        val result = tracker.add(LiveTelemetry(1000, powerWatts = 200.0), state(1.0).copy(plannedFinishSeconds = null)).single()
        assertNull(result.estimatedBudgetJoules)
        assertEquals(200.0, result.actualJoules!!, .001)
    }
}

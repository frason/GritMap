package com.gritmap.karoo.matching

import com.gritmap.karoo.domain.GeoPoint
import com.gritmap.karoo.domain.SegmentDefinition
import org.junit.Assert.*
import org.junit.Test

class ConcurrentSegmentTrackerTest {
    private fun segment(id: String, start: Double, length: Double, plan: Boolean = false) = ConcurrentSegmentInput(
        SegmentDefinition(id, id, 20, .99, 1, id, listOf(
            GeoPoint(0.0, start / 111_195.0, 0.0),
            GeoPoint(0.0, (start + length) / 111_195.0, length),
        )), if (plan) "plan-$id" else null,
    )
    private fun ConcurrentSegmentTracker.tick(t: Long, distance: Double, vararg inputs: ConcurrentSegmentInput) =
        process(t * 1000, 0.0, distance / 111_195.0, inputs.toList())

    @Test fun `overlap discovered during active attempt survives first finish`() {
        val tracker = ConcurrentSegmentTracker()
        val a = segment("a", 0.0, 1500.0, true)
        val b = segment("b", 950.0, 6500.0)
        tracker.tick(0, 0.0, a)
        tracker.tick(1, 10.0, a)
        val first = tracker.tick(2, 25.0, a).active.single()
        tracker.tick(3, 950.0, b)
        tracker.tick(4, 960.0, b)
        val both = tracker.tick(5, 975.0, b)
        assertEquals(2, both.active.size)
        assertEquals(first.attemptId, both.headline!!.attemptId)
        val secondId = both.active.single { it.input.definition.id == "b" }.attemptId
        val after = tracker.tick(6, 1500.0)
        assertEquals(secondId, after.active.single().attemptId)
        assertEquals("b", after.headline!!.input.definition.id)
        val finish = after.events.filterIsInstance<ConcurrentAttemptEvent.Finished>().single()
        assertEquals(first.attemptId, finish.state.attemptId)
        assertEquals("completed", finish.reason)
        assertTrue(after.active.single().match.progressMeters > 500)
        val end = tracker.tick(7, 7450.0)
        assertTrue(end.active.isEmpty())
        assertEquals(secondId, end.events.filterIsInstance<ConcurrentAttemptEvent.Finished>().single().state.attemptId)
    }

    @Test fun `plan wins otherwise nearest finish with stable ties`() {
        fun confirmed(vararg input: ConcurrentSegmentInput): ConcurrentTrackingResult {
            val tracker = ConcurrentSegmentTracker()
            tracker.tick(0, 0.0, *input); tracker.tick(1, 5.0, *input)
            return tracker.tick(2, 10.0, *input)
        }
        val short = segment("short", 0.0, 100.0)
        val planned = segment("planned", 0.0, 200.0, true)
        assertEquals("planned", confirmed(short, planned).headline!!.input.definition.id)
        assertEquals("short", confirmed(short, segment("long", 0.0, 200.0)).headline!!.input.definition.id)
        val a = segment("a", 0.0, 100.0)
        val b = segment("b", 0.0, 100.0)
        assertEquals("a", confirmed(b, a).headline!!.input.definition.id)
        assertEquals("a", confirmed(a, b).headline!!.input.definition.id)
    }

    @Test fun `duplicate and out of order ticks cannot confirm a start or count twice`() {
        val tracker = ConcurrentSegmentTracker()
        val a = segment("a", 0.0, 500.0)
        tracker.tick(0, 0.0, a)
        tracker.tick(1, 5.0, a)
        assertTrue(tracker.tick(1, 10.0, a).active.isEmpty())
        assertTrue(tracker.tick(0, 15.0, a).active.isEmpty())
        val started = tracker.tick(2, 10.0, a).active.single()
        assertEquals(0L, started.firstObservedAtMs)
        assertEquals(2000L, started.confirmedAtMs)
        assertEquals(1L, tracker.tick(2, 20.0, a).active.single().updateCount)
        assertEquals(2L, tracker.tick(3, 20.0, a).active.single().updateCount)
    }

    @Test fun `reverse traversal and joining mid route do not start`() {
        val tracker = ConcurrentSegmentTracker()
        val a = segment("a", 0.0, 500.0)
        assertTrue(tracker.tick(0, 250.0, a).active.isEmpty())
        tracker.tick(1, 15.0, a); tracker.tick(2, 10.0, a)
        assertTrue(tracker.tick(3, 0.0, a).active.isEmpty())
    }

    @Test fun `capacity does not evict active attempt and reports overflow once`() {
        val tracker = ConcurrentSegmentTracker(maxActive = 1)
        val a = segment("a", 0.0, 1000.0)
        val b = segment("b", 100.0, 1000.0)
        tracker.tick(0, 0.0, a); tracker.tick(1, 5.0, a)
        val id = tracker.tick(2, 10.0, a).active.single().attemptId
        tracker.tick(3, 100.0, b); tracker.tick(4, 105.0, b)
        val overflow = tracker.tick(5, 110.0, b)
        assertEquals(id, overflow.active.single().attemptId)
        assertEquals("b", overflow.events.filterIsInstance<ConcurrentAttemptEvent.CapacityReached>().single().fingerprint)
        assertTrue(tracker.tick(6, 115.0, b).events.isEmpty())
    }

    @Test fun `same tick completions and shutdown finalize each once`() {
        val tracker = ConcurrentSegmentTracker()
        val a = segment("a", 0.0, 100.0)
        val b = segment("b", 0.0, 100.0)
        tracker.tick(0, 0.0, a, b); tracker.tick(1, 5.0, a, b); tracker.tick(2, 10.0, a, b)
        assertEquals(2, tracker.tick(3, 100.0).events.filterIsInstance<ConcurrentAttemptEvent.Finished>().size)
        assertTrue(tracker.finishAll("ride-ended").events.isEmpty())
        tracker.tick(4, 0.0, a, b); tracker.tick(5, 5.0, a, b); tracker.tick(6, 10.0, a, b)
        assertEquals(2, tracker.finishAll("service-destroyed").events.size)
        assertTrue(tracker.finishAll("service-destroyed").events.isEmpty())
    }

    @Test fun `plan input is frozen until next traversal`() {
        val tracker = ConcurrentSegmentTracker()
        val a = segment("a", 0.0, 100.0)
        tracker.tick(0, 0.0, a); tracker.tick(1, 5.0, a)
        val start = tracker.tick(2, 10.0, a.copy(importedPlanId = "new-plan")).active.single()
        assertNull(start.input.importedPlanId)
        tracker.tick(3, 100.0)
        tracker.tick(4, 0.0, a.copy(importedPlanId = "new-plan"))
        tracker.tick(5, 5.0, a.copy(importedPlanId = "new-plan"))
        assertEquals("new-plan", tracker.tick(6, 10.0).active.single().input.importedPlanId)
    }
    @Test fun `abandoning one corridor does not reset another attempt`() {
        val tracker = ConcurrentSegmentTracker()
        val narrow = segment("a", 0.0, 1000.0)
        val wide = segment("b", 0.0, 2000.0).let {
            it.copy(definition = it.definition.copy(corridorMeters = 100))
        }
        tracker.tick(0, 0.0, narrow, wide); tracker.tick(1, 5.0, narrow, wide)
        val id = tracker.tick(2, 10.0, narrow, wide).active.single { it.input.definition.id == "b" }.attemptId
        tracker.process(3000, 50.0 / 111_195.0, 20.0 / 111_195.0, emptyList())
        val after = tracker.process(13000, 50.0 / 111_195.0, 40.0 / 111_195.0, emptyList())
        assertEquals(id, after.active.single().attemptId)
        assertEquals("outside-corridor-timeout", after.events.filterIsInstance<ConcurrentAttemptEvent.Finished>().single().reason)
    }

    @Test fun `tentative candidate bound and admission are deterministic`() {
        val a = segment("a", 0.0, 500.0)
        val b = segment("b", 0.0, 500.0)
        val tracker = ConcurrentSegmentTracker(maxActive = 1, maxCandidates = 1)
        val first = tracker.tick(0, 0.0, b, a)
        assertEquals("b", first.events.filterIsInstance<ConcurrentAttemptEvent.CapacityReached>().single().fingerprint)
        tracker.tick(1, 5.0, b, a)
        assertEquals("a", tracker.tick(2, 10.0, b, a).active.single().input.definition.id)
    }

}

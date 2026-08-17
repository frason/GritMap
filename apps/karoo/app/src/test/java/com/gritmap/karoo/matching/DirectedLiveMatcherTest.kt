package com.gritmap.karoo.matching

import com.gritmap.karoo.domain.GeoPoint
import com.gritmap.karoo.domain.SegmentDefinition
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DirectedLiveMatcherTest {
    private val segment = SegmentDefinition("s", "north", 30, .9, 1, "hash", listOf(
        GeoPoint(37.0, -122.0, 0.0),
        GeoPoint(37.0005, -122.0, 55.6),
        GeoPoint(37.001, -122.0, 111.2),
    ))

    @Test fun projectsOntoSegment() {
        val projection = GeoProjection.project(37.0005, -121.9999, segment.referencePolyline)
        assertTrue(projection.progressMeters in 54.0..57.0)
        assertTrue(projection.deviationMeters < 10)
    }

    @Test fun forwardTraversalCompletes() {
        val matcher = DirectedLiveMatcher(segment)
        assertEquals(LiveMatchDecision.TRACKING, matcher.update(0, 37.0, -122.0).decision)
        matcher.update(1_000, 37.0005, -122.0)
        assertEquals(LiveMatchDecision.COMPLETED, matcher.update(2_000, 37.001, -122.0).decision)
    }

    @Test fun corridorTimeoutAllowsTenSecondReacquisitionWindow() {
        val matcher = DirectedLiveMatcher(segment)
        matcher.update(0, 37.0, -122.0)
        assertEquals(LiveMatchDecision.TRACKING, matcher.update(1_000, 37.0003, -121.999).decision)
        assertEquals(LiveMatchDecision.ABANDONED, matcher.update(11_000, 37.0003, -121.999).decision)
    }

    @Test fun selectorLocksAtFiftyMeters() {
        val selector = CandidateSelector()
        selector.select(listOf(CandidateScore("a", true, 10.0, 2.0), CandidateScore("b", true, 20.0, 4.0)))
        assertEquals(null, selector.lockedSegmentId)
        selector.select(listOf(CandidateScore("a", true, 51.0, 2.0), CandidateScore("b", true, 20.0, 4.0)))
        assertEquals("a", selector.lockedSegmentId)
        assertEquals("a", selector.select(listOf(CandidateScore("a", true, 51.0, 2.0), CandidateScore("b", true, 80.0, 1.0)))?.segmentId)
    }
}


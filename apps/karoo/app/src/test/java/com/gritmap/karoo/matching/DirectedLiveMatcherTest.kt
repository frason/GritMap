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

    @Test fun realCocoJumboCarTraceCompletesWithoutSensorMetrics() {
        val realSegment = SegmentDefinition("coco-jumbo", "Coco Jumbo", 30, .9, 1, "fixture", listOf(
            GeoPoint(37.89249, -122.12891, 0.0),
            GeoPoint(37.8925105, -122.1294656, 50.0),
            GeoPoint(37.8926041, -122.1300053, 100.0),
            GeoPoint(37.8929716, -122.1303263, 150.0),
            GeoPoint(37.8932598, -122.1307606, 200.0),
            GeoPoint(37.8934586, -122.1312643, 250.0),
            GeoPoint(37.8935067, -122.1318301, 300.0),
            GeoPoint(37.8936302, -122.1323755, 350.0),
            GeoPoint(37.8938507, -122.1328714, 400.0),
            GeoPoint(37.8941393, -122.1333056, 450.0),
            GeoPoint(37.8945288, -122.1335885, 500.0),
            GeoPoint(37.89479, -122.13378, 533.553),
        ))
        val trace = listOf(
            Triple(1787021829000L, 37.892388263717294, -122.12859828025103),
            Triple(1787021832000L, 37.89255330339074, -122.12882492691278),
            Triple(1787021835000L, 37.89259999059141, -122.12896666489542),
            Triple(1787021838000L, 37.89259663783014, -122.12898996658623),
            Triple(1787021853000L, 37.89257165975869, -122.12907495908439),
            Triple(1787021856000L, 37.89254995062947, -122.12933831848204),
            Triple(1787021859000L, 37.89253662340343, -122.12965993210673),
            Triple(1787021862000L, 37.89260661229491, -122.1299399714917),
            Triple(1787021865000L, 37.8927749209106, -122.13014826178551),
            Triple(1787021868000L, 37.892984971404076, -122.13031992316246),
            Triple(1787021871000L, 37.89316828362644, -122.13056165724993),
            Triple(1787021874000L, 37.893338268622756, -122.13083826005459),
            Triple(1787021877000L, 37.89345662109554, -122.13116163387895),
            Triple(1787021880000L, 37.893496602773666, -122.13153328746557),
            Triple(1787021883000L, 37.89353163912892, -122.13193494826555),
            Triple(1787021886000L, 37.89361998438835, -122.13232328183949),
            Triple(1787021889000L, 37.89377496577799, -122.13267331011593),
            Triple(1787021892000L, 37.89393497630954, -122.1329982765019),
            Triple(1787021895000L, 37.89411158300936, -122.13327663950622),
            Triple(1787021898000L, 37.89432825520635, -122.13346665725112),
            Triple(1787021901000L, 37.8945432510227, -122.13361325673759),
            Triple(1787021904000L, 37.89465330541134, -122.13367997668684),
            Triple(1787021907000L, 37.89477325044572, -122.1338199544698),
        )
        val matcher = DirectedLiveMatcher(realSegment)

        var final: LiveMatchState? = null
        trace.forEach { point ->
            final = matcher.update(point.first, point.second, point.third)
        }

        assertEquals(LiveMatchDecision.COMPLETED, final?.decision)
        assertTrue(final!!.furthestProgressMeters >= realSegment.referencePolyline.last().distanceMeters * .9)
    }
}

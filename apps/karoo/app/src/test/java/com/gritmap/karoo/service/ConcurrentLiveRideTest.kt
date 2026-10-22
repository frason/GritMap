package com.gritmap.karoo.service

import com.gritmap.karoo.domain.GeoPoint
import com.gritmap.karoo.domain.SegmentDefinition
import com.gritmap.karoo.ui.state.*
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class ConcurrentLiveRideTest {
    private class Sink : ConcurrentAttemptPersistence {
        val entered = mutableListOf<ConcurrentAttemptRecord>()
        val ended = mutableListOf<Pair<ConcurrentAttemptRecord, String>>()
        val writes = mutableListOf<String>()
        override suspend fun enter(record: ConcurrentAttemptRecord) { entered += record; writes += "enter:${record.attemptId}" }
        override suspend fun checkpoint(record: ConcurrentAttemptRecord) { writes += "checkpoint:${record.attemptId}" }
        override suspend fun finish(record: ConcurrentAttemptRecord, reason: String) { ended += record to reason; writes += "finish:${record.attemptId}" }
    }
    private fun segment(id: String, start: Double, length: Double, plan: Boolean = false) = ConcurrentRideSegment(
        SegmentDefinition(id, id, 20, .99, 1, id, listOf(
            GeoPoint(0.0, start / 111_195.0, 0.0), GeoPoint(0.0, (start + length) / 111_195.0, length))),
        280, if (plan) "plan-$id" else null, if (plan) 1000 else null)
    private suspend fun ConcurrentLiveRide.tick(t: Long, distance: Double) = process(
        LiveTelemetry(t * 1000, lat = 0.0, lng = distance / 111_195.0, powerWatts = 200.0), SensorStatus(gps = true, power = true))

    @Test fun `service runtime persists both overlaps and hands over without resetting telemetry`() = runBlocking {
        val sink = Sink()
        val a = segment("a", 0.0, 1500.0, true)
        val b = segment("b", 950.0, 6500.0)
        var ui = LiveUiState.Idle
        val finishedSamples = mutableMapOf<String, Long>()
        val ride = ConcurrentLiveRide({ _, _, _ -> listOf(a, b) }, sink, { ui = it },
            onFinish = { session, _, _ -> finishedSamples[session.segmentId] = session.totalSampleCount })
        ride.tick(0, 0.0); ride.tick(1, 5.0); ride.tick(2, 10.0)
        ride.tick(3, 950.0); ride.tick(4, 955.0); ride.tick(5, 960.0)
        assertEquals(2, ride.activeCount)
        assertEquals("a", ui.segmentName)
        assertEquals("b", ui.otherActiveSegments.single().name)
        val bId = sink.entered.single { it.segmentId == "b" }.attemptId
        ride.tick(6, 1500.0)
        assertEquals(1, ride.activeCount)
        assertEquals(bId, ui.headlineAttemptId)
        assertEquals(3_000L, sink.entered.single { it.segmentId == "b" }.startedAtMs)
        // Entry snapshots are not mutated by subsequent live ticks.
        assertEquals(0.0, sink.entered.first().state.progressMeters, 0.0)
        ride.tick(7, 7450.0)
        assertEquals(0, ride.activeCount)
        assertEquals(listOf("a", "b"), sink.ended.map { it.first.segmentId })
        assertEquals(listOf(6000L, 7000L), sink.ended.map { it.first.timestampMs })
        assertEquals(5L, finishedSamples["b"])
        assertEquals(200.0, sink.ended.last().first.power!!, 0.0)
        assertNull(sink.ended.last().first.state.recommendation)
        assertNull(sink.ended.last().first.state.wPrime)
        assertTrue(sink.writes.indexOf("enter:$bId") < sink.writes.indexOf("finish:$bId"))
        ride.finishAll("ride-ended", 8000)
        assertEquals(2, sink.ended.size)
    }

    @Test fun `shutdown finalizes all with telemetry timing and duplicate stop is harmless`() = runBlocking {
        val sink = Sink()
        var ui = LiveUiState.Idle
        val ride = ConcurrentLiveRide({ _, _, _ -> listOf(segment("a", 0.0, 1000.0), segment("b", 0.0, 2000.0)) }, sink, { ui = it })
        ride.tick(10, 0.0); ride.tick(11, 5.0); ride.tick(12, 10.0)
        ride.finishAll("service-destroyed", 13000)
        assertEquals(2, sink.ended.size)
        assertTrue(sink.ended.all { it.first.state.matchStatus == MatchStatus.ABANDONED && it.first.timestampMs == 13000L })
        assertEquals(LiveUiState.Idle, ui)
        ride.finishAll("service-destroyed", 14000)
        assertEquals(2, sink.ended.size)
    }

    @Test fun `fifth start logs segment and reason without evicting active sessions`() = runBlocking {
        val sink = Sink()
        val ignored = mutableListOf<String>()
        val ride = ConcurrentLiveRide({ _, _, _ -> (1..5).map { segment("s$it", 0.0, 1000.0) } }, sink, {},
            diagnostic = { event, details -> if (event == "segment_ignored") ignored += details })
        ride.tick(0, 0.0); ride.tick(1, 5.0); ride.tick(2, 10.0)
        assertEquals(4, sink.entered.size)
        assertEquals(4, ride.activeCount)
        assertEquals(listOf("segment=s5 reason=concurrent-capacity"), ignored)
    }
    @Test fun `failed entry retries immutable snapshot before checkpoint and finish`() = runBlocking {
        val sink = Sink()
        var unavailable = true
        val diagnostics = mutableListOf<String>()
        val persistence = object : ConcurrentAttemptPersistence {
            override suspend fun enter(record: ConcurrentAttemptRecord) {
                if (unavailable) throw java.io.IOException("storage unavailable")
                sink.enter(record)
            }
            override suspend fun checkpoint(record: ConcurrentAttemptRecord) = sink.checkpoint(record)
            override suspend fun finish(record: ConcurrentAttemptRecord, reason: String) = sink.finish(record, reason)
        }
        val ride = ConcurrentLiveRide({ _, _, _ -> listOf(segment("a", 0.0, 100.0)) }, persistence, {},
            diagnostic = { event, _ -> diagnostics += event })
        ride.tick(0, 0.0); ride.tick(1, 5.0); ride.tick(2, 10.0)
        ride.tick(35, 100.0)
        assertTrue(sink.writes.isEmpty())
        assertTrue(diagnostics.contains("concurrent_storage_failed"))
        unavailable = false
        ride.finishAll("ride-ended", 36000)
        assertEquals(0.0, sink.entered.single().state.progressMeters, 0.0)
        assertEquals(35000L, sink.ended.single().first.timestampMs)
        assertEquals("completed", sink.ended.single().second)
        assertEquals(listOf("enter", "finish"), sink.writes.map { it.substringBefore(":") })
    }

}

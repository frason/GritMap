package com.gritmap.karoo.matching

import com.gritmap.karoo.domain.TelemetrySample
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ActiveAttemptSessionTest {
    @Test fun boundsRollingWindowButKeepsAggregates() {
        val session = ActiveAttemptSession()
        repeat(1_801) { second ->
            session.add(TelemetrySample(second * 1_000L, 37.0, -122.0, powerWatts = 200.0))
        }
        assertTrue(session.rollingSamples.size <= 121)
        assertEquals(1_801L, session.aggregates().sampleCount)
        assertEquals(200.0, session.aggregates().averagePowerWatts!!, 0.0)
    }

    @Test fun telemetryAndUnchangedInferenceNeverWrite() {
        assertFalse(AttemptWritePolicy.shouldWrite(PersistenceEvent.TelemetryTick))
        assertFalse(AttemptWritePolicy.shouldWrite(PersistenceEvent.UnchangedInference))
        assertTrue(AttemptWritePolicy.shouldWrite(PersistenceEvent.SegmentEntry))
        assertTrue(AttemptWritePolicy.shouldWrite(PersistenceEvent.RecoveryCheckpoint))
        assertTrue(AttemptWritePolicy.shouldWrite(PersistenceEvent.SegmentExit))
    }
}

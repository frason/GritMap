package com.gritmap.karoo.matching

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ForwardProgressGateTest {
    @Test fun requiresTwoConsecutiveIncreasesBeforeConfirming() {
        val gate = ForwardProgressGate(requiredForwardSamples = 2)
        assertFalse("first sample has no prior progress to compare against", gate.record("s", 0.0))
        assertFalse("only one increase so far", gate.record("s", 10.0))
        assertTrue("two consecutive increases", gate.record("s", 20.0))
    }

    @Test fun stalledOrDecreasingProgressResetsTheStreak() {
        val gate = ForwardProgressGate(requiredForwardSamples = 2)
        gate.record("s", 0.0)
        gate.record("s", 10.0) // one increase
        gate.record("s", 10.0) // stalled -- resets
        assertFalse(gate.isConfirmed("s"))
        gate.record("s", 20.0) // one increase again
        assertFalse(gate.isConfirmed("s"))
        assertTrue(gate.record("s", 30.0))
    }

    @Test fun reverseDirectionThroughStartCorridorNeverConfirms() {
        // Reproduces the real 2026-09-13 bug: descending back through the segment start
        // produces GPS-noisy projections that wobble but never sustain two real increases.
        val gate = ForwardProgressGate(requiredForwardSamples = 2)
        val wobble = listOf(5.0, 3.0, 6.0, 2.0, 4.0, 1.0, 5.0, 0.0)
        var confirmed = false
        for (progress in wobble) confirmed = confirmed || gate.record("s", progress)
        assertFalse("a reverse-direction wobble must never confirm forward progress", confirmed)
    }

    @Test fun tracksMultipleSegmentsIndependently() {
        val gate = ForwardProgressGate(requiredForwardSamples = 2)
        gate.record("a", 0.0)
        gate.record("a", 10.0)
        assertTrue(gate.record("a", 20.0))
        // "b" has seen no samples yet -- must not be confirmed just because "a" is.
        assertFalse(gate.isConfirmed("b"))
    }

    @Test fun removeForgetsState() {
        val gate = ForwardProgressGate(requiredForwardSamples = 2)
        gate.record("s", 0.0)
        gate.record("s", 10.0)
        gate.record("s", 20.0)
        assertTrue(gate.isConfirmed("s"))
        gate.remove("s")
        assertFalse(gate.isConfirmed("s"))
        // After removal, a fresh sample must be treated as the first sample again, not a
        // continuation of the forgotten history.
        assertFalse(gate.record("s", 5.0))
    }

    @Test fun resetForgetsAllSegments() {
        val gate = ForwardProgressGate(requiredForwardSamples = 2)
        gate.record("a", 0.0); gate.record("a", 10.0); gate.record("a", 20.0)
        gate.record("b", 0.0); gate.record("b", 10.0); gate.record("b", 20.0)
        gate.reset()
        assertFalse(gate.isConfirmed("a"))
        assertFalse(gate.isConfirmed("b"))
    }
}

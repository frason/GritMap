package com.gritmap.karoo.matching

/**
 * Requires [requiredForwardSamples] consecutive samples of strictly increasing progress before
 * a segment candidate is considered direction-confirmed.
 *
 * Guards against a real bug found on a 2026-09-13 ride: a rider passing back through a
 * segment's start corridor while travelling the wrong direction (e.g. descending after
 * finishing a climb) satisfies DirectedLiveMatcher.canStart()'s pure proximity check, and can
 * take several seconds of GPS noise/projection wobble before DirectedLiveMatcher's own
 * "reverse-or-excessive-backtracking" abandonment fires (it only triggers once backtracking
 * exceeds backwardToleranceMeters) -- long enough for LiveSegmentCoordinator to select the
 * candidate and create a bogus attempt (entry alert + Room row) before the matcher catches up.
 * Real ride evidence: a second attempt was created and ran 18 seconds before abandoning as
 * "no-valid-candidate", with the FIT file confirming 0 W and reverse-direction travel the
 * whole time.
 *
 * This does not replace DirectedLiveMatcher's own backtracking check -- it's a second,
 * independent gate on the earlier "is this candidate even eligible to be selected/started"
 * decision, since a candidate can be direction-ambiguous (neither confirmed forward nor
 * confirmed backward enough to abandon) for a few samples right after entering the corridor.
 */
class ForwardProgressGate(private val requiredForwardSamples: Int = 2) {
    private val consecutiveForwardCounts = mutableMapOf<String, Int>()
    private val lastProgressMeters = mutableMapOf<String, Double>()

    /** Records one sample's progress for [segmentId] and returns whether it's now confirmed. */
    fun record(segmentId: String, progressMeters: Double): Boolean {
        val last = lastProgressMeters[segmentId]
        consecutiveForwardCounts[segmentId] = when {
            last == null -> 0
            progressMeters > last -> (consecutiveForwardCounts[segmentId] ?: 0) + 1
            else -> 0
        }
        lastProgressMeters[segmentId] = progressMeters
        return isConfirmed(segmentId)
    }

    fun isConfirmed(segmentId: String): Boolean =
        (consecutiveForwardCounts[segmentId] ?: 0) >= requiredForwardSamples

    fun remove(segmentId: String) {
        consecutiveForwardCounts.remove(segmentId)
        lastProgressMeters.remove(segmentId)
    }

    fun reset() {
        consecutiveForwardCounts.clear()
        lastProgressMeters.clear()
    }
}

package com.gritmap.karoo.matching

import com.gritmap.karoo.domain.SegmentDefinition

const val LIVE_MATCHER_VERSION = 1

enum class LiveMatchDecision { TRACKING, COMPLETED, ABANDONED }

data class LiveMatchState(
    val decision: LiveMatchDecision,
    val progressMeters: Double,
    val furthestProgressMeters: Double,
    val coveragePct: Double,
    val deviationMeters: Double,
    val maxDeviationMeters: Double,
    val outsideCorridorSinceMs: Long?,
    val reason: String? = null,
)

class DirectedLiveMatcher(
    private val segment: SegmentDefinition,
    private val backwardToleranceMeters: Double = 30.0,
    private val reacquisitionMs: Long = 10_000,
) {
    private val totalDistance = segment.referencePolyline.last().distanceMeters
    private var state: LiveMatchState? = null

    fun canStart(lat: Double, lng: Double): Boolean =
        GeoProjection.distanceMeters(lat, lng, segment.referencePolyline.first().lat, segment.referencePolyline.first().lng) <= segment.corridorMeters

    fun update(timestampMs: Long, lat: Double, lng: Double): LiveMatchState {
        state?.takeIf { it.decision != LiveMatchDecision.TRACKING }?.let { return it }
        val projection = GeoProjection.project(lat, lng, segment.referencePolyline)
        val previous = state
        if (previous == null && !canStart(lat, lng)) {
            return LiveMatchState(LiveMatchDecision.ABANDONED, projection.progressMeters, 0.0, 0.0,
                projection.deviationMeters, projection.deviationMeters, null, "outside-start-corridor").also { state = it }
        }
        if (previous != null && projection.progressMeters < previous.furthestProgressMeters - backwardToleranceMeters) {
            return previous.copy(decision = LiveMatchDecision.ABANDONED, progressMeters = projection.progressMeters,
                deviationMeters = projection.deviationMeters, reason = "reverse-or-excessive-backtracking").also { state = it }
        }
        val furthest = maxOf(previous?.furthestProgressMeters ?: 0.0, projection.progressMeters)
        val coverage = if (totalDistance == 0.0) 0.0 else (furthest / totalDistance).coerceIn(0.0, 1.0)
        val outside = projection.deviationMeters > segment.corridorMeters
        val outsideSince = if (outside) previous?.outsideCorridorSinceMs ?: timestampMs else null
        val timedOut = outsideSince != null && timestampMs - outsideSince >= reacquisitionMs
        val completed = coverage >= segment.requiredCoveragePct &&
            projection.progressMeters >= totalDistance - segment.corridorMeters && !outside
        val decision = when { completed -> LiveMatchDecision.COMPLETED; timedOut -> LiveMatchDecision.ABANDONED; else -> LiveMatchDecision.TRACKING }
        return LiveMatchState(decision, projection.progressMeters, furthest, coverage, projection.deviationMeters,
            maxOf(previous?.maxDeviationMeters ?: 0.0, projection.deviationMeters), outsideSince,
            if (timedOut) "outside-corridor-timeout" else null).also { state = it }
    }
}

data class CandidateScore(
    val segmentId: String,
    val directionValid: Boolean,
    val progressMeters: Double,
    val startDistanceMeters: Double,
)

class CandidateSelector(private val lockProgressMeters: Double = 50.0) {
    var lockedSegmentId: String? = null
        private set

    fun select(candidates: List<CandidateScore>): CandidateScore? {
        lockedSegmentId?.let { id -> return candidates.firstOrNull { it.segmentId == id } }
        val selected = candidates.filter { it.directionValid }.minWithOrNull(
            compareByDescending<CandidateScore> { it.progressMeters }.thenBy { it.startDistanceMeters }.thenBy { it.segmentId }
        )
        if (selected != null && selected.progressMeters >= lockProgressMeters) lockedSegmentId = selected.segmentId
        return selected
    }

    fun abandon(segmentId: String) { if (lockedSegmentId == segmentId) lockedSegmentId = null }
    fun reset() { lockedSegmentId = null }
}


package com.gritmap.karoo.matching

import com.gritmap.karoo.domain.SegmentDefinition
import java.util.UUID

/** Frozen inputs for one traversal. A provisional/generated fallback is not an imported plan. */
internal data class ConcurrentSegmentInput(
    val definition: SegmentDefinition,
    val importedPlanId: String? = null,
)

internal data class ConcurrentAttemptState(
    val attemptId: String,
    val input: ConcurrentSegmentInput,
    val firstObservedAtMs: Long,
    val confirmedAtMs: Long,
    val match: LiveMatchState,
    val updateCount: Long,
) {
    val remainingMeters: Double
        get() = (input.definition.referencePolyline.last().distanceMeters - match.progressMeters).coerceAtLeast(0.0)
}

internal sealed interface ConcurrentAttemptEvent {
    data class Started(val state: ConcurrentAttemptState) : ConcurrentAttemptEvent
    data class Finished(val state: ConcurrentAttemptState, val reason: String) : ConcurrentAttemptEvent
    data class CapacityReached(val fingerprint: String) : ConcurrentAttemptEvent
}

internal data class ConcurrentTrackingResult(
    val active: List<ConcurrentAttemptState>,
    val headline: ConcurrentAttemptState?,
    val events: List<ConcurrentAttemptEvent>,
    val candidateFingerprints: Set<String> = emptySet(),
)

/** Deterministic selector shared by every future field/map consumer. */
internal fun selectConcurrentHeadline(active: Collection<ConcurrentAttemptState>): ConcurrentAttemptState? =
    active.minWithOrNull(
        compareByDescending<ConcurrentAttemptState> { !it.input.importedPlanId.isNullOrBlank() }
            .thenBy { it.remainingMeters }
            .thenBy { it.input.definition.fingerprint },
    )

/**
 * Pure lifecycle foundation; serialized caller supplies nearby starts on EVERY distinct GPS fix.
 * No Room, sensors, UI publishing, or Bluetooth side effects. Runtime integration is separate.
 * Observation time is deliberately not named PR start time: exact boundary timing belongs to the
 * crossing-time implementation, not delayed direction confirmation or database persistence.
 */
internal class ConcurrentSegmentTracker(
    private val maxActive: Int = 4,
    private val maxCandidates: Int = 32,
    private val newAttemptId: () -> String = { UUID.randomUUID().toString() },
) {
    private class Candidate(val input: ConcurrentSegmentInput, val observedAtMs: Long) {
        val matcher = DirectedLiveMatcher(input.definition)
        val gate = ForwardProgressGate()
        var attempt: ConcurrentAttemptState? = null
    }

    private val candidates = linkedMapOf<String, Candidate>()
    // Terminal/overflow starts must leave the start corridor before being eligible again.
    private val rearm = linkedMapOf<String, SegmentDefinition>()
    private var lastTimestampMs: Long? = null

    init {
        require(maxActive > 0 && maxCandidates >= maxActive)
    }

    fun process(timestampMs: Long, lat: Double, lng: Double, nearby: List<ConcurrentSegmentInput>): ConcurrentTrackingResult {
        require(lat.isFinite() && lng.isFinite() && lat in -90.0..90.0 && lng in -180.0..180.0)
        if (lastTimestampMs?.let { timestampMs <= it } == true) return snapshot(emptyList())
        lastTimestampMs = timestampMs
        val events = mutableListOf<ConcurrentAttemptEvent>()
        rearm.entries.removeAll { (_, definition) -> !DirectedLiveMatcher(definition).canStart(lat, lng) }

        // Fingerprint ordering makes admission independent of database/list order.
        nearby.sortedBy { it.definition.fingerprint }.forEach { input ->
            val key = input.definition.fingerprint
            if (key !in candidates && key !in rearm && DirectedLiveMatcher(input.definition).canStart(lat, lng)) {
                if (candidates.size < maxCandidates) {
                    candidates[key] = Candidate(input, timestampMs)
                } else {
                    events += ConcurrentAttemptEvent.CapacityReached(key)
                    rearm[key] = input.definition
                }
            }
        }

        // Update/finish existing attempts first so capacity freed this tick can admit new starts.
        val states = candidates.mapValues { (_, value) -> value.matcher.update(timestampMs, lat, lng) }
        val terminal = mutableListOf<String>()
        candidates.forEach { (key, candidate) ->
            val match = states.getValue(key)
            val old = candidate.attempt
            if (old != null) {
                val updated = old.copy(match = match, updateCount = old.updateCount + 1)
                candidate.attempt = updated
                if (match.decision != LiveMatchDecision.TRACKING) {
                    events += ConcurrentAttemptEvent.Finished(updated, match.reason ?: "completed")
                    terminal += key
                }
            } else if (match.decision == LiveMatchDecision.ABANDONED) {
                terminal += key
            }
        }
        terminal.forEach { key ->
            rearm[key] = candidates.getValue(key).input.definition
            candidates.remove(key)
        }
        candidates.entries.sortedWith(compareBy({ it.value.observedAtMs }, { it.key })).forEach { (key, candidate) ->
            if (candidate.attempt == null) {
                val match = states.getValue(key)
                val forward = candidate.gate.record(key, match.progressMeters)
                if (!forward && match.decision == LiveMatchDecision.COMPLETED) {
                    rearm[key] = candidate.input.definition
                } else if (forward) {
                    if (candidates.values.count { it.attempt != null } >= maxActive) {
                        events += ConcurrentAttemptEvent.CapacityReached(key)
                        rearm[key] = candidate.input.definition
                    } else {
                        val attempt = ConcurrentAttemptState(newAttemptId(), candidate.input,
                            candidate.observedAtMs, timestampMs, match, 1)
                        events += ConcurrentAttemptEvent.Started(attempt)
                        if (match.decision == LiveMatchDecision.COMPLETED) {
                            events += ConcurrentAttemptEvent.Finished(attempt, "completed")
                            rearm[key] = candidate.input.definition
                        } else candidate.attempt = attempt
                    }
                }
            }
        }
        candidates.keys.removeAll(rearm.keys)
        rearm.entries.removeAll { (_, definition) -> !DirectedLiveMatcher(definition).canStart(lat, lng) }
        return snapshot(events)
    }

    fun finishAll(reason: String): ConcurrentTrackingResult {
        require(reason.isNotBlank())
        val events = candidates.values.mapNotNull { candidate ->
            candidate.attempt?.let {
                ConcurrentAttemptEvent.Finished(it.copy(match = it.match.copy(
                    decision = LiveMatchDecision.ABANDONED, reason = reason,
                )), reason)
            }
        }
        candidates.clear()
        rearm.clear()
        lastTimestampMs = null
        return snapshot(events)
    }

    private fun snapshot(events: List<ConcurrentAttemptEvent>): ConcurrentTrackingResult {
        val active = candidates.values.mapNotNull { it.attempt }.sortedBy { it.input.definition.fingerprint }
        return ConcurrentTrackingResult(active, selectConcurrentHeadline(active), events.toList(), candidates.keys.toSet())
    }
}

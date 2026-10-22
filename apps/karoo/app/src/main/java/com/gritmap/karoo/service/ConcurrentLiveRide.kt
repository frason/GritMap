package com.gritmap.karoo.service

import com.gritmap.karoo.domain.SegmentDefinition
import com.gritmap.karoo.matching.ConcurrentSegmentInput
import com.gritmap.karoo.matching.ConcurrentSegmentTracker
import com.gritmap.karoo.matching.ConcurrentAttemptEvent
import com.gritmap.karoo.matching.ConcurrentAttemptState
import com.gritmap.karoo.ui.state.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

internal data class ConcurrentRideSegment(
    val definition: SegmentDefinition,
    val ftpWatts: Int? = null,
    val planId: String? = null,
    val targetSeconds: Int? = null,
    val zones: List<PacingZone> = emptyList(),
    val instructions: List<Recommendation> = emptyList(),
    val replanMetadata: com.gritmap.karoo.importing.ReplanMetadata? = null,
)

/** Immutable macro-event payload: never enqueue a mutable ActiveAttemptSession. */
internal data class ConcurrentAttemptRecord(
    val attemptId: String,
    val segmentId: String,
    val startedAtMs: Long,
    val timestampMs: Long,
    val state: LiveUiState,
    val planId: String?,
    val maxDeviation: Double,
    val power: Double?,
    val heartRate: Double?,
    val cadence: Double?,
    val speed: Double?,
)

internal interface ConcurrentAttemptPersistence {
    suspend fun enter(record: ConcurrentAttemptRecord)
    suspend fun checkpoint(record: ConcurrentAttemptRecord)
    suspend fun finish(record: ConcurrentAttemptRecord, reason: String)
}

/** One serialized owner for all attempts; ordered macro writes are awaited, never launched independently. */
internal class ConcurrentLiveRide(
    private val discover: suspend (Double, Double, Long) -> List<ConcurrentRideSegment>,
    private val persistence: ConcurrentAttemptPersistence,
    private val publish: (LiveUiState) -> Unit,
    private val diagnostic: (String, String) -> Unit = { _, _ -> },
    private val onStart: (ActiveAttemptSession) -> Unit = {},
    private val onFinish: (ActiveAttemptSession, String, Long) -> Unit = { _, _, _ -> },
    private val augment: (LiveUiState) -> LiveUiState = { it },
) {
    private sealed interface Write {
        data class Enter(val record: ConcurrentAttemptRecord) : Write
        data class Checkpoint(val record: ConcurrentAttemptRecord) : Write
        data class Finish(val record: ConcurrentAttemptRecord, val reason: String) : Write
    }
    private val outbox = ArrayDeque<Write>()
    private val mutex = Mutex()
    private val tracker = ConcurrentSegmentTracker(maxActive = 4)
    private val segments = mutableMapOf<String, ConcurrentRideSegment>()
    private val sessions = linkedMapOf<String, ActiveAttemptSession>()
    private val checkpoints = mutableMapOf<String, Long>()
    private val pendingSamples = mutableMapOf<String, ArrayDeque<Pair<LiveTelemetry, SensorStatus>>>()
    private var lastTimestampMs: Long? = null
    @Volatile var activeCount = 0
        private set

    suspend fun process(sample: LiveTelemetry, sensors: SensorStatus) = mutex.withLock {
        if (outbox.size >= 480) {
            flushWrites()
            if (outbox.size >= 480) {
                diagnostic("concurrent_storage_blocked", "reason=write-backlog count=${outbox.size}")
                return@withLock
            }
        }
        val lat = sample.lat ?: return@withLock
        val lng = sample.lng ?: return@withLock
        if (lastTimestampMs?.let { sample.timestampMs <= it } == true) return@withLock
        lastTimestampMs = sample.timestampMs
        val nearby = discover(lat, lng, sample.timestampMs)
        nearby.sortedBy { it.definition.fingerprint }.take(32).forEach {
            segments.putIfAbsent(it.definition.fingerprint, it)
        }
        val result = tracker.process(sample.timestampMs, lat, lng, nearby.map {
            ConcurrentSegmentInput(it.definition, it.planId)
        })
        // Keep only the bounded pre-confirmation telemetry for accepted tentative candidates.
        result.candidateFingerprints.forEach { key ->
            if (sessions.values.none { it.segmentId == segments[key]?.definition?.id }) {
                val buffer = pendingSamples.getOrPut(key) { ArrayDeque() }
                buffer.addLast(sample to sensors)
                while (buffer.size > 32) buffer.removeFirst()
            }
        }
        result.events.filterIsInstance<ConcurrentAttemptEvent.CapacityReached>().forEach {
            val id = segments[it.fingerprint]?.definition?.id
                ?: nearby.firstOrNull { s -> s.definition.fingerprint == it.fingerprint }?.definition?.id ?: it.fingerprint
            diagnostic("segment_ignored", "segment=$id reason=concurrent-capacity")
        }
        val finished = result.events.filterIsInstance<ConcurrentAttemptEvent.Finished>()
        // Finalize existing attempts before admitting a new one into a freed capacity slot.
        finished.filter { sessions.containsKey(it.state.attemptId) }.forEach {
            val session = sessions.getValue(it.state.attemptId)
            val meta = segments.getValue(it.state.input.definition.fingerprint)
            update(session, meta, it.state.match.progressMeters, it.state.match.deviationMeters, sample, sensors)
            finish(it.state, it.reason, sample.timestampMs)
        }
        result.events.filterIsInstance<ConcurrentAttemptEvent.Started>().forEach { event ->
            val meta = segments.getValue(event.state.input.definition.fingerprint)
            val session = ActiveAttemptSession(event.state.attemptId, meta.definition.id,
                event.state.firstObservedAtMs, state(meta, 0.0, sensors), meta.ftpWatts, meta.planId,
                enableWPrime = false)
            sessions[session.attemptId] = session
            checkpoints[session.attemptId] = sample.timestampMs
            outbox.addLast(Write.Enter(record(session, sample.timestampMs)))
            onStart(session)
            pendingSamples.remove(meta.definition.fingerprint)?.filter { it.first.timestampMs < sample.timestampMs }
                ?.forEach { (early, earlySensors) ->
                    val projection = com.gritmap.karoo.matching.GeoProjection.project(
                        requireNotNull(early.lat), requireNotNull(early.lng), meta.definition.referencePolyline)
                    update(session, meta, projection.progressMeters, projection.deviationMeters, early, earlySensors)
                }
        }
        (result.active + finished.map { it.state }).distinctBy { it.attemptId }.forEach { attempt ->
            val session = sessions[attempt.attemptId] ?: return@forEach
            val meta = segments.getValue(attempt.input.definition.fingerprint)
            update(session, meta, attempt.match.progressMeters, attempt.match.deviationMeters, sample, sensors)
            if (sample.timestampMs - checkpoints.getValue(session.attemptId) >= 30_000L) {
                outbox.addLast(Write.Checkpoint(record(session, sample.timestampMs)))
                checkpoints[session.attemptId] = sample.timestampMs
            }
        }
        finished.forEach { finish(it.state, it.reason, sample.timestampMs) }
        activeCount = sessions.size
        flushWrites()
        val headline = result.headline?.let { sessions[it.attemptId] }
        publish(headline?.uiState?.copy(
            headlineAttemptId = headline.attemptId,
            otherActiveSegments = result.active.filter { it.attemptId != headline.attemptId }.map {
                SecondarySegmentState(it.input.definition.name, it.remainingMeters)
            },
        ) ?: LiveUiState.Idle)
        segments.keys.retainAll(result.candidateFingerprints)
        pendingSamples.keys.retainAll(result.candidateFingerprints)
    }

    suspend fun finishAll(reason: String, timestampMs: Long) = mutex.withLock {
        tracker.finishAll(reason).events.filterIsInstance<ConcurrentAttemptEvent.Finished>().forEach {
            finish(it.state, reason, timestampMs)
        }
        segments.clear(); pendingSamples.clear(); checkpoints.clear()
        activeCount = 0; lastTimestampMs = null
        flushWrites()
        if (outbox.isNotEmpty()) diagnostic("concurrent_storage_pending", "reason=$reason count=${outbox.size}")
        publish(LiveUiState.Idle)
    }

    private suspend fun finish(attempt: ConcurrentAttemptState, reason: String, timestampMs: Long) {
        val session = sessions[attempt.attemptId] ?: return
        session.updateUiState(session.uiState.copy(matchStatus = if (reason == "completed") MatchStatus.COMPLETE else MatchStatus.ABANDONED))
        outbox.addLast(Write.Finish(record(session, timestampMs), reason))
        sessions.remove(attempt.attemptId); checkpoints.remove(attempt.attemptId)
        activeCount = sessions.size
        onFinish(session, reason, timestampMs)
    }

    private suspend fun flushWrites() {
        while (outbox.isNotEmpty()) {
            try {
                when (val next = outbox.first()) {
                    is Write.Enter -> persistence.enter(next.record)
                    is Write.Checkpoint -> persistence.checkpoint(next.record)
                    is Write.Finish -> persistence.finish(next.record, next.reason)
                }
                outbox.removeFirst()
            } catch (error: kotlinx.coroutines.CancellationException) {
                throw error
            } catch (error: Exception) {
                diagnostic("concurrent_storage_failed", "type=${error.javaClass.simpleName} pending=${outbox.size}")
                return
            }
        }
    }

    private fun update(session: ActiveAttemptSession, meta: ConcurrentRideSegment, progress: Double, deviation: Double,
        sample: LiveTelemetry, sensors: SensorStatus) {
        val base = state(meta, progress, sensors).copy(matchStatus = if (deviation > meta.definition.corridorMeters) MatchStatus.UNCERTAIN else MatchStatus.ACTIVE)
        val enriched = augment(enrichLiveMetrics(base, session, sample))
        session.recordDeviation(deviation)
        val drift = session.recordCardiacDrift(sample, enriched.progressFraction)
        session.recordTelemetryTick(sample, enriched)
        session.updateUiState(enriched.copy(cardiacDriftPct = drift.driftPct, cardiacDriftHistory = drift.history,
            cardiacEfficiencyWattsPerBpm = drift.efficiencyWattsPerBpm,
            cardiacDriftRatePctPer10Min = drift.driftRatePctPer10Min,
            cardiacDriftValidSeconds = drift.validSeconds, cardiacDriftPairedPct = drift.pairedPct,
            cardiacDriftPowerSteady = drift.powerSteady,
            planAdherencePct = session.planAdherencePct(), powerExecutionHistory = session.powerExecutionSamples(),
            segmentSplitDeltasSeconds = session.recordCompletedSplits(enriched.progressMeters,
                enriched.elapsedAttemptSeconds ?: 0.0, enriched.totalDistanceMeters, enriched.plannedFinishSeconds)))
    }

    private fun state(meta: ConcurrentRideSegment, progress: Double, sensors: SensorStatus): LiveUiState {
        val points = meta.definition.referencePolyline
        val zoneIndex = meta.zones.indexOfFirst { progress >= it.startDistanceMeters && progress <= it.endDistanceMeters }
        return LiveUiState(segmentName = meta.definition.name, progressMeters = progress,
            totalDistanceMeters = points.last().distanceMeters, plannedFinishSeconds = meta.targetSeconds,
            replanMetadata = meta.replanMetadata,
            hasCompleteElevationProfile = points.all { it.elevationMeters?.isFinite() == true },
            pacingZones = meta.zones, recommendation = meta.instructions.getOrNull(zoneIndex), sensorStatus = sensors,
            elevationProfile = points.map { ElevationSample(it.distanceMeters, it.elevationMeters ?: 0.0) },
            routeProfile = points.map { RouteSample(it.distanceMeters, it.lat, it.lng) }, matchStatus = MatchStatus.ACTIVE)
    }

    private fun record(session: ActiveAttemptSession, timestampMs: Long) = ConcurrentAttemptRecord(session.attemptId,
        session.segmentId, session.startedAtMs, timestampMs, session.uiState, session.pacingPlanId,
        session.maxDeviationMeters, session.averagePowerWatts, session.averageHeartRateBpm,
        session.averageCadenceRpm, session.averageSpeedMetersPerSecond)
}

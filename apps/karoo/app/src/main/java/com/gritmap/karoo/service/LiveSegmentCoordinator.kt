package com.gritmap.karoo.service

import com.gritmap.karoo.data.KarooDatabase
import com.gritmap.karoo.data.SegmentEntity
import com.gritmap.karoo.domain.GeoPoint
import com.gritmap.karoo.domain.SegmentDefinition
import com.gritmap.karoo.matching.CandidateScore
import com.gritmap.karoo.matching.CandidateSelector
import com.gritmap.karoo.matching.DirectedLiveMatcher
import com.gritmap.karoo.matching.GeoProjection
import com.gritmap.karoo.matching.LiveMatchDecision
import com.gritmap.karoo.pacing.ProvisionalPacingPlanner
import com.gritmap.karoo.pacing.SegmentPacingInput
import com.gritmap.karoo.ui.state.Effort
import com.gritmap.karoo.ui.state.ElevationSample
import com.gritmap.karoo.ui.state.GuidanceIcon
import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.MatchStatus
import com.gritmap.karoo.ui.state.PacingZone
import com.gritmap.karoo.ui.state.Recommendation
import com.gritmap.karoo.ui.state.SensorStatus
import java.util.UUID
import kotlin.math.cos
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Joins Room candidate discovery to the pure directed matcher without writing at 1 Hz. */
class LiveSegmentCoordinator(
    private val database: KarooDatabase,
    private val begin: (ActiveAttemptSession) -> Unit,
    private val update: (LiveTelemetry, LiveUiState, Double) -> Unit,
    private val finish: (String) -> Unit,
) {
    private data class Candidate(
        val definition: SegmentDefinition,
        val matcher: DirectedLiveMatcher,
        val ftpWatts: Int?,
    )

    private val mutex = Mutex()
    private val selector = CandidateSelector(lockProgressMeters = 50.0)
    private val candidates = linkedMapOf<String, Candidate>()
    private var selectedId: String? = null

    suspend fun process(sample: LiveTelemetry, sensors: SensorStatus) = mutex.withLock {
        val lat = sample.lat ?: return@withLock
        val lng = sample.lng ?: return@withLock
        if (candidates.isEmpty()) discover(lat, lng)
        if (candidates.isEmpty()) return@withLock

        val states = candidates.mapValues { (_, candidate) ->
            candidate.matcher.update(sample.timestampMs, lat, lng)
        }
        states.filterValues { it.decision == LiveMatchDecision.ABANDONED }
            .keys.forEach { candidates.remove(it) }

        val scores = candidates.mapNotNull { (id, candidate) ->
            val state = states[id] ?: return@mapNotNull null
            CandidateScore(
                segmentId = id,
                directionValid = state.decision != LiveMatchDecision.ABANDONED,
                progressMeters = state.furthestProgressMeters,
                startDistanceMeters = GeoProjection.distanceMeters(
                    lat, lng,
                    candidate.definition.referencePolyline.first().lat,
                    candidate.definition.referencePolyline.first().lng,
                ),
            )
        }
        val selected = selector.select(scores)
        if (selected == null) {
            selectedId?.let { finish("no-valid-candidate") }
            reset()
            return@withLock
        }

        if (selectedId != selected.segmentId) {
            if (selectedId != null) finish("candidate-replaced-before-lock")
            selectedId = selected.segmentId
            val definition = candidates.getValue(selected.segmentId).definition
            begin(newSession(candidates.getValue(selected.segmentId), sensors, sample.timestampMs))
        }

        val definition = candidates.getValue(selected.segmentId).definition
        val state = states.getValue(selected.segmentId)
        val uiState = uiState(
            candidates.getValue(selected.segmentId),
            state.progressMeters,
            sensors,
            state.deviationMeters,
        )
        update(sample, uiState, state.maxDeviationMeters)
        when (state.decision) {
            LiveMatchDecision.COMPLETED -> {
                finish("completed")
                reset()
            }
            LiveMatchDecision.ABANDONED -> {
                finish(state.reason ?: "abandoned")
                reset()
            }
            LiveMatchDecision.TRACKING -> Unit
        }
    }

    fun reset() {
        candidates.clear()
        selector.reset()
        selectedId = null
    }

    private suspend fun discover(lat: Double, lng: Double) {
        val latDelta = START_SEARCH_METERS / 111_320.0
        val longitudeScale = cos(Math.toRadians(lat)).coerceAtLeast(0.01)
        val lngDelta = START_SEARCH_METERS / (111_320.0 * longitudeScale)
        // Rider data is read once during candidate discovery, never on the 1 Hz update path.
        val ftpWatts = database.riderHistoryDao().profile()?.ftpWatts
        database.segmentDao().segmentStartsInBounds(
            lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta,
        ).forEach { entity ->
            val definition = loadDefinition(entity)
            val matcher = DirectedLiveMatcher(definition)
            if (matcher.canStart(lat, lng)) {
                candidates[entity.id] = Candidate(definition, matcher, ftpWatts)
            }
        }
    }

    private suspend fun loadDefinition(entity: SegmentEntity): SegmentDefinition = SegmentDefinition(
        id = entity.id,
        name = entity.name,
        corridorMeters = entity.corridorMeters,
        requiredCoveragePct = entity.requiredCoveragePct,
        schemaVersion = entity.schemaVersion,
        fingerprint = entity.fingerprint,
        referencePolyline = database.segmentDao().points(entity.id).map {
            GeoPoint(it.lat, it.lng, it.distanceMeters, it.elevationMeters)
        },
    )

    private fun newSession(
        candidate: Candidate,
        sensors: SensorStatus,
        nowMs: Long,
    ): ActiveAttemptSession = ActiveAttemptSession(
        attemptId = UUID.randomUUID().toString(),
        segmentId = candidate.definition.id,
        startedAtMs = nowMs,
        initialUiState = uiState(candidate, 0.0, sensors, 0.0),
        ftpWatts = candidate.ftpWatts,
    )

    private fun uiState(
        candidate: Candidate,
        progressMeters: Double,
        sensors: SensorStatus,
        deviationMeters: Double,
    ): LiveUiState {
        val definition = candidate.definition
        val total = definition.referencePolyline.last().distanceMeters
        val profile = definition.referencePolyline.map {
            ElevationSample(it.distanceMeters, it.elevationMeters ?: 0.0)
        }
        val provisional = candidate.ftpWatts?.let {
            ProvisionalPacingPlanner.create(SegmentPacingInput(total, it))
        }
        val zones = provisional?.zones.orEmpty().map {
            PacingZone(
                it.startDistanceMeters,
                it.endDistanceMeters,
                it.targetPowerWatts,
                Effort.valueOf(it.classification.name),
            )
        }
        val current = provisional?.zones?.firstOrNull {
            progressMeters >= it.startDistanceMeters && progressMeters <= it.endDistanceMeters
        }
        return LiveUiState(
            segmentName = definition.name,
            progressMeters = progressMeters.coerceIn(0.0, total),
            totalDistanceMeters = total,
            elevationProfile = profile,
            pacingZones = zones,
            recommendation = current?.let {
                Recommendation(
                    it.targetPowerWatts,
                    it.instruction,
                    GuidanceIcon.valueOf(it.icon.name),
                )
            },
            sensorStatus = sensors,
            matchStatus = if (deviationMeters > definition.corridorMeters) {
                MatchStatus.UNCERTAIN
            } else {
                MatchStatus.ACTIVE
            },
        )
    }

    companion object {
        private const val START_SEARCH_METERS = 30.0
    }
}

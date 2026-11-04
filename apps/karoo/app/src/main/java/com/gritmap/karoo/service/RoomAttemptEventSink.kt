package com.gritmap.karoo.service

import com.gritmap.karoo.data.AttemptCheckpointEntity
import com.gritmap.karoo.data.KarooDatabase
import com.gritmap.karoo.data.SegmentAttemptEntity
import com.gritmap.karoo.matching.LIVE_MATCHER_VERSION

/** Persists only macro events. Ordinary 1 Hz telemetry never calls this class. */
class RoomAttemptEventSink(private val database: KarooDatabase) : AttemptEventSink {
    override suspend fun onSegmentEntry(session: ActiveAttemptSession) {
        database.attemptDao().insertConcurrentAttemptIfAbsent(
            SegmentAttemptEntity(
                id = session.attemptId,
                segmentId = session.segmentId,
                startedAtMs = session.startedAtMs,
                endedAtMs = null,
                startProgressMeters = session.uiState.progressMeters,
                endProgressMeters = session.uiState.progressMeters,
                coveragePct = session.uiState.progressFraction.toDouble(),
                maxDeviationMeters = session.maxDeviationMeters,
                outcome = "ACTIVE",
                outcomeReason = null,
                matcherVersion = LIVE_MATCHER_VERSION,
                pacingPlanId = session.pacingPlanId,
                averagePowerWatts = null,
                averageHeartRateBpm = null,
                averageCadenceRpm = null,
                averageSpeedMetersPerSecond = null,
            ),
        )
    }

    override suspend fun onPlanChanged(session: ActiveAttemptSession) = saveCheckpoint(session)

    override suspend fun onCheckpoint(session: ActiveAttemptSession) = saveCheckpoint(session)

    override suspend fun onSegmentExit(session: ActiveAttemptSession, reason: String) {
        val completed = session.uiState.matchStatus.name == "COMPLETE"
        val result = session.completionSnapshot ?: session.freezeResult()
        // Upsert a full final row atomically: a delayed entry write is IGNORE and cannot replace it.
        database.attemptDao().saveFinalAttempt(
            SegmentAttemptEntity(
                id = session.attemptId,
                segmentId = session.segmentId,
                startedAtMs = session.startedAtMs,
                endedAtMs = result.endedAtMs ?: System.currentTimeMillis(),
                startProgressMeters = session.initialProgressMeters,
                endProgressMeters = session.uiState.progressMeters,
                coveragePct = session.uiState.progressFraction.toDouble(),
                maxDeviationMeters = session.maxDeviationMeters,
                outcome = if (completed) "COMPLETED" else "ABANDONED",
                outcomeReason = if (completed) null else reason,
                matcherVersion = LIVE_MATCHER_VERSION,
                pacingPlanId = session.pacingPlanId,
                averagePowerWatts = session.averagePowerWatts,
                averageHeartRateBpm = session.averageHeartRateBpm,
                averageCadenceRpm = session.averageCadenceRpm,
                averageSpeedMetersPerSecond = session.averageSpeedMetersPerSecond,
                sampledElapsedSeconds = result.elapsedSeconds,
                goalFinishSecondsAtCompletion = result.goalSeconds,
                completedSegmentName = result.segmentName,
                completedSegmentFingerprint = result.segmentFingerprint,
                resultTimingVersion = 1,
            ),
        )
    }

    private suspend fun saveCheckpoint(session: ActiveAttemptSession) {
        database.attemptDao().saveCheckpoint(
            AttemptCheckpointEntity(
                attemptId = session.attemptId,
                timestampMs = System.currentTimeMillis(),
                progressMeters = session.uiState.progressMeters,
                coveragePct = session.uiState.progressFraction.toDouble(),
                maxDeviationMeters = session.maxDeviationMeters,
                pacingPlanId = session.pacingPlanId,
            ),
        )
    }
}

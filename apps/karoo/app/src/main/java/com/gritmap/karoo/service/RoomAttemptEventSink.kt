package com.gritmap.karoo.service

import com.gritmap.karoo.data.AttemptCheckpointEntity
import com.gritmap.karoo.data.KarooDatabase
import com.gritmap.karoo.data.SegmentAttemptEntity
import com.gritmap.karoo.matching.LIVE_MATCHER_VERSION

/** Persists only macro events. Ordinary 1 Hz telemetry never calls this class. */
class RoomAttemptEventSink(private val database: KarooDatabase) : AttemptEventSink {
    override suspend fun onSegmentEntry(session: ActiveAttemptSession) {
        database.attemptDao().insertAttempt(
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
                pacingPlanId = null,
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
        database.attemptDao().finalizeAttempt(
            attemptId = session.attemptId,
            endedAtMs = System.currentTimeMillis(),
            progress = session.uiState.progressMeters,
            coverage = session.uiState.progressFraction.toDouble(),
            maxDeviation = session.maxDeviationMeters,
            outcome = if (completed) "COMPLETED" else "ABANDONED",
            reason = if (completed) null else reason,
            power = session.averagePowerWatts,
            heartRate = session.averageHeartRateBpm,
            cadence = session.averageCadenceRpm,
            speed = session.averageSpeedMetersPerSecond,
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
                pacingPlanId = null,
            ),
        )
    }
}

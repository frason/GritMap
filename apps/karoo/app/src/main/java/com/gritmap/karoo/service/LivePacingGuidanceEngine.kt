package com.gritmap.karoo.service

import com.gritmap.karoo.ai.AiPacingResponseParser
import com.gritmap.karoo.ai.AiPlanValidator
import com.gritmap.karoo.ai.NeedleAgentManager
import com.gritmap.karoo.ai.TelemetryV1
import com.gritmap.karoo.pacing.PacingPlan
import com.gritmap.karoo.pacing.SegmentPacingInput
import com.gritmap.karoo.ui.state.Effort
import com.gritmap.karoo.ui.state.GuidanceIcon
import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.PacingZone
import com.gritmap.karoo.ui.state.Recommendation

/** Advisory pacing boundary. Deterministic matching never calls into this interface. */
interface LivePacingGuidanceEngine {
    suspend fun initialPlan(session: ActiveAttemptSession): LiveUiState?
    suspend fun adapt(session: ActiveAttemptSession, sample: LiveTelemetry): LiveUiState?
}

class NeedleLivePacingGuidanceEngine(
    private val manager: NeedleAgentManager,
    private val validator: AiPlanValidator = AiPlanValidator(),
    private val targetFinishTimeSeconds: Int? = null,
) : LivePacingGuidanceEngine {
    override suspend fun initialPlan(session: ActiveAttemptSession): LiveUiState? {
        val ftp = session.ftpWatts ?: return null
        val total = session.uiState.totalDistanceMeters.takeIf { it > 0.0 } ?: return null
        val plan = manager.generatePlanOrFallback(
            SegmentPacingInput(
                total,
                ftp,
                targetFinishTimeSeconds ?: session.uiState.plannedFinishSeconds,
            ),
        )
        return session.uiState.withPlan(plan)
    }

    override suspend fun adapt(session: ActiveAttemptSession, sample: LiveTelemetry): LiveUiState? {
        val state = session.uiState
        val ftp = session.ftpWatts ?: return null
        if (!state.sensorStatus.adaptiveGuidanceAvailable) return null
        val power = sample.powerWatts ?: return null
        val heartRate = sample.heartRateBpm ?: return null
        val cadence = sample.cadenceRpm ?: return null
        val speed = sample.speedMetersPerSecond ?: return null
        val recent = session.recentSamples().takeLast(30)
        val rollingPower = recent.mapNotNull { it.powerWatts }.averageOr(power)
        val heartRates = recent.mapNotNull { it.heartRateBpm }
        val heartRateDrift = if (heartRates.size >= 4) {
            val middle = heartRates.size / 2
            heartRates.drop(middle).average() - heartRates.take(middle).average()
        } else 0.0
        val response = manager.processTelemetry(
            TelemetryV1(
                elapsedSeconds = ((sample.timestampMs - session.startedAtMs).coerceAtLeast(0L) / 1_000f),
                progressMeters = state.progressMeters.toFloat(),
                remainingMeters = (state.totalDistanceMeters - state.progressMeters).coerceAtLeast(0.0).toFloat(),
                gradePercent = 0f,
                powerWatts = power.toFloat(),
                heartRateBpm = heartRate.toFloat(),
                cadenceRpm = cadence.toFloat(),
                speedMetersPerSecond = speed.toFloat(),
                activeTargetWatts = (state.recommendation?.targetPowerWatts ?: ftp).toFloat(),
                rollingPowerWatts = rollingPower.toFloat(),
                heartRateDriftBpm = heartRateDrift.toFloat(),
                corridorDeviationMeters = session.maxDeviationMeters.toFloat(),
            ),
        ) ?: return null
        val plan = runCatching { AiPacingResponseParser.parse(response) }
            .mapCatching { validator.validate(it, state.totalDistanceMeters, ftp).getOrThrow() }
            .getOrNull() ?: return null
        return state.withPlan(plan)
    }

    private fun LiveUiState.withPlan(plan: PacingPlan): LiveUiState {
        val zones = plan.zones.map {
            PacingZone(
                startDistanceMeters = it.startDistanceMeters,
                endDistanceMeters = it.endDistanceMeters,
                targetPowerWatts = it.targetPowerWatts,
                effort = Effort.valueOf(it.classification.name),
            )
        }
        val active = plan.zones.firstOrNull {
            progressMeters >= it.startDistanceMeters && progressMeters <= it.endDistanceMeters
        } ?: plan.zones.lastOrNull()
        return copy(
            pacingZones = zones,
            recommendation = active?.let {
                Recommendation(
                    targetPowerWatts = it.targetPowerWatts,
                    instruction = it.instruction,
                    icon = GuidanceIcon.valueOf(it.icon.name),
                )
            },
        )
    }

    private fun List<Double>.averageOr(fallback: Double) = if (isEmpty()) fallback else average()
}

package com.gritmap.karoo.ai

import com.gritmap.karoo.pacing.PacingPlan
import kotlin.math.abs

data class AiPlanValidationConfig(
    val maximumInstructionCharacters: Int = 80,
    val maximumTargetStepWatts: Int = 100,
    val distanceEpsilonMeters: Double = 0.1,
)

class AiPlanValidator(private val config: AiPlanValidationConfig = AiPlanValidationConfig()) {
    fun validate(plan: PacingPlan, segmentLengthMeters: Double, ftpWatts: Int): Result<PacingPlan> = runCatching {
        require(segmentLengthMeters.isFinite() && segmentLengthMeters > 0.0) { "Invalid segment length" }
        require(ftpWatts > 0) { "Invalid FTP" }
        require(plan.zones.isNotEmpty()) { "Empty pacing plan" }
        val maximumPower = ftpWatts * 1.5
        plan.zones.forEachIndexed { index, zone ->
            require(zone.startDistanceMeters.isFinite() && zone.endDistanceMeters.isFinite()) { "Non-finite distance" }
            require(zone.endDistanceMeters > zone.startDistanceMeters) { "Empty or reversed zone" }
            require(zone.targetPowerWatts in 0..maximumPower.toInt()) { "Target exceeds safe FTP bound" }
            require(zone.instruction.isNotBlank() && zone.instruction.length <= config.maximumInstructionCharacters) { "Invalid instruction" }
            if (index == 0) require(abs(zone.startDistanceMeters) <= config.distanceEpsilonMeters) { "Plan must start at zero" }
            if (index > 0) {
                val previous = plan.zones[index - 1]
                require(abs(previous.endDistanceMeters - zone.startDistanceMeters) <= config.distanceEpsilonMeters) { "Plan zones must be contiguous" }
                require(abs(previous.targetPowerWatts - zone.targetPowerWatts) <= config.maximumTargetStepWatts) { "Target transition too large" }
            }
        }
        require(abs(plan.zones.last().endDistanceMeters - segmentLengthMeters) <= config.distanceEpsilonMeters) { "Plan does not cover segment" }
        plan
    }
}

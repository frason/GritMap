package com.gritmap.karoo.pacing

/** A safe, deterministic plan displayed while the native model is working. */
object ProvisionalPacingPlanner {
    fun create(input: SegmentPacingInput): PacingPlan {
        require(input.segmentLengthMeters > 0.0) { "segmentLengthMeters must be positive" }
        require(input.ftpWatts > 0) { "ftpWatts must be positive" }

        val target = (input.ftpWatts * 0.95).toInt().coerceAtLeast(1)
        return PacingPlan(
            zones = listOf(
                PacingZone(
                    startDistanceMeters = 0.0,
                    endDistanceMeters = input.segmentLengthMeters,
                    targetPowerWatts = target,
                    classification = PacingClassification.HOLD,
                    icon = RecommendationIcon.HOLD,
                    instruction = "Settle into a sustainable effort",
                ),
            ),
            source = PacingPlan.Source.PROVISIONAL,
        )
    }
}

package com.gritmap.karoo.pacing

enum class PacingClassification { RECOVER, HOLD, PUSH }

enum class RecommendationIcon { RECOVER, HOLD, PUSH, WARNING }

data class PacingZone(
    val startDistanceMeters: Double,
    val endDistanceMeters: Double,
    val targetPowerWatts: Int,
    val classification: PacingClassification,
    val icon: RecommendationIcon,
    val instruction: String,
)

data class PacingPlan(
    val schemaVersion: Int = 1,
    val zones: List<PacingZone>,
    val source: Source,
) {
    enum class Source { PROVISIONAL, NEEDLE }
}

data class SegmentPacingInput(
    val segmentLengthMeters: Double,
    val ftpWatts: Int,
    val targetFinishTimeSeconds: Int? = null,
)

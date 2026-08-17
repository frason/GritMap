package com.gritmap.karoo.domain

data class GeoPoint(
    val lat: Double,
    val lng: Double,
    val distanceMeters: Double,
    val elevationMeters: Double? = null,
)

data class SegmentDefinition(
    val id: String,
    val name: String,
    val corridorMeters: Int = 30,
    val requiredCoveragePct: Double = 0.9,
    val schemaVersion: Int = 1,
    val fingerprint: String,
    val referencePolyline: List<GeoPoint>,
)

enum class PacingClassification { RECOVER, HOLD, PUSH }

data class PacingZone(
    val startDistanceMeters: Double,
    val endDistanceMeters: Double,
    val targetPowerWatts: Int,
    val classification: PacingClassification,
    val icon: String,
    val instruction: String,
)

data class PacingPlan(
    val id: String,
    val segmentId: String,
    val segmentFingerprint: String,
    val createdAtMs: Long,
    val zones: List<PacingZone>,
)

enum class AttemptOutcome { ACTIVE, COMPLETED, ABANDONED }

data class SegmentAttempt(
    val id: String,
    val segmentId: String,
    val startedAtMs: Long,
    val endedAtMs: Long? = null,
    val startProgressMeters: Double = 0.0,
    val endProgressMeters: Double = 0.0,
    val coveragePct: Double = 0.0,
    val maxDeviationMeters: Double = 0.0,
    val outcome: AttemptOutcome = AttemptOutcome.ACTIVE,
    val outcomeReason: String? = null,
    val matcherVersion: Int,
    val pacingPlanId: String? = null,
)

data class RiderProfile(
    val ftpWatts: Int,
    val weightKg: Double,
    val maxHeartRateBpm: Int? = null,
    val thresholdHeartRateBpm: Int? = null,
)

data class TrainingLoadSummary(
    val periodStartMs: Long,
    val periodEndMs: Long,
    val load: Double,
)

data class HistoricalAttemptSample(
    val segmentId: String,
    val attemptId: String,
    val distanceMeters: Double,
    val powerWatts: Double? = null,
    val heartRateBpm: Double? = null,
    val cadenceRpm: Double? = null,
    val speedMetersPerSecond: Double? = null,
    val elevationMeters: Double? = null,
)

data class RiderHistoryPackage(
    val schemaVersion: Int,
    val profile: RiderProfile,
    val trainingLoads: List<TrainingLoadSummary>,
    val samples: List<HistoricalAttemptSample>,
)

data class TelemetrySample(
    val timestampMs: Long,
    val lat: Double,
    val lng: Double,
    val elevationMeters: Double? = null,
    val powerWatts: Double? = null,
    val heartRateBpm: Double? = null,
    val cadenceRpm: Double? = null,
    val speedMetersPerSecond: Double? = null,
)


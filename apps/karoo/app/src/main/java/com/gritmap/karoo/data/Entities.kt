package com.gritmap.karoo.data

import androidx.room.Entity
import androidx.room.ColumnInfo
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "segments", indices = [Index(value = ["fingerprint"], unique = true)])
data class SegmentEntity(
    @PrimaryKey val id: String,
    val name: String,
    val corridorMeters: Int = 30,
    val requiredCoveragePct: Double = 0.9,
    val schemaVersion: Int,
    val fingerprint: String,
)

@Entity(
    tableName = "segment_reference_points",
    foreignKeys = [ForeignKey(
        entity = SegmentEntity::class,
        parentColumns = ["id"], childColumns = ["segmentId"],
        onDelete = ForeignKey.CASCADE,
    )],
    indices = [
        Index(value = ["segmentId", "pointIndex"], unique = true),
        Index(value = ["lat", "lng"]),
        Index(value = ["segmentId", "distanceMeters"]),
    ],
)
data class SegmentReferencePointEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val segmentId: String,
    val pointIndex: Int,
    val lat: Double,
    val lng: Double,
    val distanceMeters: Double,
    val elevationMeters: Double?,
)

@Entity(tableName = "pacing_plans", foreignKeys = [ForeignKey(
    entity = SegmentEntity::class, parentColumns = ["id"], childColumns = ["segmentId"],
    onDelete = ForeignKey.CASCADE,
)], indices = [Index(value = ["segmentId", "isBaseline"])])
data class PacingPlanEntity(
    @PrimaryKey val id: String,
    val segmentId: String,
    val segmentFingerprint: String,
    val createdAtMs: Long,
    @ColumnInfo(defaultValue = "'LOCAL'") val source: String = "LOCAL",
    val generatorModelVersion: String? = null,
    val ftpWatts: Int? = null,
    val targetFinishTimeSeconds: Int? = null,
    @ColumnInfo(defaultValue = "0") val isBaseline: Boolean = false,
)

@Entity(tableName = "pacing_zones", foreignKeys = [ForeignKey(
    entity = PacingPlanEntity::class, parentColumns = ["id"], childColumns = ["planId"],
    onDelete = ForeignKey.CASCADE,
)], indices = [Index(value = ["planId", "startDistanceMeters"], unique = true)])
data class PacingZoneEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val planId: String,
    val startDistanceMeters: Double,
    val endDistanceMeters: Double,
    val targetPowerWatts: Int,
    val classification: String,
    val icon: String,
    val instruction: String,
)

@Entity(tableName = "segment_attempts", foreignKeys = [ForeignKey(
    entity = SegmentEntity::class, parentColumns = ["id"], childColumns = ["segmentId"],
    onDelete = ForeignKey.CASCADE,
)], indices = [Index("segmentId"), Index("startedAtMs")])
data class SegmentAttemptEntity(
    @PrimaryKey val id: String,
    val segmentId: String,
    val startedAtMs: Long,
    val endedAtMs: Long?,
    val startProgressMeters: Double,
    val endProgressMeters: Double,
    val coveragePct: Double,
    val maxDeviationMeters: Double,
    val outcome: String,
    val outcomeReason: String?,
    val matcherVersion: Int,
    val pacingPlanId: String?,
    val averagePowerWatts: Double?,
    val averageHeartRateBpm: Double?,
    val averageCadenceRpm: Double?,
    val averageSpeedMetersPerSecond: Double?,
)

@Entity(tableName = "attempt_checkpoints", foreignKeys = [ForeignKey(
    entity = SegmentAttemptEntity::class, parentColumns = ["id"], childColumns = ["attemptId"],
    onDelete = ForeignKey.CASCADE,
)], indices = [Index("attemptId")])
data class AttemptCheckpointEntity(
    @PrimaryKey val attemptId: String,
    val timestampMs: Long,
    val progressMeters: Double,
    val coveragePct: Double,
    val maxDeviationMeters: Double,
    val pacingPlanId: String?,
)

@Entity(tableName = "rider_profiles")
data class RiderProfileEntity(
    @PrimaryKey val singletonId: Int = 1,
    val schemaVersion: Int,
    val ftpWatts: Int,
    val weightKg: Double,
    val maxHeartRateBpm: Int?,
    val thresholdHeartRateBpm: Int?,
)

@Entity(tableName = "training_load_summaries", indices = [Index("periodStartMs")])
data class TrainingLoadEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val periodStartMs: Long,
    val periodEndMs: Long,
    val load: Double,
)

@Entity(tableName = "historical_attempt_samples", indices = [
    Index(value = ["segmentId", "attemptId", "distanceMeters"], unique = true),
])
data class HistoricalAttemptSampleEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val segmentId: String,
    val attemptId: String,
    val distanceMeters: Double,
    val powerWatts: Double?,
    val heartRateBpm: Double?,
    val cadenceRpm: Double?,
    val speedMetersPerSecond: Double?,
    val elevationMeters: Double?,
)

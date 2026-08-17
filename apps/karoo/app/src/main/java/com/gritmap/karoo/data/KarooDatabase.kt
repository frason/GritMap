package com.gritmap.karoo.data

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.RoomDatabase
import androidx.room.Transaction

data class SegmentLibraryRow(
    val id: String,
    val name: String,
    val fingerprint: String,
    val corridorMeters: Int,
    val requiredCoveragePct: Double,
    val pointCount: Int,
    val lengthMeters: Double,
    val hasBaselinePlan: Boolean,
)

@Dao
interface SegmentDao {
    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertSegment(segment: SegmentEntity)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertPoints(points: List<SegmentReferencePointEntity>)

    @Transaction
    suspend fun insertDefinition(segment: SegmentEntity, points: List<SegmentReferencePointEntity>) {
        insertSegment(segment)
        insertPoints(points)
    }

    @Query("SELECT * FROM segments WHERE id = :id")
    suspend fun segment(id: String): SegmentEntity?

    @Query("SELECT * FROM segments WHERE fingerprint = :fingerprint")
    suspend fun segmentByFingerprint(fingerprint: String): SegmentEntity?

    @Query("""
        SELECT s.id, s.name, s.fingerprint, s.corridorMeters, s.requiredCoveragePct,
               COUNT(DISTINCT p.id) AS pointCount,
               COALESCE(MAX(p.distanceMeters), 0) AS lengthMeters,
               CASE WHEN COUNT(pp.id) > 0 THEN 1 ELSE 0 END AS hasBaselinePlan
        FROM segments s
        LEFT JOIN segment_reference_points p ON p.segmentId = s.id
        LEFT JOIN pacing_plans pp ON pp.segmentId = s.id AND pp.isBaseline = 1
        GROUP BY s.id
        ORDER BY s.name COLLATE NOCASE, s.id
    """)
    suspend fun library(): List<SegmentLibraryRow>

    @Query("SELECT * FROM segment_reference_points WHERE segmentId = :segmentId ORDER BY pointIndex")
    suspend fun points(segmentId: String): List<SegmentReferencePointEntity>

    @Query("SELECT DISTINCT s.* FROM segments s JOIN segment_reference_points p ON p.segmentId = s.id WHERE p.pointIndex = 0 AND p.lat BETWEEN :minLat AND :maxLat AND p.lng BETWEEN :minLng AND :maxLng")
    suspend fun segmentStartsInBounds(minLat: Double, maxLat: Double, minLng: Double, maxLng: Double): List<SegmentEntity>

    @Query("DELETE FROM segments WHERE id = :id")
    suspend fun delete(id: String)
}

@Dao
interface AttemptDao {
    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertAttempt(attempt: SegmentAttemptEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveCheckpoint(checkpoint: AttemptCheckpointEntity)

    @Query("SELECT * FROM attempt_checkpoints WHERE attemptId = :attemptId")
    suspend fun checkpoint(attemptId: String): AttemptCheckpointEntity?

    @Query("UPDATE segment_attempts SET endedAtMs=:endedAtMs, endProgressMeters=:progress, coveragePct=:coverage, maxDeviationMeters=:maxDeviation, outcome=:outcome, outcomeReason=:reason, averagePowerWatts=:power, averageHeartRateBpm=:heartRate, averageCadenceRpm=:cadence, averageSpeedMetersPerSecond=:speed WHERE id=:attemptId")
    suspend fun finalizeAttempt(attemptId: String, endedAtMs: Long, progress: Double, coverage: Double,
        maxDeviation: Double, outcome: String, reason: String?, power: Double?, heartRate: Double?,
        cadence: Double?, speed: Double?)
}

@Dao
interface PacingDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlan(plan: PacingPlanEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertZones(zones: List<PacingZoneEntity>)

    @Query("DELETE FROM pacing_plans WHERE segmentId = :segmentId AND isBaseline = 1")
    suspend fun deleteBaseline(segmentId: String)

    @Query("SELECT * FROM pacing_plans WHERE segmentId = :segmentId AND isBaseline = 1 LIMIT 1")
    suspend fun baseline(segmentId: String): PacingPlanEntity?

    @Transaction
    suspend fun replacePlan(plan: PacingPlanEntity, zones: List<PacingZoneEntity>) {
        if (plan.isBaseline) deleteBaseline(plan.segmentId)
        insertPlan(plan)
        insertZones(zones)
    }
}

@Dao
interface RiderHistoryDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun saveProfile(profile: RiderProfileEntity)
    @Query("DELETE FROM training_load_summaries") suspend fun clearLoads()
    @Query("DELETE FROM historical_attempt_samples") suspend fun clearSamples()
    @Insert suspend fun insertLoads(loads: List<TrainingLoadEntity>)
    @Insert suspend fun insertSamples(samples: List<HistoricalAttemptSampleEntity>)

    @Query("SELECT * FROM rider_profiles WHERE singletonId = 1")
    suspend fun profile(): RiderProfileEntity?

    @Transaction
    suspend fun replace(profile: RiderProfileEntity, loads: List<TrainingLoadEntity>, samples: List<HistoricalAttemptSampleEntity>) {
        saveProfile(profile)
        clearLoads(); clearSamples()
        insertLoads(loads); insertSamples(samples)
    }
}

@Database(
    entities = [SegmentEntity::class, SegmentReferencePointEntity::class, PacingPlanEntity::class,
        PacingZoneEntity::class, SegmentAttemptEntity::class, AttemptCheckpointEntity::class,
        RiderProfileEntity::class, TrainingLoadEntity::class, HistoricalAttemptSampleEntity::class],
    version = 2,
    exportSchema = true,
)
abstract class KarooDatabase : RoomDatabase() {
    abstract fun segmentDao(): SegmentDao
    abstract fun attemptDao(): AttemptDao
    abstract fun pacingDao(): PacingDao
    abstract fun riderHistoryDao(): RiderHistoryDao
}

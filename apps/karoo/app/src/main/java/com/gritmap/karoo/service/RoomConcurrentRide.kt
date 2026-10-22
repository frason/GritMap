package com.gritmap.karoo.service

import com.gritmap.karoo.data.*
import com.gritmap.karoo.domain.GeoPoint
import com.gritmap.karoo.domain.SegmentDefinition
import com.gritmap.karoo.matching.LIVE_MATCHER_VERSION
import com.gritmap.karoo.ui.state.*
import kotlin.math.cos

internal class RoomConcurrentDiscovery(
    private val database: KarooDatabase,
    private val approach: (String) -> Unit,
) {
    private var lastApproachMs: Long? = null
    suspend fun discover(lat: Double, lng: Double, nowMs: Long): List<ConcurrentRideSegment> {
        val longitudeScale = cos(Math.toRadians(lat)).coerceAtLeast(0.01)
        suspend fun starts(radius: Double) = database.segmentDao().segmentStartsInBounds(
            lat - radius / 111_320.0, lat + radius / 111_320.0,
            lng - radius / (111_320.0 * longitudeScale), lng + radius / (111_320.0 * longitudeScale))
        if (lastApproachMs?.let { nowMs - it >= 10_000 } != false) {
            lastApproachMs = nowMs
            starts(250.0).forEach { approach(it.id) }
        }
        val ftp = database.riderHistoryDao().profile()?.ftpWatts
        return starts(30.0).sortedBy { it.fingerprint }.map { entity ->
            val points = database.segmentDao().points(entity.id)
            val plan = database.pacingDao().baseline(entity.id)
            val zones = plan?.let { database.pacingDao().zones(it.id) }.orEmpty()
            ConcurrentRideSegment(
                SegmentDefinition(entity.id, entity.name, entity.corridorMeters, entity.requiredCoveragePct,
                    entity.schemaVersion, entity.fingerprint, points.map { GeoPoint(it.lat, it.lng, it.distanceMeters, it.elevationMeters) }),
                ftp, plan?.id, plan?.targetFinishTimeSeconds,
                zones.map { PacingZone(it.startDistanceMeters, it.endDistanceMeters, it.targetPowerWatts, Effort.valueOf(it.classification.uppercase())) },
                zones.map { Recommendation(it.targetPowerWatts, it.instruction, GuidanceIcon.valueOf(it.icon.uppercase())) },
            )
        }
    }
}

internal class RoomConcurrentAttemptPersistence(private val database: KarooDatabase) : ConcurrentAttemptPersistence {
    override suspend fun enter(record: ConcurrentAttemptRecord) {
        database.attemptDao().insertConcurrentAttemptIfAbsent(SegmentAttemptEntity(record.attemptId, record.segmentId,
            record.startedAtMs, null, record.state.progressMeters, record.state.progressMeters,
            record.state.progressFraction.toDouble(), record.maxDeviation, "ACTIVE", null, LIVE_MATCHER_VERSION,
            record.planId, null, null, null, null))
    }
    override suspend fun checkpoint(record: ConcurrentAttemptRecord) {
        database.attemptDao().saveCheckpoint(AttemptCheckpointEntity(record.attemptId, record.timestampMs,
            record.state.progressMeters, record.state.progressFraction.toDouble(), record.maxDeviation, record.planId))
    }
    override suspend fun finish(record: ConcurrentAttemptRecord, reason: String) {
        database.attemptDao().finalizeAttempt(record.attemptId, record.timestampMs, record.state.progressMeters,
            record.state.progressFraction.toDouble(), record.maxDeviation,
            if (reason == "completed") "COMPLETED" else "ABANDONED", if (reason == "completed") null else reason,
            record.power, record.heartRate, record.cadence, record.speed)
    }
}

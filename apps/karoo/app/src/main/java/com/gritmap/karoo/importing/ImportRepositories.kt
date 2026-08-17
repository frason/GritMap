package com.gritmap.karoo.importing

import com.gritmap.karoo.data.HistoricalAttemptSampleEntity
import com.gritmap.karoo.data.KarooDatabase
import com.gritmap.karoo.data.RiderProfileEntity
import com.gritmap.karoo.data.SegmentEntity
import com.gritmap.karoo.data.SegmentReferencePointEntity
import com.gritmap.karoo.data.TrainingLoadEntity
import com.gritmap.karoo.domain.RiderHistoryPackage
import com.gritmap.karoo.domain.SegmentDefinition

class SegmentImportRepository(
    private val database: KarooDatabase,
    private val parser: SegmentJsonParser = SegmentJsonParser(),
) {
    suspend fun importSegment(json: String): SegmentDefinition {
        val definition = parser.parse(json)
        importDefinition(definition)
        return definition
    }

    suspend fun importDefinition(definition: SegmentDefinition) {
        database.segmentDao().insertDefinition(
            SegmentEntity(
                id = definition.id,
                name = definition.name,
                corridorMeters = definition.corridorMeters,
                requiredCoveragePct = definition.requiredCoveragePct,
                schemaVersion = definition.schemaVersion,
                fingerprint = definition.fingerprint,
            ),
            definition.referencePolyline.mapIndexed { index, point ->
                SegmentReferencePointEntity(
                    segmentId = definition.id,
                    pointIndex = index,
                    lat = point.lat,
                    lng = point.lng,
                    distanceMeters = point.distanceMeters,
                    elevationMeters = point.elevationMeters,
                )
            },
        )
    }
}

class RiderHistoryImportRepository(
    private val database: KarooDatabase,
    private val parser: RiderHistoryJsonParser = RiderHistoryJsonParser(),
) {
    suspend fun importRiderHistory(json: String): RiderHistoryPackage {
        val history = parser.parse(json)
        importHistory(history)
        return history
    }

    suspend fun importHistory(history: RiderHistoryPackage) {
        database.riderHistoryDao().replace(
            RiderProfileEntity(
                schemaVersion = history.schemaVersion,
                ftpWatts = history.profile.ftpWatts,
                weightKg = history.profile.weightKg,
                maxHeartRateBpm = history.profile.maxHeartRateBpm,
                thresholdHeartRateBpm = history.profile.thresholdHeartRateBpm,
            ),
            history.trainingLoads.map {
                TrainingLoadEntity(periodStartMs = it.periodStartMs, periodEndMs = it.periodEndMs, load = it.load)
            },
            history.samples.map {
                HistoricalAttemptSampleEntity(
                    segmentId = it.segmentId,
                    attemptId = it.attemptId,
                    distanceMeters = it.distanceMeters,
                    powerWatts = it.powerWatts,
                    heartRateBpm = it.heartRateBpm,
                    cadenceRpm = it.cadenceRpm,
                    speedMetersPerSecond = it.speedMetersPerSecond,
                    elevationMeters = it.elevationMeters,
                )
            },
        )
    }
}

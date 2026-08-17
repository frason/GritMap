package com.gritmap.karoo.importing

import com.gritmap.karoo.data.KarooDatabase
import com.gritmap.karoo.data.SegmentLibraryRow

enum class RawSegmentImportResult { IMPORTED, DUPLICATE }

class SegmentLibraryRepository(
    private val database: KarooDatabase,
    private val parser: SegmentJsonParser = SegmentJsonParser(),
    private val importer: SegmentImportRepository = SegmentImportRepository(database, parser),
) {
    suspend fun list(): List<SegmentLibraryRow> = database.segmentDao().library()

    suspend fun delete(segmentId: String) {
        database.segmentDao().delete(segmentId)
    }

    suspend fun importRawSegment(json: String): RawSegmentImportResult {
        val definition = parser.parse(json)
        val sameFingerprint = database.segmentDao().segmentByFingerprint(definition.fingerprint)
        if (sameFingerprint != null) return RawSegmentImportResult.DUPLICATE
        val sameId = database.segmentDao().segment(definition.id)
        if (sameId != null) fail("Segment id already exists with different immutable geography")
        importer.importDefinition(definition)
        return RawSegmentImportResult.IMPORTED
    }
}

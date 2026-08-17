package com.gritmap.karoo.data

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.gritmap.karoo.importing.SegmentImportRepository
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class KarooDatabaseTest {
    private lateinit var db: KarooDatabase

    @Before fun create() {
        db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext<Context>(), KarooDatabase::class.java)
            .allowMainThreadQueries().build()
    }

    @After fun close() = db.close()

    @Test fun orderedPointsAndSegmentCascade() = runBlocking {
        val segment = SegmentEntity("s", "segment", 30, .9, 1, "fingerprint")
        db.segmentDao().insertDefinition(segment, listOf(
            SegmentReferencePointEntity(segmentId = "s", pointIndex = 1, lat = 1.1, lng = 2.0, distanceMeters = 10.0, elevationMeters = 4.0),
            SegmentReferencePointEntity(segmentId = "s", pointIndex = 0, lat = 1.0, lng = 2.0, distanceMeters = 0.0, elevationMeters = 3.0),
        ))
        assertEquals(listOf(0, 1), db.segmentDao().points("s").map { it.pointIndex })
        db.attemptDao().insertAttempt(SegmentAttemptEntity("a", "s", 1, null, 0.0, 0.0, 0.0, 0.0,
            "ACTIVE", null, 1, null, null, null, null, null))
        db.attemptDao().saveCheckpoint(AttemptCheckpointEntity("a", 2, 5.0, .05, 1.0, null))
        db.segmentDao().delete("s")
        assertNull(db.attemptDao().checkpoint("a"))
        assertEquals(0, db.segmentDao().points("s").size)
    }

    @Test fun segmentRepositoryParsesAndPersistsInOneTransaction() = runBlocking {
        val imported = SegmentImportRepository(db).importSegment("""
            {"schemaVersion":1,"id":"imported","name":"Imported","direction":"forward",
             "matching":{"corridorMeters":30,"requiredCoveragePct":0.9},
             "referencePolyline":[
               {"lat":37.0,"lng":-122.0,"distanceMeters":0,"elevationMeters":1},
               {"lat":37.001,"lng":-122.0,"distanceMeters":111,"elevationMeters":2}]}
        """.trimIndent())
        assertEquals(imported.fingerprint, db.segmentDao().segment("imported")?.fingerprint)
        assertEquals(2, db.segmentDao().points("imported").size)
    }
}

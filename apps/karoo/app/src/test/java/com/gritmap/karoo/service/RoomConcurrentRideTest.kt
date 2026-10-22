package com.gritmap.karoo.service

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.gritmap.karoo.data.KarooDatabase
import com.gritmap.karoo.data.SegmentEntity
import com.gritmap.karoo.domain.GeoPoint
import com.gritmap.karoo.domain.SegmentDefinition
import com.gritmap.karoo.ui.state.SensorStatus
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [31])
class RoomConcurrentRideTest {
    @Test fun `overlapping attempts persist independently with sample timestamps`() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val db = Room.inMemoryDatabaseBuilder(context, KarooDatabase::class.java).allowMainThreadQueries().build()
        try {
            suspend fun definition(id: String, length: Double): ConcurrentRideSegment {
                db.segmentDao().insertSegment(SegmentEntity(id, id, 20, .99, 1, id))
                return ConcurrentRideSegment(SegmentDefinition(id, id, 20, .99, 1, id, listOf(
                    GeoPoint(0.0, 0.0, 0.0), GeoPoint(0.0, length / 111_195.0, length))))
            }
            val segments = listOf(definition("a", 100.0), definition("b", 200.0))
            val ride = ConcurrentLiveRide({ _, _, _ -> segments }, RoomConcurrentAttemptPersistence(db), {})
            suspend fun tick(t: Long, distance: Double) = ride.process(LiveTelemetry(t, lat = 0.0,
                lng = distance / 111_195.0, powerWatts = 200.0), SensorStatus(gps = true, power = true))
            tick(1000, 0.0); tick(2000, 5.0); tick(3000, 10.0)
            tick(31000, 100.0)
            assertEquals(1, ride.activeCount)
            tick(61000, 200.0)
            db.openHelper.readableDatabase.query("SELECT startedAtMs, endedAtMs, outcome, averagePowerWatts FROM segment_attempts ORDER BY segmentId").use {
                assertEquals(2, it.count)
                assertTrue(it.moveToNext()); assertEquals(1000L, it.getLong(0)); assertEquals(31000L, it.getLong(1)); assertEquals("COMPLETED", it.getString(2))
                assertEquals(200.0, it.getDouble(3), 0.0)
                assertTrue(it.moveToNext()); assertEquals(1000L, it.getLong(0)); assertEquals(61000L, it.getLong(1))
            }
        } finally { db.close() }
    }
}

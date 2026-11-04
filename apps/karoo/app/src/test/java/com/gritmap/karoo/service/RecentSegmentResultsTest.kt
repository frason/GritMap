package com.gritmap.karoo.service

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.gritmap.karoo.data.*
import com.gritmap.karoo.ui.state.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.async
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[31])
class RecentSegmentResultsTest {
    private val context=ApplicationProvider.getApplicationContext<Context>()
    private fun memory()=Room.inMemoryDatabaseBuilder(context,KarooDatabase::class.java).allowMainThreadQueries().build()
    private suspend fun seed(db:KarooDatabase)=db.segmentDao().insertSegment(SegmentEntity("s","Original climb",30,.9,1,"f"))
    private suspend fun rows(db:KarooDatabase)=withTimeout(5000){db.attemptDao().recentCompleted().first()}
    private fun attempt(id:String,end:Long,outcome:String="COMPLETED")=SegmentAttemptEntity(
        id,"s",1000,end,0.0,500.0,1.0,0.0,outcome,null,1,null,200.0,140.0,null,null)

    @Test fun `normal completion survives late entry live clear next attempt and changed plan`() = runBlocking {
        val db=memory()
        try {
            seed(db)
            val originalPlan=PacingPlanEntity("p1","s","f",1000,targetFinishTimeSeconds=10,isBaseline=true)
            db.pacingDao().replacePlan(originalPlan,emptyList())
            val s=ActiveAttemptSession("a","s",1000,LiveUiState(segmentName="Original climb",totalDistanceMeters=500.0,plannedFinishSeconds=10,matchStatus=MatchStatus.ACTIVE),pacingPlanId="p1",segmentFingerprint="f")
            s.recordTelemetryTick(LiveTelemetry(1000,powerWatts=200.0,heartRateBpm=140.0))
            s.recordTelemetryTick(LiveTelemetry(11000,powerWatts=240.0,heartRateBpm=150.0))
            s.updateUiState(s.uiState.copy(progressMeters=500.0,matchStatus=MatchStatus.COMPLETE))
            s.freezeResult()
            // Goal/name metadata cannot be read from a later UI/plan after the completion boundary.
            s.updateUiState(s.uiState.copy(segmentName="Later UI",plannedFinishSeconds=999))
            val sink=RoomAttemptEventSink(db)
            sink.onSegmentExit(s,"completed")
            sink.onSegmentEntry(s) // delayed entry must not overwrite COMPLETED.
            LiveUiStore.clear()
            sink.onSegmentEntry(ActiveAttemptSession("next","s",12000,LiveUiState.Idle))
            db.pacingDao().replacePlan(originalPlan.copy(id="p2",targetFinishTimeSeconds=1),emptyList())
            db.openHelper.writableDatabase.execSQL("UPDATE segments SET name='Renamed' WHERE id='s'")
            val saved=rows(db).single()
            assertEquals("a",saved.attemptId);assertEquals("Original climb",saved.segmentName)
            assertEquals(11000,saved.completedAtMs);assertEquals(10.0,saved.durationSeconds,0.0)
            assertEquals(10,saved.goalSeconds);assertFalse(saved.approximate)
            assertEquals(220.0,saved.averagePowerWatts!!,0.0);assertEquals(145.0,saved.averageHeartRateBpm!!,0.0)
            val repo=withTimeout(5000){RecentSegmentResultsRepository(db).observe().first{it is RecentResultsState.Ready}} as RecentResultsState.Ready
            assertEquals("a",repo.results.single().attemptId)
            db.segmentDao().delete("s")
            assertTrue(rows(db).isEmpty())
        } finally{db.close()}
    }

    @Test fun `subscribed repository receives completion without live state GPS or reopening`() = runBlocking {
        val db=memory()
        try {
            seed(db)
            val watching=CompletableDeferred<Unit>()
            val update=async(Dispatchers.Default) {
                withTimeout(5000) {
                    RecentSegmentResultsRepository(db).observe().onEach {
                        if(it is RecentResultsState.Ready && it.results.isEmpty())watching.complete(Unit)
                    }.first {it is RecentResultsState.Ready && it.results.isNotEmpty()} as RecentResultsState.Ready
                }
            }
            withTimeout(5000){watching.await()}
            LiveUiStore.clear()
            db.attemptDao().saveFinalAttempt(attempt("fresh",301000))
            assertEquals("fresh",update.await().results.single().attemptId)
        } finally{db.close()}
    }

    @Test fun `recent query keeps repeated attempts excludes unfinished and never sorts by best`() = runBlocking {
        val db=memory()
        try {
            seed(db)
            db.attemptDao().saveFinalAttempt(attempt("old-fast",2000))
            db.attemptDao().saveFinalAttempt(attempt("new-slow",601000))
            db.attemptDao().saveFinalAttempt(attempt("tie-z",601000))
            db.attemptDao().saveFinalAttempt(attempt("abandoned",900000,"ABANDONED"))
            db.attemptDao().saveFinalAttempt(attempt("active",900000,"ACTIVE"))
            db.attemptDao().saveFinalAttempt(attempt("invalid",500))
            assertEquals(listOf("tie-z","new-slow","old-fast"),rows(db).map{it.attemptId})
            assertTrue(rows(db).all{it.approximate && it.goalSeconds==null})
            assertEquals(600.0,rows(db)[0].durationSeconds,0.0)
            for(i in 1..25)db.attemptDao().saveFinalAttempt(attempt("extra-$i",1_000_000L+i))
            assertEquals(20,rows(db).size)
        } finally{db.close()}
    }

    @Test fun `concurrent completion also captures sampled time name and original goal`() = runBlocking {
        val db=memory()
        try {
            seed(db)
            val record=ConcurrentAttemptRecord("c","s",1000,10000,
                LiveUiState(segmentName="Original climb",totalDistanceMeters=500.0,progressMeters=500.0,plannedFinishSeconds=12,matchStatus=MatchStatus.COMPLETE),
                null,0.0,210.0,145.0,null,null,"f")
            val store=RoomConcurrentAttemptPersistence(db)
            store.finish(record,"completed");store.enter(record)
            val row=rows(db).single()
            assertEquals(9.0,row.durationSeconds,0.0);assertEquals(12,row.goalSeconds)
            assertEquals("Original climb",row.segmentName);assertFalse(row.approximate)
        } finally{db.close()}
    }

    @Test fun `Room4 migration preserves legacy rows owner and history across reopen`() = runBlocking {
        val name="recent-results-migration.db";context.deleteDatabase(name)
        val file=context.getDatabasePath(name);file.parentFile!!.mkdirs()
        val schema=JSONObject(File("schemas/com.gritmap.karoo.data.KarooDatabase/4.json").readText()).getJSONObject("database")
        val raw=SQLiteDatabase.openOrCreateDatabase(file,null)
        try {
            val entities=schema.getJSONArray("entities")
            for(i in 0 until entities.length()) {
                val e=entities.getJSONObject(i);val table=e.getString("tableName")
                raw.execSQL(e.getString("createSql").replace("\${TABLE_NAME}",table))
                val indices=e.optJSONArray("indices")
                for(j in 0 until (indices?.length() ?: 0))raw.execSQL(indices!!.getJSONObject(j).getString("createSql").replace("\${TABLE_NAME}",table))
            }
            raw.execSQL("CREATE TABLE IF NOT EXISTS room_master_table (id INTEGER PRIMARY KEY,identity_hash TEXT)")
            raw.execSQL("INSERT INTO room_master_table (id,identity_hash) VALUES(42,?)",arrayOf(schema.getString("identityHash")))
            raw.execSQL("INSERT INTO segments(id,name,corridorMeters,requiredCoveragePct,schemaVersion,fingerprint) VALUES('s','Legacy climb',30,0.9,1,'f')")
            raw.execSQL("INSERT INTO segment_attempts(id,segmentId,startedAtMs,endedAtMs,startProgressMeters,endProgressMeters,coveragePct,maxDeviationMeters,outcome,matcherVersion) VALUES('old','s',1000,301000,0,500,1,0,'COMPLETED',1)")
            raw.execSQL("INSERT INTO segment_record_owner(singletonId,riderId) VALUES(1,'synthetic-owner')")
            raw.version=4
        } finally{raw.close()}
        fun open()=Room.databaseBuilder(context,KarooDatabase::class.java,name).addMigrations(DatabaseProvider.MIGRATION_4_5).allowMainThreadQueries().build()
        try {
            val db=open()
            try {
                val old=rows(db).single()
                assertEquals("Legacy climb",old.segmentName);assertEquals(300.0,old.durationSeconds,0.0)
                assertTrue(old.approximate);assertNull(old.goalSeconds)
                assertEquals("synthetic-owner",db.segmentRecordDao().owner()!!.riderId)
                assertEquals(5,db.openHelper.readableDatabase.version)
            } finally{db.close()}
            val reopened=open()
            try{assertEquals("old",rows(reopened).single().attemptId)}finally{reopened.close()}
        } finally{context.deleteDatabase(name)}
    }
}

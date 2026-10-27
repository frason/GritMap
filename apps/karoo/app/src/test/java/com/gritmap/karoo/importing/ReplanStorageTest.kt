package com.gritmap.karoo.importing

import android.content.Context
import androidx.room.Room
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.sqlite.db.SupportSQLiteOpenHelper
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import androidx.test.core.app.ApplicationProvider
import com.gritmap.karoo.data.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File
import java.util.UUID

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[31])
class ReplanStorageTest {
    private val root = generateSequence(File(".").absoluteFile) { it.parentFile }
        .first { File(it,"docs/fixtures/plan-ceilings-synthetic.json").exists() }

    @Test fun `shared phone targets and ceilings survive transfer import and reload`() = runBlocking {
        val input=File(root,"docs/fixtures/plan-ceilings-transfer-v1.json").readText()
        val plan=TransferPackageParser(planCeilingsEnabled = true).parse(input).baselinePlan!!
        val source=Json.parseToJsonElement(File(root,"docs/fixtures/plan-ceilings-synthetic.json").readText()).jsonObject
            .getValue("result").jsonObject.getValue("zones").jsonArray
        assertEquals(source.map { it.jsonObject.getValue("targetPowerWatts").jsonPrimitive.int },plan.plan.zones.map { it.targetPowerWatts })
        assertEquals(source.map { it.jsonObject.getValue("ceilingPowerWatts").jsonPrimitive.int },plan.replanMetadata!!.ceilings)
        val context=ApplicationProvider.getApplicationContext<Context>()
        val db=Room.inMemoryDatabaseBuilder(context,KarooDatabase::class.java).allowMainThreadQueries().build()
        try {
            db.segmentDao().insertDefinition(SegmentEntity("s","Synthetic",schemaVersion=1,fingerprint=plan.segmentFingerprint),
                listOf(SegmentReferencePointEntity(segmentId="s",pointIndex=0,lat=0.0,lng=0.0,distanceMeters=0.0,elevationMeters=0.0),
                    SegmentReferencePointEntity(segmentId="s",pointIndex=1,lat=0.1,lng=0.0,distanceMeters=plan.plan.zones.last().endDistanceMeters,elevationMeters=100.0)))
            TransferPackageRepository(db, parser = TransferPackageParser(planCeilingsEnabled = true)).importPackage(input)
            val stored=db.pacingDao().baseline("s")!!
            val targets=db.pacingDao().zones(stored.id).map { it.targetPowerWatts }
            assertEquals(plan.replanMetadata,ReplanMetadata.decode(stored.replanMetadataJson,targets,stored.ftpWatts))
            assertEquals(plan.plan.zones.map { it.targetPowerWatts }, targets)
        } finally { db.close() }
    }

    @Test fun `schema two upgrade preserves existing segment and plan`() = runBlocking {
        val context=ApplicationProvider.getApplicationContext<Context>()
        val name="replan-migration-${UUID.randomUUID()}.db"
        val schema=Json.parseToJsonElement(File(root,"apps/karoo/app/schemas/com.gritmap.karoo.data.KarooDatabase/2.json").readText())
            .jsonObject.getValue("database").jsonObject
        val helper=FrameworkSQLiteOpenHelperFactory().create(SupportSQLiteOpenHelper.Configuration.builder(context).name(name)
            .callback(object: SupportSQLiteOpenHelper.Callback(2) {
                override fun onCreate(db: SupportSQLiteDatabase) {
                    schema.getValue("entities").jsonArray.forEach { item ->
                        val entity=item.jsonObject
                        val table=entity.getValue("tableName").jsonPrimitive.content
                        db.execSQL(entity.getValue("createSql").jsonPrimitive.content.replace("\${TABLE_NAME}",table))
                        entity["indices"]?.jsonArray.orEmpty().forEach { index ->
                            db.execSQL(index.jsonObject.getValue("createSql").jsonPrimitive.content.replace("\${TABLE_NAME}",table))
                        }
                    }
                    db.execSQL("INSERT INTO segments VALUES ('s','Preserved',30,0.9,1,'abc')")
                    db.execSQL("INSERT INTO pacing_plans (id,segmentId,segmentFingerprint,createdAtMs,source,isBaseline) VALUES ('p','s','abc',1000,'LOCAL',1)")
                }
                override fun onUpgrade(db: SupportSQLiteDatabase,oldVersion:Int,newVersion:Int) = Unit
            }).build())
        helper.writableDatabase
        helper.close()
        val db=Room.databaseBuilder(context,KarooDatabase::class.java,name).allowMainThreadQueries()
            .addMigrations(DatabaseProvider.MIGRATION_2_3, DatabaseProvider.MIGRATION_3_4).build()
        try {
            assertEquals("Preserved",db.segmentDao().segment("s")!!.name)
            val plan=db.pacingDao().baseline("s")!!
            assertEquals("p",plan.id)
            assertNull(plan.replanMetadataJson)
        } finally { db.close(); context.deleteDatabase(name) }
    }
    @Test fun `schema three upgrade retains ceiling metadata`() = runBlocking {
        val context=ApplicationProvider.getApplicationContext<Context>()
        val name="records-migration-${UUID.randomUUID()}.db"
        val schema=Json.parseToJsonElement(File(root,"apps/karoo/app/schemas/com.gritmap.karoo.data.KarooDatabase/3.json").readText()).jsonObject.getValue("database").jsonObject
        val helper=FrameworkSQLiteOpenHelperFactory().create(SupportSQLiteOpenHelper.Configuration.builder(context).name(name)
            .callback(object: SupportSQLiteOpenHelper.Callback(3) {
                override fun onCreate(db: SupportSQLiteDatabase) {
                    schema.getValue("entities").jsonArray.forEach { item ->
                        val entity=item.jsonObject;val table=entity.getValue("tableName").jsonPrimitive.content
                        db.execSQL(entity.getValue("createSql").jsonPrimitive.content.replace("\${TABLE_NAME}",table))
                        entity["indices"]?.jsonArray.orEmpty().forEach { index -> db.execSQL(index.jsonObject.getValue("createSql").jsonPrimitive.content.replace("\${TABLE_NAME}",table)) }
                    }
                    db.execSQL("INSERT INTO segments VALUES ('s','Preserved',30,0.9,1,'abc')")
                    db.execSQL("INSERT INTO pacing_plans (id,segmentId,segmentFingerprint,createdAtMs,source,isBaseline,replanMetadataJson) VALUES ('p','s','abc',1000,'LOCAL',1,'retained-metadata')")
                }
                override fun onUpgrade(db: SupportSQLiteDatabase,oldVersion:Int,newVersion:Int) = Unit
            }).build())
        helper.writableDatabase;helper.close()
        val db=Room.databaseBuilder(context,KarooDatabase::class.java,name).allowMainThreadQueries().addMigrations(DatabaseProvider.MIGRATION_3_4).build()
        try {
            assertEquals("retained-metadata",db.pacingDao().baseline("s")!!.replanMetadataJson)
            assertNull(db.segmentRecordDao().owner())
            assertNull(db.segmentRecordDao().record("abc"))
        } finally { db.close();context.deleteDatabase(name) }
    }

    @Test fun `record import retains fastest value and rolls back mismatched owner plan`() = runBlocking {
        val context=ApplicationProvider.getApplicationContext<Context>()
        val db=Room.inMemoryDatabaseBuilder(context,KarooDatabase::class.java).allowMainThreadQueries().build()
        val planFixture=Json.parseToJsonElement(File(root,"fixtures/contracts/plan-ceilings-transfer-v1.json").readText()).jsonObject
        val recordFixture=Json.parseToJsonElement(File(root,"fixtures/contracts/segment-record-v1.json").readText()).jsonObject
        val fp=recordFixture.getValue("segmentFingerprint").jsonPrimitive.content
        val repository=TransferPackageRepository(db,parser=TransferPackageParser(planCeilingsEnabled=true,segmentRecordsEnabled=true))
        fun payload(duration:Int=2400,rider:String="synthetic_rider_0001",withPlan:Boolean=false,length:Double=10460.736): String {
            val record=JsonObject(recordFixture + mapOf("bestDurationSeconds" to JsonPrimitive(duration),"riderId" to JsonPrimitive(rider),"splits" to buildJsonArray {
                add(buildJsonObject { put("distanceMeters",0);put("elapsedSeconds",0) })
                add(buildJsonObject { put("distanceMeters",length);put("elapsedSeconds",duration) })
            }))
            return JsonObject(planFixture.filterKeys { it!="baselinePacingPlan" || withPlan } + ("segmentRecord" to record)).toString()
        }
        try {
            db.segmentDao().insertDefinition(SegmentEntity("s","Synthetic",schemaVersion=1,fingerprint=fp),listOf(
                SegmentReferencePointEntity(segmentId="s",pointIndex=0,lat=0.0,lng=0.0,distanceMeters=0.0,elevationMeters=0.0),
                SegmentReferencePointEntity(segmentId="s",pointIndex=1,lat=0.1,lng=0.0,distanceMeters=10460.736,elevationMeters=100.0)))
            assertTrue(repository.importPackage(payload()).segmentRecordUpdated)
            assertFalse(repository.importPackage(payload(2500)).segmentRecordUpdated)
            assertFalse(repository.importPackage(payload()).segmentRecordUpdated)
            assertTrue(repository.importPackage(payload(2300)).segmentRecordUpdated)
            assertEquals(2300.0,db.segmentRecordDao().record(fp)!!.bestDurationSeconds,0.0)
            assertTrue(runCatching { repository.importPackage(payload(2200,"synthetic_rider_0002",true)) }.isFailure)
            assertNull(db.pacingDao().baseline("s")) // plan replacement rolled back atomically
            assertTrue(runCatching { repository.importPackage(payload(2200,length=200.0)) }.isFailure)
            assertEquals(2300.0,db.segmentRecordDao().record(fp)!!.bestDurationSeconds,0.0)
        } finally { db.close() }
    }

}

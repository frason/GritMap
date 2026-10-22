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
        val plan=TransferPackageParser().parse(input).baselinePlan!!
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
            TransferPackageRepository(db).importPackage(input)
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
            .addMigrations(DatabaseProvider.MIGRATION_2_3).build()
        try {
            assertEquals("Preserved",db.segmentDao().segment("s")!!.name)
            val plan=db.pacingDao().baseline("s")!!
            assertEquals("p",plan.id)
            assertNull(plan.replanMetadataJson)
        } finally { db.close(); context.deleteDatabase(name) }
    }
}

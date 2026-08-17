package com.gritmap.karoo.data

import androidx.room.testing.MigrationTestHelper
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.IOException
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class KarooDatabaseMigrationTest {
    @get:Rule
    val helper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        KarooDatabase::class.java,
        emptyList(),
        FrameworkSQLiteOpenHelperFactory(),
    )

    @Test fun migrationOneToTwoPreservesPlansAndAddsBaselineMetadata() {
        helper.createDatabase(NAME, 1).apply {
            execSQL("INSERT INTO segments VALUES ('s','Segment',30,0.9,1,'fingerprint')")
            execSQL("INSERT INTO pacing_plans VALUES ('p','s','fingerprint',1)")
            close()
        }

        helper.runMigrationsAndValidate(NAME, 2, true, DatabaseProvider.MIGRATION_1_2).use { db ->
            db.query("SELECT source, isBaseline FROM pacing_plans WHERE id='p'").use { cursor ->
                cursor.moveToFirst()
                assertEquals("LOCAL", cursor.getString(0))
                assertEquals(0, cursor.getInt(1))
            }
        }
    }

    companion object { private const val NAME = "migration-test" }
}

package com.gritmap.karoo.data

import android.content.Context
import androidx.room.Room
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

object DatabaseProvider {
    @Volatile private var instance: KarooDatabase? = null

    fun get(context: Context): KarooDatabase = instance ?: synchronized(this) {
        instance ?: Room.databaseBuilder(
            context.applicationContext,
            KarooDatabase::class.java,
            "gritmap-karoo.db",
        ).addMigrations(MIGRATION_1_2).build().also { instance = it }
    }

    val MIGRATION_1_2 = object : Migration(1, 2) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE pacing_plans ADD COLUMN source TEXT NOT NULL DEFAULT 'LOCAL'")
            db.execSQL("ALTER TABLE pacing_plans ADD COLUMN generatorModelVersion TEXT")
            db.execSQL("ALTER TABLE pacing_plans ADD COLUMN ftpWatts INTEGER")
            db.execSQL("ALTER TABLE pacing_plans ADD COLUMN targetFinishTimeSeconds INTEGER")
            db.execSQL("ALTER TABLE pacing_plans ADD COLUMN isBaseline INTEGER NOT NULL DEFAULT 0")
            db.execSQL("DROP INDEX IF EXISTS index_pacing_plans_segmentId")
            db.execSQL("CREATE INDEX IF NOT EXISTS index_pacing_plans_segmentId_isBaseline ON pacing_plans(segmentId, isBaseline)")
        }
    }
}

package com.gritmap.karoo.data

import android.content.Context
import androidx.room.Room

object DatabaseProvider {
    @Volatile private var instance: KarooDatabase? = null

    fun get(context: Context): KarooDatabase = instance ?: synchronized(this) {
        instance ?: Room.databaseBuilder(
            context.applicationContext,
            KarooDatabase::class.java,
            "gritmap-karoo.db",
        ).build().also { instance = it }
    }
}


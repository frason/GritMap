package com.gritmap.karoo.service

import android.content.Context
import android.util.Log
import java.io.File
import java.util.concurrent.Executors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object LiveDiagnostics {
    private const val TAG = "GritMapLive"
    private val executor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "gritmap-diagnostics").apply { isDaemon = true }
    }
    @Volatile private var log: BoundedDiagnosticLog? = null

    fun record(context: Context, event: String, details: String = "") {
        Log.i(TAG, if (details.isBlank()) event else "$event $details")
        val applicationContext = context.applicationContext
        executor.execute { diagnosticLog(applicationContext).append(event, details) }
    }

    suspend fun recent(context: Context, maxLines: Int = 12): List<String> =
        withContext(Dispatchers.IO) { diagnosticLog(context.applicationContext).tail(maxLines) }

    private fun diagnosticLog(context: Context): BoundedDiagnosticLog =
        log ?: synchronized(this) {
            log ?: BoundedDiagnosticLog(
                File(context.filesDir, "diagnostics/live-segment.log"),
            ).also { log = it }
        }
}

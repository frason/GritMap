package com.gritmap.karoo.service

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat

object LiveServiceStarter {
    fun hasLocationPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    fun startIfPermitted(context: Context, origin: String): Boolean {
        if (!hasLocationPermission(context)) {
            LiveDiagnostics.record(context, "service_start_blocked", "origin=$origin permission=location")
            return false
        }
        return try {
            val started = context.startService(Intent(context, LiveSegmentService::class.java)) != null
            LiveDiagnostics.record(context, "service_start_requested", "origin=$origin started=$started")
            started
        } catch (error: RuntimeException) {
            LiveDiagnostics.record(
                context,
                "service_start_failed",
                "origin=$origin error=${error.javaClass.simpleName}:${error.message}",
            )
            false
        }
    }
}

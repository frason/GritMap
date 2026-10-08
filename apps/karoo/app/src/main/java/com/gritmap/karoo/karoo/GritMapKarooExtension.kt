package com.gritmap.karoo.karoo

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import com.gritmap.karoo.BuildConfig
import com.gritmap.karoo.service.LiveDiagnostics
import com.gritmap.karoo.service.LiveSegmentService
import com.gritmap.karoo.service.LiveServiceStarter
import com.gritmap.karoo.ui.state.LiveUiStore
import io.hammerhead.karooext.extension.KarooExtension
import io.hammerhead.karooext.internal.Emitter
import io.hammerhead.karooext.models.MapEffect
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

class GritMapKarooExtension : KarooExtension(EXTENSION_ID, BuildConfig.VERSION_NAME) {
    private var liveServiceBindingRequested = false
    private var liveServiceBound = false
    private val liveServiceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            liveServiceBound = true
            LiveDiagnostics.record(this@GritMapKarooExtension, "service_bound", "origin=extension")
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            liveServiceBound = false
            LiveDiagnostics.record(this@GritMapKarooExtension, "service_disconnected", "origin=extension")
        }

        override fun onBindingDied(name: ComponentName?) {
            liveServiceBound = false
            LiveDiagnostics.record(this@GritMapKarooExtension, "service_binding_died", "origin=extension")
        }

        override fun onNullBinding(name: ComponentName?) {
            liveServiceBound = false
            LiveDiagnostics.record(this@GritMapKarooExtension, "service_null_binding", "origin=extension")
        }
    }

    override fun onCreate() {
        super.onCreate()
        LiveDiagnostics.record(this, "extension_created")
        bindLiveService()
    }

    override fun onDestroy() {
        if (liveServiceBindingRequested) {
            runCatching { unbindService(liveServiceConnection) }
                .onFailure {
                    LiveDiagnostics.record(
                        this,
                        "service_unbind_failed",
                        "origin=extension error=${it.javaClass.simpleName}:${it.message}",
                    )
                }
            liveServiceBindingRequested = false
            liveServiceBound = false
        }
        super.onDestroy()
    }

    override val types by lazy {
        listOf(
            PacingCoachDataType(extension),
            TargetPowerDataType(extension),
            PowerDeltaDataType(extension),
            PredictedFinishDataType(extension),
            PacingProfileDataType(extension),
            SegmentPerformanceDataType(extension),
            WattsPerHeartRateDataType(extension),
            PowerBalanceDataType(extension),
            CardiacDriftDataType(extension),
            H10CardiacDataType(extension),
        )
    }

    override fun startMap(emitter: Emitter<MapEffect>) {
        LiveServiceStarter.startIfPermitted(this, "map-layer")
        val scope = CoroutineScope(Job() + Dispatchers.Default)
        val layer = PacerMapLayer()
        scope.launch {
            LiveUiStore.state.collect { state ->
                layer.effects(state).forEach(emitter::onNext)
            }
        }
        emitter.setCancellable { scope.cancel() }
    }

    private fun bindLiveService() {
        if (!LiveServiceStarter.hasLocationPermission(this)) {
            LiveDiagnostics.record(this, "service_bind_blocked", "origin=extension permission=location")
            return
        }
        try {
            val requested = bindService(
                Intent(this, LiveSegmentService::class.java),
                liveServiceConnection,
                Context.BIND_AUTO_CREATE,
            )
            liveServiceBindingRequested = requested
            LiveDiagnostics.record(this, "service_bind_requested", "origin=extension requested=$requested")
        } catch (error: RuntimeException) {
            LiveDiagnostics.record(
                this,
                "service_bind_failed",
                "origin=extension error=${error.javaClass.simpleName}:${error.message}",
            )
        }
    }

    companion object {
        const val EXTENSION_ID = "gritmap-live-pacing"
    }
}

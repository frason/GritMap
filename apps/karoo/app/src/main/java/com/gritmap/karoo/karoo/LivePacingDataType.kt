package com.gritmap.karoo.karoo

import android.content.Context
import android.os.SystemClock
import android.widget.RemoteViews
import com.gritmap.karoo.R
import com.gritmap.karoo.ui.ProfileBitmapRenderer
import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.LiveUiStore
import io.hammerhead.karooext.extension.DataTypeImpl
import io.hammerhead.karooext.internal.ViewEmitter
import io.hammerhead.karooext.models.UpdateGraphicConfig
import io.hammerhead.karooext.models.ViewConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

class LivePacingDataType(
    extensionId: String,
    private val state: StateFlow<LiveUiState> = LiveUiStore.state,
) : DataTypeImpl(extensionId, TYPE_ID) {
    override fun startView(context: Context, config: ViewConfig, emitter: ViewEmitter) {
        emitter.onNext(UpdateGraphicConfig(showHeader = false))
        val renderer = KarooDataFieldRenderer(context, emitter, config, ProfileBitmapRenderer())
        val scope = CoroutineScope(Job() + Dispatchers.Default)
        scope.launch {
            // StateFlow is already conflated; a slow renderer resumes with the newest state.
            state.collect { latest -> renderer.submit(latest) }
        }
        emitter.setCancellable { scope.cancel() }
    }

    companion object {
        const val TYPE_ID = "live-pacing"
    }
}

/** Converts framework-neutral state to RemoteViews and enforces Hammerhead's 1 Hz limit. */
class KarooDataFieldRenderer(
    private val context: Context,
    private val emitter: ViewEmitter,
    private val config: ViewConfig,
    private val profileRenderer: ProfileBitmapRenderer,
    private val clockMs: () -> Long = SystemClock::elapsedRealtime,
) {
    private var lastEmitMs = Long.MIN_VALUE

    suspend fun submit(state: LiveUiState) {
        val elapsed = if (lastEmitMs == Long.MIN_VALUE) MIN_UPDATE_INTERVAL_MS else clockMs() - lastEmitMs
        if (elapsed < MIN_UPDATE_INTERVAL_MS) delay(MIN_UPDATE_INTERVAL_MS - elapsed)
        val latestNow = clockMs()
        val remoteViews = RemoteViews(context.packageName, R.layout.karoo_live_pacing_field)
        remoteViews.setTextViewText(R.id.karoo_segment_name, state.segmentName.ifBlank { "GritMap" })
        remoteViews.setTextViewText(
            R.id.karoo_target_power,
            state.recommendation?.targetPowerWatts?.let { "$it W" } ?: "-- W",
        )
        remoteViews.setTextViewText(
            R.id.karoo_guidance,
            state.sensorStatus.warning ?: state.recommendation?.instruction ?: "Waiting for segment",
        )
        val width = config.viewSize.first.coerceAtLeast(1)
        val height = (config.viewSize.second * 0.55).toInt().coerceAtLeast(1)
        remoteViews.setImageViewBitmap(R.id.karoo_profile_image, profileRenderer.render(state, width, height))
        emitter.updateView(remoteViews)
        lastEmitMs = latestNow
    }

    companion object {
        const val MIN_UPDATE_INTERVAL_MS = 1_000L
    }
}

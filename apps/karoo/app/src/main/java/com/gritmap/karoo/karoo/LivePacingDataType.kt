package com.gritmap.karoo.karoo

import android.content.Context
import android.os.SystemClock
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import com.gritmap.karoo.R
import com.gritmap.karoo.service.LiveServiceStarter
import com.gritmap.karoo.ui.ProfileBitmapRenderer
import com.gritmap.karoo.ui.karooVisualPalette
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

class PacingProfileDataType(
    extensionId: String,
    private val state: StateFlow<LiveUiState> = LiveUiStore.state,
) : DataTypeImpl(extensionId, TYPE_ID) {
    override fun startView(context: Context, config: ViewConfig, emitter: ViewEmitter) {
        emitter.onNext(UpdateGraphicConfig(showHeader = false))
        val renderer = PacingProfileDataFieldRenderer(
            context,
            emitter,
            config,
            ProfileBitmapRenderer(karooVisualPalette(context)),
        )
        val scope = CoroutineScope(Job() + Dispatchers.Default)
        scope.launch {
            if (config.preview) {
                karooPreviewFlow().collect { preview -> renderer.submit(preview) }
            } else {
                LiveServiceStarter.startIfPermitted(context, "pacing-profile-view")
                // StateFlow is already conflated; a slow renderer resumes with the newest state.
                state.collect { latest -> renderer.submit(latest) }
            }
        }
        emitter.setCancellable { scope.cancel() }
    }

    companion object {
        // Retain the original ID so existing Karoo page configurations become the profile field.
        const val TYPE_ID = "live-pacing"
    }
}

/** Converts framework-neutral state to RemoteViews and enforces Hammerhead's 1 Hz limit. */
class PacingProfileDataFieldRenderer(
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
        val layout = karooFieldLayout(config)
        val presentation = pacingProfilePresentation(state, layout)
        val remoteViews = RemoteViews(context.packageName, R.layout.karoo_live_pacing_field)
        remoteViews.setTextViewText(R.id.karoo_segment_name, presentation.title)
        remoteViews.setTextViewText(R.id.karoo_profile_status, presentation.status)
        remoteViews.setTextViewText(R.id.karoo_profile_guidance, presentation.guidance)
        remoteViews.setTextColor(
            R.id.karoo_profile_guidance,
            karooEffortTextColor(state.recommendation?.icon),
        )
        remoteViews.setInt(
            R.id.karoo_profile_guidance_badge,
            "setBackgroundResource",
            guidanceBackgroundResource(state.recommendation?.icon),
        )
        remoteViews.setTextViewTextSize(
            R.id.karoo_profile_guidance,
            TypedValue.COMPLEX_UNIT_SP,
            profileGuidanceTextSize(layout),
        )
        remoteViews.setTextViewText(R.id.karoo_profile_execution, presentation.execution)
        remoteViews.setTextViewText(R.id.karoo_profile_remaining, presentation.remaining)
        remoteViews.setViewVisibility(R.id.karoo_profile_header, visibility(presentation.showHeader))
        remoteViews.setViewVisibility(
            R.id.karoo_profile_guidance_badge,
            visibility(presentation.showGuidance),
        )
        remoteViews.setViewVisibility(R.id.karoo_profile_footer, visibility(presentation.showFooter))
        remoteViews.setViewVisibility(R.id.karoo_profile_image, View.VISIBLE)

        val width = config.viewSize.first.coerceAtLeast(1)
        val height = presentation.bitmapHeight(config.viewSize.second)
        val bitmap = if (presentation.compactStrip) {
            profileRenderer.renderPacingStrip(state, width, height)
        } else if (presentation.verticalPacer) {
            profileRenderer.renderVerticalPacer(state, width, height)
        } else {
            profileRenderer.render(state, width, height)
        }
        remoteViews.setImageViewBitmap(R.id.karoo_profile_image, bitmap)
        emitter.updateView(remoteViews)
        lastEmitMs = latestNow
    }

    companion object {
        const val MIN_UPDATE_INTERVAL_MS = 1_000L
    }
}

private fun guidanceBackgroundResource(
    icon: com.gritmap.karoo.ui.state.GuidanceIcon?,
): Int = when (icon) {
    com.gritmap.karoo.ui.state.GuidanceIcon.RECOVER -> R.drawable.gm_guidance_recover
    com.gritmap.karoo.ui.state.GuidanceIcon.HOLD -> R.drawable.gm_guidance_hold
    com.gritmap.karoo.ui.state.GuidanceIcon.PUSH -> R.drawable.gm_guidance_push
    com.gritmap.karoo.ui.state.GuidanceIcon.WARNING, null -> R.drawable.gm_guidance_neutral
}

internal data class PacingProfilePresentation(
    val title: String,
    val status: String,
    val guidance: String,
    val execution: String,
    val remaining: String,
    val showHeader: Boolean,
    val showGuidance: Boolean,
    val showFooter: Boolean,
    val compactStrip: Boolean,
    val verticalPacer: Boolean,
    val graphFraction: Double,
) {
    fun bitmapHeight(viewHeightPx: Int): Int =
        (viewHeightPx.coerceAtLeast(1) * graphFraction).toInt().coerceAtLeast(18)
}

internal fun pacingProfilePresentation(
    state: LiveUiState,
    layout: KarooFieldLayout,
): PacingProfilePresentation {
    val title = state.segmentName.ifBlank { "GritMap" }
    val progress = if (state.totalDistanceMeters > 0.0) {
        "${state.progressMeters.toInt()} / ${state.totalDistanceMeters.toInt()} m"
    } else {
        "Waiting for segment"
    }
    val compactGuidance = state.recommendation?.let {
        it.icon.compactLabel()
    } ?: state.sensorStatus.warning.orEmpty().ifBlank { "Waiting for pacing plan" }
    val immediate = state.recommendation?.let {
        it.icon.compactLabel()
    } ?: state.sensorStatus.warning.orEmpty().ifBlank { "Waiting for pacing plan" }
    val execution = state.rollingPowerWatts3s?.let { actual ->
        val delta = state.powerDeltaWatts?.let { value ->
            " · ${if (value > 0) "+" else ""}$value W"
        }.orEmpty()
        "3s $actual W$delta"
    } ?: "3s power --"
    val remaining = if (state.totalDistanceMeters > 0.0) {
        "${(state.totalDistanceMeters - state.progressMeters).coerceAtLeast(0.0).toInt()} m left"
    } else {
        ""
    }

    return when (layout) {
        KarooFieldLayout.SMALL -> PacingProfilePresentation(
            title = title,
            status = progress,
            guidance = compactGuidance,
            execution = execution,
            remaining = remaining,
            showHeader = false,
            showGuidance = true,
            showFooter = false,
            compactStrip = true,
            verticalPacer = false,
            graphFraction = 0.34,
        )
        KarooFieldLayout.SMALL_WIDE -> PacingProfilePresentation(
            title = title,
            status = progress,
            guidance = compactGuidance,
            execution = execution,
            remaining = remaining,
            showHeader = false,
            showGuidance = true,
            showFooter = false,
            compactStrip = true,
            verticalPacer = false,
            graphFraction = 0.35,
        )
        KarooFieldLayout.MEDIUM -> PacingProfilePresentation(
            title = title,
            status = progress,
            guidance = immediate,
            execution = execution,
            remaining = remaining,
            showHeader = false,
            showGuidance = true,
            showFooter = false,
            compactStrip = false,
            verticalPacer = true,
            graphFraction = 0.62,
        )
        KarooFieldLayout.MEDIUM_WIDE -> PacingProfilePresentation(
            title = title,
            status = progress,
            guidance = immediate,
            execution = execution,
            remaining = remaining,
            showHeader = true,
            showGuidance = true,
            showFooter = true,
            compactStrip = true,
            verticalPacer = false,
            graphFraction = 0.35,
        )
        KarooFieldLayout.NARROW -> PacingProfilePresentation(
            title = title,
            status = progress,
            guidance = immediate,
            execution = execution,
            remaining = remaining,
            showHeader = true,
            showGuidance = true,
            showFooter = true,
            compactStrip = false,
            verticalPacer = true,
            graphFraction = 0.68,
        )
        KarooFieldLayout.LARGE -> PacingProfilePresentation(
            title = title,
            status = progress,
            guidance = immediate,
            execution = execution,
            remaining = remaining,
            showHeader = true,
            showGuidance = true,
            showFooter = true,
            compactStrip = false,
            verticalPacer = true,
            graphFraction = 0.68,
        )
    }
}

private fun com.gritmap.karoo.ui.state.GuidanceIcon.compactLabel(): String = when (this) {
    com.gritmap.karoo.ui.state.GuidanceIcon.RECOVER -> "REST"
    com.gritmap.karoo.ui.state.GuidanceIcon.HOLD -> "HOLD"
    com.gritmap.karoo.ui.state.GuidanceIcon.PUSH -> "PUSH"
    com.gritmap.karoo.ui.state.GuidanceIcon.WARNING -> "CHECK"
}

private fun profileGuidanceTextSize(layout: KarooFieldLayout): Float = when (layout) {
    KarooFieldLayout.SMALL -> 16f
    KarooFieldLayout.SMALL_WIDE -> 17f
    KarooFieldLayout.MEDIUM -> 18f
    KarooFieldLayout.MEDIUM_WIDE -> 18f
    KarooFieldLayout.NARROW -> 19f
    KarooFieldLayout.LARGE -> 20f
}

private fun visibility(visible: Boolean): Int = if (visible) View.VISIBLE else View.GONE

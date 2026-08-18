package com.gritmap.karoo.karoo

import android.content.Context
import android.widget.RemoteViews
import com.gritmap.karoo.R
import com.gritmap.karoo.service.LiveServiceStarter
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
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

abstract class StateGraphicDataType(
    extensionId: String,
    typeId: String,
    private val state: StateFlow<LiveUiState> = LiveUiStore.state,
) : DataTypeImpl(extensionId, typeId) {
    protected abstract fun remoteViews(context: Context, state: LiveUiState): RemoteViews

    override fun startView(context: Context, config: ViewConfig, emitter: ViewEmitter) {
        emitter.onNext(UpdateGraphicConfig(showHeader = false))
        val scope = CoroutineScope(Job() + Dispatchers.Default)
        scope.launch {
            if (config.preview) {
                emitter.updateView(remoteViews(context, KarooPreviewState))
            } else {
                LiveServiceStarter.startIfPermitted(context, "$typeId-view")
                state.collect { emitter.updateView(remoteViews(context, it)) }
            }
        }
        emitter.setCancellable { scope.cancel() }
    }
}

class PacingCoachDataType(extensionId: String) : StateGraphicDataType(extensionId, TYPE_ID) {
    override fun remoteViews(context: Context, state: LiveUiState): RemoteViews {
        val text = pacingCoachText(state)
        return RemoteViews(context.packageName, R.layout.karoo_pacing_coach_field).apply {
            setTextViewText(R.id.karoo_coach_action, text.action)
            setTextViewText(R.id.karoo_coach_target, text.target)
            setTextViewText(R.id.karoo_coach_actual, text.actual)
            setTextViewText(R.id.karoo_coach_next, text.next)
        }
    }

    companion object { const val TYPE_ID = "pacing-coach" }
}

class SegmentPerformanceDataType(extensionId: String) : StateGraphicDataType(extensionId, TYPE_ID) {
    override fun remoteViews(context: Context, state: LiveUiState): RemoteViews {
        val text = segmentPerformanceText(state)
        return RemoteViews(context.packageName, R.layout.karoo_segment_performance_field).apply {
            setTextViewText(R.id.karoo_performance_name, text.segmentName)
            setTextViewText(R.id.karoo_performance_finish, text.predictedFinish)
            setTextViewText(R.id.karoo_performance_adherence, text.adherence)
            setTextViewText(R.id.karoo_performance_progress, text.progress)
        }
    }

    companion object { const val TYPE_ID = "segment-performance" }
}

internal data class PacingCoachText(
    val action: String,
    val target: String,
    val actual: String,
    val next: String,
)

internal fun pacingCoachText(state: LiveUiState): PacingCoachText {
    val recommendation = state.recommendation
    val delta = state.powerDeltaWatts
    val next = state.nextPacingZone
    return PacingCoachText(
        action = recommendation?.instruction ?: "Waiting for pacing plan",
        target = recommendation?.targetPowerWatts?.let { "$it W" } ?: "-- W",
        actual = state.currentPowerWatts?.let { actual ->
            val deltaText = delta?.let { " · ${if (it >= 0) "+" else ""}$it W" }.orEmpty()
            "Actual $actual W$deltaText"
        } ?: state.sensorStatus.warning.orEmpty().ifBlank { "Waiting for power" },
        next = next?.let {
            "${it.effort.name.lowercase().replaceFirstChar(Char::uppercase)} ${it.targetPowerWatts} W " +
                "in ${state.distanceToNextZoneMeters} m"
        } ?: "Final pacing zone",
    )
}

internal data class SegmentPerformanceText(
    val segmentName: String,
    val predictedFinish: String,
    val adherence: String,
    val progress: String,
)

internal fun segmentPerformanceText(state: LiveUiState) = SegmentPerformanceText(
    segmentName = state.segmentName.ifBlank { "GritMap Performance" },
    predictedFinish = "Predicted ${state.predictedFinishSeconds?.let(::formatDuration).orEmpty().ifBlank { "--" }}",
    adherence = "Plan adherence ${state.planAdherencePct?.let { "$it%" } ?: "--"}",
    progress = if (state.totalDistanceMeters > 0.0) {
        "${state.progressMeters.toInt()} / ${state.totalDistanceMeters.toInt()} m"
    } else {
        "Waiting for segment"
    },
)

internal fun formatDuration(seconds: Int): String {
    val safe = seconds.coerceAtLeast(0)
    val hours = safe / 3600
    val minutes = (safe % 3600) / 60
    val remainingSeconds = safe % 60
    return if (hours > 0) {
        "%d:%02d:%02d".format(hours, minutes, remainingSeconds)
    } else {
        "%d:%02d".format(minutes, remainingSeconds)
    }
}

package com.gritmap.karoo.karoo

import android.content.Context
import android.view.View
import android.widget.RemoteViews
import com.gritmap.karoo.R
import com.gritmap.karoo.service.LiveServiceStarter
import com.gritmap.karoo.ui.PowerBalanceBitmapRenderer
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
    protected abstract fun remoteViews(
        context: Context,
        state: LiveUiState,
        size: KarooFieldSize,
    ): RemoteViews

    override fun startView(context: Context, config: ViewConfig, emitter: ViewEmitter) {
        emitter.onNext(UpdateGraphicConfig(showHeader = false))
        val scope = CoroutineScope(Job() + Dispatchers.Default)
        scope.launch {
            if (config.preview) {
                emitter.updateView(remoteViews(context, KarooPreviewState, karooFieldSize(config)))
            } else {
                LiveServiceStarter.startIfPermitted(context, "$typeId-view")
                state.collect { emitter.updateView(remoteViews(context, it, karooFieldSize(config))) }
            }
        }
        emitter.setCancellable { scope.cancel() }
    }
}

class PacingCoachDataType(extensionId: String) : StateGraphicDataType(extensionId, TYPE_ID) {
    override fun remoteViews(context: Context, state: LiveUiState, size: KarooFieldSize): RemoteViews {
        val text = pacingCoachText(state)
        return RemoteViews(context.packageName, R.layout.karoo_pacing_coach_field).apply {
            setTextViewText(R.id.karoo_coach_action, text.action)
            setTextViewText(R.id.karoo_coach_target, text.target)
            setTextViewText(R.id.karoo_coach_actual, text.actual)
            setTextViewText(R.id.karoo_coach_next, text.next)
            setViewVisibility(
                R.id.karoo_coach_actual,
                if (size == KarooFieldSize.SMALL) View.GONE else View.VISIBLE,
            )
            setViewVisibility(
                R.id.karoo_coach_next,
                if (size == KarooFieldSize.LARGE) View.VISIBLE else View.GONE,
            )
        }
    }

    companion object { const val TYPE_ID = "pacing-coach" }
}

class SegmentPerformanceDataType(extensionId: String) : StateGraphicDataType(extensionId, TYPE_ID) {
    override fun remoteViews(context: Context, state: LiveUiState, size: KarooFieldSize): RemoteViews {
        val text = segmentPerformanceText(state)
        return RemoteViews(context.packageName, R.layout.karoo_segment_performance_field).apply {
            setTextViewText(R.id.karoo_performance_name, text.segmentName)
            setTextViewText(R.id.karoo_performance_finish, text.predictedFinish)
            setTextViewText(R.id.karoo_performance_adherence, text.adherence)
            setTextViewText(R.id.karoo_performance_progress, text.progress)
            setViewVisibility(
                R.id.karoo_performance_name,
                if (size == KarooFieldSize.LARGE) View.VISIBLE else View.GONE,
            )
            setViewVisibility(
                R.id.karoo_performance_adherence,
                if (size == KarooFieldSize.SMALL) View.GONE else View.VISIBLE,
            )
            setViewVisibility(
                R.id.karoo_performance_progress,
                if (size == KarooFieldSize.LARGE) View.VISIBLE else View.GONE,
            )
        }
    }

    companion object { const val TYPE_ID = "segment-performance" }
}

class WattsPerHeartRateDataType(extensionId: String) : StateGraphicDataType(extensionId, TYPE_ID) {
    override fun remoteViews(context: Context, state: LiveUiState, size: KarooFieldSize): RemoteViews {
        val ratio = state.wattsPerHeartRate
        return RemoteViews(context.packageName, R.layout.karoo_watts_per_hr_field).apply {
            setTextViewText(R.id.karoo_watts_hr_value, ratio?.let { "%.2f".format(it) } ?: "--")
            setTextViewText(
                R.id.karoo_watts_hr_detail,
                if (ratio != null) {
                    "${state.rollingPowerWatts3s} W / ${state.currentHeartRateBpm} bpm"
                } else {
                    "Waiting for power and HR"
                },
            )
            setViewVisibility(
                R.id.karoo_watts_hr_detail,
                if (size == KarooFieldSize.SMALL) View.GONE else View.VISIBLE,
            )
        }
    }

    companion object { const val TYPE_ID = "watts-per-hr" }
}

class PowerBalanceDataType(extensionId: String) : StateGraphicDataType(extensionId, TYPE_ID) {
    private val barRenderer = PowerBalanceBitmapRenderer()

    override fun remoteViews(context: Context, state: LiveUiState, size: KarooFieldSize): RemoteViews {
        val target = state.recommendation?.targetPowerWatts
        val actual = state.rollingPowerWatts3s
        val delta = state.powerDeltaWatts
        return RemoteViews(context.packageName, R.layout.karoo_power_balance_field).apply {
            setTextViewText(
                R.id.karoo_power_balance_values,
                if (actual != null && target != null) "$actual / $target W" else "-- / -- W",
            )
            setTextViewText(
                R.id.karoo_power_balance_delta,
                delta?.let { "${if (it >= 0) "+" else ""}$it W" } ?: "Waiting for plan and power",
            )
            setViewVisibility(
                R.id.karoo_power_balance_title,
                if (size == KarooFieldSize.SMALL) View.GONE else View.VISIBLE,
            )
            setViewVisibility(
                R.id.karoo_power_balance_delta,
                if (size == KarooFieldSize.SMALL) View.GONE else View.VISIBLE,
            )
            val width = when (size) {
                KarooFieldSize.SMALL -> 320
                KarooFieldSize.MEDIUM -> 480
                KarooFieldSize.LARGE -> 600
            }
            setImageViewBitmap(
                R.id.karoo_power_balance_bar,
                barRenderer.render(actual, target, width, 48),
            )
        }
    }

    companion object { const val TYPE_ID = "power-balance" }
}

enum class KarooFieldSize { SMALL, MEDIUM, LARGE }

/** Karoo's page grid is always 60 rows high, independent of device pixel density. */
internal fun karooFieldSize(config: ViewConfig): KarooFieldSize = when (config.gridSize.second) {
    in Int.MIN_VALUE..15 -> KarooFieldSize.SMALL
    in 16..29 -> KarooFieldSize.MEDIUM
    else -> KarooFieldSize.LARGE
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
        actual = (state.rollingPowerWatts3s ?: state.currentPowerWatts)?.let { actual ->
            val deltaText = delta?.let { " · ${if (it >= 0) "+" else ""}$it W" }.orEmpty()
            "3s $actual W$deltaText"
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

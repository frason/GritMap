package com.gritmap.karoo.karoo

import android.content.Context
import android.view.View
import android.widget.RemoteViews
import com.gritmap.karoo.R
import com.gritmap.karoo.service.LiveServiceStarter
import com.gritmap.karoo.ui.PowerBalanceBitmapRenderer
import com.gritmap.karoo.ui.PacingCoachBitmapRenderer
import com.gritmap.karoo.ui.SegmentPerformanceBitmapRenderer
import com.gritmap.karoo.ui.WPrimeBalanceBitmapRenderer
import com.gritmap.karoo.ui.karooVisualPalette
import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.LiveUiStore
import com.gritmap.karoo.ui.state.MatchStatus
import com.gritmap.karoo.ui.state.UnitSystem
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
import kotlin.math.roundToInt

abstract class StateGraphicDataType(
    extensionId: String,
    typeId: String,
    private val state: StateFlow<LiveUiState> = LiveUiStore.state,
) : DataTypeImpl(extensionId, typeId) {
    protected abstract fun remoteViews(
        context: Context,
        state: LiveUiState,
        size: KarooFieldSize,
        layout: KarooFieldLayout,
        viewSize: Pair<Int, Int>,
    ): RemoteViews

    override fun startView(context: Context, config: ViewConfig, emitter: ViewEmitter) {
        emitter.onNext(UpdateGraphicConfig(showHeader = false))
        val scope = CoroutineScope(Job() + Dispatchers.Default)
        scope.launch {
            if (config.preview) {
                karooPreviewFlow().collect { preview ->
                    emitter.updateView(
                        remoteViews(context, preview, karooFieldSize(config), karooFieldLayout(config), config.viewSize),
                    )
                }
            } else {
                LiveServiceStarter.startIfPermitted(context, "$typeId-view")
                state.collect {
                    emitter.updateView(
                        remoteViews(context, it, karooFieldSize(config), karooFieldLayout(config), config.viewSize),
                    )
                }
            }
        }
        emitter.setCancellable { scope.cancel() }
    }
}

class PacingCoachDataType(extensionId: String) : GlanceGraphicDataType(
    extensionId, TYPE_ID, com.gritmap.karoo.ui.GlanceField.PACING,
) { companion object { const val TYPE_ID = "pacing-coach" } }

private fun coachActionLabel(icon: com.gritmap.karoo.ui.state.GuidanceIcon?): String = when (icon) {
    com.gritmap.karoo.ui.state.GuidanceIcon.RECOVER -> "REST"
    com.gritmap.karoo.ui.state.GuidanceIcon.HOLD -> "HOLD"
    com.gritmap.karoo.ui.state.GuidanceIcon.PUSH -> "PUSH"
    com.gritmap.karoo.ui.state.GuidanceIcon.WARNING, null -> "CHECK"
}

private fun coachBackgroundResource(icon: com.gritmap.karoo.ui.state.GuidanceIcon?): Int = when (icon) {
    com.gritmap.karoo.ui.state.GuidanceIcon.RECOVER -> R.drawable.gm_guidance_recover
    com.gritmap.karoo.ui.state.GuidanceIcon.HOLD -> R.drawable.gm_guidance_hold
    com.gritmap.karoo.ui.state.GuidanceIcon.PUSH -> R.drawable.gm_guidance_push
    com.gritmap.karoo.ui.state.GuidanceIcon.WARNING, null -> R.drawable.gm_guidance_neutral
}

class SegmentPerformanceDataType(extensionId: String) : GlanceGraphicDataType(
    extensionId, TYPE_ID, com.gritmap.karoo.ui.GlanceField.PERFORMANCE,
) { companion object { const val TYPE_ID = "segment-performance" } }

class PowerBalanceDataType(extensionId: String) : GlanceGraphicDataType(
    extensionId, TYPE_ID, com.gritmap.karoo.ui.GlanceField.BALANCE,
) { companion object { const val TYPE_ID = "power-balance" } }

private fun signedWatts(delta: Int?): String = delta?.let {
    "${if (it >= 0) "+" else "−"}${kotlin.math.abs(it)} W"
} ?: "-- W"

private fun signedPercent(delta: Float?): String = delta?.let {
    "${if (it >= 0f) "+" else "−"}${kotlin.math.abs(it).toInt()}%"
} ?: "--%"

internal fun reserveComparisonHeadline(actualPct: Float, plannedPct: Float?): String {
    val planned = plannedPct ?: return "WAITING FOR PLAN"
    val difference = (actualPct - planned).roundToInt()
    return when {
        difference > 0 -> "$difference% ABOVE PLAN"
        difference < 0 -> "${kotlin.math.abs(difference)}% BELOW PLAN"
        else -> "ON PLAN"
    }
}

internal fun powerTrend(state: LiveUiState): String {
    val samples = state.powerExecutionHistory
    if (samples.size < 2) return "→"
    val change = samples.last().actualWatts - samples[samples.lastIndex - 1].actualWatts
    return when {
        change >= 8 -> "↑"
        change <= -8 -> "↓"
        else -> "→"
    }
}

/**
 * Green means within the same tolerance used for plan adherence. A large negative delta is
 * under target rather than "better", so it stays blue; above tolerance is red.
 */
internal fun powerDeltaColor(deltaWatts: Int?, targetWatts: Int?): Int {
    if (deltaWatts == null || targetWatts == null || targetWatts <= 0) return POWER_DELTA_NEUTRAL
    val tolerance = maxOf(15.0, targetWatts * 0.1)
    return when {
        deltaWatts < -tolerance -> POWER_DELTA_UNDER
        deltaWatts > tolerance -> POWER_DELTA_OVER
        else -> POWER_DELTA_ON_TARGET
    }
}

internal const val POWER_DELTA_ON_TARGET: Int = -13_975_959 // #FF2ABE69
internal const val POWER_DELTA_UNDER: Int = -12_281_880 // #FF4497E8
internal const val POWER_DELTA_OVER: Int = -1_088_434 // #FFEF644E
internal const val POWER_DELTA_NEUTRAL: Int = -3_551_526 // #FFC9CEDA

enum class KarooFieldSize { SMALL, MEDIUM, LARGE }

/** Karoo's page grid is always 60 rows high, independent of device pixel density. */
internal fun karooFieldSize(config: ViewConfig): KarooFieldSize = when (config.gridSize.second) {
    in Int.MIN_VALUE..15 -> KarooFieldSize.SMALL
    in 16..29 -> KarooFieldSize.MEDIUM
    else -> KarooFieldSize.LARGE
}

internal data class PacingCoachText(
    val header: String,
    val action: String,
    val target: String,
    val actual: String,
    val next: String,
    val paceRelation: String,
    val quality: String,
)

internal fun pacingCoachText(state: LiveUiState): PacingCoachText {
    val recommendation = state.recommendation
    val delta = state.powerDeltaWatts
    val next = state.nextPacingZone
    return PacingCoachText(
        header = buildString {
            append(state.segmentName.ifBlank { "GM PACING COACH" })
            if (state.totalDistanceMeters > 0.0) {
                append("  ·  ")
                append(formatCoachDistance(state.progressMeters, state.distanceUnitSystem))
                append(" / ")
                append(formatCoachDistance(state.totalDistanceMeters, state.distanceUnitSystem))
            }
        },
        action = recommendation?.instruction ?: "Waiting for pacing plan",
        target = recommendation?.targetPowerWatts?.let { "$it W" } ?: "-- W",
        actual = (state.rollingPowerWatts3s ?: state.currentPowerWatts)?.let { actual ->
            val deltaText = delta?.let { " · ${if (it >= 0) "+" else ""}$it W" }.orEmpty()
            "3s $actual W$deltaText"
        } ?: state.sensorStatus.warning.orEmpty().ifBlank { "Waiting for power" },
        next = next?.let {
            "NEXT ${it.effort.name}  ·  ${it.targetPowerWatts} W  ·  " +
                formatCoachDistance(state.distanceToNextZoneMeters?.toDouble() ?: 0.0, state.distanceUnitSystem)
        } ?: "Final pacing section",
        paceRelation = coachPaceRelation(state),
        quality = coachGuidanceQuality(state),
    )
}

private fun coachPaceRelation(state: LiveUiState): String {
    val elapsed = state.elapsedAttemptSeconds ?: return ""
    val planned = state.plannedFinishSeconds?.takeIf { it > 0 } ?: return ""
    if (state.totalDistanceMeters <= 0.0) return ""
    val targetProgress = (elapsed / planned * state.totalDistanceMeters)
        .coerceIn(0.0, state.totalDistanceMeters)
    val signedSecondsAhead = ((state.progressMeters - targetProgress) / state.totalDistanceMeters * planned)
        .roundToInt()
    if (kotlin.math.abs(signedSecondsAhead) <= 1) return "ON PACE"
    return if (signedSecondsAhead > 0) {
        "${signedSecondsAhead}s AHEAD"
    } else {
        "${kotlin.math.abs(signedSecondsAhead)}s BEHIND"
    }
}

private fun coachGuidanceQuality(state: LiveUiState): String {
    if (state.recommendation == null) return "GUIDANCE UNAVAILABLE"
    if (state.matchStatus == MatchStatus.UNCERTAIN) return "ESTIMATED  ·  ROUTE UNCERTAIN"
    if (!state.sensorStatus.gps || !state.sensorStatus.power) {
        val missing = buildList {
            if (!state.sensorStatus.gps) add("GPS")
            if (!state.sensorStatus.power) add("POWER")
        }
        return "STALE  ·  ${missing.joinToString(" + ")} MISSING"
    }
    return if (state.sensorStatus.adaptiveGuidanceAvailable) {
        "LIVE  ·  ADAPTIVE"
    } else {
        "LIVE  ·  BASELINE PLAN"
    }
}

private fun formatCoachDistance(meters: Double, units: UnitSystem): String =
    if (units == UnitSystem.IMPERIAL) {
        "${(meters * 3.28084).roundToInt()} ft"
    } else {
        "${meters.roundToInt()} m"
    }

internal data class SegmentPerformanceText(
    val segmentName: String,
    val plannedFinish: String,
    val predictedFinish: String,
    val adherence: String,
    val progress: String,
    val variance: String,
)

internal fun segmentPerformanceText(state: LiveUiState) = SegmentPerformanceText(
    segmentName = state.segmentName.ifBlank { "GritMap Performance" },
    plannedFinish = "Plan ${state.plannedFinishSeconds?.let(::formatDuration).orEmpty().ifBlank { "--" }}",
    predictedFinish = "Predicted ${state.predictedFinishSeconds?.let(::formatDuration).orEmpty().ifBlank { "--" }}",
    adherence = buildString {
        append("Adherence ${state.planAdherencePct?.let { "$it%" } ?: "--"}")
        val plan = state.plannedFinishSeconds
        val predicted = state.predictedFinishSeconds
        if (plan != null && predicted != null) {
            val delta = predicted - plan
            append(" · ${if (delta >= 0) "+" else "−"}${formatDuration(kotlin.math.abs(delta))}")
        }
    },
    progress = if (state.totalDistanceMeters > 0.0) {
        "${state.progressMeters.toInt()} / ${state.totalDistanceMeters.toInt()} m"
    } else {
        "Waiting for segment"
    },
    variance = finishVarianceLabel(state.plannedFinishSeconds, state.predictedFinishSeconds),
)

internal fun finishVarianceLabel(plannedSeconds: Int?, predictedSeconds: Int?): String {
    if (plannedSeconds == null || predictedSeconds == null) return "--"
    val delta = predictedSeconds - plannedSeconds
    if (delta == 0) return "ON PLAN"
    val direction = if (delta < 0) "AHEAD" else "BEHIND"
    return "${formatDuration(kotlin.math.abs(delta))} $direction"
}

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

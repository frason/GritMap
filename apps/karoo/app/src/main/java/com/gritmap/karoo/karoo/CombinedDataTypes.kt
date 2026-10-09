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

class PacingCoachDataType(extensionId: String) : StateGraphicDataType(extensionId, TYPE_ID) {
    override fun remoteViews(
        context: Context,
        state: LiveUiState,
        size: KarooFieldSize,
        layout: KarooFieldLayout,
        viewSize: Pair<Int, Int>,
    ): RemoteViews {
        val bitmap = PacingCoachBitmapRenderer(karooVisualPalette(context)).render(
            state,
            viewSize.first.coerceAtLeast(1),
            viewSize.second.coerceAtLeast(1),
        )
        return RemoteViews(context.packageName, R.layout.karoo_pacing_coach_dashboard_field).apply {
            setImageViewBitmap(R.id.karoo_pacing_coach_dashboard, bitmap)
        }
    }

    companion object { const val TYPE_ID = "pacing-coach" }
}

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

class SegmentPerformanceDataType(extensionId: String) : StateGraphicDataType(extensionId, TYPE_ID) {
    override fun remoteViews(
        context: Context,
        state: LiveUiState,
        size: KarooFieldSize,
        layout: KarooFieldLayout,
        viewSize: Pair<Int, Int>,
    ): RemoteViews {
        val renderer = SegmentPerformanceBitmapRenderer(karooVisualPalette(context))
        val bitmap = if (layout == KarooFieldLayout.LARGE || layout == KarooFieldLayout.NARROW) {
            renderer.renderDashboard(state, viewSize.first.coerceAtLeast(1), viewSize.second.coerceAtLeast(1))
        } else {
            renderer.renderCompactDashboard(
                state = state,
                width = viewSize.first.coerceAtLeast(1),
                height = viewSize.second.coerceAtLeast(1),
                showSupportingMetrics = layout == KarooFieldLayout.MEDIUM || layout == KarooFieldLayout.MEDIUM_WIDE,
            )
        }
        return RemoteViews(context.packageName, R.layout.karoo_segment_performance_dashboard_field).apply {
            setImageViewBitmap(R.id.karoo_performance_dashboard, bitmap)
        }
    }

    companion object { const val TYPE_ID = "segment-performance" }
}

class PowerBalanceDataType(extensionId: String) : StateGraphicDataType(extensionId, TYPE_ID) {
    override fun remoteViews(
        context: Context,
        state: LiveUiState,
        size: KarooFieldSize,
        layout: KarooFieldLayout,
        viewSize: Pair<Int, Int>,
    ): RemoteViews {
        val target = state.recommendation?.targetPowerWatts
        val actual = state.rollingPowerWatts3s
        val delta = state.powerDeltaWatts
        val trend = powerTrend(state)
        val compact = layout == KarooFieldLayout.SMALL || layout == KarooFieldLayout.SMALL_WIDE
        val reserve = state.wPrime
        return RemoteViews(context.packageName, R.layout.karoo_power_balance_field).apply {
            setTextViewText(
                R.id.karoo_power_balance_title,
                if (reserve?.estimated == true) "ENGINE RESERVE · EST." else "ENGINE RESERVE",
            )
            setTextViewText(
                R.id.karoo_power_balance_values,
                if (reserve != null) {
                    when (layout) {
                        KarooFieldLayout.SMALL, KarooFieldLayout.SMALL_WIDE -> {
                            "W′ ${reserve.actualRemainingPct.toInt()}% · ${signedWatts(delta)}"
                        }
                        KarooFieldLayout.MEDIUM, KarooFieldLayout.MEDIUM_WIDE,
                        KarooFieldLayout.NARROW -> {
                            "PLAN ${reserve.plannedRemainingPct?.toInt() ?: "--"}%   " +
                                "ACTUAL ${reserve.actualRemainingPct.toInt()}%"
                        }
                        KarooFieldLayout.LARGE -> {
                            reserveComparisonHeadline(reserve.actualRemainingPct, reserve.plannedRemainingPct)
                        }
                    }
                } else if (actual != null && target != null) {
                    "ACTUAL $actual W  $trend  TARGET $target W"
                } else {
                    "ACTUAL --  TARGET --"
                },
            )
            setTextViewText(
                R.id.karoo_power_balance_delta,
                if (reserve != null) {
                    val actualRate = reserve.actualBalanceChangeJoulesPerSecond
                    val plannedRate = reserve.plannedBalanceChangeJoulesPerSecond
                    val actualLabel = if (actualRate < 0.0) {
                        "USING ${kotlin.math.abs(actualRate).toInt()} J/s"
                    } else {
                        "RECOVERING +${actualRate.toInt()} J/s"
                    }
                    val plannedLabel = plannedRate?.let {
                        if (it < 0.0) {
                            "PLAN: USING ${kotlin.math.abs(it).toInt()} J/s"
                        } else {
                            "PLAN: RECOVERING ${it.toInt()} J/s"
                        }
                    }
                    if (layout == KarooFieldLayout.LARGE) {
                        val actualShort = if (actualRate < 0.0) {
                            "−${kotlin.math.abs(actualRate).toInt()}"
                        } else {
                            "+${actualRate.toInt()}"
                        }
                        val planShort = plannedRate?.let {
                            "${if (it >= 0.0) "+" else "−"}${kotlin.math.abs(it).toInt()}"
                        } ?: "--"
                        "ACT $actualShort W  •  PLAN $planShort W"
                    } else buildList {
                        add("ACTUAL: $actualLabel")
                        if (plannedLabel != null) add(plannedLabel)
                        if (layout != KarooFieldLayout.LARGE) {
                            reserve.projectedFinishPct?.toInt()?.let { add("FINISH $it%") }
                        }
                    }.joinToString(" · ")
                } else {
                    delta?.let { "${if (it >= 0) "+" else ""}$it W" }
                        ?: "Waiting for plan and power"
                },
            )
            setTextColor(
                R.id.karoo_power_balance_delta,
                if (reserve != null) context.getColor(R.color.gm_field_secondary_text)
                else powerDeltaColor(delta, target),
            )
            setViewVisibility(
                R.id.karoo_power_balance_title,
                if (compact || layout == KarooFieldLayout.LARGE) View.GONE else View.VISIBLE,
            )
            setViewVisibility(
                R.id.karoo_power_balance_values,
                if (compact || layout == KarooFieldLayout.LARGE) View.GONE else View.VISIBLE,
            )
            setViewVisibility(
                R.id.karoo_power_balance_delta,
                if (compact && layout != KarooFieldLayout.SMALL_WIDE) View.GONE else View.VISIBLE,
            )
            if (layout == KarooFieldLayout.LARGE) {
                setViewVisibility(R.id.karoo_power_balance_values, View.GONE)
                setViewVisibility(R.id.karoo_power_balance_delta, View.GONE)
            }
            val width = when (layout) {
                KarooFieldLayout.SMALL, KarooFieldLayout.MEDIUM, KarooFieldLayout.NARROW -> 320
                KarooFieldLayout.SMALL_WIDE, KarooFieldLayout.MEDIUM_WIDE -> 520
                KarooFieldLayout.LARGE -> viewSize.first.coerceAtLeast(1)
            }
            val height = when (layout) {
                KarooFieldLayout.SMALL, KarooFieldLayout.SMALL_WIDE -> 72
                KarooFieldLayout.MEDIUM, KarooFieldLayout.MEDIUM_WIDE, KarooFieldLayout.NARROW -> 150
                KarooFieldLayout.LARGE -> viewSize.second.coerceAtLeast(1)
            }
            setImageViewBitmap(
                R.id.karoo_power_balance_bar,
                if (reserve == null) {
                    WPrimeBalanceBitmapRenderer(karooVisualPalette(context)).renderCalculating(width, height)
                } else {
                    val renderer = WPrimeBalanceBitmapRenderer(karooVisualPalette(context))
                    when (layout) {
                        KarooFieldLayout.SMALL, KarooFieldLayout.SMALL_WIDE ->
                            renderer.renderCompact(reserve, width, height)
                        KarooFieldLayout.LARGE -> renderer.renderTrajectory(reserve, state, width, height)
                        else -> renderer.renderTanks(reserve, width, height)
                    }
                },
            )
        }
    }

    companion object { const val TYPE_ID = "power-balance" }
}

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

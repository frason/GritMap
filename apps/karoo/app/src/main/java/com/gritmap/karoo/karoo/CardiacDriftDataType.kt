package com.gritmap.karoo.karoo

import android.content.Context
import android.view.View
import android.widget.RemoteViews
import com.gritmap.karoo.R
import com.gritmap.karoo.ui.CardiacDriftBitmapRenderer
import com.gritmap.karoo.ui.karooVisualPalette
import com.gritmap.karoo.ui.state.CardiacDriftSample
import com.gritmap.karoo.ui.state.LiveUiState

/** Kept in its own source unit so incremental D8 always emits its concrete class definition. */
class CardiacDriftDataType(extensionId: String) : StateGraphicDataType(extensionId, TYPE_ID) {
    override fun remoteViews(
        context: Context,
        state: LiveUiState,
        size: KarooFieldSize,
        layout: KarooFieldLayout,
        viewSize: Pair<Int, Int>,
    ): RemoteViews {
        if (layout == KarooFieldLayout.LARGE || layout == KarooFieldLayout.SMALL || layout == KarooFieldLayout.SMALL_WIDE) {
            val renderer = CardiacDriftBitmapRenderer(karooVisualPalette(context))
            val bitmap = when (layout) {
                KarooFieldLayout.SMALL -> renderer.renderSmallThreshold(
                    state,
                    viewSize.first.coerceAtLeast(1),
                    viewSize.second.coerceAtLeast(1),
                )
                KarooFieldLayout.SMALL_WIDE -> renderer.renderCompactGauge(
                    state,
                    viewSize.first.coerceAtLeast(1),
                    viewSize.second.coerceAtLeast(1),
                )
                else -> renderer.renderDashboard(
                    state,
                    viewSize.first.coerceAtLeast(1),
                    viewSize.second.coerceAtLeast(1),
                )
            }
            return RemoteViews(context.packageName, R.layout.karoo_cardiac_drift_dashboard_field).apply {
                setImageViewBitmap(R.id.karoo_drift_dashboard, bitmap)
            }
        }
        val drift = state.cardiacDriftPct
        val direction = cardiacDriftTrend(state.cardiacDriftHistory)
        val status = when {
            drift == null -> "Settling · 3 min"
            drift < -0.5 -> "Improving"
            drift < 3.0 -> "Stable"
            drift < 5.0 -> "Drifting"
            else -> "High strain"
        } + if (drift == null) "" else "  $direction"
        val compact = layout == KarooFieldLayout.SMALL
        val width = when (size) {
            KarooFieldSize.SMALL -> 320
            KarooFieldSize.MEDIUM -> 480
            KarooFieldSize.LARGE -> 600
        }
        val height = when (size) {
            KarooFieldSize.SMALL -> 42
            KarooFieldSize.MEDIUM -> 80
            KarooFieldSize.LARGE -> 150
        }
        return RemoteViews(context.packageName, R.layout.karoo_cardiac_drift_field).apply {
            setTextViewText(R.id.karoo_drift_value, formatCardiacDrift(drift))
            setTextViewText(R.id.karoo_drift_status, status)
            setViewVisibility(
                R.id.karoo_drift_title,
                if (compact) View.GONE else View.VISIBLE,
            )
            setViewVisibility(
                R.id.karoo_drift_status,
                if (compact) View.GONE else View.VISIBLE,
            )
            setImageViewBitmap(
                R.id.karoo_drift_graph,
                CardiacDriftBitmapRenderer(karooVisualPalette(context)).render(
                    state.cardiacDriftHistory,
                    width,
                    height,
                ),
            )
        }
    }

    companion object { const val TYPE_ID = "cardiac-drift" }
}

internal fun formatCardiacDrift(driftPct: Double?): String = driftPct?.let {
    "${if (it >= 0.0) "+" else ""}${"%.1f".format(it)}%"
} ?: "--"

internal fun cardiacDriftTrend(history: List<CardiacDriftSample>): String {
    if (history.size < 2) return "→"
    val change = history.last().driftPct - history[history.lastIndex - 1].driftPct
    return when {
        change >= 0.35 -> "↑"
        change <= -0.35 -> "↓"
        else -> "→"
    }
}

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
class CardiacDriftDataType(extensionId: String) : GlanceGraphicDataType(
    extensionId, TYPE_ID, com.gritmap.karoo.ui.GlanceField.DRIFT,
) { companion object { const val TYPE_ID = "cardiac-drift" } }

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

package com.gritmap.karoo.karoo

import android.content.Context
import android.widget.RemoteViews
import com.gritmap.karoo.R
import com.gritmap.karoo.ui.H10CardiacBitmapRenderer
import com.gritmap.karoo.ui.karooVisualPalette
import com.gritmap.karoo.ui.state.LiveUiState

/** Polar H10-only beat-to-beat cardiac stability field. */
class H10CardiacDataType(extensionId: String) : StateGraphicDataType(extensionId, TYPE_ID) {
    override fun remoteViews(
        context: Context,
        state: LiveUiState,
        size: KarooFieldSize,
        layout: KarooFieldLayout,
        viewSize: Pair<Int, Int>,
    ): RemoteViews {
        val renderer = H10CardiacBitmapRenderer(karooVisualPalette(context))
        val bitmap = if (layout == KarooFieldLayout.LARGE || layout == KarooFieldLayout.NARROW) {
            renderer.renderDashboard(state, viewSize.first.coerceAtLeast(1), viewSize.second.coerceAtLeast(1))
        } else {
            renderer.renderCompact(state, viewSize.first.coerceAtLeast(1), viewSize.second.coerceAtLeast(1))
        }
        return RemoteViews(context.packageName, R.layout.karoo_cardiac_drift_dashboard_field).apply {
            setImageViewBitmap(R.id.karoo_drift_dashboard, bitmap)
        }
    }

    companion object { const val TYPE_ID = "h10-cardiac-stability" }
}

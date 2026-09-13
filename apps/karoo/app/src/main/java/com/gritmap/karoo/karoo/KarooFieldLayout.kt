package com.gritmap.karoo.karoo

import com.gritmap.karoo.ui.state.GuidanceIcon
import io.hammerhead.karooext.models.ViewConfig

/**
 * Semantic Karoo field shapes. Width and height both matter: a short full-width cell and a
 * narrow tall cell cannot use the same composition even when they contain a similar area.
 */
enum class KarooFieldLayout {
    SMALL,
    SMALL_WIDE,
    MEDIUM,
    MEDIUM_WIDE,
    LARGE,
    NARROW,
}

internal fun karooFieldLayout(config: ViewConfig): KarooFieldLayout {
    val fullWidth = config.gridSize.first >= 50
    val heightPx = config.viewSize.second
    return if (fullWidth) {
        when {
            heightPx >= 250 -> KarooFieldLayout.LARGE
            heightPx >= 160 -> KarooFieldLayout.MEDIUM_WIDE
            else -> KarooFieldLayout.SMALL_WIDE
        }
    } else {
        when {
            heightPx >= 600 -> KarooFieldLayout.NARROW
            heightPx >= 200 -> KarooFieldLayout.MEDIUM
            else -> KarooFieldLayout.SMALL
        }
    }
}

internal fun karooEffortColor(icon: GuidanceIcon?): Int = when (icon) {
    GuidanceIcon.RECOVER -> 0xFF20AA5B.toInt()
    GuidanceIcon.HOLD -> 0xFF1D7DDC.toInt()
    GuidanceIcon.PUSH -> 0xFFE75B40.toInt()
    GuidanceIcon.WARNING, null -> 0xFFFFFFFF.toInt()
}

internal fun karooEffortTextColor(icon: GuidanceIcon?): Int = when (icon) {
    GuidanceIcon.RECOVER -> 0xFF000000.toInt()
    GuidanceIcon.HOLD, GuidanceIcon.PUSH, GuidanceIcon.WARNING, null -> 0xFFFFFFFF.toInt()
}

package com.gritmap.karoo.ui

import android.content.Context
import android.content.res.Configuration
import android.graphics.Color

data class KarooVisualPalette(
    val background: Int,
    val surface: Int,
    val primaryText: Int,
    val secondaryText: Int,
    val divider: Int,
    val progressMarker: Int,
) {
    companion object {
        val Dark = KarooVisualPalette(
            Color.rgb(18, 20, 23), Color.rgb(12, 14, 17), Color.WHITE,
            Color.rgb(205, 211, 219), Color.rgb(112, 120, 130), Color.WHITE,
        )
        val Light = KarooVisualPalette(
            Color.rgb(247, 248, 250), Color.WHITE, Color.rgb(18, 20, 23),
            Color.rgb(76, 83, 92), Color.rgb(150, 157, 166), Color.BLACK,
        )
    }
}

fun karooVisualPalette(context: Context): KarooVisualPalette {
    val mode = context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
    return if (mode == Configuration.UI_MODE_NIGHT_YES) KarooVisualPalette.Dark else KarooVisualPalette.Light
}

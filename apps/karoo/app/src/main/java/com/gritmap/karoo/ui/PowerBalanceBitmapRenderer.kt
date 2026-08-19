package com.gritmap.karoo.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import kotlin.math.max

/** Renders rolling power as a filled bar with a fixed white target marker. */
class PowerBalanceBitmapRenderer {
    private val background = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(48, 53, 60) }
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val targetMarker = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        strokeWidth = 4f
    }

    fun render(actualWatts: Int?, targetWatts: Int?, width: Int, height: Int): Bitmap {
        val safeWidth = max(width, 1)
        val safeHeight = max(height, 1)
        val bitmap = Bitmap.createBitmap(safeWidth, safeHeight, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawRoundRect(0f, 0f, safeWidth.toFloat(), safeHeight.toFloat(), 12f, 12f, background)
        if (actualWatts == null || targetWatts == null || targetWatts <= 0) return bitmap

        val maximum = max(targetWatts * 1.5, actualWatts.toDouble()).coerceAtLeast(1.0)
        val targetX = (targetWatts / maximum * safeWidth).toFloat().coerceIn(0f, safeWidth.toFloat())
        val actualX = (actualWatts / maximum * safeWidth).toFloat().coerceIn(0f, safeWidth.toFloat())
        val tolerance = max(15.0, targetWatts * 0.1)
        fill.color = when {
            actualWatts < targetWatts - tolerance -> Color.rgb(29, 125, 220)
            actualWatts > targetWatts + tolerance -> Color.rgb(231, 91, 64)
            else -> Color.rgb(32, 170, 91)
        }
        canvas.drawRoundRect(0f, 0f, actualX, safeHeight.toFloat(), 12f, 12f, fill)
        canvas.drawLine(targetX, 0f, targetX, safeHeight.toFloat(), targetMarker)
        return bitmap
    }
}

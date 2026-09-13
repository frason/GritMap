package com.gritmap.karoo.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import kotlin.math.abs
import kotlin.math.max

/** Visualizes predicted finish relative to the plan plus completed segment distance. */
class SegmentPerformanceBitmapRenderer(
    private val palette: KarooVisualPalette = KarooVisualPalette.Dark,
) {
    fun render(
        plannedSeconds: Int?,
        predictedSeconds: Int?,
        progressFraction: Float,
        width: Int,
        height: Int,
    ): Bitmap {
        val safeWidth = max(width, 1)
        val safeHeight = max(height, 1)
        val bitmap = Bitmap.createBitmap(safeWidth, safeHeight, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(palette.background)
        val inset = safeWidth * 0.06f
        val trackStart = inset
        val trackEnd = safeWidth - inset
        val centerX = safeWidth / 2f
        val comparisonY = safeHeight * 0.38f
        val progressY = safeHeight * 0.78f
        val base = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.divider
            strokeWidth = (safeHeight * 0.14f).coerceIn(8f, 16f)
            strokeCap = Paint.Cap.ROUND
        }
        canvas.drawLine(trackStart, comparisonY, trackEnd, comparisonY, base)

        if (plannedSeconds != null && plannedSeconds > 0 && predictedSeconds != null) {
            val delta = predictedSeconds - plannedSeconds
            val range = max(plannedSeconds * 0.15, 30.0)
            val predictedX = (centerX + delta / range * (trackEnd - trackStart) / 2f)
                .toFloat()
                .coerceIn(trackStart, trackEnd)
            val result = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = if (delta <= 0) Color.rgb(32, 170, 91) else Color.rgb(231, 91, 64)
                strokeWidth = base.strokeWidth
                strokeCap = Paint.Cap.ROUND
            }
            canvas.drawLine(centerX, comparisonY, predictedX, comparisonY, result)
            canvas.drawCircle(predictedX, comparisonY, base.strokeWidth * 0.72f, result)
            val plan = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = palette.primaryText
                strokeWidth = 4f
            }
            canvas.drawLine(centerX, comparisonY - 16f, centerX, comparisonY + 16f, plan)
        }

        val progressBase = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.divider
            strokeWidth = (safeHeight * 0.10f).coerceIn(6f, 12f)
            strokeCap = Paint.Cap.ROUND
        }
        val progress = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(29, 125, 220)
            strokeWidth = progressBase.strokeWidth
            strokeCap = Paint.Cap.ROUND
        }
        canvas.drawLine(trackStart, progressY, trackEnd, progressY, progressBase)
        canvas.drawLine(
            trackStart,
            progressY,
            trackStart + (trackEnd - trackStart) * progressFraction.coerceIn(0f, 1f),
            progressY,
            progress,
        )
        return bitmap
    }
}

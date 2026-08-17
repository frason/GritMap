package com.gritmap.karoo.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import com.gritmap.karoo.ui.state.Effort
import com.gritmap.karoo.ui.state.LiveUiState
import kotlin.math.max

class ProfileBitmapRenderer {
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = 3f
    }
    private val markerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }

    fun render(state: LiveUiState, width: Int, height: Int): Bitmap {
        val safeWidth = max(width, 1)
        val safeHeight = max(height, 1)
        val bitmap = Bitmap.createBitmap(safeWidth, safeHeight, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.rgb(18, 20, 23))

        val profile = state.elevationProfile
        if (profile.size < 2 || state.totalDistanceMeters <= 0.0) return bitmap

        val minElevation = profile.minOf { it.elevationMeters }
        val maxElevation = profile.maxOf { it.elevationMeters }
        val elevationSpan = max(maxElevation - minElevation, 1.0)
        val total = state.totalDistanceMeters

        state.pacingZones.forEach { zone ->
            fillPaint.color = when (zone.effort) {
                Effort.RECOVER -> Color.rgb(29, 125, 220)
                Effort.HOLD -> Color.rgb(32, 170, 91)
                Effort.PUSH -> Color.rgb(231, 91, 64)
            }
            fillPaint.alpha = 105
            val left = (zone.startDistanceMeters / total * safeWidth).toFloat().coerceIn(0f, safeWidth.toFloat())
            val right = (zone.endDistanceMeters / total * safeWidth).toFloat().coerceIn(left, safeWidth.toFloat())
            canvas.drawRect(left, 0f, right, safeHeight.toFloat(), fillPaint)
        }

        val path = Path()
        profile.forEachIndexed { index, sample ->
            val x = (sample.distanceMeters / total * safeWidth).toFloat()
            val y = safeHeight - ((sample.elevationMeters - minElevation) / elevationSpan * (safeHeight - 8)).toFloat() - 4f
            if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        canvas.drawPath(path, linePaint)

        val markerX = state.progressFraction * safeWidth
        canvas.drawCircle(markerX, safeHeight * 0.5f, 6f, markerPaint)
        canvas.drawLine(markerX, 0f, markerX, safeHeight.toFloat(), markerPaint)
        return bitmap
    }
}

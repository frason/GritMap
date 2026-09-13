package com.gritmap.karoo.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import com.gritmap.karoo.ui.state.CardiacDriftSample
import kotlin.math.max

/** Draws a progress-based drift sparkline over stable, caution, and high-strain bands. */
class CardiacDriftBitmapRenderer(
    palette: KarooVisualPalette = KarooVisualPalette.Dark,
) {
    private val green = Paint().apply { color = Color.rgb(24, 91, 55) }
    private val amber = Paint().apply { color = Color.rgb(112, 84, 20) }
    private val red = Paint().apply { color = Color.rgb(117, 48, 40) }
    private val improving = Paint().apply { color = Color.rgb(18, 73, 48) }
    private val zeroLine = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = palette.divider
        strokeWidth = 2f
    }
    private val trace = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = palette.primaryText
        strokeWidth = 4f
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }
    private val threshold = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(120, 255, 255, 255)
        strokeWidth = 2f
    }

    fun render(history: List<CardiacDriftSample>, width: Int, height: Int): Bitmap {
        val safeWidth = max(width, 1)
        val safeHeight = max(height, 1)
        val bitmap = Bitmap.createBitmap(safeWidth, safeHeight, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val yZero = yFor(0.0, safeHeight)
        val yThree = yFor(3.0, safeHeight)
        val yFive = yFor(5.0, safeHeight)
        canvas.drawRect(0f, 0f, safeWidth.toFloat(), yFive, red)
        canvas.drawRect(0f, yFive, safeWidth.toFloat(), yThree, amber)
        canvas.drawRect(0f, yThree, safeWidth.toFloat(), yZero, green)
        // Negative drift is a real, useful result: power/HR efficiency improved from baseline.
        canvas.drawRect(0f, yZero, safeWidth.toFloat(), safeHeight.toFloat(), improving)
        canvas.drawLine(0f, yZero, safeWidth.toFloat(), yZero, zeroLine)
        canvas.drawLine(0f, yThree, safeWidth.toFloat(), yThree, threshold)
        canvas.drawLine(0f, yFive, safeWidth.toFloat(), yFive, threshold)

        if (history.size >= 2) {
            val path = android.graphics.Path()
            history.forEachIndexed { index, sample ->
                val x = sample.progressFraction.coerceIn(0f, 1f) * safeWidth
                val y = yFor(sample.driftPct, safeHeight)
                if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }
            canvas.drawPath(path, trace)
            val last = history.last()
            canvas.drawCircle(
                last.progressFraction.coerceIn(0f, 1f) * safeWidth,
                yFor(last.driftPct, safeHeight),
                7f,
                Paint(Paint.ANTI_ALIAS_FLAG).apply { color = trace.color },
            )
        }
        return bitmap
    }

    private fun yFor(driftPct: Double, height: Int): Float {
        val minimum = -10.0
        val maximum = 10.0
        val fraction = ((driftPct.coerceIn(minimum, maximum) - minimum) / (maximum - minimum))
        return ((1.0 - fraction) * height).toFloat()
    }
}

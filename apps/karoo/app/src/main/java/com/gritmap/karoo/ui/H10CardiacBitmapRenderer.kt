package com.gritmap.karoo.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import com.gritmap.karoo.ui.state.H10DfaSample
import com.gritmap.karoo.ui.state.LiveUiState
import kotlin.math.max

/** Research-oriented H10 view. Reference bands are context, not medical thresholds. */
class H10CardiacBitmapRenderer(
    private val palette: KarooVisualPalette = KarooVisualPalette.Dark,
) {
    private val blue = Color.rgb(38, 135, 232)
    private val green = Color.rgb(32, 170, 91)
    private val amber = Color.rgb(239, 174, 55)
    private val red = Color.rgb(231, 91, 64)

    fun renderDashboard(state: LiveUiState, width: Int, height: Int): Bitmap {
        val w = max(width, 1).toFloat()
        val h = max(height, 1).toFloat()
        val bitmap = Bitmap.createBitmap(w.toInt(), h.toInt(), Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(palette.background)
        val margin = w * 0.035f
        text(canvas, "GM H10 CARDIAC", margin, h * 0.045f, w * 0.061f, palette.primaryText, Paint.Align.LEFT)
        text(canvas, "RR ${state.h10ValidRrPct}%", w - margin, h * 0.045f, w * 0.055f, qualityColor(state), Paint.Align.RIGHT)

        val bannerTop = h * 0.085f
        val bannerBottom = h * 0.19f
        val status = status(state)
        canvas.drawRoundRect(margin, bannerTop, w - margin, bannerBottom, 18f, 18f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = status.color
        })
        centered(canvas, status.label, w / 2f, (bannerTop + bannerBottom) / 2f, w * 0.077f, status.textColor)

        metricCard(canvas, margin, h * 0.21f, w * 0.49f, h * 0.38f, "DFA α1", formatAlpha(state.h10DfaAlpha1), "2 MIN RR", status.color)
        metricCard(canvas, w * 0.51f, h * 0.21f, w - margin, h * 0.38f, "RMSSD", state.h10RmssdMs?.let { "%.0f ms".format(it) } ?: "--", "SUPPORTING", blue)

        text(canvas, "CARDIAC CORRELATION", margin, h * 0.425f, w * 0.058f, palette.primaryText, Paint.Align.LEFT)
        drawChart(canvas, state.h10DfaHistory, w * 0.14f, h * 0.48f, w * 0.96f, h * 0.88f)

        val footer = when {
            !state.h10EnhancedAvailable -> "COLLECTING 2 MIN OF CLEAN RR"
            state.h10ValidRrPct < 90 -> "SIGNAL POOR • GUIDANCE FROZEN"
            else -> "H10 ENHANCED • RESEARCH SIGNAL"
        }
        canvas.drawRoundRect(margin, h * 0.925f, w - margin, h * 0.975f, 14f, 14f, Paint().apply {
            color = Color.rgb(10, 48, 31)
        })
        centered(canvas, footer, w / 2f, h * 0.95f, w * 0.042f, qualityColor(state))
        return bitmap
    }

    fun renderCompact(state: LiveUiState, width: Int, height: Int): Bitmap {
        val w = max(width, 1).toFloat()
        val h = max(height, 1).toFloat()
        val bitmap = Bitmap.createBitmap(w.toInt(), h.toInt(), Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(palette.background)
        val status = status(state)
        text(canvas, "GM H10 α1", w * 0.06f, h * 0.15f, (w * 0.075f).coerceIn(16f, 27f), palette.primaryText, Paint.Align.LEFT)
        text(canvas, "RR ${state.h10ValidRrPct}%", w * 0.94f, h * 0.15f, (w * 0.06f).coerceIn(14f, 23f), qualityColor(state), Paint.Align.RIGHT)
        centered(canvas, formatAlpha(state.h10DfaAlpha1), w / 2f, h * 0.49f, (w * 0.19f).coerceIn(36f, 70f), palette.primaryText)
        centered(canvas, status.label, w / 2f, h * 0.76f, (w * 0.072f).coerceIn(16f, 27f), status.color)
        val y = h * 0.9f
        val left = w * 0.08f
        val right = w * 0.92f
        canvas.drawLine(left, y, right, y, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = palette.divider; strokeWidth = 10f; strokeCap = Paint.Cap.ROUND })
        listOf(0.5 to red, 0.75 to amber, 1.0 to green).forEach { (value, color) ->
            val x = alphaX(value, left, right)
            canvas.drawCircle(x, y, 7f, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color })
        }
        state.h10DfaAlpha1?.let { value ->
            canvas.drawCircle(alphaX(value, left, right), y, 10f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE })
        }
        return bitmap
    }

    private fun drawChart(canvas: Canvas, history: List<H10DfaSample>, left: Float, top: Float, right: Float, bottom: Float) {
        fun y(value: Double): Float = bottom - ((value.coerceIn(0.3, 1.3) - 0.3) * (bottom - top)).toFloat()
        canvas.drawRect(left, top, right, y(0.75), Paint().apply { color = Color.argb(58, 32, 170, 91) })
        canvas.drawRect(left, y(0.75), right, y(0.5), Paint().apply { color = Color.argb(58, 239, 174, 55) })
        canvas.drawRect(left, y(0.5), right, bottom, Paint().apply { color = Color.argb(58, 231, 91, 64) })
        val axis = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = palette.secondaryText; strokeWidth = 2f }
        canvas.drawLine(left, top, left, bottom, axis)
        canvas.drawLine(left, bottom, right, bottom, axis)
        listOf(0.5, 0.75, 1.0).forEach { value ->
            val yy = y(value)
            canvas.drawLine(left, yy, right, yy, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = palette.divider; strokeWidth = 2f; pathEffect = DashPathEffect(floatArrayOf(10f, 7f), 0f)
            })
            text(canvas, "%.2f".format(value), left - 10f, yy, 22f, palette.secondaryText, Paint.Align.RIGHT)
        }
        if (history.size >= 2) {
            val minTime = history.first().elapsedSeconds
            val duration = (history.last().elapsedSeconds - minTime).coerceAtLeast(1)
            fun x(sample: H10DfaSample) = left + (sample.elapsedSeconds - minTime).toFloat() / duration * (right - left)
            val path = Path()
            history.forEachIndexed { index, sample ->
                if (index == 0) path.moveTo(x(sample), y(sample.alpha1)) else path.lineTo(x(sample), y(sample.alpha1))
            }
            canvas.drawPath(path, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = blue; strokeWidth = 7f; style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND })
            val last = history.last()
            canvas.drawCircle(x(last), y(last.alpha1), 9f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = blue })
        }
        text(canvas, "LOW", left, bottom + 25f, 20f, palette.secondaryText, Paint.Align.LEFT)
        text(canvas, "HIGH STRAIN", right, bottom + 25f, 20f, palette.secondaryText, Paint.Align.RIGHT)
    }

    private data class Status(val label: String, val color: Int, val textColor: Int = Color.WHITE)
    private fun status(state: LiveUiState): Status = when {
        !state.h10EnhancedAvailable || state.h10DfaAlpha1 == null -> Status("COLLECTING RR", palette.divider)
        state.h10ValidRrPct < 90 -> Status("SIGNAL POOR", amber, Color.BLACK)
        state.h10DfaAlpha1 < 0.5 -> Status("HIGH CARDIAC STRAIN", red)
        state.h10DfaAlpha1 < 0.75 -> Status("THRESHOLD RANGE", amber, Color.BLACK)
        else -> Status("AEROBICALLY STABLE", green)
    }

    private fun qualityColor(state: LiveUiState) = if (state.h10ValidRrPct >= 90) green else amber
    private fun formatAlpha(value: Double?) = value?.let { "%.2f".format(it) } ?: "--"
    private fun alphaX(value: Double, left: Float, right: Float) = left + ((value.coerceIn(0.3, 1.3) - 0.3) * (right - left)).toFloat()

    private fun metricCard(canvas: Canvas, left: Float, top: Float, right: Float, bottom: Float, label: String, value: String, subtitle: String, accent: Int) {
        canvas.drawRoundRect(left, top, right, bottom, 12f, 12f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = palette.divider; style = Paint.Style.STROKE; strokeWidth = 2f })
        centered(canvas, label, (left + right) / 2f, top + (bottom - top) * 0.2f, 24f, palette.secondaryText)
        centered(canvas, value, (left + right) / 2f, top + (bottom - top) * 0.52f, 48f, palette.primaryText)
        centered(canvas, subtitle, (left + right) / 2f, top + (bottom - top) * 0.81f, 20f, accent)
    }

    private fun centered(canvas: Canvas, value: String, x: Float, y: Float, size: Float, color: Int) = text(canvas, value, x, y, size, color, Paint.Align.CENTER)
    private fun text(canvas: Canvas, value: String, x: Float, y: Float, size: Float, color: Int, align: Paint.Align) {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color; textSize = size; textAlign = align; isFakeBoldText = true
            typeface = android.graphics.Typeface.create("sans-serif-condensed", android.graphics.Typeface.BOLD)
        }
        canvas.drawText(value, x, y - (paint.fontMetrics.ascent + paint.fontMetrics.descent) / 2f, paint)
    }
}

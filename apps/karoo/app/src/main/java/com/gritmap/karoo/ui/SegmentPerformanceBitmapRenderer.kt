package com.gritmap.karoo.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.GuidanceIcon
import com.gritmap.karoo.ui.state.UnitSystem
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/** Visualizes predicted finish relative to the plan plus completed segment distance. */
class SegmentPerformanceBitmapRenderer(
    private val palette: KarooVisualPalette = KarooVisualPalette.Dark,
) {
    fun renderDashboard(state: LiveUiState, width: Int, height: Int): Bitmap {
        val w = max(width, 1).toFloat()
        val h = max(height, 1).toFloat()
        val bitmap = Bitmap.createBitmap(w.toInt(), h.toInt(), Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(palette.background)
        val margin = w * 0.035f
        text(canvas, "GM SEGMENT PERFORMANCE", margin, h * 0.042f, w * 0.048f, palette.primaryText, Paint.Align.LEFT)
        text(canvas, performanceDistance(state), w - margin, h * 0.042f, w * 0.043f, palette.secondaryText, Paint.Align.RIGHT)

        val plan = state.plannedFinishSeconds
        val predicted = state.predictedFinishSeconds
        val timeBank = if (plan != null && predicted != null) plan - predicted else null
        val improving = timeBank != null && timeBank >= 0
        val bannerTop = h * 0.075f
        val bannerBottom = h * 0.165f
        canvas.drawRoundRect(margin, bannerTop, w - margin, bannerBottom, 18f, 18f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = if (improving) Color.rgb(38, 135, 232) else Color.rgb(231, 91, 64)
        })
        centered(canvas, "${actionLabel(state.recommendation?.icon)} • ${resultHeadline(timeBank)}", w / 2f, (bannerTop + bannerBottom) / 2f, w * 0.061f, Color.WHITE)

        val resultColor = if (improving) Color.rgb(32, 190, 105) else Color.rgb(239, 91, 69)
        centered(canvas, predicted?.let(::clock) ?: "--:--", w / 2f, h * 0.235f, w * 0.120f, palette.primaryText)
        centered(canvas, "EXPECTED FINISH  •  GOAL ${plan?.let(::clock) ?: "--:--"}  •  ${resultHeadline(timeBank)}", w / 2f, h * 0.300f, w * 0.035f, resultColor)

        drawTimeBank(canvas, timeBank, w, h * 0.365f)

        text(canvas, "¼-MILE SPLITS VS PLAN", margin, h * 0.455f, w * 0.043f, palette.primaryText, Paint.Align.LEFT)
        if (state.segmentSplitDeltasSeconds.isEmpty()) {
            drawAwaitingFirstSplit(canvas, state, margin, h * 0.49f, w - margin, h * 0.79f)
        } else {
            drawSplitChart(canvas, state.segmentSplitDeltasSeconds, margin, h * 0.49f, w - margin, h * 0.79f)
        }

        drawMetricCard(canvas, margin, h * 0.83f, w * 0.485f, h * 0.965f, "COMPLETE", "${(state.progressFraction * 100).toInt()}%", Color.rgb(38, 135, 232))
        drawMetricCard(canvas, w * 0.515f, h * 0.83f, w - margin, h * 0.965f, "ADHERENCE", "${state.planAdherencePct ?: 0}%", adherenceColor(state.planAdherencePct))
        return bitmap
    }

    private fun drawTimeBank(canvas: Canvas, seconds: Int?, width: Float, centerY: Float) {
        val left = width * 0.07f
        val right = width * 0.93f
        val center = width / 2f
        val track = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(53, 58, 65); strokeWidth = 24f; strokeCap = Paint.Cap.ROUND }
        canvas.drawLine(left, centerY, right, centerY, track)
        canvas.drawLine(center, centerY - 19f, center, centerY + 19f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.primaryText; strokeWidth = 4f; strokeCap = Paint.Cap.ROUND
        })
        text(canvas, "−60", left, centerY + 31f, 17f, palette.secondaryText, Paint.Align.CENTER)
        text(canvas, "0", center, centerY + 31f, 17f, palette.secondaryText, Paint.Align.CENTER)
        text(canvas, "+60", right, centerY + 31f, 17f, palette.secondaryText, Paint.Align.CENTER)
        if (seconds != null) {
            val fraction = (seconds.coerceIn(-60, 60) / 60f)
            val endpoint = center + fraction * (right - center)
            val start = minOf(center, endpoint)
            val end = maxOf(center, endpoint)
            val color = if (seconds >= 0) Color.rgb(32, 190, 105) else Color.rgb(239, 91, 69)
            val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                shader = LinearGradient(start, centerY, end.coerceAtLeast(start + 1f), centerY, Color.argb(145, Color.red(color), Color.green(color), Color.blue(color)), color, Shader.TileMode.CLAMP)
                strokeWidth = 24f; strokeCap = Paint.Cap.ROUND
            }
            canvas.drawLine(center, centerY, endpoint, centerY, fill)
            val radius = 31f
            canvas.drawCircle(endpoint, centerY, radius, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color })
            canvas.drawCircle(endpoint, centerY, radius, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = palette.primaryText; style = Paint.Style.STROKE; strokeWidth = 4f })
            centered(canvas, signedSeconds(seconds), endpoint, centerY, 21f, Color.WHITE)
        }
    }

    private fun drawSplitChart(canvas: Canvas, splits: List<Int>, left: Float, top: Float, right: Float, bottom: Float) {
        canvas.drawRoundRect(left, top, right, bottom, 15f, 15f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(20, 23, 27) })
        val shown = splits.takeLast(5).reversed()
        val rowHeight = (bottom - top) / shown.size.coerceAtLeast(1)
        val zeroX = left + (right - left) * 0.50f
        val maxAbs = max(8, shown.maxOfOrNull { abs(it) } ?: 8)
        canvas.drawLine(zeroX, top + 8f, zeroX, bottom - 8f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = palette.secondaryText; strokeWidth = 3f })
        shown.forEachIndexed { index, delta ->
            val centerY = top + rowHeight * (index + 0.5f)
            val barWidth = abs(delta).toFloat() / maxAbs * (right - left) * 0.36f
            val endX = if (delta >= 0) zeroX + barWidth else zeroX - barWidth
            val color = if (delta >= 0) Color.rgb(32, 190, 105) else Color.rgb(239, 91, 69)
            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color }
            canvas.drawRoundRect(min(zeroX, endX), centerY - rowHeight * 0.27f, max(zeroX, endX), centerY + rowHeight * 0.27f, 9f, 9f, paint)
            val splitNumber = splits.size - index
            text(canvas, splitDistanceLabel(splitNumber), left + 13f, centerY, 17f, palette.secondaryText, Paint.Align.LEFT)
            text(canvas, signedSeconds(delta), if (delta >= 0) endX + 9f else endX - 9f, centerY, 18f, color, if (delta >= 0) Paint.Align.LEFT else Paint.Align.RIGHT)
        }
    }

    private fun drawAwaitingFirstSplit(canvas: Canvas, state: LiveUiState, left: Float, top: Float, right: Float, bottom: Float) {
        canvas.drawRoundRect(left, top, right, bottom, 16f, 16f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(20, 23, 27) })
        val remaining = (402.336 - state.progressMeters.coerceAtLeast(0.0)).coerceAtLeast(0.0)
        centered(canvas, "FIRST ¼-MILE", (left + right) / 2f, top + (bottom - top) * 0.32f, 27f, palette.primaryText)
        centered(canvas, "IN ${distanceShort(remaining, state.distanceUnitSystem)}", (left + right) / 2f, top + (bottom - top) * 0.58f, 39f, Color.rgb(38, 135, 232))
        centered(canvas, "SPLIT COMPARISON STARTS HERE", (left + right) / 2f, top + (bottom - top) * 0.80f, 17f, palette.secondaryText)
    }

    private fun drawMetricCard(canvas: Canvas, left: Float, top: Float, right: Float, bottom: Float, label: String, value: String, color: Int) {
        canvas.drawRoundRect(left, top, right, bottom, 17f, 17f, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = Color.rgb(20, 23, 27) })
        canvas.drawRoundRect(left, top, left + 8f, bottom, 6f, 6f, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color })
        centered(canvas, value, (left + right) / 2f, top + (bottom - top) * 0.42f, 35f, palette.primaryText)
        centered(canvas, label, (left + right) / 2f, top + (bottom - top) * 0.76f, 17f, palette.secondaryText)
    }

    private fun finishComparison(timeBank: Int?, plan: Int?): String {
        if (timeBank == null || plan == null) return "WAITING FOR GOAL"
        return "${abs(timeBank)}s ${if (timeBank >= 0) "AHEAD OF" else "BEHIND"} ${clock(plan)} GOAL"
    }

    private fun resultHeadline(timeBank: Int?): String = when {
        timeBank == null -> "WAITING FOR GOAL"
        timeBank > 0 -> "+${timeBank}s AHEAD"
        timeBank < 0 -> "−${abs(timeBank)}s BEHIND"
        else -> "ON GOAL"
    }

    private fun actionLabel(icon: GuidanceIcon?): String = when (icon) {
        GuidanceIcon.RECOVER -> "REST"
        GuidanceIcon.HOLD -> "HOLD"
        GuidanceIcon.PUSH -> "PUSH"
        GuidanceIcon.WARNING, null -> "CHECK"
    }

    private fun signedSeconds(seconds: Int): String = when {
        seconds > 0 -> "+${seconds}s"
        seconds < 0 -> "−${abs(seconds)}s"
        else -> "0s"
    }

    private fun adherenceColor(value: Int?): Int = when {
        value == null -> palette.secondaryText
        value >= 90 -> Color.rgb(32, 190, 105)
        value >= 75 -> Color.rgb(246, 178, 54)
        else -> Color.rgb(239, 91, 69)
    }

    private fun distanceShort(meters: Double, units: UnitSystem): String = if (units == UnitSystem.IMPERIAL) {
        "${(meters * 3.28084).toInt()} FT"
    } else {
        "${meters.toInt()} M"
    }

    private fun splitDistanceLabel(quarter: Int): String {
        val whole = quarter / 4
        val fraction = when (quarter % 4) {
            1 -> "¼"
            2 -> "½"
            3 -> "¾"
            else -> ""
        }
        return if (whole == 0) "$fraction MI" else "$whole$fraction MI"
    }

    private fun performanceDistance(state: LiveUiState): String = if (state.distanceUnitSystem == UnitSystem.IMPERIAL) {
        "%.1f / %.1f MI".format(state.progressMeters / 1609.344, state.totalDistanceMeters / 1609.344)
    } else {
        "%.1f / %.1f KM".format(state.progressMeters / 1000.0, state.totalDistanceMeters / 1000.0)
    }

    private fun clock(seconds: Int): String = "%d:%02d".format(seconds.coerceAtLeast(0) / 60, seconds.coerceAtLeast(0) % 60)

    private fun centered(canvas: Canvas, value: String, x: Float, y: Float, size: Float, color: Int) = text(canvas, value, x, y, size, color, Paint.Align.CENTER)

    private fun text(canvas: Canvas, value: String, x: Float, y: Float, size: Float, color: Int, align: Paint.Align) {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color; textSize = size; textAlign = align; isFakeBoldText = true
            typeface = android.graphics.Typeface.create("sans-serif-condensed", android.graphics.Typeface.BOLD)
        }
        canvas.drawText(value, x, y - (paint.fontMetrics.ascent + paint.fontMetrics.descent) / 2f, paint)
    }

    /** Purpose-built compact layouts: result first, then a legible centered time bank. */
    fun renderCompactDashboard(
        state: LiveUiState,
        width: Int,
        height: Int,
        showSupportingMetrics: Boolean,
    ): Bitmap {
        val w = max(width, 1).toFloat()
        val h = max(height, 1).toFloat()
        val bitmap = Bitmap.createBitmap(w.toInt(), h.toInt(), Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(palette.background)
        val margin = w * 0.055f
        val plan = state.plannedFinishSeconds
        val predicted = state.predictedFinishSeconds
        val bank = if (plan != null && predicted != null) plan - predicted else null
        val color = if ((bank ?: 0) >= 0) Color.rgb(32, 190, 105) else Color.rgb(239, 91, 69)

        if (!showSupportingMetrics || h < 150f) {
            text(canvas, "GM PERFORMANCE", margin, h * 0.20f, min(w * 0.075f, h * 0.19f), palette.secondaryText, Paint.Align.LEFT)
            text(canvas, predicted?.let(::clock) ?: "--:--", margin, h * 0.52f, min(w * 0.14f, h * 0.34f), palette.primaryText, Paint.Align.LEFT)
            val label = "EXPECTED • ${resultHeadline(bank)}"
            text(canvas, label, margin, h * 0.79f, min(w * 0.065f, h * 0.17f), palette.secondaryText, Paint.Align.LEFT)
            drawCompactBank(canvas, bank, w * 0.72f, w * 0.94f, h * 0.51f, h)
        } else {
            text(canvas, state.segmentName.ifBlank { "GM PERFORMANCE" }, margin, h * 0.11f, min(w * 0.057f, h * 0.13f), palette.primaryText, Paint.Align.LEFT)
            text(canvas, performanceDistance(state), w - margin, h * 0.11f, min(w * 0.047f, h * 0.11f), palette.secondaryText, Paint.Align.RIGHT)
            centered(canvas, predicted?.let(::clock) ?: "--:--", w / 2f, h * 0.35f, min(w * 0.13f, h * 0.25f), palette.primaryText)
            centered(canvas, "EXPECTED • GOAL ${plan?.let(::clock) ?: "--:--"} • ${resultHeadline(bank)}", w / 2f, h * 0.55f, min(w * 0.048f, h * 0.095f), color)
            drawCompactBank(canvas, bank, margin, w - margin, h * 0.74f, h)
        }
        return bitmap
    }

    private fun drawCompactBank(canvas: Canvas, seconds: Int?, left: Float, right: Float, y: Float, height: Float) {
        val center = (left + right) / 2f
        val stroke = (height * 0.085f).coerceIn(7f, 16f)
        canvas.drawLine(left, y, right, y, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(53, 58, 65); strokeWidth = stroke; strokeCap = Paint.Cap.ROUND })
        if (seconds == null) return
        val end = center + (seconds.coerceIn(-60, 60) / 60f) * (right - left) / 2f
        val active = if (seconds >= 0) Color.rgb(32, 190, 105) else Color.rgb(239, 91, 69)
        canvas.drawLine(center, y, end, y, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = active; strokeWidth = stroke; strokeCap = Paint.Cap.ROUND })
        canvas.drawCircle(end, y, stroke * 0.95f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = active })
        canvas.drawCircle(end, y, stroke * 0.95f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = palette.primaryText; style = Paint.Style.STROKE; strokeWidth = 2f })
    }

    /** Compact comparison for a short full-width field: plan and prediction never move. */
    fun renderCompactTimeline(
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
        val left = safeWidth * 0.08f
        val right = safeWidth * 0.92f
        val y = safeHeight * 0.62f
        val base = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.divider
            strokeWidth = (safeHeight * 0.13f).coerceIn(6f, 11f)
            strokeCap = Paint.Cap.ROUND
        }
        canvas.drawLine(left, y, right, y, base)
        val progress = Paint(base).apply { color = Color.rgb(29, 125, 220) }
        canvas.drawLine(left, y, left + (right - left) * progressFraction.coerceIn(0f, 1f), y, progress)
        val center = (left + right) / 2f
        val planPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.primaryText
            strokeWidth = 4f
        }
        canvas.drawLine(center, y - safeHeight * 0.25f, center, y + safeHeight * 0.25f, planPaint)
        if (plannedSeconds != null && plannedSeconds > 0 && predictedSeconds != null) {
            val delta = predictedSeconds - plannedSeconds
            val range = max(plannedSeconds * 0.15, 30.0)
            val predictionX = (center + delta / range * (right - left) / 2f).toFloat().coerceIn(left, right)
            val predictionPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = if (delta <= 0) Color.rgb(32, 170, 91) else Color.rgb(231, 91, 64)
            }
            canvas.drawCircle(predictionX, y, (safeHeight * 0.18f).coerceIn(7f, 13f), predictionPaint)
            canvas.drawCircle(predictionX, y, (safeHeight * 0.18f).coerceIn(7f, 13f), Paint(planPaint).apply {
                style = Paint.Style.STROKE
                strokeWidth = 3f
            })
            val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = palette.secondaryText
                textSize = (safeHeight * 0.25f).coerceIn(12f, 16f)
                isFakeBoldText = true
            }
            canvas.drawText("PLAN ${compactTime(plannedSeconds)}", left, safeHeight * 0.25f, labelPaint.apply {
                textAlign = Paint.Align.LEFT
            })
            canvas.drawText("PRED ${compactTime(predictedSeconds)}", right, safeHeight * 0.25f, labelPaint.apply {
                textAlign = Paint.Align.RIGHT
            })
        }
        return bitmap
    }

    private fun compactTime(seconds: Int): String =
        "${seconds.coerceAtLeast(0) / 60}:${(seconds.coerceAtLeast(0) % 60).toString().padStart(2, '0')}"

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

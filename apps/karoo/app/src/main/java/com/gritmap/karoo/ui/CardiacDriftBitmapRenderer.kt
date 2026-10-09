package com.gritmap.karoo.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import com.gritmap.karoo.ui.state.CardiacDriftSample
import com.gritmap.karoo.ui.state.CardiacPresentationMode
import com.gritmap.karoo.ui.state.GuidanceIcon
import com.gritmap.karoo.ui.state.LiveUiState
import kotlin.math.max

/** Draws a progress-based drift sparkline over stable, caution, and high-strain bands. */
class CardiacDriftBitmapRenderer(
    private val palette: KarooVisualPalette = KarooVisualPalette.Dark,
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

    fun renderDashboard(state: LiveUiState, width: Int, height: Int): Bitmap {
        val w = max(width, 1).toFloat()
        val h = max(height, 1).toFloat()
        val bitmap = Bitmap.createBitmap(w.toInt(), h.toInt(), Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(palette.background)
        val margin = w * 0.035f

        text(canvas, "GM CARDIAC", margin, h * 0.045f, w * 0.061f, palette.primaryText, Paint.Align.LEFT)
        text(canvas, validTime(state.cardiacDriftValidSeconds), w - margin, h * 0.045f, w * 0.055f, palette.secondaryText, Paint.Align.RIGHT)

        val drift = state.cardiacDriftPct
        val action = when (state.recommendation?.icon) {
            GuidanceIcon.RECOVER -> "REST"
            GuidanceIcon.PUSH -> "PUSH"
            GuidanceIcon.WARNING -> "EASE"
            else -> "HOLD"
        }
        val bannerColor = when (state.recommendation?.icon) {
            GuidanceIcon.RECOVER -> Color.rgb(32, 170, 91)
            GuidanceIcon.PUSH, GuidanceIcon.WARNING -> Color.rgb(231, 91, 64)
            else -> Color.rgb(38, 135, 232)
        }
        val bannerTop = h * 0.085f
        val bannerBottom = h * 0.19f
        canvas.drawRoundRect(margin, bannerTop, w - margin, bannerBottom, 18f, 18f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = bannerColor })
        centered(
            canvas,
            "$action • ${presentationStatus(state)}",
            w / 2f,
            (bannerTop + bannerBottom) / 2f,
            w * 0.072f,
            Color.WHITE,
        )

        val cardsTop = h * 0.205f
        val cardsBottom = h * 0.37f
        val gap = w * 0.018f
        val cardWidth = (w - margin * 2f - gap) / 2f
        metricCard(
            canvas, margin, cardsTop, margin + cardWidth, cardsBottom,
            primaryMetricLabel(state), primaryMetricValue(state), primaryMetricSubtitle(state), driftColor(drift),
        )
        val hrCost = state.cardiacEfficiencyWattsPerBpm?.takeIf { it > 0.0 }?.let { 100.0 / it }
        metricCard(
            canvas, margin + cardWidth + gap, cardsTop, w - margin, cardsBottom,
            "HR COST", hrCost?.let { "%.0f".format(it) } ?: "--",
            "BPM / 100 W",
            driftColor(drift),
        )

        val trustTop = h * 0.385f
        val trustBottom = h * 0.445f
        val trustColor = if (state.cardiacDriftPowerSteady) Color.rgb(32, 170, 91) else Color.rgb(239, 174, 55)
        canvas.drawRoundRect(margin, trustTop, w - margin, trustBottom, 12f, 12f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = trustColor
        })
        centered(
            canvas,
            if (state.cardiacDriftPowerSteady) "POWER STEADY ✓" else "POWER VARIABLE",
            w / 2f,
            (trustTop + trustBottom) / 2f,
            w * 0.057f,
            if (state.cardiacDriftPowerSteady) Color.WHITE else Color.BLACK,
        )

        val chartLeft = w * 0.14f
        val chartRight = w * 0.96f
        val chartTop = h * 0.51f
        val showH10Strip = state.h10ContextEligible &&
            (state.h10ValidRrPct > 0 || state.h10DfaHistory.isNotEmpty() || state.h10DfaAlpha1 != null)
        val chartBottom = if (showH10Strip) h * 0.785f else h * 0.865f
        text(
            canvas,
            if (state.cardiacPresentationMode == CardiacPresentationMode.CARDIAC_DRIFT) {
                "EFFICIENCY INDEX"
            } else {
                "EFFICIENCY RESPONSE"
            },
            margin,
            h * 0.475f,
            w * 0.058f,
            palette.primaryText,
            Paint.Align.LEFT,
        )
        drawEfficiencyChart(canvas, state.cardiacDriftHistory, chartLeft, chartTop, chartRight, chartBottom)

        if (showH10Strip) {
            drawH10ContextStrip(canvas, state, margin, h * 0.825f, w - margin, h * 0.895f)
        }

        val confidence = confidenceCompactLabel(state)
        val footerTop = h * 0.925f
        canvas.drawRoundRect(margin, footerTop, w - margin, h * 0.975f, 14f, 14f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(10, 48, 31)
            style = Paint.Style.FILL
        })
        centered(canvas, confidence, w / 2f, (footerTop + h * 0.975f) / 2f, w * 0.042f, Color.rgb(42, 210, 115))
        return bitmap
    }

    private fun drawH10ContextStrip(
        canvas: Canvas,
        state: LiveUiState,
        left: Float,
        top: Float,
        right: Float,
        bottom: Float,
    ) {
        val radius = 10f
        canvas.drawRoundRect(left, top, right, bottom, radius, radius, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(31, 35, 40)
        })
        val samples = state.h10DfaHistory
        if (samples.isNotEmpty()) {
            val minimum = samples.first().elapsedSeconds
            val span = (samples.last().elapsedSeconds - minimum).coerceAtLeast(1)
            samples.zipWithNext().forEach { (sample, next) ->
                val x1 = left + (sample.elapsedSeconds - minimum).toFloat() / span * (right - left)
                val x2 = left + (next.elapsedSeconds - minimum).toFloat() / span * (right - left)
                canvas.drawRect(x1, top, x2.coerceAtLeast(x1 + 2f), bottom, Paint().apply {
                    color = h10Color(sample.alpha1)
                })
            }
        }
        val status = when {
            state.h10ContextQualified ->
                "H10 α1 ${state.h10DfaAlpha1?.let { "%.2f".format(it) } ?: "--"} • EXPERIMENTAL"
            state.h10ValidRrPct < 95 -> "H10 • SIGNAL ${state.h10ValidRrPct}%"
            else -> "H10 • COLLECTING 2 MIN"
        }
        centered(canvas, status, (left + right) / 2f, (top + bottom) / 2f, 19f, Color.WHITE)
    }

    private fun h10Color(alpha1: Double): Int = when {
        alpha1 >= 0.75 -> Color.rgb(32, 170, 91)
        alpha1 >= 0.50 -> Color.rgb(239, 174, 55)
        else -> Color.rgb(231, 91, 64)
    }

    fun renderSmallThreshold(state: LiveUiState, width: Int, height: Int): Bitmap {
        val w = max(width, 1).toFloat()
        val h = max(height, 1).toFloat()
        val bitmap = Bitmap.createBitmap(w.toInt(), h.toInt(), Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(palette.background)
        val drift = state.cardiacDriftPct
        text(canvas, "GM CARDIAC", w * 0.07f, h * 0.15f, (w * 0.075f).coerceIn(16f, 25f), palette.primaryText, Paint.Align.LEFT)
        centered(canvas, primaryMetricValue(state), w / 2f, h * 0.46f, (w * 0.18f).coerceIn(34f, 60f), palette.primaryText)
        centered(canvas, primaryMetricSubtitle(state), w / 2f, h * 0.69f, (w * 0.068f).coerceIn(15f, 24f), driftColor(drift))
        val left = w * 0.08f
        val right = w * 0.92f
        val top = h * 0.84f
        val bottom = h * 0.90f
        val trackWidth = right - left
        canvas.drawRoundRect(left, top, right, bottom, 6f, 6f, Paint().apply { color = Color.rgb(32, 170, 91) })
        canvas.drawRect(left + trackWidth * 0.60f, top, left + trackWidth * 0.80f, bottom, Paint().apply { color = Color.rgb(239, 174, 55) })
        canvas.drawRoundRect(left + trackWidth * 0.80f, top, right, bottom, 6f, 6f, Paint().apply { color = Color.rgb(231, 91, 64) })
        drift?.let {
            val markerX = left + (kotlin.math.abs(it).coerceIn(0.0, 8.0) / 8.0 * trackWidth).toFloat()
            canvas.drawLine(markerX, top - 7f, markerX, bottom + 7f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.WHITE; strokeWidth = 4f; strokeCap = Paint.Cap.ROUND
            })
        }
        return bitmap
    }

    fun renderCompactGauge(state: LiveUiState, width: Int, height: Int): Bitmap {
        val w = max(width, 1).toFloat()
        val h = max(height, 1).toFloat()
        val bitmap = Bitmap.createBitmap(w.toInt(), h.toInt(), Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(palette.background)
        val margin = w * 0.035f
        text(canvas, "GM CARDIAC", margin, h * 0.12f, (w * 0.045f).coerceIn(17f, 25f), palette.primaryText, Paint.Align.LEFT)
        text(canvas, confidenceShort(state), w - margin, h * 0.12f, (w * 0.038f).coerceIn(15f, 21f), confidenceColor(state), Paint.Align.RIGHT)

        val last = state.cardiacDriftHistory.lastOrNull()
        drawIndexGauge(canvas, "POWER", last?.powerIndex, Color.rgb(38, 135, 232), w, h * 0.34f)
        drawIndexGauge(canvas, "HR", last?.heartRateIndex, Color.rgb(239, 91, 69), w, h * 0.58f)

        val divider = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = palette.divider; strokeWidth = 2f }
        canvas.drawLine(margin, h * 0.73f, w - margin, h * 0.73f, divider)
        text(canvas, "DRIFT", margin, h * 0.86f, 16f, palette.secondaryText, Paint.Align.LEFT)
        text(canvas, formatDrift(state.cardiacDriftPct), w * 0.24f, h * 0.86f, 24f, palette.primaryText, Paint.Align.LEFT)
        text(canvas, "RATE", w * 0.55f, h * 0.86f, 16f, palette.secondaryText, Paint.Align.LEFT)
        text(canvas, formatRate(state.cardiacDriftRatePctPer10Min), w - margin, h * 0.86f, 22f, palette.primaryText, Paint.Align.RIGHT)
        return bitmap
    }

    private fun drawIndexGauge(canvas: Canvas, label: String, value: Double?, color: Int, width: Float, y: Float) {
        val left = width * 0.32f
        val right = width * 0.95f
        text(canvas, label, width * 0.04f, y, 19f, palette.secondaryText, Paint.Align.LEFT)
        val track = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = Color.rgb(43, 47, 52); strokeWidth = 11f; strokeCap = Paint.Cap.ROUND }
        canvas.drawLine(left, y, right, y, track)
        val normalized = ((value ?: 100.0).coerceIn(95.0, 110.0) - 95.0) / 15.0
        val currentX = left + normalized.toFloat() * (right - left)
        canvas.drawLine(left, y, currentX, y, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color; strokeWidth = 11f; strokeCap = Paint.Cap.ROUND })
        canvas.drawCircle(currentX, y, 9f, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color })
        canvas.drawCircle(currentX, y, 4f, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = Color.WHITE })
        val thresholdX = left + (105.0 - 95.0).toFloat() / 15f * (right - left)
        canvas.drawLine(thresholdX, y - 15f, thresholdX, y + 15f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = Color.rgb(239, 174, 55); strokeWidth = 2f
        })
        text(canvas, value?.let { "%.0f".format(it) } ?: "--", left - 18f, y, 22f, palette.primaryText, Paint.Align.RIGHT)
    }

    private fun drawEfficiencyChart(canvas: Canvas, history: List<CardiacDriftSample>, left: Float, top: Float, right: Float, bottom: Float) {
        val axis = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = palette.secondaryText; strokeWidth = 2f }
        fun y(value: Double): Float = bottom - ((value.coerceIn(94.0, 104.0) - 94.0) / 10.0 * (bottom - top)).toFloat()
        canvas.drawRect(left, y(103.0), right, y(97.0), Paint().apply { color = Color.argb(72, 32, 170, 91) })
        canvas.drawRect(left, y(97.0), right, y(95.0), Paint().apply { color = Color.argb(72, 239, 174, 55) })
        canvas.drawRect(left, y(95.0), right, bottom, Paint().apply { color = Color.argb(72, 231, 91, 64) })
        canvas.drawLine(left, top, left, bottom, axis)
        canvas.drawLine(left, bottom, right, bottom, axis)
        listOf(95, 97, 100, 103).forEach { value ->
            val yy = y(value.toDouble())
            text(canvas, value.toString(), left - 10f, yy, 22f, palette.secondaryText, Paint.Align.RIGHT)
        }
        val baselineY = y(100.0)
        canvas.drawLine(left, baselineY, right, baselineY, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.primaryText; strokeWidth = 2f; pathEffect = android.graphics.DashPathEffect(floatArrayOf(10f, 7f), 0f)
        })
        text(canvas, "BASE", left + 12f, baselineY - 16f, 20f, palette.primaryText, Paint.Align.LEFT)
        val watchY = y(95.0)
        canvas.drawLine(left, watchY, right, watchY, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(231, 91, 64); strokeWidth = 2f; pathEffect = android.graphics.DashPathEffect(floatArrayOf(10f, 7f), 0f)
        })

        val maxSeconds = max(1, history.maxOfOrNull { it.elapsedSeconds } ?: 1)
        fun x(seconds: Int): Float = left + seconds.toFloat() / maxSeconds * (right - left)
        val baselineX = x(180.coerceAtMost(maxSeconds))
        canvas.drawLine(baselineX, top, baselineX, bottom, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.secondaryText; strokeWidth = 2f; pathEffect = android.graphics.DashPathEffect(floatArrayOf(9f, 7f), 0f)
        })
        text(canvas, "BASELINE SET", baselineX + 8f, top + 18f, 19f, palette.secondaryText, Paint.Align.LEFT)

        if (history.size >= 2) {
            val linePath = Path()
            val fillPath = Path()
            history.forEachIndexed { index, sample ->
                val xx = x(sample.elapsedSeconds)
                val efficiencyIndex = sample.powerIndex / sample.heartRateIndex.coerceAtLeast(1.0) * 100.0
                val yy = y(efficiencyIndex)
                if (index == 0) { linePath.moveTo(xx, yy); fillPath.moveTo(xx, bottom); fillPath.lineTo(xx, yy) }
                else { linePath.lineTo(xx, yy); fillPath.lineTo(xx, yy) }
            }
            val last = history.last()
            val lastX = x(last.elapsedSeconds)
            val lastValue = last.powerIndex / last.heartRateIndex.coerceAtLeast(1.0) * 100.0
            val lastY = y(lastValue)
            fillPath.lineTo(lastX, bottom); fillPath.close()
            canvas.drawPath(fillPath, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(58, 38, 135, 232) })
            canvas.drawPath(linePath, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.rgb(38, 135, 232); strokeWidth = 6f; style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
            })
            canvas.drawCircle(lastX, lastY, 8f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(38, 135, 232) })
            text(canvas, "%.1f".format(lastValue), lastX - 8f, lastY - 24f, 28f, palette.primaryText, Paint.Align.RIGHT)
        }
        text(canvas, "0", left, bottom + 23f, 21f, palette.secondaryText, Paint.Align.CENTER)
        text(canvas, "${maxSeconds / 120}", (left + right) / 2f, bottom + 23f, 21f, palette.secondaryText, Paint.Align.CENTER)
        text(canvas, "${maxSeconds / 60} MIN", right, bottom + 23f, 21f, palette.secondaryText, Paint.Align.RIGHT)
    }

    private fun metricCard(canvas: Canvas, left: Float, top: Float, right: Float, bottom: Float, label: String, value: String, subtitle: String, accent: Int) {
        val border = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = palette.divider; style = Paint.Style.STROKE; strokeWidth = 2f }
        canvas.drawRoundRect(left, top, right, bottom, 12f, 12f, border)
        centered(canvas, label, (left + right) / 2f, top + (bottom - top) * 0.19f, 23f, palette.secondaryText)
        centered(canvas, value, (left + right) / 2f, top + (bottom - top) * 0.51f, 48f, palette.primaryText)
        centered(canvas, subtitle, (left + right) / 2f, top + (bottom - top) * 0.80f, 21f, accent)
        canvas.drawRoundRect(left + 12f, bottom - 12f, right - 12f, bottom - 7f, 3f, 3f, Paint().apply { color = accent })
    }

    private fun confidenceLabel(state: LiveUiState): String {
        val confidence = when {
            state.cardiacDriftPairedPct >= 90 && state.cardiacDriftPowerSteady -> "HIGH CONFIDENCE"
            state.cardiacDriftPairedPct >= 75 -> "MED CONFIDENCE"
            else -> "LOW CONFIDENCE"
        }
        val steadiness = if (state.cardiacDriftPowerSteady) "STEADY POWER" else "VARIABLE POWER"
        return "$confidence • $steadiness • ${state.cardiacDriftPairedPct}% PAIRED"
    }

    private fun confidenceCompactLabel(state: LiveUiState): String {
        val confidence = when {
            state.cardiacDriftPairedPct >= 90 && state.cardiacDriftPowerSteady -> "HIGH"
            state.cardiacDriftPairedPct >= 75 -> "MED"
            else -> "LOW"
        }
        return "$confidence • ${state.cardiacDriftPairedPct}% PAIRED"
    }

    private fun confidenceShort(state: LiveUiState): String = when {
        state.cardiacDriftPairedPct >= 90 && state.cardiacDriftPowerSteady -> "HIGH"
        state.cardiacDriftPairedPct >= 75 -> "MED"
        else -> "LOW"
    }

    private fun confidenceColor(state: LiveUiState): Int = when (confidenceShort(state)) {
        "HIGH" -> Color.rgb(32, 170, 91)
        "MED" -> Color.rgb(239, 174, 55)
        else -> Color.rgb(231, 91, 64)
    }

    private fun driftStatus(value: Double?): String = when {
        value == null -> "SETTLING"
        kotlin.math.abs(value) < 3.0 -> "STABLE"
        kotlin.math.abs(value) < 5.0 -> "WATCH"
        else -> "HIGH"
    }

    private fun presentationStatus(state: LiveUiState): String = when (state.cardiacPresentationMode) {
        CardiacPresentationMode.WAITING_FOR_HR -> "WAITING FOR HR"
        CardiacPresentationMode.HR_RESPONSE -> "HR RESPONSE"
        CardiacPresentationMode.EMERGING_DRIFT -> "DRIFT FORMING"
        CardiacPresentationMode.CARDIAC_DRIFT -> "DRIFT ${driftStatus(state.cardiacDriftPct)}"
    }

    private fun primaryMetricLabel(state: LiveUiState): String = when (state.cardiacPresentationMode) {
        CardiacPresentationMode.WAITING_FOR_HR -> "HEART RATE"
        CardiacPresentationMode.HR_RESPONSE -> "HR RESPONSE"
        CardiacPresentationMode.EMERGING_DRIFT -> "DRIFT FORMING"
        CardiacPresentationMode.CARDIAC_DRIFT -> "HR DRIFT"
    }

    private fun primaryMetricValue(state: LiveUiState): String = when (state.cardiacPresentationMode) {
        CardiacPresentationMode.WAITING_FOR_HR -> "--"
        CardiacPresentationMode.HR_RESPONSE -> state.currentHeartRateBpm?.let { "$it" } ?: "--"
        CardiacPresentationMode.EMERGING_DRIFT,
        CardiacPresentationMode.CARDIAC_DRIFT,
        -> formatDrift(state.cardiacDriftPct)
    }

    private fun primaryMetricSubtitle(state: LiveUiState): String = when (state.cardiacPresentationMode) {
        CardiacPresentationMode.WAITING_FOR_HR -> "PAIR HR SENSOR"
        CardiacPresentationMode.HR_RESPONSE -> "BPM • BUILDING BASELINE"
        CardiacPresentationMode.EMERGING_DRIFT -> "${driftTrend(state.cardiacDriftHistory)} EARLY TREND"
        CardiacPresentationMode.CARDIAC_DRIFT ->
            "${driftTrend(state.cardiacDriftHistory)} ${driftStatus(state.cardiacDriftPct)}"
    }

    private fun driftTrend(history: List<CardiacDriftSample>): String {
        if (history.size < 2) return "→"
        val change = history.last().driftPct - history[history.lastIndex - 1].driftPct
        return when {
            change >= 0.35 -> "↗"
            change <= -0.35 -> "↘"
            else -> "→"
        }
    }

    private fun validTime(seconds: Int): String = "%d:%02d VALID".format(seconds / 60, seconds % 60)
    private fun formatDrift(value: Double?): String = value?.let { "${if (it >= 0) "+" else ""}%.1f%%".format(it) } ?: "--"
    private fun formatRate(value: Double?): String = value?.let { "${if (it >= 0) "+" else ""}%.1f%%/10M".format(it) } ?: "--"
    private fun driftColor(value: Double?): Int = when {
        value == null -> palette.secondaryText
        kotlin.math.abs(value) < 3.0 -> Color.rgb(32, 170, 91)
        kotlin.math.abs(value) < 5.0 -> Color.rgb(239, 174, 55)
        else -> Color.rgb(231, 91, 64)
    }

    private fun centered(canvas: Canvas, value: String, x: Float, y: Float, size: Float, color: Int) = text(canvas, value, x, y, size, color, Paint.Align.CENTER)
    private fun text(canvas: Canvas, value: String, x: Float, y: Float, size: Float, color: Int, align: Paint.Align) {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color; textSize = size; textAlign = align; isFakeBoldText = true
            typeface = android.graphics.Typeface.create("sans-serif-condensed", android.graphics.Typeface.BOLD)
        }
        canvas.drawText(value, x, y - (paint.fontMetrics.ascent + paint.fontMetrics.descent) / 2f, paint)
    }

    private fun yFor(driftPct: Double, height: Int): Float {
        val minimum = -10.0
        val maximum = 10.0
        val fraction = ((driftPct.coerceIn(minimum, maximum) - minimum) / (maximum - minimum))
        return ((1.0 - fraction) * height).toFloat()
    }
}

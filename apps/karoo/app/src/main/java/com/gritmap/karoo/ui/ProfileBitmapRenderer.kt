package com.gritmap.karoo.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import com.gritmap.karoo.ui.state.Effort
import com.gritmap.karoo.ui.state.LiveUiState
import kotlin.math.max
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.roundToInt

class ProfileBitmapRenderer(
    private val palette: KarooVisualPalette = KarooVisualPalette.Dark,
) {
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = palette.primaryText
        style = Paint.Style.STROKE
        strokeWidth = 6f
    }
    private val markerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    private val executionPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }

    fun render(state: LiveUiState, width: Int, height: Int): Bitmap {
        val safeWidth = max(width, 1)
        val safeHeight = max(height, 1)
        val bitmap = Bitmap.createBitmap(safeWidth, safeHeight, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(palette.background)

        val profile = state.elevationProfile
        if (profile.size < 2 || state.totalDistanceMeters <= 0.0) return bitmap

        val minElevation = profile.minOf { it.elevationMeters }
        val maxElevation = profile.maxOf { it.elevationMeters }
        val elevationSpan = max(maxElevation - minElevation, 1.0)
        val total = state.totalDistanceMeters

        val planStripHeight = (safeHeight * 0.08f).coerceIn(8f, 18f)
        val chartBottom = safeHeight - planStripHeight

        state.pacingZones.forEach { zone ->
            fillPaint.color = when (zone.effort) {
                Effort.RECOVER -> Color.rgb(32, 170, 91)
                Effort.HOLD -> Color.rgb(29, 125, 220)
                Effort.PUSH -> Color.rgb(231, 91, 64)
            }
            fillPaint.alpha = 58
            val left = (zone.startDistanceMeters / total * safeWidth).toFloat().coerceIn(0f, safeWidth.toFloat())
            val right = (zone.endDistanceMeters / total * safeWidth).toFloat().coerceIn(left, safeWidth.toFloat())
            canvas.drawRect(left, 0f, right, chartBottom, fillPaint)
            fillPaint.alpha = 255
            canvas.drawRect(left, chartBottom, right, safeHeight.toFloat(), fillPaint)
        }

        drawExecutionHistory(canvas, state, safeWidth, chartBottom, minElevation, elevationSpan)

        val path = Path()
        profile.forEachIndexed { index, sample ->
            val x = (sample.distanceMeters / total * safeWidth).toFloat()
            val y = yForElevation(sample.elevationMeters, minElevation, elevationSpan, chartBottom)
            if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        canvas.drawPath(path, linePaint)

        val markerX = state.progressFraction * safeWidth
        val markerElevation = elevationAt(state, state.progressMeters)
        val markerY = yForElevation(markerElevation, minElevation, elevationSpan, chartBottom)
        canvas.drawCircle(markerX, markerY, 6f, markerPaint)
        markerPaint.strokeWidth = 2f
        canvas.drawLine(markerX, markerY, markerX, chartBottom, markerPaint)
        return bitmap
    }

    /** Compact semantic profile: pacing zones and current position without an unreadable curve. */
    fun renderPacingStrip(state: LiveUiState, width: Int, height: Int): Bitmap {
        val safeWidth = max(width, 1)
        val safeHeight = max(height, 1)
        val bitmap = Bitmap.createBitmap(safeWidth, safeHeight, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.rgb(48, 53, 60))
        val total = state.totalDistanceMeters
        if (total <= 0.0) return bitmap

        state.pacingZones.forEach { zone ->
            fillPaint.color = when (zone.effort) {
                Effort.RECOVER -> Color.rgb(32, 170, 91)
                Effort.HOLD -> Color.rgb(29, 125, 220)
                Effort.PUSH -> Color.rgb(231, 91, 64)
            }
            fillPaint.alpha = 82
            val left = (zone.startDistanceMeters / total * safeWidth).toFloat()
                .coerceIn(0f, safeWidth.toFloat())
            val right = (zone.endDistanceMeters / total * safeWidth).toFloat()
                .coerceIn(left, safeWidth.toFloat())
            canvas.drawRect(left, 0f, right, safeHeight.toFloat(), fillPaint)
        }

        drawCompactExecutionHistory(canvas, state, safeWidth, safeHeight)

        val markerX = state.progressFraction * safeWidth
        markerPaint.strokeWidth = 2f
        canvas.drawLine(markerX, 0f, markerX, safeHeight.toFloat(), markerPaint)
        val riderRadius = (minOf(safeWidth, safeHeight) * 0.16f).coerceIn(5f, 9f)
        val riderOutline = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = palette.background }
        var compactTargetX: Float? = null
        var compactTargetColor = Color.TRANSPARENT
        var compactTargetLabel: String? = null
        virtualPacerGap(state)?.let { pacer ->
            val targetRadius = (minOf(safeWidth, safeHeight) * 0.36f).coerceIn(12f, 18f)
            val rawTargetX = (pacer.targetProgressMeters / total * safeWidth).toFloat()
                .coerceIn(targetRadius + 2f, safeWidth - targetRadius - 2f)
            val minimumGap = targetRadius + riderRadius + 4f
            val targetX = if (abs(rawTargetX - markerX) < minimumGap) {
                (markerX + if (pacer.targetIsAhead) minimumGap else -minimumGap)
                    .coerceIn(targetRadius + 2f, safeWidth - targetRadius - 2f)
            } else {
                rawTargetX
            }
            val targetColor = if (pacer.targetIsAhead) {
                Color.rgb(239, 82, 67)
            } else {
                Color.rgb(42, 190, 105)
            }
            val targetPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = targetColor }
            compactTargetX = targetX
            compactTargetColor = targetPaint.color
            compactTargetLabel = formatPacerTimeGap(pacerTimeGapSeconds(state, pacer))
        }
        compactTargetX?.let { targetX ->
            val targetRadius = (minOf(safeWidth, safeHeight) * 0.36f).coerceIn(12f, 18f)
            drawTimedPacerCircle(
                canvas,
                targetX,
                safeHeight / 2f,
                targetRadius,
                compactTargetColor,
                requireNotNull(compactTargetLabel),
                minimumTextSize = 12f,
            )
        }
        canvas.drawCircle(markerX, safeHeight / 2f, riderRadius + 4f, riderOutline)
        canvas.drawCircle(markerX, safeHeight / 2f, riderRadius, markerPaint)
        return bitmap
    }

    /**
     * Large-field pacing road. The rider stays fixed in the center while the planned course
     * moves downward. Upcoming plan spans the width; completed prescription stays left and
     * actual execution is painted on the right. A red/green virtual rider shows goal pace.
     */
    fun renderVerticalPacer(state: LiveUiState, width: Int, height: Int): Bitmap {
        val safeWidth = max(width, 1)
        val safeHeight = max(height, 1)
        val bitmap = Bitmap.createBitmap(safeWidth, safeHeight, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(palette.background)
        if (state.totalDistanceMeters <= 0.0) return bitmap

        val centerX = safeWidth / 2f
        val centerY = safeHeight / 2f
        val virtualPacer = virtualPacerGap(state)
        val visibleMetersEachSide = adaptivePacerRadiusMeters(
            virtualPacer?.gapMeters,
            state.totalDistanceMeters,
        )
        val pixelsPerMeter = (safeHeight * 0.47) / visibleMetersEachSide
        fun yForDistance(distanceMeters: Double): Float =
            (centerY - (distanceMeters - state.progressMeters) * pixelsPerMeter).toFloat()

        state.pacingZones.forEach { zone ->
            val top = yForDistance(zone.endDistanceMeters).coerceAtLeast(0f)
            val bottom = yForDistance(zone.startDistanceMeters).coerceAtMost(safeHeight.toFloat())
            if (bottom <= top) return@forEach
            fillPaint.color = effortColor(zone.effort)
            val futureBottom = minOf(bottom, centerY)
            if (futureBottom > top) {
                fillPaint.alpha = 72
                canvas.drawRect(0f, top, safeWidth.toFloat(), futureBottom, fillPaint)
            }
            val completedTop = maxOf(top, centerY)
            if (bottom > completedTop) {
                fillPaint.alpha = 108
                canvas.drawRect(0f, completedTop, centerX - 5f, bottom, fillPaint)
            }
        }

        state.powerExecutionHistory.zipWithNext().forEach { (start, end) ->
            val top = yForDistance(end.distanceMeters).coerceAtLeast(centerY)
            val bottom = yForDistance(start.distanceMeters).coerceAtMost(safeHeight.toFloat())
            if (bottom > top) {
                executionPaint.color = executionColor(end.actualWatts, end.targetWatts)
                executionPaint.alpha = 138
                canvas.drawRect(centerX + 5f, top, safeWidth.toFloat(), bottom, executionPaint)
            }
        }

        drawOverallProgressRails(canvas, state, safeWidth, safeHeight)

        drawDistanceTicks(
            canvas = canvas,
            centerX = centerX,
            state = state,
            visibleRadiusMeters = visibleMetersEachSide,
            yForDistance = ::yForDistance,
            height = safeHeight,
            width = safeWidth,
        )

        val roadPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.divider
            strokeWidth = 4f
        }
        canvas.drawLine(centerX, 0f, centerX, safeHeight.toFloat(), roadPaint)

        val startY = yForDistance(0.0)
        if (startY in 0f..safeHeight.toFloat()) {
            val boundaryPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = palette.divider
                strokeWidth = 4f
            }
            canvas.drawLine(0f, startY, safeWidth.toFloat(), startY, boundaryPaint)
            drawPillText(
                canvas,
                "START",
                safeWidth * 0.12f,
                (startY - 7f).coerceAtLeast(20f),
                (safeWidth * 0.032f).coerceIn(15f, 22f),
                palette.secondaryText,
            )
        }

        var targetMarkerY: Float? = null
        var targetMarkerColor = Color.TRANSPARENT
        var targetMarkerLabel: String? = null
        if (virtualPacer != null) {
            val rawTargetY = yForDistance(virtualPacer.targetProgressMeters)
                .coerceIn(12f, safeHeight - 12f)
            val targetAhead = virtualPacer.targetIsAhead
            val minimumMarkerGap = max(
                (safeHeight * 0.055f).coerceIn(22f, 38f),
                (safeWidth * 0.12f).coerceIn(56f, 78f),
            )
            val targetY = if (abs(rawTargetY - centerY) < minimumMarkerGap) {
                centerY + if (targetAhead) -minimumMarkerGap else minimumMarkerGap
            } else {
                rawTargetY
            }
            val targetPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = if (targetAhead) Color.rgb(239, 82, 67) else Color.rgb(42, 190, 105)
            }
            targetMarkerY = targetY
            targetMarkerColor = targetPaint.color
            targetMarkerLabel = formatPacerTimeGap(pacerTimeGapSeconds(state, virtualPacer))
            val gapMeters = abs(virtualPacer.gapMeters).toInt()
            val gapText = when {
                gapMeters < 3 -> if (safeWidth < 420) "ON PACE" else "ON TARGET PACE"
                targetAhead -> "$gapMeters m BEHIND"
                else -> "$gapMeters m AHEAD"
            }
            drawPillText(
                canvas,
                gapText,
                centerX,
                safeHeight - (safeHeight * 0.045f).coerceIn(18f, 30f),
                (safeWidth * 0.052f).coerceIn(24f, 36f),
                targetPaint.color,
            )
        }

        val targetWatts = state.recommendation?.targetPowerWatts
        val actualWatts = state.rollingPowerWatts3s ?: state.currentPowerWatts
        val metricBaseline = centerY - (safeHeight * 0.15f).coerceIn(48f, 78f)
        drawMetricBlock(
            canvas,
            "TARGET",
            targetWatts?.let { "$it W" } ?: "--",
            safeWidth * 0.21f,
            metricBaseline,
            safeWidth,
            palette.primaryText,
        )
        val actualColor = if (targetWatts != null && actualWatts != null) {
            executionTextColor(actualWatts, targetWatts)
        } else {
            palette.primaryText
        }
        drawMetricBlock(
            canvas,
            "ACTUAL",
            actualWatts?.let { "$it W" } ?: "--",
            safeWidth * 0.79f,
            metricBaseline,
            safeWidth,
            actualColor,
        )

        // Markers are deliberately the final layer so metric cards and effort bands can never
        // obscure either the virtual target rider or the real rider.
        val riderTextScaleRadius = (safeWidth * 0.044f).coerceIn(23f, 30f)
        val riderRadius = riderTextScaleRadius + 4f
        targetMarkerY?.let { targetY ->
            val outerRadius = (safeWidth * 0.052f).coerceIn(25f, 34f)
            val connectorPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = targetMarkerColor
                strokeWidth = (safeWidth * 0.024f).coerceIn(10f, 16f)
                strokeCap = Paint.Cap.ROUND
            }
            canvas.drawLine(centerX, centerY, centerX, targetY, connectorPaint)
            drawTimedPacerCircle(
                canvas,
                centerX,
                targetY,
                outerRadius,
                targetMarkerColor,
                requireNotNull(targetMarkerLabel),
                minimumTextSize = 18f,
            )
        }
        val riderOutline = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = palette.background }
        canvas.drawCircle(centerX, centerY, riderRadius + 6f, riderOutline)
        canvas.drawCircle(centerX, centerY, riderRadius, markerPaint)
        val youPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.background
            textSize = (riderTextScaleRadius * 0.98f).coerceIn(21f, 29f)
            textAlign = Paint.Align.CENTER
            isFakeBoldText = true
        }
        val youBaseline = centerY - (youPaint.fontMetrics.ascent + youPaint.fontMetrics.descent) / 2f
        canvas.drawText("YOU", centerX, youBaseline, youPaint)
        return bitmap
    }

    private fun drawCompactExecutionHistory(
        canvas: Canvas,
        state: LiveUiState,
        width: Int,
        height: Int,
    ) {
        if (state.totalDistanceMeters <= 0.0) return
        state.powerExecutionHistory.zipWithNext().forEach { (start, end) ->
            val left = (start.distanceMeters / state.totalDistanceMeters * width).toFloat()
                .coerceIn(0f, width.toFloat())
            val right = (end.distanceMeters / state.totalDistanceMeters * width).toFloat()
                .coerceIn(left, width.toFloat())
            executionPaint.color = executionColor(end.actualWatts, end.targetWatts)
            executionPaint.alpha = 225
            canvas.drawRect(left, 0f, right, height.toFloat(), executionPaint)
        }
    }

    private fun drawDistanceTicks(
        canvas: Canvas,
        centerX: Float,
        state: LiveUiState,
        visibleRadiusMeters: Double,
        yForDistance: (Double) -> Float,
        height: Int,
        width: Int,
    ) {
        val interval = pacerTickIntervalMeters(visibleRadiusMeters)
        var distance = floor(
            ((state.progressMeters - visibleRadiusMeters).coerceAtLeast(0.0)) / interval,
        ) * interval
        val end = (state.progressMeters + visibleRadiusMeters)
            .coerceAtMost(state.totalDistanceMeters)
        val minorPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK
            strokeWidth = 3f
            alpha = 205
        }
        val majorPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK
            strokeWidth = 6f
            alpha = 245
        }
        val railWidth = (width * 0.035f).coerceIn(14f, 24f)
        val gutterWidth = (width * 0.018f).coerceIn(7f, 12f)
        val centerAreaStart = railWidth + gutterWidth
        val centerAreaEnd = width - railWidth - gutterWidth
        val centerAreaWidth = centerAreaEnd - centerAreaStart
        var safety = 0
        while (distance <= end + 0.001 && safety++ < 100) {
            val y = yForDistance(distance)
            if (y in 0f..height.toFloat()) {
                val major = ((distance / interval).toInt() % 5) == 0
                val tickWidth = centerAreaWidth * if (major) 0.5f else 0.25f
                canvas.drawLine(
                    centerX - tickWidth / 2f,
                    y,
                    centerX + tickWidth / 2f,
                    y,
                    if (major) majorPaint else minorPaint,
                )
            }
            distance += interval
        }
    }

    private fun drawTimedPacerCircle(
        canvas: Canvas,
        centerX: Float,
        centerY: Float,
        radius: Float,
        color: Int,
        label: String,
        minimumTextSize: Float,
    ) {
        val outline = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = Color.WHITE
            style = Paint.Style.FILL
        }
        val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color }
        canvas.drawCircle(centerX, centerY, radius + 6f, outline)
        canvas.drawCircle(centerX, centerY, radius, fill)
        val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = Color.WHITE
            textSize = (radius * 1.25f).coerceAtLeast(minimumTextSize)
            textAlign = Paint.Align.CENTER
            isFakeBoldText = true
        }
        val maximumTextWidth = radius * 1.72f
        val measuredWidth = textPaint.measureText(label)
        if (measuredWidth > maximumTextWidth) {
            textPaint.textSize = (textPaint.textSize * maximumTextWidth / measuredWidth)
                .coerceAtLeast(minimumTextSize)
        }
        val baseline = centerY - (textPaint.fontMetrics.ascent + textPaint.fontMetrics.descent) / 2f
        canvas.drawText(label, centerX, baseline, textPaint)
    }

    private fun drawOverallProgressRails(
        canvas: Canvas,
        state: LiveUiState,
        width: Int,
        height: Int,
    ) {
        if (state.totalDistanceMeters <= 0.0) return
        val railWidth = (width * 0.035f).coerceIn(14f, 24f)
        val gutterWidth = (width * 0.018f).coerceIn(7f, 12f)
        val rightStart = width - railWidth
        val railBackground = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(35, 39, 44) }
        val gutterPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = palette.background }
        canvas.drawRect(railWidth, 0f, railWidth + gutterWidth, height.toFloat(), gutterPaint)
        canvas.drawRect(rightStart - gutterWidth, 0f, rightStart, height.toFloat(), gutterPaint)
        canvas.drawRect(0f, 0f, railWidth, height.toFloat(), railBackground)
        canvas.drawRect(rightStart, 0f, width.toFloat(), height.toFloat(), railBackground)

        fun overviewY(distanceMeters: Double): Float =
            (height * (1.0 - distanceMeters / state.totalDistanceMeters)).toFloat()
                .coerceIn(0f, height.toFloat())

        // Left rail is the immutable full-segment prescription.
        state.pacingZones.forEach { zone ->
            fillPaint.color = effortColor(zone.effort)
            fillPaint.alpha = 255
            canvas.drawRect(
                0f,
                overviewY(zone.endDistanceMeters),
                railWidth,
                overviewY(zone.startDistanceMeters),
                fillPaint,
            )
        }

        // Right rail is only what the rider has actually completed.
        state.powerExecutionHistory.zipWithNext().forEach { (start, end) ->
            executionPaint.color = executionColor(end.actualWatts, end.targetWatts)
            executionPaint.alpha = 255
            canvas.drawRect(
                rightStart,
                overviewY(end.distanceMeters),
                width.toFloat(),
                overviewY(start.distanceMeters),
                executionPaint,
            )
        }

        val progressY = overviewY(state.progressMeters)
        val progressPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = palette.progressMarker }
        val progressThickness = (width * 0.02f).coerceIn(12f, 20f)
        canvas.drawRect(
            0f,
            progressY - progressThickness / 2f,
            railWidth + gutterWidth * 0.7f,
            progressY + progressThickness / 2f,
            progressPaint,
        )
        canvas.drawRect(
            rightStart - gutterWidth * 0.7f,
            progressY - progressThickness / 2f,
            width.toFloat(),
            progressY + progressThickness / 2f,
            progressPaint,
        )
        val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.divider
            style = Paint.Style.STROKE
            strokeWidth = 3f
        }
        canvas.drawRect(0f, 0f, railWidth, height.toFloat(), border)
        canvas.drawRect(rightStart, 0f, width.toFloat(), height.toFloat(), border)
    }

    private fun drawExecutionHistory(
        canvas: Canvas,
        state: LiveUiState,
        width: Int,
        chartBottom: Float,
        minElevation: Double,
        elevationSpan: Double,
    ) {
        state.powerExecutionHistory.zipWithNext().forEach { (start, end) ->
            val startX = (start.distanceMeters / state.totalDistanceMeters * width).toFloat()
            val endX = (end.distanceMeters / state.totalDistanceMeters * width).toFloat()
            val startY = yForElevation(
                elevationAt(state, start.distanceMeters), minElevation, elevationSpan, chartBottom,
            )
            val endY = yForElevation(
                elevationAt(state, end.distanceMeters), minElevation, elevationSpan, chartBottom,
            )
            executionPaint.color = executionColor(end.actualWatts, end.targetWatts)
            executionPaint.alpha = 185
            val fill = Path().apply {
                moveTo(startX, startY)
                lineTo(endX, endY)
                lineTo(endX, chartBottom)
                lineTo(startX, chartBottom)
                close()
            }
            canvas.drawPath(fill, executionPaint)
        }
    }

    private fun executionColor(actualWatts: Int, targetWatts: Int): Int {
        val delta = actualWatts - targetWatts
        val tolerance = max(15.0, targetWatts * 0.1)
        return when {
            delta < -tolerance -> Color.rgb(239, 174, 55) // under target
            delta > tolerance -> Color.rgb(213, 74, 95) // over target
            else -> Color.rgb(45, 190, 128) // executing the target
        }
    }

    private fun executionTextColor(actualWatts: Int, targetWatts: Int): Int {
        val delta = kotlin.math.abs(actualWatts - targetWatts)
        val tolerance = max(15.0, targetWatts * 0.1)
        return when {
            delta <= tolerance -> Color.rgb(42, 210, 118)
            delta <= tolerance * 2.0 -> Color.rgb(244, 182, 55)
            else -> Color.rgb(246, 91, 76)
        }
    }

    private fun effortColor(effort: Effort): Int = when (effort) {
        Effort.RECOVER -> Color.rgb(32, 170, 91)
        Effort.HOLD -> Color.rgb(29, 125, 220)
        Effort.PUSH -> Color.rgb(231, 91, 64)
    }

    private fun drawPillText(
        canvas: Canvas,
        text: String,
        centerX: Float,
        baselineY: Float,
        size: Float,
        color: Int,
    ) {
        val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
            textSize = size
            textAlign = Paint.Align.CENTER
            isFakeBoldText = true
        }
        val horizontalPadding = size * 0.42f
        val verticalPadding = size * 0.28f
        val halfWidth = textPaint.measureText(text) / 2f + horizontalPadding
        val metrics = textPaint.fontMetrics
        val top = baselineY + metrics.ascent - verticalPadding
        val bottom = baselineY + metrics.descent + verticalPadding
        val background = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = Color.argb(
                225,
                Color.red(palette.surface),
                Color.green(palette.surface),
                Color.blue(palette.surface),
            )
        }
        canvas.drawRoundRect(
            centerX - halfWidth,
            top,
            centerX + halfWidth,
            bottom,
            size * 0.35f,
            size * 0.35f,
            background,
        )
        canvas.drawText(text, centerX, baselineY, textPaint)
    }

    private fun drawMetricBlock(
        canvas: Canvas,
        title: String,
        value: String,
        centerX: Float,
        centerY: Float,
        canvasWidth: Int,
        valueColor: Int,
    ) {
        val titleSize = (canvasWidth * 0.052f).coerceIn(22f, 34f)
        val valueSize = (canvasWidth * 0.068f).coerceIn(28f, 44f)
        val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.secondaryText
            textSize = titleSize
            textAlign = Paint.Align.CENTER
            isFakeBoldText = true
        }
        val valuePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = valueColor
            textSize = valueSize
            textAlign = Paint.Align.CENTER
            isFakeBoldText = true
        }
        val titleBaseline = centerY - valueSize * 0.22f
        val valueBaseline = centerY + valueSize * 0.78f
        val halfWidth = max(titlePaint.measureText(title), valuePaint.measureText(value)) / 2f + 10f
        val top = titleBaseline + titlePaint.fontMetrics.ascent - 7f
        val bottom = valueBaseline + valuePaint.fontMetrics.descent + 7f
        val background = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = Color.argb(
                230,
                Color.red(palette.surface),
                Color.green(palette.surface),
                Color.blue(palette.surface),
            )
        }
        canvas.drawRoundRect(
            centerX - halfWidth,
            top,
            centerX + halfWidth,
            bottom,
            10f,
            10f,
            background,
        )
        canvas.drawText(title, centerX, titleBaseline, titlePaint)
        canvas.drawText(value, centerX, valueBaseline, valuePaint)
    }

    private fun elevationAt(state: LiveUiState, distanceMeters: Double): Double {
        val profile = state.elevationProfile
        if (profile.isEmpty()) return 0.0
        val afterIndex = profile.indexOfFirst { it.distanceMeters >= distanceMeters }
        if (afterIndex <= 0) return profile.first().elevationMeters
        if (afterIndex == -1) return profile.last().elevationMeters
        val before = profile[afterIndex - 1]
        val after = profile[afterIndex]
        val span = after.distanceMeters - before.distanceMeters
        if (span <= 0.0) return after.elevationMeters
        val fraction = ((distanceMeters - before.distanceMeters) / span).coerceIn(0.0, 1.0)
        return before.elevationMeters + (after.elevationMeters - before.elevationMeters) * fraction
    }

    private fun yForElevation(
        elevation: Double,
        minElevation: Double,
        elevationSpan: Double,
        chartBottom: Float,
    ): Float = chartBottom -
        ((elevation - minElevation) / elevationSpan * (chartBottom - 8f)).toFloat() - 4f
}

internal data class VirtualPacerGap(
    val targetProgressMeters: Double,
    /** Positive when the target rider is ahead, negative when the real rider is ahead. */
    val gapMeters: Double,
) {
    val targetIsAhead: Boolean get() = gapMeters > 0.0
}

internal fun virtualPacerGap(state: LiveUiState): VirtualPacerGap? {
    val target = state.targetProgressMeters ?: return null
    return VirtualPacerGap(target, target - state.progressMeters)
}

internal fun pacerTimeGapSeconds(state: LiveUiState, pacer: VirtualPacerGap): Int {
    val plannedSeconds = state.plannedFinishSeconds?.takeIf { it > 0 } ?: return 0
    if (state.totalDistanceMeters <= 0.0) return 0
    return (pacer.gapMeters * plannedSeconds / state.totalDistanceMeters).roundToInt()
}

internal fun formatPacerTimeGap(seconds: Int): String {
    if (seconds == 0) return "0s"
    val sign = if (seconds > 0) "+" else "-"
    val absolute = abs(seconds)
    return if (absolute < 60) {
        "$sign${absolute}s"
    } else {
        "$sign${absolute / 60}:${(absolute % 60).toString().padStart(2, '0')}"
    }
}

internal fun adaptivePacerRadiusMeters(gapMeters: Double?, totalDistanceMeters: Double): Double {
    val gap = abs(gapMeters ?: 0.0)
    val desired = when {
        gap <= 15.0 -> 55.0
        gap <= 40.0 -> 80.0
        gap <= 80.0 -> 130.0
        gap <= 150.0 -> 200.0
        else -> (gap * 1.25 + 30.0).coerceAtMost(450.0)
    }
    return desired.coerceAtMost(totalDistanceMeters.coerceAtLeast(55.0))
}

// Keep physical tick spacing constant. Adaptive viewport scale alone then makes far-state
// ticks denser and move fewer pixels per meter, while close-state ticks spread out and sweep
// faster. Major ticks remain every 50 m in drawDistanceTicks.
internal fun pacerTickIntervalMeters(visibleRadiusMeters: Double): Double = 10.0

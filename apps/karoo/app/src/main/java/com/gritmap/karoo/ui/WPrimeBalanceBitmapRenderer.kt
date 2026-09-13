package com.gritmap.karoo.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import com.gritmap.karoo.ui.state.WPrimeState
import com.gritmap.karoo.ui.state.EnergyFlowStatus
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin

class WPrimeBalanceBitmapRenderer(
    private val palette: KarooVisualPalette = KarooVisualPalette.Dark,
) {
    fun renderCompact(state: WPrimeState, width: Int, height: Int): Bitmap {
        val bitmap = bitmap(width, height)
        val canvas = Canvas(bitmap)
        val left = width * 0.05f
        val right = width * 0.95f
        val top = height * 0.24f
        val bottom = height * 0.76f
        drawReserveTrack(canvas, left, top, right, bottom)
        val actualX = left + (right - left) * state.actualRemainingPct / 100f
        val empty = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = palette.surface; alpha = 205 }
        canvas.drawRect(actualX, top, right, bottom, empty)
        drawPlanMarker(canvas, state.plannedRemainingPct, left, right, top, bottom)
        return bitmap
    }

    fun renderTanks(state: WPrimeState, width: Int, height: Int): Bitmap {
        val bitmap = bitmap(width, height)
        val canvas = Canvas(bitmap)
        val left = width * 0.30f
        val right = width * 0.70f
        val top = height * 0.13f
        val bottom = height * 0.82f
        drawBattery(canvas, left, top, right, bottom, state)
        drawFlow(canvas, state, width * 0.82f, top, bottom, width, false)
        return bitmap
    }

    fun renderTrajectory(state: WPrimeState, width: Int, height: Int): Bitmap {
        val bitmap = bitmap(width, height)
        val canvas = Canvas(bitmap)
        val nodeY = height * 0.28f
        val planX = width * 0.12f
        val rideX = width * 0.88f
        val planNodePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = planVisualColor()
            style = Paint.Style.FILL
        }
        val rideNodePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = rideVisualColor()
            style = Paint.Style.FILL
        }
        val nodeBorder = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.primaryText
            style = Paint.Style.STROKE
            strokeWidth = 4f
        }
        val nodeRadius = (width * 0.09f).coerceIn(44f, 56f)
        drawNode(canvas, "PLAN", planX, nodeY, nodeRadius, planNodePaint, nodeBorder, Color.BLACK)
        drawNode(canvas, "RIDE", rideX, nodeY, nodeRadius, rideNodePaint, nodeBorder, Color.WHITE)

        val routeLine = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.divider
            strokeWidth = 10f
            strokeCap = Paint.Cap.ROUND
            style = Paint.Style.STROKE
        }

        val batteryLeft = width * 0.22f
        val batteryRight = width * 0.78f
        val batteryTop = height * 0.48f
        val batteryBottom = height * 0.72f
        val batteryCenterY = (batteryTop + batteryBottom) / 2f
        drawHorizontalBattery(canvas, batteryLeft, batteryTop, batteryRight, batteryBottom, state)

        val topStartX = planX + nodeRadius
        val topEndX = rideX - nodeRadius
        canvas.drawLine(topStartX, nodeY, topEndX, nodeY, routeLine)
        val planLeg = Path().apply {
            moveTo(batteryLeft, batteryCenterY)
            lineTo(planX + 18f, batteryCenterY)
            quadTo(planX, batteryCenterY, planX, batteryCenterY - 18f)
            lineTo(planX, nodeY + nodeRadius)
        }
        val rideLeg = Path().apply {
            moveTo(batteryRight, batteryCenterY)
            lineTo(rideX - 18f, batteryCenterY)
            quadTo(rideX, batteryCenterY, rideX, batteryCenterY - 18f)
            lineTo(rideX, nodeY + nodeRadius)
        }
        canvas.drawPath(planLeg, routeLine)
        canvas.drawPath(rideLeg, routeLine)

        val activeRouteLine = Paint(routeLine).apply {
            color = flowVisualColor()
            strokeWidth = 14f
        }
        val overextended = state.energyFlowStatus == EnergyFlowStatus.DRAINING_TOO_FAST ||
            state.energyFlowStatus == EnergyFlowStatus.BURNING_DURING_RECOVERY
        val underextended = state.energyFlowStatus == EnergyFlowStatus.RECOVERING ||
            state.energyFlowStatus == EnergyFlowStatus.RECOVERING_TOO_SLOW
        when {
            underextended -> canvas.drawPath(rideLeg, activeRouteLine)
            overextended -> {
                canvas.drawLine(topStartX, nodeY, topEndX, nodeY, activeRouteLine)
                canvas.drawPath(rideLeg, activeRouteLine)
            }
            else -> {
                canvas.drawPath(planLeg, activeRouteLine)
                canvas.drawLine(topStartX, nodeY, topEndX, nodeY, activeRouteLine)
            }
        }

        drawTrajectoryFlows(
            canvas = canvas,
            state = state,
            planX = planX,
            rideX = rideX,
            nodeY = nodeY,
            nodeRadius = nodeRadius,
            batteryLeft = batteryLeft,
            batteryRight = batteryRight,
            batteryCenterY = batteryCenterY,
        )
        drawActionBanner(canvas, state, width, height)
        return bitmap
    }

    private fun drawNode(
        canvas: Canvas,
        label: String,
        x: Float,
        y: Float,
        radius: Float,
        fill: Paint,
        border: Paint,
        textColor: Int,
    ) {
        canvas.drawCircle(x, y, radius, fill)
        canvas.drawCircle(x, y, radius, border)
        drawCenteredText(canvas, label, x, y, radius * 0.56f, textColor)
    }

    private fun drawTrajectoryFlows(
        canvas: Canvas,
        state: WPrimeState,
        planX: Float,
        rideX: Float,
        nodeY: Float,
        nodeRadius: Float,
        batteryLeft: Float,
        batteryRight: Float,
        batteryCenterY: Float,
    ) {
        val color = flowVisualColor()
        val phase = ((state.flowAnimationPhase % 1f) + 1f) % 1f
        val overextended = state.energyFlowStatus == EnergyFlowStatus.DRAINING_TOO_FAST ||
            state.energyFlowStatus == EnergyFlowStatus.BURNING_DURING_RECOVERY
        val underextended = state.energyFlowStatus == EnergyFlowStatus.RECOVERING ||
            state.energyFlowStatus == EnergyFlowStatus.RECOVERING_TOO_SLOW

        if (underextended) {
            drawChevronsOnPolyline(
                canvas,
                listOf(
                    rideX to (nodeY + nodeRadius),
                    rideX to (batteryCenterY - 18f),
                    (rideX - 18f) to batteryCenterY,
                    batteryRight to batteryCenterY,
                ),
                phase,
                color,
            )
            return
        }

        // Both on-plan and overextended states send the planned contribution to the ride.
        drawChevronsOnPolyline(
            canvas,
            listOf((planX + nodeRadius) to nodeY, (rideX - nodeRadius) to nodeY),
            phase,
            color,
        )
        if (overextended) {
            drawChevronsOnPolyline(
                canvas,
                listOf(
                    batteryRight to batteryCenterY,
                    (rideX - 18f) to batteryCenterY,
                    rideX to (batteryCenterY - 18f),
                    rideX to (nodeY + nodeRadius),
                ),
                phase,
                color,
            )
        } else {
            drawChevronsOnPolyline(
                canvas,
                listOf(
                    batteryLeft to batteryCenterY,
                    (planX + 18f) to batteryCenterY,
                    planX to (batteryCenterY - 18f),
                    planX to (nodeY + nodeRadius),
                ),
                phase,
                color,
            )
        }
    }

    private fun drawChevronsOnPolyline(
        canvas: Canvas,
        points: List<Pair<Float, Float>>,
        phase: Float,
        color: Int,
    ) {
        val segmentCount = points.lastIndex.coerceAtLeast(1)
        repeat(6) { index ->
            val progress = ((index + phase) / 6f).coerceIn(0f, 0.98f)
            val scaled = progress * segmentCount
            val segment = scaled.toInt().coerceAtMost(points.lastIndex - 1)
            val local = scaled - segment
            val start = points[segment]
            val end = points[segment + 1]
            drawChevron(
                canvas,
                start.first + (end.first - start.first) * local,
                start.second + (end.second - start.second) * local,
                atan2(end.second - start.second, end.first - start.first),
                color,
            )
        }
    }

    private fun drawChevron(canvas: Canvas, x: Float, y: Float, angle: Float, color: Int) {
        val length = 15f
        val wing = 10f
        val backX = x - cos(angle) * length
        val backY = y - sin(angle) * length
        val normalX = -sin(angle) * wing
        val normalY = cos(angle) * wing
        val path = Path().apply {
            moveTo(backX + normalX, backY + normalY)
            lineTo(x, y)
            lineTo(backX - normalX, backY - normalY)
        }
        canvas.drawPath(path, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
            style = Paint.Style.STROKE
            strokeWidth = 8f
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
        })
    }

    private fun drawActionBanner(canvas: Canvas, state: WPrimeState, width: Int, height: Int) {
        val (label, color, textColor) = when (state.energyFlowStatus) {
            EnergyFlowStatus.DRAINING_TOO_FAST,
            EnergyFlowStatus.BURNING_DURING_RECOVERY -> Triple("REST", Color.rgb(32, 170, 91), Color.BLACK)
            EnergyFlowStatus.RECOVERING,
            EnergyFlowStatus.RECOVERING_TOO_SLOW -> Triple("PUSH", Color.rgb(231, 91, 64), Color.WHITE)
            else -> Triple("HOLD", Color.rgb(29, 125, 220), Color.WHITE)
        }
        val left = width * 0.05f
        val right = width * 0.95f
        val top = height * 0.02f
        val bottom = height * 0.15f
        canvas.drawRoundRect(left, top, right, bottom, 18f, 18f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
        })
        drawCenteredText(canvas, label, width / 2f, (top + bottom) / 2f, 44f, textColor)
    }

    private fun drawHorizontalBattery(
        canvas: Canvas,
        left: Float,
        top: Float,
        right: Float,
        bottom: Float,
        state: WPrimeState,
    ) {
        val borderColor = palette.primaryText
        val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = borderColor
            style = Paint.Style.STROKE
            strokeWidth = 6f
        }
        val terminalWidth = 12f
        val terminalHeight = (bottom - top) * 0.42f
        canvas.drawRoundRect(
            right,
            (top + bottom - terminalHeight) / 2f,
            right + terminalWidth,
            (top + bottom + terminalHeight) / 2f,
            3f,
            3f,
            Paint(Paint.ANTI_ALIAS_FLAG).apply { color = borderColor },
        )
        val fillRight = left + (right - left) * state.actualRemainingPct / 100f
        canvas.drawRoundRect(left + 5f, top + 5f, fillRight, bottom - 5f, 8f, 8f, Paint().apply {
            color = batteryVisualColor()
        })
        canvas.drawRoundRect(left, top, right, bottom, 12f, 12f, border)
        state.plannedRemainingPct?.let { planned ->
            val x = left + (right - left) * planned / 100f
            val markerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = planVisualColor()
                strokeWidth = 7f
                strokeCap = Paint.Cap.ROUND
            }
            canvas.drawLine(x, top - 10f, x, bottom + 7f, markerPaint)
            drawCenteredText(canvas, "PLAN ${planned.toInt()}%", x, top - 32f, 25f, planVisualColor())
        }
        drawCenteredText(
            canvas,
            "W′ ${state.actualRemainingPct.toInt()}%",
            (left + right) / 2f,
            (top + bottom) / 2f,
            40f,
            palette.primaryText,
        )
    }

    private fun statusColor(status: EnergyFlowStatus): Int = when (status) {
        EnergyFlowStatus.DRAINING_TOO_FAST,
        EnergyFlowStatus.BURNING_DURING_RECOVERY -> Color.rgb(231, 91, 64)
        EnergyFlowStatus.RECOVERING,
        EnergyFlowStatus.ON_ENERGY_PLAN -> Color.rgb(32, 170, 91)
        EnergyFlowStatus.CONTROLLED_BURN,
        EnergyFlowStatus.RECOVERING_TOO_SLOW -> Color.rgb(239, 174, 55)
    }

    private fun planVisualColor(): Int = Color.rgb(239, 174, 55)

    private fun rideVisualColor(): Int = Color.rgb(29, 125, 220)

    private fun flowVisualColor(): Int = rideVisualColor()

    private fun batteryVisualColor(): Int = rideVisualColor()

    private fun drawBattery(
        canvas: Canvas,
        left: Float,
        top: Float,
        right: Float,
        bottom: Float,
        state: WPrimeState,
    ) {
        val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = if (state.depletingTooFast) Color.rgb(231, 91, 64) else palette.primaryText
            style = Paint.Style.STROKE
            strokeWidth = if (state.depletingTooFast) 7f else 4f
        }
        val terminalWidth = (right - left) * 0.34f
        canvas.drawRect(
            (left + right - terminalWidth) / 2f,
            top - 10f,
            (left + right + terminalWidth) / 2f,
            top,
            Paint().apply { color = border.color },
        )
        val fillTop = yFor(state.actualRemainingPct, top, bottom)
        canvas.drawRect(left + 5f, fillTop, right - 5f, bottom - 5f, Paint().apply {
            color = reserveColor(state.actualRemainingPct)
        })
        canvas.drawRoundRect(left, top, right, bottom, 10f, 10f, border)
        state.plannedRemainingPct?.let { planned ->
            val y = yFor(planned, top, bottom)
            val marker = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = palette.progressMarker
                strokeWidth = 5f
            }
            canvas.drawLine(left - 8f, y, right + 8f, y, marker)
        }
        drawCenteredText(
            canvas,
            "${state.actualRemainingPct.toInt()}%",
            (left + right) / 2f,
            top + (bottom - top) * 0.72f,
            ((right - left) * 0.24f).coerceAtLeast(18f),
            palette.primaryText,
        )
    }

    private fun drawFlow(
        canvas: Canvas,
        state: WPrimeState,
        centerX: Float,
        top: Float,
        bottom: Float,
        width: Int,
        large: Boolean,
    ) {
        val rate = state.actualBalanceChangeJoulesPerSecond
        val color = flowColor(state)
        val count = (kotlin.math.abs(rate) / 20.0).toInt().coerceIn(1, 4)
        val low = minOf(top, bottom)
        val high = maxOf(top, bottom)
        repeat(count) { index ->
            val fraction = (index + 1f) / (count + 1f)
            val y = low + (high - low) * fraction
            // Depletion flows out of the battery; recovery flows into it.
            drawArrowHead(canvas, centerX, y, rate < 0.0, color, if (large) 13f else 10f, vertical = true)
        }
        if (large && state.depletingTooFast) {
            drawCenteredText(
                canvas,
                "TOO FAST",
                width * 0.78f,
                (top + bottom) / 2f,
                (width * 0.042f).coerceIn(20f, 30f),
                Color.rgb(231, 91, 64),
            )
        }
    }

    private fun flowColor(state: WPrimeState): Int = when {
        state.depletingTooFast -> Color.rgb(231, 91, 64)
        state.actualBalanceChangeJoulesPerSecond < 0.0 -> Color.rgb(239, 174, 55)
        else -> Color.rgb(32, 170, 91)
    }

    private fun flowStroke(state: WPrimeState): Float =
        (5f + kotlin.math.abs(state.actualBalanceChangeJoulesPerSecond).toFloat() / 12f)
            .coerceIn(6f, 14f)

    private fun drawArrowHead(
        canvas: Canvas,
        x: Float,
        y: Float,
        forward: Boolean,
        color: Int,
        size: Float,
        vertical: Boolean = false,
    ) {
        val path = Path()
        if (vertical) {
            val direction = if (forward) -1f else 1f
            path.moveTo(x, y + direction * size)
            path.lineTo(x - size * 0.65f, y - direction * size * 0.4f)
            path.lineTo(x + size * 0.65f, y - direction * size * 0.4f)
        } else {
            val direction = if (forward) 1f else -1f
            path.moveTo(x + direction * size, y)
            path.lineTo(x - direction * size * 0.4f, y - size * 0.65f)
            path.lineTo(x - direction * size * 0.4f, y + size * 0.65f)
        }
        path.close()
        canvas.drawPath(path, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color })
    }

    private fun drawCenteredText(
        canvas: Canvas,
        text: String,
        centerX: Float,
        centerY: Float,
        size: Float,
        color: Int,
    ) {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
            textSize = size
            textAlign = Paint.Align.CENTER
            isFakeBoldText = true
        }
        canvas.drawText(
            text,
            centerX,
            centerY - (paint.fontMetrics.ascent + paint.fontMetrics.descent) / 2f,
            paint,
        )
    }

    private fun bitmap(width: Int, height: Int): Bitmap {
        val bitmap = Bitmap.createBitmap(max(width, 1), max(height, 1), Bitmap.Config.ARGB_8888)
        Canvas(bitmap).drawColor(palette.background)
        return bitmap
    }

    private fun drawReserveTrack(canvas: Canvas, left: Float, top: Float, right: Float, bottom: Float) {
        val width = right - left
        val red = Paint().apply { color = Color.rgb(231, 91, 64) }
        val amber = Paint().apply { color = Color.rgb(239, 174, 55) }
        val green = Paint().apply { color = Color.rgb(32, 170, 91) }
        canvas.drawRoundRect(left, top, right, bottom, 12f, 12f, green)
        canvas.drawRect(left, top, left + width * 0.2f, bottom, red)
        canvas.drawRect(left + width * 0.2f, top, left + width * 0.5f, bottom, amber)
    }

    private fun drawPlanMarker(
        canvas: Canvas,
        plannedPct: Float?,
        left: Float,
        right: Float,
        top: Float,
        bottom: Float,
    ) {
        val value = plannedPct ?: return
        val x = left + (right - left) * value / 100f
        val marker = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = palette.primaryText; strokeWidth = 5f }
        canvas.drawLine(x, top - 5f, x, bottom + 5f, marker)
    }

    private fun drawTank(
        canvas: Canvas,
        left: Float,
        width: Float,
        height: Int,
        pct: Float,
        actual: Boolean,
    ) {
        val top = height * 0.08f
        val bottom = height * 0.92f
        val right = left + width
        val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.divider
            style = Paint.Style.STROKE
            strokeWidth = if (actual) 5f else 3f
        }
        val fillTop = bottom - (bottom - top) * pct.coerceIn(0f, 100f) / 100f
        val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = reserveColor(pct) }
        canvas.drawRoundRect(left, fillTop, right, bottom, 10f, 10f, fill)
        canvas.drawRoundRect(left, top, right, bottom, 10f, 10f, border)
    }

    private fun plannedPaint() = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = palette.primaryText
        strokeWidth = 4f
        style = Paint.Style.STROKE
        pathEffect = DashPathEffect(floatArrayOf(10f, 7f), 0f)
    }

    private fun actualPaint(pct: Float) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = reserveColor(pct)
        strokeWidth = 7f
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }

    private fun reserveColor(pct: Float): Int = when {
        pct < 20f -> Color.rgb(231, 91, 64)
        pct < 50f -> Color.rgb(239, 174, 55)
        else -> Color.rgb(32, 170, 91)
    }

    private fun yFor(pct: Float, top: Float, bottom: Float): Float =
        bottom - (bottom - top) * pct.coerceIn(0f, 100f) / 100f
}

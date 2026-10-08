package com.gritmap.karoo.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Shader
import com.gritmap.karoo.ui.state.WPrimeState
import com.gritmap.karoo.ui.state.EnergyFlowStatus
import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.UnitSystem
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sin

class WPrimeBalanceBitmapRenderer(
    private val palette: KarooVisualPalette = KarooVisualPalette.Dark,
) {
    fun renderCompact(state: WPrimeState, width: Int, height: Int): Bitmap {
        val bitmap = bitmap(width, height)
        val canvas = Canvas(bitmap)
        val left = width * 0.05f
        val right = width * 0.95f
        val top = height * 0.18f
        val bottom = height * 0.70f
        drawReserveTrack(canvas, left, top, right, bottom)
        val actualX = left + (right - left) * state.actualRemainingPct / 100f
        val empty = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = palette.surface; alpha = 205 }
        canvas.drawRect(actualX, top, right, bottom, empty)
        drawPlanMarker(canvas, state.plannedRemainingPct, left, right, top, bottom)
        drawCenteredText(
            canvas,
            "W′ ${state.actualRemainingPct.roundToInt()}%",
            width / 2f,
            (top + bottom) / 2f,
            (height * 0.30f).coerceIn(15f, 25f),
            palette.primaryText,
        )
        val plan = state.plannedRemainingPct
        val comparison = if (plan == null) {
            "WAITING FOR PLAN"
        } else {
            val difference = (state.actualRemainingPct - plan).roundToInt()
            when {
                difference > 0 -> "$difference% ABOVE PLAN"
                difference < 0 -> "${kotlin.math.abs(difference)}% BELOW PLAN"
                else -> "ON PLAN"
            }
        }
        drawCenteredText(
            canvas,
            comparison,
            width / 2f,
            height * 0.88f,
            (height * 0.20f).coerceIn(11f, 17f),
            palette.secondaryText,
        )
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

    fun renderTrajectory(
        state: WPrimeState,
        liveState: LiveUiState,
        width: Int,
        height: Int,
    ): Bitmap {
        val bitmap = bitmap(width, height)
        val canvas = Canvas(bitmap)
        drawText(
            canvas,
            "GM POWER BALANCE",
            width * 0.04f,
            height * 0.052f,
            (width * 0.052f).coerceIn(22f, 27f),
            palette.primaryText,
            Paint.Align.LEFT,
        )
        drawText(
            canvas,
            progressLabel(liveState),
            width * 0.96f,
            height * 0.052f,
            (width * 0.047f).coerceIn(20f, 25f),
            palette.secondaryText,
            Paint.Align.RIGHT,
        )
        drawActionBanner(canvas, state, width, height)
        drawCenteredText(
            canvas,
            projectedFinishHeadline(state),
            width / 2f,
            height * 0.255f,
            (width * 0.05f).coerceIn(24f, 29f),
            palette.primaryText,
        )

        val nodeY = height * 0.37f
        val planX = width * 0.13f
        val rideX = width * 0.87f
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
        val nodeRadius = (width * 0.105f).coerceIn(46f, 56f)
        drawNode(canvas, "PLAN", planX, nodeY, nodeRadius, planNodePaint, nodeBorder, Color.BLACK)
        drawNode(canvas, "RIDE", rideX, nodeY, nodeRadius, rideNodePaint, nodeBorder, Color.WHITE)

        val routeLine = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.divider
            strokeWidth = 10f
            strokeCap = Paint.Cap.ROUND
            style = Paint.Style.STROKE
        }

        val batteryLeft = width * 0.20f
        val batteryRight = width * 0.80f
        val batteryTop = height * 0.50f
        val batteryBottom = height * 0.665f
        val batteryCenterY = (batteryTop + batteryBottom) / 2f

        val topStartX = planX + nodeRadius
        val topEndX = rideX - nodeRadius
        canvas.drawLine(topStartX, nodeY, topEndX, nodeY, routeLine)
        val planLeg = Path().apply {
            moveTo(batteryLeft, batteryCenterY)
            lineTo(planX + 22f, batteryCenterY)
            cubicTo(planX + 8f, batteryCenterY, planX, batteryCenterY - 8f, planX, batteryCenterY - 22f)
            lineTo(planX, nodeY + nodeRadius)
        }
        val rideLeg = Path().apply {
            moveTo(batteryRight, batteryCenterY)
            lineTo(rideX - 22f, batteryCenterY)
            cubicTo(rideX - 8f, batteryCenterY, rideX, batteryCenterY - 8f, rideX, batteryCenterY - 22f)
            lineTo(rideX, nodeY + nodeRadius)
        }
        canvas.drawPath(planLeg, routeLine)
        canvas.drawPath(rideLeg, routeLine)

        val activeRouteLine = Paint(routeLine).apply {
            color = flowVisualColor()
            strokeWidth = 13f
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
        // The battery sits above the connector endpoints so its border remains unbroken.
        drawHorizontalBattery(canvas, batteryLeft, batteryTop, batteryRight, batteryBottom, state)
        drawCenteredText(
            canvas,
            energyStatusLabel(state.energyFlowStatus),
            width / 2f,
            height * 0.715f,
            (width * 0.037f).coerceIn(20f, 26f),
            statusColor(state.energyFlowStatus),
        )
        val plannedRate = state.plannedBalanceChangeJoulesPerSecond
        drawFlowMetricCard(
            canvas,
            "PLAN ${plannedRate?.let(::flowModeLabel) ?: "RATE"}",
            plannedRate?.let(::signedReserveWatts) ?: "-- W",
            width * 0.04f,
            height * 0.77f,
            width * 0.485f,
            height * 0.965f,
        )
        drawFlowMetricCard(
            canvas,
            "ACTUAL ${flowModeLabel(state.actualBalanceChangeJoulesPerSecond)}",
            signedReserveWatts(state.actualBalanceChangeJoulesPerSecond),
            width * 0.515f,
            height * 0.77f,
            width * 0.96f,
            height * 0.965f,
        )
        return bitmap
    }

    fun renderCalculating(width: Int, height: Int): Bitmap {
        val bitmap = bitmap(width, height)
        val canvas = Canvas(bitmap)
        val left = width * 0.12f
        val right = width * 0.88f
        val top = height * 0.34f
        val bottom = height * 0.62f
        val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.primaryText
            style = Paint.Style.STROKE
            strokeWidth = 5f
        }
        canvas.drawRoundRect(left, top, right, bottom, 14f, 14f, border)
        canvas.drawRoundRect(
            right,
            height * 0.43f,
            right + 12f,
            height * 0.53f,
            3f,
            3f,
            Paint(Paint.ANTI_ALIAS_FLAG).apply { color = palette.primaryText },
        )
        drawCenteredText(canvas, "CALCULATING", width / 2f, height * 0.46f, 30f, palette.primaryText)
        drawCenteredText(canvas, "Waiting for segment power", width / 2f, height * 0.70f, 20f, palette.secondaryText)
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
        val color = Color.rgb(42, 145, 242)
        val phase = ((state.flowAnimationPhase % 1f) + 1f) % 1f
        val overextended = state.energyFlowStatus == EnergyFlowStatus.DRAINING_TOO_FAST ||
            state.energyFlowStatus == EnergyFlowStatus.BURNING_DURING_RECOVERY
        val underextended = state.energyFlowStatus == EnergyFlowStatus.RECOVERING ||
            state.energyFlowStatus == EnergyFlowStatus.RECOVERING_TOO_SLOW

        if (underextended) {
            // Ride returns reserve: down the ride leg, then left into the battery.
            val verticalMid = ((nodeY + nodeRadius) + (batteryCenterY - 22f)) / 2f
            drawIntegratedChevron(canvas, rideX, verticalMid + (phase - 0.5f) * 12f, Math.PI.toFloat() / 2f, color)
            return
        }

        // Planned contribution always travels left-to-right toward the ride.
        val topStart = planX + nodeRadius
        val topEnd = rideX - nodeRadius
        repeat(4) { index ->
            val fraction = (index + 1f) / 5f
            drawIntegratedChevron(canvas, topStart + (topEnd - topStart) * fraction, nodeY, 0f, color)
        }
        if (overextended) {
            // Extra effort drains reserve rightward, then upward into the ride.
            val verticalMid = ((nodeY + nodeRadius) + (batteryCenterY - 22f)) / 2f
            drawIntegratedChevron(canvas, rideX, verticalMid - (phase - 0.5f) * 12f, -Math.PI.toFloat() / 2f, color)
        } else {
            // On plan, reserve is routed left and upward into the planned contribution.
            val verticalMid = ((nodeY + nodeRadius) + (batteryCenterY - 22f)) / 2f
            drawIntegratedChevron(canvas, planX, verticalMid - (phase - 0.5f) * 12f, -Math.PI.toFloat() / 2f, color)
        }
    }

    private fun drawIntegratedChevron(canvas: Canvas, x: Float, y: Float, angle: Float, color: Int) {
        fun point(forward: Float, lateral: Float): Pair<Float, Float> =
            (x + cos(angle) * forward - sin(angle) * lateral) to
                (y + sin(angle) * forward + cos(angle) * lateral)
        // Broad, solid chevrons are integrated into the stroke, matching the approved mock.
        val tip = point(17f, 0f)
        val outerTop = point(-2f, -14f)
        val innerTop = point(-11f, -14f)
        val innerPoint = point(7f, 0f)
        val innerBottom = point(-11f, 14f)
        val outerBottom = point(-2f, 14f)
        val path = Path().apply {
            moveTo(tip.first, tip.second)
            lineTo(outerTop.first, outerTop.second)
            lineTo(innerTop.first, innerTop.second)
            lineTo(innerPoint.first, innerPoint.second)
            lineTo(innerBottom.first, innerBottom.second)
            lineTo(outerBottom.first, outerBottom.second)
            close()
        }
        canvas.drawPath(path, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color })
    }

    private fun drawActionBanner(canvas: Canvas, state: WPrimeState, width: Int, height: Int) {
        val (action, color, textColor) = when (state.energyFlowStatus) {
            EnergyFlowStatus.DRAINING_TOO_FAST,
            EnergyFlowStatus.BURNING_DURING_RECOVERY -> Triple("REST", Color.rgb(32, 170, 91), Color.BLACK)
            EnergyFlowStatus.RECOVERING,
            EnergyFlowStatus.RECOVERING_TOO_SLOW -> Triple("PUSH", Color.rgb(231, 91, 64), Color.WHITE)
            else -> Triple("HOLD", Color.rgb(29, 125, 220), Color.WHITE)
        }
        val label = "$action • ${comparisonForBanner(state)}"
        val left = width * 0.04f
        val right = width * 0.96f
        val top = height * 0.085f
        val bottom = height * 0.20f
        canvas.drawRoundRect(left, top, right, bottom, 18f, 18f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
        })
        drawCenteredText(
            canvas,
            label,
            width / 2f,
            (top + bottom) / 2f,
            (width * 0.065f).coerceIn(30f, 36f),
            textColor,
        )
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
        val shadow = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(150, 0, 0, 0) }
        canvas.drawRoundRect(left + 5f, top + 7f, right + 5f, bottom + 7f, 14f, 14f, shadow)
        val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = borderColor
            style = Paint.Style.STROKE
            strokeWidth = 6f
        }
        val terminalWidth = 15f
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
        val innerLeft = left + 7f
        val innerTop = top + 7f
        val innerRight = right - 7f
        val innerBottom = bottom - 7f
        val fillRight = innerLeft + (innerRight - innerLeft) * state.actualRemainingPct / 100f
        val innerShape = Path().apply { addRoundRect(innerLeft, innerTop, innerRight, innerBottom, 8f, 8f, Path.Direction.CW) }
        canvas.save()
        canvas.clipPath(innerShape)
        canvas.drawRect(innerLeft, innerTop, innerRight, innerBottom, Paint().apply {
            shader = LinearGradient(innerLeft, innerTop, innerRight, innerBottom, Color.rgb(30, 35, 42), Color.rgb(12, 15, 19), Shader.TileMode.CLAMP)
        })
        canvas.drawRect(innerLeft, innerTop, fillRight, innerBottom, Paint().apply {
            shader = LinearGradient(innerLeft, innerTop, fillRight.coerceAtLeast(innerLeft + 1f), innerBottom, Color.rgb(45, 151, 245), Color.rgb(24, 112, 207), Shader.TileMode.CLAMP)
        })
        canvas.restore()
        canvas.drawRoundRect(left, top, right, bottom, 12f, 12f, border)
        state.plannedRemainingPct?.let { planned ->
            val x = left + (right - left) * planned / 100f
            val markerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = planVisualColor()
                strokeWidth = 7f
                strokeCap = Paint.Cap.ROUND
            }
            canvas.drawLine(x, top - 10f, x, bottom + 7f, markerPaint)
            drawCenteredText(canvas, "PLAN ${planned.toInt()}%", x, top - 30f, 24f, planVisualColor())
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

    private fun comparisonForBanner(state: WPrimeState): String {
        val planned = state.plannedRemainingPct ?: return "BUILDING RESERVE PLAN"
        val difference = (state.actualRemainingPct - planned).toInt()
        return when {
            difference > 0 -> "$difference% ABOVE"
            difference < 0 -> "${kotlin.math.abs(difference)}% BELOW"
            else -> "ON PLAN"
        }
    }

    private fun projectedFinishHeadline(state: WPrimeState): String =
        state.projectedFinishPct?.let { "PROJECTED FINISH ${it.toInt()}%" }
            ?: "PROJECTED FINISH --"

    private fun energyStatusLabel(status: EnergyFlowStatus): String = when (status) {
        EnergyFlowStatus.DRAINING_TOO_FAST -> "DRAINING TOO FAST"
        EnergyFlowStatus.BURNING_DURING_RECOVERY -> "BURNING DURING RECOVERY"
        EnergyFlowStatus.RECOVERING_TOO_SLOW -> "RECOVERING TOO SLOW"
        EnergyFlowStatus.RECOVERING -> "RECOVERING"
        EnergyFlowStatus.CONTROLLED_BURN -> "CONTROLLED BURN"
        EnergyFlowStatus.ON_ENERGY_PLAN -> "ON ENERGY PLAN"
    }

    private fun flowModeLabel(rateWatts: Double): String =
        if (rateWatts < 0.0) "DRAIN" else "RECOVERY"

    private fun signedReserveWatts(rateWatts: Double): String =
        "${if (rateWatts >= 0.0) "+" else "−"}${kotlin.math.abs(rateWatts).toInt()} W"

    private fun drawFlowMetricCard(
        canvas: Canvas,
        label: String,
        value: String,
        left: Float,
        top: Float,
        right: Float,
        bottom: Float,
    ) {
        val surface = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = palette.surface }
        val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.divider
            style = Paint.Style.STROKE
            strokeWidth = 3f
        }
        canvas.drawRoundRect(left, top, right, bottom, 14f, 14f, surface)
        canvas.drawRoundRect(left, top, right, bottom, 14f, 14f, border)
        val centerX = (left + right) / 2f
        drawCenteredText(canvas, label, centerX, top + (bottom - top) * 0.30f, 21f, palette.secondaryText)
        drawCenteredText(canvas, value, centerX, top + (bottom - top) * 0.68f, 35f, palette.primaryText)
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

    private fun progressLabel(state: LiveUiState): String {
        if (state.totalDistanceMeters <= 0.0) return "-- / --"
        return if (state.distanceUnitSystem == UnitSystem.IMPERIAL) {
            val progressMiles = state.progressMeters / 1_609.344
            val totalMiles = state.totalDistanceMeters / 1_609.344
            String.format(java.util.Locale.US, "%.1f / %.1f mi", progressMiles, totalMiles)
        } else {
            "${state.progressMeters.roundToInt()} / ${state.totalDistanceMeters.roundToInt()} m"
        }
    }

    private fun drawText(
        canvas: Canvas,
        text: String,
        x: Float,
        centerY: Float,
        size: Float,
        color: Int,
        align: Paint.Align,
    ) {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
            textSize = size
            textAlign = align
            isFakeBoldText = true
            typeface = android.graphics.Typeface.create("sans-serif-condensed", android.graphics.Typeface.BOLD)
        }
        canvas.drawText(
            text,
            x,
            centerY - (paint.fontMetrics.ascent + paint.fontMetrics.descent) / 2f,
            paint,
        )
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
            typeface = android.graphics.Typeface.create("sans-serif-condensed", android.graphics.Typeface.BOLD)
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

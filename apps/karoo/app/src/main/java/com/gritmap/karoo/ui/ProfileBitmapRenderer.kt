package com.gritmap.karoo.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Shader
import com.gritmap.karoo.ui.state.Effort
import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.UnitSystem
import kotlin.math.max
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.roundToInt
import kotlin.math.cos
import kotlin.math.ceil
import kotlin.math.sqrt

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
     * Large-field head-up course: upcoming geography dominates, the rider stays low in the
     * viewport, and the full elevation profile remains available for strategic context.
     */
    fun renderFirstPersonRoute(state: LiveUiState, width: Int, height: Int): Bitmap {
        val safeWidth = max(width, 1)
        val safeHeight = max(height, 1)
        val bitmap = Bitmap.createBitmap(safeWidth, safeHeight, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(palette.background)
        if (state.totalDistanceMeters <= 0.0 || state.routeProfile.size < 2) {
            drawCenteredText(
                canvas,
                "WAITING FOR SEGMENT",
                safeWidth / 2f,
                safeHeight * 0.45f,
                safeWidth * 0.065f,
                palette.primaryText,
            )
            drawCenteredText(
                canvas,
                "Start a recorded ride",
                safeWidth / 2f,
                safeHeight * 0.55f,
                safeWidth * 0.042f,
                palette.secondaryText,
            )
            return bitmap
        }

        val pacer = virtualPacerGap(state)
        val mapTop = 3f
        val mapBottom = safeHeight * 0.61f
        val metricTop = mapBottom + 5f
        val metricBottom = safeHeight * 0.79f
        val elevationTop = metricBottom + 5f
        val elevationBottom = safeHeight - 4f
        val targetGap = pacer?.gapMeters ?: 0.0
        val pastMeters = firstPersonPastMeters(targetGap)
        val aheadMeters = firstPersonAheadMeters(targetGap)
        val windowStart = (state.progressMeters - pastMeters).coerceAtLeast(0.0)
        val windowEnd = (state.progressMeters + aheadMeters).coerceAtMost(state.totalDistanceMeters)
        val riderCoordinate = routeCoordinateAt(state, state.progressMeters)
        val riderLat = riderCoordinate.first
        val riderLng = riderCoordinate.second
        val longitudeScale = cos(Math.toRadians(riderLat)).coerceAtLeast(0.01)
        val headingCoordinate = routeCoordinateAt(
            state,
            (state.progressMeters + 25.0).coerceAtMost(state.totalDistanceMeters),
        )
        val headingEast = (headingCoordinate.second - riderLng) * 111_320.0 * longitudeScale
        val headingNorth = (headingCoordinate.first - riderLat) * 111_320.0
        val headingLength = kotlin.math.hypot(headingEast, headingNorth).coerceAtLeast(0.001)
        val forwardEast = headingEast / headingLength
        val forwardNorth = headingNorth / headingLength
        fun lateralMeters(lat: Double, lng: Double): Double {
            val east = (lng - riderLng) * 111_320.0 * longitudeScale
            val north = (lat - riderLat) * 111_320.0
            return east * forwardNorth - north * forwardEast
        }
        val sampleDistances = buildList {
            add(windowStart)
            var distance = (floor(windowStart / 8.0) * 8.0 + 8.0)
            while (distance < windowEnd) {
                add(distance)
                distance += 8.0
            }
            add(state.progressMeters.coerceIn(windowStart, windowEnd))
            add(windowEnd)
        }.distinct().sorted()
        val lateralExtent = sampleDistances.maxOfOrNull { distance ->
            val coordinate = routeCoordinateAt(state, distance)
            abs(lateralMeters(coordinate.first, coordinate.second))
        }
            ?.coerceAtLeast(28.0) ?: 28.0
        val xScale = (safeWidth * 0.27f / lateralExtent).toFloat()

        // Reserve a clean status lane below the rider instead of stacking labels on markers.
        // Keep the rider spatially stable. Pace is communicated by the target marker and
        // metrics, never by shifting the rider's anchor between frames.
        val riderY = mapBottom - 48f
        val horizonY = mapTop + 12f
        // The road's vanishing point meets the lower edge of the mountain silhouette.
        val roadHorizonY = horizonY + (mapBottom - horizonY) * 0.13f
        fun yFor(distance: Double): Float {
            val delta = distance - state.progressMeters
            return if (delta >= 0.0) {
                val normalized = (delta / aheadMeters).coerceIn(0.0, 1.0)
                (riderY - sqrt(normalized).toFloat() * (riderY - roadHorizonY))
            } else {
                val normalized = (-delta / pastMeters).coerceIn(0.0, 1.0)
                riderY + normalized.toFloat() * (mapBottom - riderY)
            }
        }
        data class ProjectedRoadPoint(
            val distanceMeters: Double,
            val x: Float,
            val y: Float,
            val halfWidth: Float,
        )
        val rawCenters = sampleDistances.map { distance ->
            val coordinate = routeCoordinateAt(state, distance)
            (safeWidth / 2f + lateralMeters(coordinate.first, coordinate.second) * xScale).toFloat()
                .coerceIn(safeWidth * 0.18f, safeWidth * 0.82f)
        }
        val smoothedCenters = rawCenters.indices.map { index ->
            val from = (index - 2).coerceAtLeast(0)
            val to = (index + 2).coerceAtMost(rawCenters.lastIndex)
            (from..to).map { rawCenters[it] }.average().toFloat()
        }
        val road = sampleDistances.mapIndexed { index, distance ->
            val y = yFor(distance)
            val depth = ((y - roadHorizonY) / (mapBottom - roadHorizonY)).coerceIn(0f, 1f)
            ProjectedRoadPoint(
                distanceMeters = distance,
                x = smoothedCenters[index],
                y = y,
                halfWidth = 5f + depth * safeWidth * 0.14f,
            )
        }
        fun projectedAt(distance: Double): ProjectedRoadPoint {
            val afterIndex = road.indexOfFirst { it.distanceMeters >= distance }
            if (afterIndex <= 0) return road.first()
            if (afterIndex == -1) return road.last()
            val before = road[afterIndex - 1]
            val after = road[afterIndex]
            val fraction = ((distance - before.distanceMeters) /
                (after.distanceMeters - before.distanceMeters).coerceAtLeast(0.001)).toFloat()
            return ProjectedRoadPoint(
                distance,
                before.x + (after.x - before.x) * fraction,
                before.y + (after.y - before.y) * fraction,
                before.halfWidth + (after.halfWidth - before.halfWidth) * fraction,
            )
        }

        val distantRoadOffset = road
            .takeLast((road.size / 3).coerceAtLeast(1))
            .map { it.x }
            .average()
            .toFloat() - safeWidth / 2f
        drawMountainHorizon(
            canvas,
            safeWidth,
            horizonY,
            mapBottom,
            parallaxOffsetX = (-distantRoadOffset * 0.85f)
                .coerceIn(-safeWidth * 0.14f, safeWidth * 0.14f),
        )

        // Ground-plane contours are intentionally stronger than the prior diagnostic lines.
        val contourPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.secondaryText
            alpha = 150
            strokeWidth = 3f
        }
        elevationContourCrossings(state, windowStart, windowEnd).forEach { contour ->
            val projected = projectedAt(contour.first)
            val contourY = projected.y
            if (contourY in roadHorizonY..mapBottom) {
                val depth = ((contourY - roadHorizonY) / (mapBottom - roadHorizonY)).coerceIn(0f, 1f)
                val halfWidth = safeWidth * (0.20f + depth * 0.27f)
                val left = safeWidth / 2f - halfWidth
                canvas.drawLine(left, contourY, safeWidth / 2f + halfWidth, contourY, contourPaint)
                drawText(
                    canvas,
                    "${contour.second} ft",
                    8f,
                    contourY - 6f,
                    17f,
                    palette.secondaryText,
                    Paint.Align.LEFT,
                )
            }
        }

        // Fill actual road quads so this reads as a receding surface rather than a thick line.
        road.zipWithNext().forEach { (start, end) ->
            val midpoint = (start.distanceMeters + end.distanceMeters) / 2.0
            val effort = effortAt(state, midpoint)
            val baseColor = effortColor(effort)
            val startDepth = ((start.y - roadHorizonY) / (mapBottom - roadHorizonY)).coerceIn(0f, 1f)
            val endDepth = ((end.y - roadHorizonY) / (mapBottom - roadHorizonY)).coerceIn(0f, 1f)
            val startShoulder = 1.5f + startDepth * 12f
            val endShoulder = 1.5f + endDepth * 12f
            val shoulder = Path().apply {
                moveTo(start.x - start.halfWidth - startShoulder, start.y)
                lineTo(start.x + start.halfWidth + startShoulder, start.y)
                lineTo(end.x + end.halfWidth + endShoulder, end.y)
                lineTo(end.x - end.halfWidth - endShoulder, end.y)
                close()
            }
            canvas.drawPath(shoulder, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                alpha = 235
                shader = LinearGradient(
                    0f,
                    mapBottom,
                    0f,
                    roadHorizonY,
                    intArrayOf(
                        Color.rgb(18, 20, 22),
                        Color.rgb(45, 49, 53),
                        Color.rgb(56, 60, 65),
                        Color.rgb(30, 33, 36),
                    ),
                    floatArrayOf(0f, 0.28f, 0.68f, 1f),
                    Shader.TileMode.CLAMP,
                )
            })
            // A narrow dark reveal separates the effort surface from its shoulder. It
            // follows the same perspective taper, matching the original depth concept.
            val startSeparator = 0.6f + startDepth * 3.4f
            val endSeparator = 0.6f + endDepth * 3.4f
            val separator = Path().apply {
                moveTo(start.x - start.halfWidth - startSeparator, start.y)
                lineTo(start.x + start.halfWidth + startSeparator, start.y)
                lineTo(end.x + end.halfWidth + endSeparator, end.y)
                lineTo(end.x - end.halfWidth - endSeparator, end.y)
                close()
            }
            canvas.drawPath(separator, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.rgb(5, 7, 9)
                alpha = 245
            })
            val roadPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                alpha = 235
                shader = LinearGradient(
                    0f,
                    mapBottom,
                    0f,
                    roadHorizonY,
                    intArrayOf(
                        shadeColor(baseColor, 0.12f),
                        shadeColor(baseColor, 0.46f),
                        shadeColor(baseColor, 0.92f),
                        shadeColor(baseColor, 0.42f),
                    ),
                    floatArrayOf(0f, 0.28f, 0.68f, 1f),
                    Shader.TileMode.CLAMP,
                )
            }
            val quad = Path().apply {
                moveTo(start.x - start.halfWidth, start.y)
                lineTo(start.x + start.halfWidth, start.y)
                lineTo(end.x + end.halfWidth, end.y)
                lineTo(end.x - end.halfWidth, end.y)
                close()
            }
            canvas.drawPath(quad, roadPaint)
        }

        state.nextPacingZone?.takeIf { it.startDistanceMeters <= windowEnd }?.let { next ->
            val point = projectedAt(next.startDistanceMeters)
            val calloutOnRight = point.x < safeWidth * 0.60f
            val lineEndX = if (calloutOnRight) safeWidth * 0.94f else safeWidth * 0.06f
            val textX = if (calloutOnRight) lineEndX - 2f else lineEndX + 2f
            val align = if (calloutOnRight) Paint.Align.RIGHT else Paint.Align.LEFT
            val calloutY = (point.y - 10f).coerceIn(roadHorizonY + 20f, riderY - 42f)
            val calloutPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = palette.primaryText
                strokeWidth = 3f
            }
            canvas.drawCircle(point.x, point.y, 6f, calloutPaint)
            canvas.drawLine(point.x, point.y, lineEndX, calloutY, calloutPaint)
            val distance = (next.startDistanceMeters - state.progressMeters).coerceAtLeast(0.0)
            val label = "${effortLabel(next.effort)} IN ${formatDistance(distance, state.distanceUnitSystem)} • ${next.targetPowerWatts} W"
            drawText(canvas, label, textX, calloutY - 5f, 19.2f, palette.primaryText, align)
        }

        val riderPoint = projectedAt(state.progressMeters)
        val riderX = riderPoint.x
        val riderRadius = (safeWidth * 0.047f).coerceIn(20f, 29f)
        pacer?.takeIf { it.targetIsAhead }?.let {
            val targetPoint = projectedAt(it.targetProgressMeters.coerceIn(windowStart, windowEnd))
            val pacerRadius = (safeWidth * 0.045f).coerceIn(19f, 28f)
            val minimumSeparation = riderRadius + pacerRadius + 12f
            val pacerBottomLimit = if (it.targetIsAhead) {
                mapBottom - pacerRadius
            } else {
                mapBottom - 70f
            }
            var pacerY = targetPoint.y.coerceIn(roadHorizonY + pacerRadius, pacerBottomLimit)
            if (abs(pacerY - riderY) < minimumSeparation) {
                pacerY = (riderY + if (it.targetIsAhead) -minimumSeparation else minimumSeparation)
                    .coerceIn(roadHorizonY + pacerRadius, pacerBottomLimit)
            }
            drawSimplePacerMarker(
                canvas, targetPoint.x, pacerY, pacerRadius * 0.72f,
                if (it.targetIsAhead) Color.rgb(239, 82, 67) else Color.rgb(42, 190, 105),
            )
        }
        canvas.drawCircle(riderX, riderY, riderRadius + 4f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = palette.background })
        canvas.drawCircle(riderX, riderY, riderRadius, markerPaint)
        drawCenteredText(canvas, "YOU", riderX, riderY, riderRadius * 1.032f, palette.background)

        val target = state.recommendation?.targetPowerWatts
        val actual = state.rollingPowerWatts3s ?: state.currentPowerWatts
        val currentEffort = effortAt(state, state.progressMeters)
        val cardGap = safeWidth * 0.025f
        val cardWidth = (safeWidth - cardGap * 4f) / 3f
        drawColoredMetricCard(
            canvas, "TARGET", target?.let { "$it W" } ?: "-- W",
            cardGap, metricTop,
            cardGap + cardWidth, metricBottom, effortColor(currentEffort),
        )
        val actualBackground = if (target != null && actual != null) {
            executionColor(actual, target)
        } else {
            palette.surface
        }
        drawColoredMetricCard(
            canvas, "ACTUAL", actual?.let { "$it W" } ?: "-- W",
            cardGap * 3f + cardWidth * 2f, metricTop,
            cardGap * 3f + cardWidth * 3f, metricBottom, actualBackground,
        )
        val signedDistanceMeters = pacer?.let {
            if (it.targetIsAhead) -abs(it.gapMeters) else abs(it.gapMeters)
        } ?: 0.0
        drawColoredMetricCard(
            canvas, "PACE", formatSignedPacerDistance(signedDistanceMeters, state.distanceUnitSystem),
            cardGap * 2f + cardWidth, metricTop,
            cardGap * 2f + cardWidth * 2f, metricBottom, palette.surface,
        )
        drawMiniElevationProfile(canvas, state, safeWidth, elevationTop, elevationBottom, pacer)
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

    private fun drawSimplePacerMarker(
        canvas: Canvas,
        centerX: Float,
        centerY: Float,
        radius: Float,
        color: Int,
    ) {
        canvas.drawCircle(
            centerX,
            centerY,
            radius + 5f,
            Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = Color.WHITE },
        )
        canvas.drawCircle(
            centerX,
            centerY,
            radius,
            Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color },
        )
        canvas.drawCircle(
            centerX,
            centerY,
            radius * 0.34f,
            Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = Color.WHITE },
        )
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

    private fun effortLabel(effort: Effort): String = when (effort) {
        Effort.RECOVER -> "REST"
        Effort.HOLD -> "HOLD"
        Effort.PUSH -> "PUSH"
    }

    private fun formatDistance(meters: Double, system: UnitSystem): String =
        if (system == UnitSystem.IMPERIAL) {
            "${abs(meters * 3.28084).roundToInt()} ft"
        } else {
            "${abs(meters).roundToInt()} m"
        }

    private fun shadeColor(color: Int, factor: Float): Int = Color.rgb(
        (Color.red(color) * factor).roundToInt().coerceIn(0, 255),
        (Color.green(color) * factor).roundToInt().coerceIn(0, 255),
        (Color.blue(color) * factor).roundToInt().coerceIn(0, 255),
    )

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

    private fun drawColoredMetricCard(
        canvas: Canvas,
        title: String,
        value: String,
        left: Float,
        top: Float,
        right: Float,
        bottom: Float,
        backgroundColor: Int,
    ) {
        val background = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = backgroundColor }
        canvas.drawRoundRect(left, top, right, bottom, 12f, 12f, background)
        val centerX = (left + right) / 2f
        val titleY = top + (bottom - top) * 0.35f
        val valueY = top + (bottom - top) * 0.72f
        val textColor = Color.WHITE
        drawCenteredText(canvas, title, centerX, titleY, (right - left) * 0.18f, textColor)
        drawCenteredText(canvas, value, centerX, valueY, (right - left) * 0.30f, textColor)
    }

    private fun drawMountainHorizon(
        canvas: Canvas,
        width: Int,
        horizonY: Float,
        mapBottom: Float,
        parallaxOffsetX: Float,
    ) {
        fun mountainPath(
            points: List<Pair<Float, Float>>,
            baseline: Float,
            layerOffsetX: Float,
        ): Path = Path().apply {
            moveTo(0f, baseline)
            points.forEach { (x, y) ->
                lineTo(x * width + layerOffsetX, horizonY + y * (mapBottom - horizonY))
            }
            lineTo(width.toFloat(), baseline)
            close()
        }
        canvas.drawPath(
            mountainPath(
                listOf(-0.08f to 0.055f, 0.16f to 0.018f, 0.34f to 0.050f, 0.58f to 0.008f, 0.78f to 0.052f, 1.08f to 0.025f),
                horizonY + (mapBottom - horizonY) * 0.09f,
                parallaxOffsetX * 0.42f,
            ),
            Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(37, 42, 48); alpha = 185 },
        )
        canvas.drawPath(
            mountainPath(
                listOf(-0.08f to 0.085f, 0.20f to 0.052f, 0.44f to 0.080f, 0.68f to 0.035f, 0.84f to 0.075f, 1.08f to 0.055f),
                horizonY + (mapBottom - horizonY) * 0.13f,
                parallaxOffsetX,
            ),
            Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(25, 30, 35); alpha = 220 },
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
        }
        canvas.drawText(text, centerX, centerY - (paint.fontMetrics.ascent + paint.fontMetrics.descent) / 2f, paint)
    }

    private fun drawMiniElevationProfile(
        canvas: Canvas,
        state: LiveUiState,
        width: Int,
        top: Float,
        bottom: Float,
        pacer: VirtualPacerGap?,
    ) {
        val profile = state.elevationProfile
        if (profile.size < 2) return
        val minElevation = profile.minOf { it.elevationMeters }
        val maxElevation = profile.maxOf { it.elevationMeters }
        val span = (maxElevation - minElevation).coerceAtLeast(1.0)
        val chartLeft = (width * 0.145f).coerceIn(62f, 76f)
        val chartWidth = width - chartLeft
        fun xForDistance(distance: Double): Float =
            chartLeft + (distance / state.totalDistanceMeters * chartWidth).toFloat()
        state.pacingZones.forEach { zone ->
            fillPaint.color = effortColor(zone.effort)
            fillPaint.alpha = 62
            canvas.drawRect(
                xForDistance(zone.startDistanceMeters), top,
                xForDistance(zone.endDistanceMeters), bottom,
                fillPaint,
            )
        }
        // Completed distance overlays actual execution quality on the muted plan.
        state.powerExecutionHistory.zipWithNext().forEach { (start, end) ->
            val left = xForDistance(start.distanceMeters).coerceIn(chartLeft, width.toFloat())
            val right = xForDistance(end.distanceMeters).coerceIn(left, width.toFloat())
            executionPaint.color = executionColor(end.actualWatts, end.targetWatts)
            executionPaint.alpha = 150
            canvas.drawRect(left, top, right, bottom, executionPaint)
        }
        val path = Path()
        profile.forEachIndexed { index, point ->
            val x = xForDistance(point.distanceMeters)
            val y = bottom - 5f - ((point.elevationMeters - minElevation) / span * (bottom - top - 10f)).toFloat()
            if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        linePaint.strokeWidth = 4f
        canvas.drawPath(path, linePaint)
        fun drawProfileMarker(distance: Double, color: Int, radius: Float) {
            val x = xForDistance(distance)
            val elevation = elevationAt(state, distance)
            val y = bottom - 5f - ((elevation - minElevation) / span * (bottom - top - 10f)).toFloat()
            canvas.drawCircle(x, y, radius + 3f, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = palette.background })
            canvas.drawCircle(x, y, radius, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color })
        }
        drawProfileMarker(state.progressMeters, Color.WHITE, 7f)
        pacer?.let {
            drawProfileMarker(
                it.targetProgressMeters,
                if (it.targetIsAhead) Color.rgb(239, 82, 67) else Color.rgb(42, 190, 105),
                7f,
            )
        }
        val axisPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.secondaryText
            textSize = (width * 0.0375f).coerceIn(16f, 21f)
            textAlign = Paint.Align.RIGHT
            isFakeBoldText = true
        }
        repeat(4) { index ->
            val fraction = index / 3.0
            val elevationMeters = minElevation + span * fraction
            val y = bottom - 5f - (fraction * (bottom - top - 10f)).toFloat()
            val value = if (state.elevationUnitSystem == UnitSystem.IMPERIAL) {
                (elevationMeters * 3.28084).roundToInt().toString()
            } else {
                elevationMeters.roundToInt().toString()
            }
            canvas.drawText(value, chartLeft - 7f, y - (axisPaint.fontMetrics.ascent + axisPaint.fontMetrics.descent) / 2f, axisPaint)
        }
        drawText(
            canvas,
            if (state.elevationUnitSystem == UnitSystem.IMPERIAL) "ft" else "m",
            chartLeft - 7f,
            bottom - 2f,
            (width * 0.033f).coerceIn(14f, 18f),
            palette.secondaryText,
            Paint.Align.RIGHT,
        )
    }

    private fun effortAt(state: LiveUiState, distanceMeters: Double): Effort =
        state.pacingZones.firstOrNull {
            distanceMeters >= it.startDistanceMeters && distanceMeters <= it.endDistanceMeters
        }?.effort ?: Effort.HOLD

    /** Returns the route distances where the elevation crosses an exact 100-foot level. */
    private fun elevationContourCrossings(
        state: LiveUiState,
        startDistanceMeters: Double,
        endDistanceMeters: Double,
    ): List<Pair<Double, Int>> {
        val profile = state.elevationProfile
        if (profile.size < 2) return emptyList()
        val startElevation = elevationAt(state, startDistanceMeters)
        val endElevation = elevationAt(state, endDistanceMeters)
        val visibleSamples = profile.filter { it.distanceMeters in startDistanceMeters..endDistanceMeters }
        val minElevation = minOf(startElevation, endElevation, visibleSamples.minOfOrNull { it.elevationMeters } ?: startElevation)
        val maxElevation = maxOf(startElevation, endElevation, visibleSamples.maxOfOrNull { it.elevationMeters } ?: endElevation)
        val firstFeet = (ceil(minElevation / 30.48) * 100.0).toInt()
        val lastFeet = floor(maxElevation / 30.48).toInt() * 100
        if (firstFeet > lastFeet) return emptyList()

        val contours = mutableListOf<Pair<Double, Int>>()
        for (feet in firstFeet..lastFeet step 100) {
            val targetMeters = feet * 0.3048
            profile.zipWithNext().firstOrNull { (before, after) ->
                val low = minOf(before.elevationMeters, after.elevationMeters)
                val high = maxOf(before.elevationMeters, after.elevationMeters)
                targetMeters in low..high && after.distanceMeters >= startDistanceMeters && before.distanceMeters <= endDistanceMeters
            }?.let { (before, after) ->
                val elevationSpan = after.elevationMeters - before.elevationMeters
                val fraction = if (abs(elevationSpan) < 0.0001) 0.0 else {
                    ((targetMeters - before.elevationMeters) / elevationSpan).coerceIn(0.0, 1.0)
                }
                val distance = before.distanceMeters + (after.distanceMeters - before.distanceMeters) * fraction
                if (distance in startDistanceMeters..endDistanceMeters) contours += distance to feet
            }
        }
        return contours
    }

    private fun drawText(
        canvas: Canvas,
        text: String,
        x: Float,
        baselineY: Float,
        size: Float,
        color: Int,
        align: Paint.Align,
    ) {
        canvas.drawText(text, x, baselineY, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
            textSize = size
            textAlign = align
            isFakeBoldText = true
        })
    }

    private fun routeCoordinateAt(state: LiveUiState, distanceMeters: Double): Pair<Double, Double> {
        val route = state.routeProfile
        val afterIndex = route.indexOfFirst { it.distanceMeters >= distanceMeters }
        if (afterIndex <= 0) return route.first().let { it.lat to it.lng }
        if (afterIndex == -1) return route.last().let { it.lat to it.lng }
        val before = route[afterIndex - 1]
        val after = route[afterIndex]
        val span = (after.distanceMeters - before.distanceMeters).coerceAtLeast(0.001)
        val fraction = ((distanceMeters - before.distanceMeters) / span).coerceIn(0.0, 1.0)
        return (before.lat + (after.lat - before.lat) * fraction) to
            (before.lng + (after.lng - before.lng) * fraction)
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

internal fun formatSignedPacerDistance(meters: Double, system: UnitSystem): String {
    val converted = if (system == UnitSystem.IMPERIAL) meters * 3.28084 else meters
    val rounded = converted.roundToInt()
    val sign = when {
        rounded > 0 -> "+"
        rounded < 0 -> "-"
        else -> ""
    }
    val unit = if (system == UnitSystem.IMPERIAL) "ft" else "m"
    return "$sign${abs(rounded)} $unit"
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

internal fun firstPersonAheadMeters(targetGapMeters: Double): Double =
    if (targetGapMeters > 0.0) {
        (targetGapMeters * 1.45 + 55.0).coerceIn(200.0, 1_100.0)
    } else {
        220.0
    }

internal fun firstPersonPastMeters(targetGapMeters: Double): Double =
    if (targetGapMeters < 0.0) {
        (abs(targetGapMeters) * 1.35 + 25.0).coerceIn(50.0, 340.0)
    } else {
        24.0
    }

// Keep physical tick spacing constant. Adaptive viewport scale alone then makes far-state
// ticks denser and move fewer pixels per meter, while close-state ticks spread out and sweep
// faster. Major ticks remain every 50 m in drawDistanceTicks.
internal fun pacerTickIntervalMeters(visibleRadiusMeters: Double): Double = 10.0

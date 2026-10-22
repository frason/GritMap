package com.gritmap.karoo.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import com.gritmap.karoo.ui.state.Effort
import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.PacingZone
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** A zone stack whose horizontal axis is power and whose vertical axis is plan sequence. */
class PacingCoachBitmapRenderer(
    private val palette: KarooVisualPalette = KarooVisualPalette.Dark,
) {
    fun render(state: LiveUiState, width: Int, height: Int): Bitmap {
        val w = max(width, 1).toFloat()
        val h = max(height, 1).toFloat()
        val bitmap = Bitmap.createBitmap(w.toInt(), h.toInt(), Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(palette.background)
        val zones = state.pacingZones
        if (zones.isEmpty()) {
            centered(canvas, "WAITING FOR PLAN", w / 2f, h / 2f, w * 0.07f, palette.secondaryText)
            return bitmap
        }

        val currentIndex = currentZoneIndex(zones, state.progressMeters)
        val visibleRadius = when {
            h < 135f -> 0
            h < 280f -> 1
            else -> 2
        }
        // Include one extra row so the next zone can glide into view before the boundary.
        val shown = pacingStackOrder(currentIndex, zones.lastIndex, visibleRadius + 1)
        val margin = w * 0.045f
        val headerHeight = when {
            h >= 280f -> h * 0.22f
            h >= 135f -> h * 0.25f
            else -> 0f
        }
        if (headerHeight > 0f) {
            val active = zones[currentIndex]
            val titleY = headerHeight * 0.20f
            text(canvas, "GM PACING COACH", margin, titleY, w * 0.061f, palette.primaryText, Paint.Align.LEFT)
            text(
                canvas,
                coachProgressLabel(state),
                w - margin,
                titleY,
                w * 0.050f,
                palette.secondaryText,
                Paint.Align.RIGHT,
            )

            val banner = RectF(margin, headerHeight * 0.38f, w - margin, headerHeight * 0.96f)
            val bannerRadius = banner.height() * 0.25f
            canvas.drawRoundRect(banner, bannerRadius, bannerRadius, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = effortColor(active.effort)
            })
            centered(
                canvas,
                pacingSectionCounterLabel(active.effort, currentIndex, zones.size),
                banner.centerX(),
                banner.centerY(),
                banner.height() * 0.41f,
                Color.WHITE,
            )
        }

        val availableTop = headerHeight + h * 0.025f
        val availableBottom = h - h * 0.025f
        val centerY = (availableTop + availableBottom) / 2f
        val visibleSlots = visibleRadius * 2 + 1
        val baseGap = (availableBottom - availableTop) / (visibleSlots + 0.15f)
        val normalHeight = min(baseGap * 0.90f, h * 0.205f)
        val activeHeight = min(normalHeight * 1.5f, (availableBottom - availableTop) * 0.88f)
        val range = powerRange(state)
        canvas.save()
        canvas.clipRect(0f, availableTop, w, availableBottom)
        shown.forEach { index ->
            val relative = index - currentIndex
            val emphasis = stackEmphasis(kotlin.math.abs(relative).toFloat())
            val scale = if (relative == 0) 1f else emphasis.first
            val alpha = if (relative == 0) 255 else emphasis.second
            if (alpha <= 8) return@forEach
            val rowHeight = if (relative == 0) activeHeight else normalHeight * scale
            val offset = activeHeight / 2f + rowHeight / 2f + baseGap * 0.10f +
                (kotlin.math.abs(relative) - 1).coerceAtLeast(0) * baseGap
            val y = if (relative == 0) centerY else centerY - kotlin.math.sign(relative.toFloat()) * offset
            val rowWidth = (w - margin * 2f) * scale
            val left = (w - rowWidth) / 2f
            drawZone(canvas, state, zones[index], index, currentIndex, left, y - rowHeight / 2f,
                left + rowWidth, y + rowHeight / 2f, range, alpha)
        }
        canvas.restore()
        return bitmap
    }

    private fun drawZone(
        canvas: Canvas,
        state: LiveUiState,
        zone: PacingZone,
        zoneIndex: Int,
        currentIndex: Int,
        left: Float,
        top: Float,
        right: Float,
        bottom: Float,
        range: IntRange,
        alpha: Int,
    ) {
        val rect = RectF(left, top, right, bottom)
        val radius = (bottom - top) * 0.19f
        val effort = effortColor(zone.effort)
        val isFuture = zoneIndex > currentIndex
        val base = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = if (isFuture) {
                Color.argb((alpha * 0.72f).roundToInt(), 28, 33, 39)
            } else {
                withAlpha(effort, (alpha * 0.30f).roundToInt())
            }
        }
        canvas.drawRoundRect(rect, radius, radius, base)

        val actual = when {
            zoneIndex > currentIndex -> null
            zoneIndex == currentIndex -> currentZoneAveragePower(state, zone)
            else -> completedZoneAveragePower(state, zone)
        }
        val actualX = actual?.let { powerX(it, range, left, right) }
        val path = Path().apply { addRoundRect(rect, radius, radius, Path.Direction.CW) }
        canvas.save()
        canvas.clipPath(path)
        val work = state.sectionWork.firstOrNull { it.startDistanceMeters == zone.startDistanceMeters }
        val budget = work?.estimatedBudgetJoules?.takeIf { it > 0 }
        val actualFill = if (budget != null) work?.actualJoules?.div(budget)?.toFloat() else null
        val plannedFill = if (budget != null) ((work?.plannedJoules ?: 0.0) / budget).toFloat() else null
        if (actualFill != null) {
            canvas.drawRect(left, top, workFillX(left, right, actualFill), bottom,
                Paint().apply { color = withAlpha(effort, (alpha * 0.85f).roundToInt()) })
        }
        canvas.restore()

        val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = withAlpha(effort, alpha)
            style = Paint.Style.STROKE
            strokeWidth = if (zoneIndex == currentIndex) 4f else 2f
        }
        canvas.drawRoundRect(rect, radius, radius, border)

        val labelSize = (bottom - top) * if (zoneIndex == currentIndex) 0.30f else 0.25f
        val labelBox = RectF(
            left + (right - left) * 0.025f,
            top + (bottom - top) * 0.12f,
            left + (right - left) * if (zoneIndex == currentIndex) 0.48f else 0.31f,
            bottom - (bottom - top) * 0.12f,
        )
        val labelRadius = labelBox.height() * 0.17f
        canvas.drawRoundRect(labelBox, labelRadius, labelRadius, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb((alpha * if (zoneIndex == currentIndex) 0.35f else 0.92f).roundToInt(), 13, 17, 21)
        })
        val labelX = labelBox.left + labelBox.width() * 0.08f
        text(canvas, zone.effort.label(), labelX, labelBox.top + labelBox.height() * 0.31f, labelSize, Color.argb(alpha, 255, 255, 255), Paint.Align.LEFT)
        text(canvas, "${zone.targetPowerWatts} W", labelX, labelBox.top + labelBox.height() * 0.71f, labelSize * 0.90f, Color.argb(alpha, 255, 255, 255), Paint.Align.LEFT)

        if (actual != null && actualX != null) {
            val valueX = right - (right - left) * 0.025f
            text(canvas, "$actual W", valueX, (top + bottom) / 2f, labelSize * 1.15f, Color.argb(alpha, 255, 255, 255), Paint.Align.RIGHT)
        }
        if (zoneIndex == currentIndex) {
            val caption = when {
                work?.actualJoules == null && work != null -> "POWER DATA GAP"
                work == null && state.plannedFinishSeconds != null -> "COLLECTING WORK"
                budget == null -> "NO TIMED WORK GOAL"
                (actualFill ?: 0f) > 1f || (plannedFill ?: 0f) > 1f ->
                    "WORK ${((actualFill ?: 0f) * 100).roundToInt()}% · TARGET ${((plannedFill ?: 0f) * 100).roundToInt()}%"
                else -> "WHITE: TARGET WORK · EST. SCALE"
            }
            text(canvas, caption, (left + right) / 2f, bottom - (bottom - top) * 0.07f,
                (bottom - top) * 0.085f, Color.argb(alpha, 255, 255, 255), Paint.Align.CENTER)
        }
        if (plannedFill != null) {
            val lineX = workFillX(left, right, plannedFill).coerceIn(left + 3f, right - 3f)
            canvas.drawLine(lineX, top + 3f, lineX, bottom - 3f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.argb(alpha, 255, 255, 255); strokeWidth = 4f
            })
        }

    }

    private fun powerRange(state: LiveUiState): IntRange {
        val values = buildList {
            addAll(state.pacingZones.map { it.targetPowerWatts })
            addAll(state.powerExecutionHistory.map { it.actualWatts })
            state.rollingPowerWatts3s?.let(::add)
        }.sorted()
        if (values.isEmpty()) return 0..400
        // Ignore isolated extremes so a brief spike cannot make the complete stack jump scale.
        val lowIndex = floor((values.lastIndex * 0.08)).toInt()
        val highIndex = ceil((values.lastIndex * 0.92)).toInt()
        val low = (values[lowIndex] - 25).coerceAtLeast(0)
        val high = (values[highIndex] + 25).coerceAtLeast(low + 100)
        return (low / 10 * 10)..(((high + 9) / 10) * 10)
    }

    private fun powerX(power: Int, range: IntRange, left: Float, right: Float): Float {
        val fraction = ((power - range.first).toFloat() / (range.last - range.first).coerceAtLeast(1)).coerceIn(0f, 1f)
        return left + (right - left) * fraction
    }

    private fun text(canvas: Canvas, value: String, x: Float, centerY: Float, size: Float, color: Int, align: Paint.Align) {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color; textSize = size; textAlign = align; typeface = android.graphics.Typeface.DEFAULT_BOLD }
        canvas.drawText(value, x, centerY - (paint.ascent() + paint.descent()) / 2f, paint)
    }

    private fun centered(canvas: Canvas, value: String, x: Float, y: Float, size: Float, color: Int) = text(canvas, value, x, y, size, color, Paint.Align.CENTER)
    private fun withAlpha(color: Int, alpha: Int) = Color.argb(alpha.coerceIn(0, 255), Color.red(color), Color.green(color), Color.blue(color))
    private fun effortColor(effort: Effort) = when (effort) { Effort.RECOVER -> Color.rgb(34, 177, 93); Effort.HOLD -> Color.rgb(39, 132, 226); Effort.PUSH -> Color.rgb(239, 86, 65) }
}

private fun coachProgressLabel(state: LiveUiState): String = when {
    state.totalDistanceMeters <= 0.0 -> "WAITING"
    state.distanceUnitSystem == com.gritmap.karoo.ui.state.UnitSystem.IMPERIAL ->
        "${(state.progressMeters * 3.28084).toInt()} / ${(state.totalDistanceMeters * 3.28084).toInt()} FT"
    else -> "${state.progressMeters.toInt()} / ${state.totalDistanceMeters.toInt()} M"
}

internal fun pacingSectionCounterLabel(effort: Effort, currentIndex: Int, sectionCount: Int): String =
    "${effort.label()}  ·  ${currentIndex + 1}/$sectionCount SECTIONS"

internal fun currentZoneIndex(zones: List<PacingZone>, progressMeters: Double): Int =
    zones.indexOfFirst { progressMeters >= it.startDistanceMeters && progressMeters < it.endDistanceMeters }
        .takeIf { it >= 0 } ?: zones.lastIndex

internal fun pacingStackOrder(currentIndex: Int, lastIndex: Int, radius: Int): List<Int> {
    val first = max(0, currentIndex - radius)
    val last = min(lastIndex, currentIndex + radius)
    return (first..last).toList().sortedDescending()
}

/** Continuous plan position keeps rows moving smoothly across discrete zone boundaries. */
internal fun continuousStackPosition(currentIndex: Int, completion: Float, lastIndex: Int): Float =
    if (currentIndex >= lastIndex) currentIndex.toFloat()
    else currentIndex + completion.coerceIn(0f, 1f)

/** Strong distance fade: the current/arriving row dominates while context recedes quickly. */
internal fun stackEmphasis(distance: Float): Pair<Float, Int> = when {
    distance <= 1f -> {
        val scale = 1f - 0.22f * distance
        val alpha = (255f - 120f * distance).roundToInt()
        scale to alpha
    }
    distance <= 2f -> {
        val phase = distance - 1f
        val scale = 0.78f - 0.18f * phase
        val alpha = (135f - 80f * phase).roundToInt()
        scale to alpha
    }
    else -> {
        val phase = (distance - 2f).coerceIn(0f, 1f)
        (0.60f - 0.12f * phase) to (55f - 43f * phase).roundToInt()
    }
}

internal fun zoneCompletion(progressMeters: Double, zone: PacingZone, zoneIndex: Int, currentIndex: Int): Float = when {
    zoneIndex < currentIndex -> 1f
    zoneIndex > currentIndex -> 0f
    else -> ((progressMeters - zone.startDistanceMeters) / (zone.endDistanceMeters - zone.startDistanceMeters).coerceAtLeast(1.0)).coerceIn(0.0, 1.0).toFloat()
}

internal fun completionTop(top: Float, bottom: Float, completion: Float): Float =
    bottom - (bottom - top) * completion.coerceIn(0f, 1f)

internal fun completedZoneAveragePower(state: LiveUiState, zone: PacingZone): Int? {
    state.sectionWork.firstOrNull { it.startDistanceMeters == zone.startDistanceMeters }?.let { work ->
        if (work.actualJoules != null && work.plannedJoules > 0) {
            return (work.actualJoules * zone.targetPowerWatts / work.plannedJoules).roundToInt()
        }
    }
    val samples = state.powerExecutionHistory.filter { it.distanceMeters >= zone.startDistanceMeters && it.distanceMeters <= zone.endDistanceMeters }
    return samples.takeIf { it.isNotEmpty() }?.map { it.actualWatts }?.average()?.roundToInt()
}

internal fun currentZoneAveragePower(state: LiveUiState, zone: PacingZone): Int? {
    val settled = completedZoneAveragePower(state, zone)
    return settled ?: state.rollingPowerWatts3s ?: state.currentPowerWatts
}

private fun Effort.label(): String = when (this) { Effort.RECOVER -> "REST"; Effort.HOLD -> "HOLD"; Effort.PUSH -> "PUSH" }

internal fun workFillX(left: Float, right: Float, fraction: Float): Float =
    left + (right - left) * fraction.coerceIn(0f, 1f)

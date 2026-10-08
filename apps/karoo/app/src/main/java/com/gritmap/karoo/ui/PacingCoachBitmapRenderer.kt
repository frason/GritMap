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
            text(canvas, state.segmentName.ifBlank { "GM PACING COACH" }, margin, titleY, w * 0.047f, palette.primaryText, Paint.Align.LEFT)

            val banner = RectF(margin, headerHeight * 0.38f, w - margin, headerHeight * 0.96f)
            val bannerRadius = banner.height() * 0.25f
            canvas.drawRoundRect(banner, bannerRadius, bannerRadius, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = effortColor(active.effort)
            })
            centered(
                canvas,
                "${active.effort.label()}  ·  ${currentIndex + 1}/${zones.size} ZONES",
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
        val baseGap = (availableBottom - availableTop) / (visibleSlots + 0.35f)
        val activeCompletion = zoneCompletion(state.progressMeters, zones[currentIndex], currentIndex, currentIndex)
        val stackPosition = continuousStackPosition(currentIndex, activeCompletion, zones.lastIndex)
        val range = powerRange(state)
        canvas.save()
        canvas.clipRect(0f, availableTop, w, availableBottom)
        shown.forEach { index ->
            val relativePosition = index - stackPosition
            val distance = kotlin.math.abs(relativePosition)
            val emphasis = stackEmphasis(distance)
            val scale = emphasis.first
            val alpha = emphasis.second
            if (alpha <= 8) return@forEach
            val rowHeight = min(baseGap * 0.82f, h * 0.19f) * scale
            val y = centerY - relativePosition * baseGap
            val rowWidth = (w - margin * 2f) * scale
            val left = (w - rowWidth) / 2f
            val right = left + rowWidth
            drawZone(canvas, state, zones[index], index, currentIndex, left, y - rowHeight / 2f, right, y + rowHeight / 2f, range, alpha)
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
        if (actualX != null) {
            canvas.drawRect(left, top, actualX, bottom, Paint().apply { color = withAlpha(effort, (alpha * 0.80f).roundToInt()) })
        }
        val completion = zoneCompletion(state.progressMeters, zone, zoneIndex, currentIndex)
        if (completion > 0f) {
            canvas.drawRect(left, completionTop(top, bottom, completion), right, bottom, Paint().apply {
                color = Color.argb((alpha * 0.16f).roundToInt(), 255, 255, 255)
            })
        }
        canvas.restore()

        val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = withAlpha(effort, alpha)
            style = Paint.Style.STROKE
            strokeWidth = if (zoneIndex == currentIndex) 4f else 2f
        }
        canvas.drawRoundRect(rect, radius, radius, border)

        val targetX = powerX(zone.targetPowerWatts, range, left, right)
        canvas.drawLine(targetX, top + 3f, targetX, bottom - 3f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(alpha, 255, 255, 255)
            strokeWidth = if (zoneIndex == currentIndex) 4f else 3f
        })

        val labelSize = (bottom - top) * if (zoneIndex == currentIndex) 0.27f else 0.23f
        val labelBox = RectF(
            left + (right - left) * 0.025f,
            top + (bottom - top) * 0.12f,
            left + (right - left) * if (zoneIndex == currentIndex) 0.34f else 0.31f,
            bottom - (bottom - top) * 0.12f,
        )
        val labelRadius = labelBox.height() * 0.17f
        canvas.drawRoundRect(labelBox, labelRadius, labelRadius, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb((alpha * 0.92f).roundToInt(), 13, 17, 21)
        })
        val labelX = labelBox.left + labelBox.width() * 0.08f
        text(canvas, zone.effort.label(), labelX, labelBox.top + labelBox.height() * 0.31f, labelSize, Color.argb(alpha, 255, 255, 255), Paint.Align.LEFT)
        text(canvas, "${zone.targetPowerWatts} W", labelX, labelBox.top + labelBox.height() * 0.71f, labelSize * 0.82f, Color.argb(alpha, 255, 255, 255), Paint.Align.LEFT)

        if (actual != null && actualX != null) {
            val valueX = (actualX - 8f).coerceIn(left + (right - left) * 0.42f, right - 8f)
            text(canvas, "$actual W", valueX, (top + bottom) / 2f, labelSize * 1.05f, Color.argb(alpha, 255, 255, 255), Paint.Align.RIGHT)
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
    val samples = state.powerExecutionHistory.filter { it.distanceMeters >= zone.startDistanceMeters && it.distanceMeters <= zone.endDistanceMeters }
    return samples.takeIf { it.isNotEmpty() }?.map { it.actualWatts }?.average()?.roundToInt()
}

internal fun currentZoneAveragePower(state: LiveUiState, zone: PacingZone): Int? {
    val settled = completedZoneAveragePower(state, zone)
    return settled ?: state.rollingPowerWatts3s ?: state.currentPowerWatts
}

private fun Effort.label(): String = when (this) { Effort.RECOVER -> "REST"; Effort.HOLD -> "HOLD"; Effort.PUSH -> "PUSH" }

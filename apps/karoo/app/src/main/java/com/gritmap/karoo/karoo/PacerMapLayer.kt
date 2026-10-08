package com.gritmap.karoo.karoo

import com.gritmap.karoo.R
import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.MatchStatus
import com.gritmap.karoo.ui.state.RouteSample
import io.hammerhead.karooext.models.HidePolyline
import io.hammerhead.karooext.models.HideSymbols
import io.hammerhead.karooext.models.MapEffect
import io.hammerhead.karooext.models.ShowPolyline
import io.hammerhead.karooext.models.ShowSymbols
import io.hammerhead.karooext.models.Symbol
import kotlin.math.roundToInt

/** Converts framework-neutral pacing state into idempotent effects for Karoo's native map. */
internal class PacerMapLayer {
    private var shown = false
    private var shownRouteKey: Int? = null

    fun effects(state: LiveUiState): List<MapEffect> {
        val targetDistance = state.targetProgressMeters
        val target = targetDistance?.let { pointAtDistance(state.routeProfile, it) }
        val active = state.matchStatus == MatchStatus.ACTIVE && target != null
        if (!active) {
            if (!shown) return emptyList()
            shown = false
            shownRouteKey = null
            return listOf(HideSymbols(listOf(PACER_SYMBOL_ID)), HidePolyline(SEGMENT_POLYLINE_ID))
        }

        val effects = mutableListOf<MapEffect>()
        val routeKey = routeKey(state.routeProfile)
        if (routeKey != shownRouteKey) {
            effects += ShowPolyline(
                id = SEGMENT_POLYLINE_ID,
                encodedPolyline = encodePolyline(state.routeProfile),
                color = SEGMENT_COLOR,
                width = 5,
            )
            shownRouteKey = routeKey
        }
        effects += ShowSymbols(
            listOf(
                Symbol.Icon(
                    id = PACER_SYMBOL_ID,
                    lat = requireNotNull(target).lat,
                    lng = target.lng,
                    iconRes = R.drawable.gm_map_pacer,
                    orientation = 0f,
                ),
            ),
        )
        shown = true
        return effects
    }

    private fun routeKey(route: List<RouteSample>): Int = route.fold(1) { key, point ->
        31 * key + point.distanceMeters.roundToInt() + 31 * point.lat.hashCode() + point.lng.hashCode()
    }

    companion object {
        internal const val PACER_SYMBOL_ID = "gritmap-virtual-pacer"
        internal const val SEGMENT_POLYLINE_ID = "gritmap-active-segment"
        private const val SEGMENT_COLOR: Int = -13_399_066 // #FF3386E6
    }
}

internal fun pointAtDistance(route: List<RouteSample>, distanceMeters: Double): RouteSample? {
    if (route.isEmpty()) return null
    if (route.size == 1 || distanceMeters <= route.first().distanceMeters) return route.first()
    if (distanceMeters >= route.last().distanceMeters) return route.last()
    val endIndex = route.indexOfFirst { it.distanceMeters >= distanceMeters }.takeIf { it > 0 } ?: return route.last()
    val start = route[endIndex - 1]
    val end = route[endIndex]
    val span = (end.distanceMeters - start.distanceMeters).coerceAtLeast(0.001)
    val fraction = ((distanceMeters - start.distanceMeters) / span).coerceIn(0.0, 1.0)
    return RouteSample(
        distanceMeters = distanceMeters,
        lat = start.lat + (end.lat - start.lat) * fraction,
        lng = start.lng + (end.lng - start.lng) * fraction,
    )
}

/** Google encoded-polyline format, precision 5, required by karoo-ext ShowPolyline. */
internal fun encodePolyline(route: List<RouteSample>): String {
    val output = StringBuilder()
    var previousLat = 0
    var previousLng = 0
    route.forEach { point ->
        val lat = (point.lat * 100_000.0).roundToInt()
        val lng = (point.lng * 100_000.0).roundToInt()
        encodeSigned(lat - previousLat, output)
        encodeSigned(lng - previousLng, output)
        previousLat = lat
        previousLng = lng
    }
    return output.toString()
}

private fun encodeSigned(value: Int, output: StringBuilder) {
    var encoded = if (value < 0) (value shl 1).inv() else value shl 1
    while (encoded >= 0x20) {
        output.append(((0x20 or (encoded and 0x1f)) + 63).toChar())
        encoded = encoded shr 5
    }
    output.append((encoded + 63).toChar())
}

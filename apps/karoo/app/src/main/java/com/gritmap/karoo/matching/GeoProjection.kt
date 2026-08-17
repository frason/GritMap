package com.gritmap.karoo.matching

import com.gritmap.karoo.domain.GeoPoint
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sqrt

data class Projection(
    val progressMeters: Double,
    val deviationMeters: Double,
    val segmentIndex: Int,
)

object GeoProjection {
    private const val EARTH_RADIUS_METERS = 6_371_008.8

    fun distanceMeters(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
        val meanLat = (lat1 + lat2) * 0.5 * PI / 180.0
        val x = (lng2 - lng1) * PI / 180.0 * cos(meanLat) * EARTH_RADIUS_METERS
        val y = (lat2 - lat1) * PI / 180.0 * EARTH_RADIUS_METERS
        return sqrt(x * x + y * y)
    }

    fun project(lat: Double, lng: Double, polyline: List<GeoPoint>): Projection {
        require(polyline.size >= 2)
        var best: Projection? = null
        for (i in 0 until polyline.lastIndex) {
            val a = polyline[i]
            val b = polyline[i + 1]
            val meanLat = (a.lat + b.lat + lat) / 3.0 * PI / 180.0
            fun x(value: Double) = (value - a.lng) * PI / 180.0 * cos(meanLat) * EARTH_RADIUS_METERS
            fun y(value: Double) = (value - a.lat) * PI / 180.0 * EARTH_RADIUS_METERS
            val bx = x(b.lng); val by = y(b.lat)
            val px = x(lng); val py = y(lat)
            val lengthSquared = bx * bx + by * by
            val t = if (lengthSquared == 0.0) 0.0 else ((px * bx + py * by) / lengthSquared).coerceIn(0.0, 1.0)
            val dx = px - t * bx; val dy = py - t * by
            val progress = a.distanceMeters + t * (b.distanceMeters - a.distanceMeters)
            val candidate = Projection(progress, sqrt(dx * dx + dy * dy), i)
            if (best == null || candidate.deviationMeters < best.deviationMeters) best = candidate
        }
        return checkNotNull(best)
    }
}


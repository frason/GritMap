package com.gritmap.karoo.importing

import kotlinx.serialization.json.*
import kotlin.math.abs

/** Imported sampled elapsed-time record; no rendering or plan-free send activation here. */
data class SegmentRecord(
    val riderId: String,
    val segmentFingerprint: String,
    val bestDurationSeconds: Double,
    val achievedAtMs: Long,
    val effortCount: Int,
    val splits: List<Pair<Double, Double>>,
    val json: String,
) {
    fun validateLength(length: Double) {
        require(length.isFinite() && length > 0)
        if (splits.isNotEmpty()) {
            require(abs(splits.last().first - length) <= .01) { "Record split finish must match segment length" }
        }
    }

    companion object {
        fun parse(o: JsonObject): SegmentRecord {
            require(o.toString().encodeToByteArray().size <= 8192) { "Segment record too large" }
            require(o.keys == setOf("schemaVersion", "riderId", "segmentFingerprint", "bestDurationSeconds",
                "achievedAtMs", "effortCount", "splits")) { "Unknown or missing segment record property" }
            fun primitive(key: String) = o.getValue(key).jsonPrimitive
            fun number(key: String): JsonPrimitive = primitive(key).also { require(!it.isString) { "Record number must be numeric" } }
            require(number("schemaVersion").int == 1) { "Unsupported record schema" }
            require(primitive("riderId").isString && primitive("segmentFingerprint").isString)
            val rider = primitive("riderId").content
            require(rider.matches(Regex("[A-Za-z0-9_-]{16,64}"))) { "Invalid opaque record rider id" }
            val fingerprint = primitive("segmentFingerprint").content
            require(fingerprint.matches(Regex("[0-9a-f]{64}"))) { "Invalid record fingerprint" }
            val duration = number("bestDurationSeconds").double
            require(duration.isFinite() && duration > 0 && duration <= 604800) { "Invalid record duration" }
            val achieved = number("achievedAtMs").long
            val count = number("effortCount").int
            require(achieved > 0 && count in 0..1000000)
            val splits = o.getValue("splits").jsonArray.map {
                val s = it.jsonObject
                require(s.keys == setOf("distanceMeters", "elapsedSeconds")) { "Invalid record split properties" }
                val d = s.getValue("distanceMeters").jsonPrimitive
                val t = s.getValue("elapsedSeconds").jsonPrimitive
                require(!d.isString && !t.isString)
                d.double to t.double
            }
            require(splits.size <= 80 && (splits.isEmpty() || splits.size >= 2))
            require(splits.all { (d,t) -> d.isFinite() && t.isFinite() && d >= 0 && t >= 0 && t <= duration })
            if (splits.isNotEmpty()) {
                require(splits.first() == (0.0 to 0.0)) { "Record splits require explicit origin" }
                require(splits.zipWithNext().all { (a,b) -> b.first > a.first && b.second > a.second })
                require(abs(splits.last().second-duration) <= .000001) { "Record finish must match duration" }
            }
            return SegmentRecord(rider, fingerprint, duration, achieved, count, splits, o.toString())
        }
    }
}

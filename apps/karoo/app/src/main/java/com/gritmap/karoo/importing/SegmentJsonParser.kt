package com.gritmap.karoo.importing

import com.gritmap.karoo.domain.GeoPoint
import com.gritmap.karoo.domain.SegmentDefinition
import java.security.MessageDigest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class ImportValidationException(message: String) : IllegalArgumentException(message)

class SegmentJsonParser(private val json: Json = Json { ignoreUnknownKeys = true }) {
    fun parse(input: String): SegmentDefinition {
        val root = json.parseToJsonElement(input).requireObject("root")
        val schemaVersion = root.requiredInt("schemaVersion")
        if (schemaVersion != 1) fail("Unsupported segment schemaVersion: $schemaVersion")
        if (root.requiredString("direction") != "forward") fail("Only forward segments are supported")

        val id = root.requiredString("id").also { if (it.isBlank()) fail("id must not be blank") }
        val name = root.requiredString("name").also { if (it.isBlank()) fail("name must not be blank") }
        val matching = root.requiredObject("matching")
        val corridor = matching.requiredInt("corridorMeters")
        val coverage = matching.requiredDouble("requiredCoveragePct")
        if (corridor <= 0) fail("corridorMeters must be positive")
        if (coverage !in 0.0..1.0 || coverage == 0.0) fail("requiredCoveragePct must be in (0, 1]")

        val points = root.requiredArray("referencePolyline").mapIndexed { index, value ->
            val point = value.requireObject("referencePolyline[$index]")
            GeoPoint(
                lat = point.requiredDouble("lat"),
                lng = point.requiredDouble("lng"),
                distanceMeters = point.requiredDouble("distanceMeters"),
                elevationMeters = point.optionalDouble("elevationMeters"),
            ).also { validatePoint(it, index) }
        }
        if (points.size < 2) fail("referencePolyline must contain at least two points")
        if (points.first().distanceMeters != 0.0) fail("referencePolyline must begin at distance 0")
        points.zipWithNext().forEachIndexed { index, (a, b) ->
            if (b.distanceMeters <= a.distanceMeters) fail("distance must increase at point ${index + 1}")
        }
        val fingerprint = SegmentFingerprint.compute("forward", corridor, coverage, points)
        root["fingerprint"]?.jsonPrimitive?.content?.let {
            if (!it.equals(fingerprint, ignoreCase = true)) fail("fingerprint does not match segment content")
        }
        return SegmentDefinition(id, name, corridor, coverage, schemaVersion, fingerprint, points)
    }

    private fun validatePoint(point: GeoPoint, index: Int) {
        if (!point.lat.isFinite() || point.lat !in -90.0..90.0) fail("invalid latitude at point $index")
        if (!point.lng.isFinite() || point.lng !in -180.0..180.0) fail("invalid longitude at point $index")
        if (!point.distanceMeters.isFinite() || point.distanceMeters < 0) fail("invalid distance at point $index")
        if (point.elevationMeters?.isFinite() == false) fail("invalid elevation at point $index")
    }
}

object SegmentFingerprint {
    fun compute(direction: String, corridorMeters: Int, requiredCoveragePct: Double, points: List<GeoPoint>): String {
        val canonical = buildString {
            append("segment-fingerprint-v1\n")
            append("direction=").append(direction).append('\n')
            append("corridorMeters=").append(corridorMeters).append('\n')
            append("requiredCoveragePct=").append(requiredCoveragePct.toString()).append('\n')
            points.forEach {
                append(it.lat.toString()).append(',')
                append(it.lng.toString()).append(',')
                append(it.distanceMeters.toString()).append(',')
                append(it.elevationMeters?.toString() ?: "null").append('\n')
            }
        }
        return MessageDigest.getInstance("SHA-256")
            .digest(canonical.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    }
}

internal fun fail(message: String): Nothing = throw ImportValidationException(message)
internal fun JsonElement.requireObject(label: String): JsonObject = this as? JsonObject ?: fail("$label must be an object")
internal fun JsonObject.requiredObject(key: String) = this[key]?.requireObject(key) ?: fail("missing $key")
internal fun JsonObject.requiredArray(key: String): JsonArray = this[key]?.jsonArray ?: fail("missing or invalid $key")
internal fun JsonObject.requiredString(key: String): String = this[key]?.jsonPrimitive?.content ?: fail("missing $key")
internal fun JsonObject.requiredDouble(key: String): Double = try { this[key]?.jsonPrimitive?.double ?: fail("missing $key") } catch (_: Exception) { fail("invalid $key") }
internal fun JsonObject.optionalDouble(key: String): Double? = this[key]?.let { try { it.jsonPrimitive.double } catch (_: Exception) { fail("invalid $key") } }
internal fun JsonObject.requiredInt(key: String): Int = try { this[key]?.jsonPrimitive?.int ?: fail("missing $key") } catch (_: Exception) { fail("invalid $key") }


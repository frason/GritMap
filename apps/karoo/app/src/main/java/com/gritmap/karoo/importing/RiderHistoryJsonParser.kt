package com.gritmap.karoo.importing

import com.gritmap.karoo.domain.HistoricalAttemptSample
import com.gritmap.karoo.domain.RiderHistoryPackage
import com.gritmap.karoo.domain.RiderProfile
import com.gritmap.karoo.domain.TrainingLoadSummary
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long

class RiderHistoryJsonParser(private val json: Json = Json { ignoreUnknownKeys = true }) {
    fun parse(input: String): RiderHistoryPackage {
        val root = json.parseToJsonElement(input).requireObject("root")
        val version = root.requiredInt("schemaVersion")
        if (version != 1) fail("Unsupported rider history schemaVersion: $version")
        val p = root.requiredObject("profile")
        val profile = RiderProfile(
            ftpWatts = p.requiredInt("ftpWatts"),
            weightKg = p.requiredDouble("weightKg"),
            maxHeartRateBpm = p["maxHeartRateBpm"]?.jsonPrimitive?.int,
            thresholdHeartRateBpm = p["thresholdHeartRateBpm"]?.jsonPrimitive?.int,
        )
        if (profile.ftpWatts <= 0 || profile.weightKg <= 0 || !profile.weightKg.isFinite()) fail("invalid rider profile")

        val loads = root.requiredArray("trainingLoads").mapIndexed { index, element ->
            val item = element.requireObject("trainingLoads[$index]")
            TrainingLoadSummary(item.requiredLong("periodStartMs"), item.requiredLong("periodEndMs"), item.requiredDouble("load"))
                .also { if (it.periodEndMs <= it.periodStartMs || !it.load.isFinite() || it.load < 0) fail("invalid training load at $index") }
        }
        val samples = root.requiredArray("samples").mapIndexed { index, element ->
            val item = element.requireObject("samples[$index]")
            HistoricalAttemptSample(
                segmentId = item.requiredString("segmentId"),
                attemptId = item.requiredString("attemptId"),
                distanceMeters = item.requiredDouble("distanceMeters"),
                powerWatts = item.optionalDouble("powerWatts"),
                heartRateBpm = item.optionalDouble("heartRateBpm"),
                cadenceRpm = item.optionalDouble("cadenceRpm"),
                speedMetersPerSecond = item.optionalDouble("speedMetersPerSecond"),
                elevationMeters = item.optionalDouble("elevationMeters"),
            ).also {
                if (it.segmentId.isBlank() || it.attemptId.isBlank() || it.distanceMeters < 0 || !it.distanceMeters.isFinite()) fail("invalid historical sample at $index")
            }
        }
        samples.groupBy { it.segmentId to it.attemptId }.values.forEach { attempt ->
            if (attempt.zipWithNext().any { (a, b) -> b.distanceMeters <= a.distanceMeters }) fail("sample distances must increase within an attempt")
        }
        return RiderHistoryPackage(version, profile, loads, samples)
    }
}

private fun kotlinx.serialization.json.JsonObject.requiredLong(key: String): Long = try {
    this[key]?.jsonPrimitive?.long ?: fail("missing $key")
} catch (_: Exception) { fail("invalid $key") }

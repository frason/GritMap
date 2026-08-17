package com.gritmap.karoo.ai

import com.gritmap.karoo.pacing.PacingPlan
import com.gritmap.karoo.pacing.PacingZone
import com.gritmap.karoo.pacing.PacingClassification
import com.gritmap.karoo.pacing.RecommendationIcon
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

object AiPacingResponseParser {
    private val json = Json { ignoreUnknownKeys = false; isLenient = false }

    fun parse(value: String): PacingPlan {
        val root = json.parseToJsonElement(value).jsonObject
        // cactus_complete returns an envelope; tests and alternate bridges may return
        // the model's plan directly.
        if ("response" in root) {
            require(root["success"]?.jsonPrimitive?.content == "true") { "Cactus completion failed" }
            require(root["cloud_handoff"]?.jsonPrimitive?.content != "true") { "Local model was uncertain" }
            return parse(root.requiredString("response"))
        }
        val allowedRoot = setOf("schemaVersion", "zones")
        require(root.keys.all(allowedRoot::contains)) { "Unknown plan property" }
        require(root.requiredInt("schemaVersion") == 1) { "Unsupported plan schema" }
        val zones = root["zones"]?.jsonArray ?: error("Missing zones")
        require(zones.isNotEmpty()) { "Plan must include zones" }
        return PacingPlan(zones = zones.map(::parseZone), source = PacingPlan.Source.NEEDLE)
    }

    private fun parseZone(element: kotlinx.serialization.json.JsonElement): PacingZone {
        val value = element.jsonObject
        val allowed = setOf("startDistanceMeters", "endDistanceMeters", "targetPowerWatts", "classification", "icon", "instruction")
        require(value.keys.all(allowed::contains)) { "Unknown zone property" }
        return PacingZone(
            startDistanceMeters = value.requiredDouble("startDistanceMeters"),
            endDistanceMeters = value.requiredDouble("endDistanceMeters"),
            targetPowerWatts = value.requiredInt("targetPowerWatts"),
            classification = enumValueOf(value.requiredString("classification").uppercase()),
            icon = enumValueOf(value.requiredString("icon").uppercase()),
            instruction = value.requiredString("instruction"),
        )
    }

    private fun JsonObject.requiredString(key: String) = get(key)?.jsonPrimitive?.content ?: error("Missing $key")
    private fun JsonObject.requiredInt(key: String) = get(key)?.jsonPrimitive?.intOrNull ?: error("Invalid $key")
    private fun JsonObject.requiredDouble(key: String) = get(key)?.jsonPrimitive?.doubleOrNull ?: error("Invalid $key")
}

package com.gritmap.karoo.importing

import com.gritmap.karoo.pacing.ReplanParameters
import kotlinx.serialization.json.*

/** Kept separately from the original targets; nullable extension for old plans. */
data class ReplanMetadata(val parameters: ReplanParameters, val ceilings: List<Int>) {
    fun encode(): String = buildJsonObject {
        put("replan", buildJsonObject {
            put("schemaVersion", parameters.schemaVersion)
            put("criticalPowerWatts", parameters.criticalPowerWatts)
            put("wPrimeJoules", parameters.wPrimeJoules)
            put("wPrimeReserveFraction", parameters.wPrimeReserveFraction)
            put("maxStepWatts", parameters.maxStepWatts)
            put("hardMaxStepWatts", parameters.hardMaxStepWatts)
            put("stepLimitMinGradePct", parameters.stepLimitMinGradePct)
        })
        put("ceilings", JsonArray(ceilings.map(::JsonPrimitive)))
    }.toString()

    companion object {
        fun fromWire(value: JsonObject, targets: List<Int>, ftp: Int): ReplanMetadata? {
            val zones = value.getValue("zones").jsonArray
            val replan = value["replan"]?.jsonObject
            // Future extensions remain importable with original targets, even if their layout changes.
            if (replan != null && replan["schemaVersion"]?.jsonPrimitive?.intOrNull != 1) return null
            if (replan == null) {
                require(zones.none { "ceilingPowerWatts" in it.jsonObject }) { "Ceilings require replan metadata" }
                return null
            }
            val ceilings = zones.map { it.jsonObject["ceilingPowerWatts"]?.jsonPrimitive?.intOrNull
                ?: error("Every section requires a ceiling") }
            val result = ReplanMetadata(parseParameters(replan), ceilings)
            result.validate(targets, ftp)
            return result
        }

        fun decode(stored: String?, targets: List<Int>, ftp: Int?): ReplanMetadata? = stored?.let {
            runCatching {
                val root = Json.parseToJsonElement(it).jsonObject
                ReplanMetadata(parseParameters(root.getValue("replan").jsonObject),
                    root.getValue("ceilings").jsonArray.map { c -> c.jsonPrimitive.int }).also { metadata ->
                    metadata.validate(targets, requireNotNull(ftp))
                }
            }.getOrNull()
        }

        private fun parseParameters(o: JsonObject): ReplanParameters {
            require(o.keys == setOf("schemaVersion", "criticalPowerWatts", "wPrimeJoules", "wPrimeReserveFraction",
                "maxStepWatts", "hardMaxStepWatts", "stepLimitMinGradePct")) { "Unknown or missing replan property" }
            fun number(key: String) = o.getValue(key).jsonPrimitive.double.also { require(it.isFinite()) }
            fun integer(key: String) = o.getValue(key).jsonPrimitive.int
            require(integer("schemaVersion") == 1)
            return ReplanParameters(1, number("criticalPowerWatts"), number("wPrimeJoules"),
                number("wPrimeReserveFraction"), integer("maxStepWatts"), integer("hardMaxStepWatts"), number("stepLimitMinGradePct"))
        }
    }

    fun validate(targets: List<Int>, ftp: Int) {
        require(ceilings.size == targets.size && ceilings.zip(targets).all { (ceiling, target) ->
            ceiling >= target && ceiling in (ftp * .7).toInt()..(ftp * 1.5).toInt()
        }) { "Unsafe section ceiling" }
        require(parameters.criticalPowerWatts in ftp * .7..ftp * 1.5) { "Invalid critical power" }
        require(parameters.wPrimeJoules in 100.0..500000.0) { "Invalid W prime capacity" }
        require(parameters.wPrimeReserveFraction >= 0 && parameters.wPrimeReserveFraction < 1) { "Invalid reserve" }
        require(parameters.maxStepWatts in 1..100 && parameters.hardMaxStepWatts in parameters.maxStepWatts..100) { "Invalid step limit" }
        require(parameters.stepLimitMinGradePct in 0.0..30.0) { "Invalid grade threshold" }
    }
}

package com.gritmap.karoo.ai

/** Stable JNI wire format. Never reorder fields; add a new schema version instead. */
data class TelemetryV1(
    val elapsedSeconds: Float,
    val progressMeters: Float,
    val remainingMeters: Float,
    val gradePercent: Float,
    val powerWatts: Float,
    val heartRateBpm: Float,
    val cadenceRpm: Float,
    val speedMetersPerSecond: Float,
    val activeTargetWatts: Float,
    val rollingPowerWatts: Float,
    val heartRateDriftBpm: Float,
    val corridorDeviationMeters: Float,
) {
    fun toFloatArray(): FloatArray = floatArrayOf(
        SCHEMA_VERSION.toFloat(), elapsedSeconds, progressMeters, remainingMeters,
        gradePercent, powerWatts, heartRateBpm, cadenceRpm, speedMetersPerSecond,
        activeTargetWatts, rollingPowerWatts, heartRateDriftBpm, corridorDeviationMeters,
    )

    init {
        require(toFloatArray().all(Float::isFinite)) { "Telemetry values must be finite" }
    }

    companion object {
        const val SCHEMA_VERSION = 1
        const val ARRAY_SIZE = 13
    }
}

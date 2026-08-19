package com.gritmap.karoo.ui.state

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Framework-neutral state shared by the overlay and Karoo graphical field. */
data class LiveUiState(
    val segmentName: String = "",
    val progressMeters: Double = 0.0,
    val totalDistanceMeters: Double = 0.0,
    val elevationProfile: List<ElevationSample> = emptyList(),
    val pacingZones: List<PacingZone> = emptyList(),
    val recommendation: Recommendation? = null,
    val currentPowerWatts: Int? = null,
    val rollingPowerWatts3s: Int? = null,
    val currentHeartRateBpm: Int? = null,
    val plannedFinishSeconds: Int? = null,
    val predictedFinishSeconds: Int? = null,
    val planAdherencePct: Int? = null,
    val sensorStatus: SensorStatus = SensorStatus(),
    val matchStatus: MatchStatus = MatchStatus.IDLE,
) {
    val progressFraction: Float
        get() = if (totalDistanceMeters > 0.0) {
            (progressMeters / totalDistanceMeters).coerceIn(0.0, 1.0).toFloat()
        } else {
            0f
        }

    val powerDeltaWatts: Int?
        get() = rollingPowerWatts3s?.let { actual ->
            recommendation?.targetPowerWatts?.let { target -> actual - target }
        }

    val wattsPerHeartRate: Double?
        get() = rollingPowerWatts3s?.let { power ->
            currentHeartRateBpm?.takeIf { it > 0 }?.let { heartRate -> power.toDouble() / heartRate }
        }

    val nextPacingZone: PacingZone?
        get() = pacingZones.firstOrNull { it.startDistanceMeters > progressMeters }

    val distanceToNextZoneMeters: Int?
        get() = nextPacingZone?.let { (it.startDistanceMeters - progressMeters).toInt().coerceAtLeast(0) }

    companion object {
        val Idle = LiveUiState()
    }
}

data class ElevationSample(
    val distanceMeters: Double,
    val elevationMeters: Double,
)

data class PacingZone(
    val startDistanceMeters: Double,
    val endDistanceMeters: Double,
    val targetPowerWatts: Int,
    val effort: Effort,
)

enum class Effort { RECOVER, HOLD, PUSH }

enum class GuidanceIcon { RECOVER, HOLD, PUSH, WARNING }

data class Recommendation(
    val targetPowerWatts: Int,
    val instruction: String,
    val icon: GuidanceIcon,
)

data class SensorStatus(
    val gps: Boolean = false,
    val power: Boolean = false,
    val heartRate: Boolean = false,
    val cadence: Boolean = false,
    val speed: Boolean = false,
    val elevation: Boolean = false,
) {
    val adaptiveGuidanceAvailable: Boolean
        get() = gps && power && heartRate && cadence && speed && elevation

    val warning: String?
        get() {
            if (adaptiveGuidanceAvailable) return null
            val missing = buildList {
                if (!gps) add("GPS")
                if (!power) add("power")
                if (!heartRate) add("HR")
                if (!cadence) add("cadence")
                if (!speed) add("speed")
                if (!elevation) add("elevation")
            }
            return "Waiting for ${missing.joinToString()}"
        }
}

enum class MatchStatus { IDLE, CANDIDATE, ACTIVE, UNCERTAIN, COMPLETE, ABANDONED }

/** Process-local state bus. Room is deliberately not used as a UI communication channel. */
object LiveUiStore {
    private val mutableState = MutableStateFlow(LiveUiState.Idle)
    val state: StateFlow<LiveUiState> = mutableState.asStateFlow()

    fun publish(value: LiveUiState) {
        mutableState.value = value
    }

    fun clear() {
        mutableState.value = LiveUiState.Idle
    }
}

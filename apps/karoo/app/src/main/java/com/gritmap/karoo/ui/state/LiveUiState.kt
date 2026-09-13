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
    val powerExecutionHistory: List<PowerExecutionSample> = emptyList(),
    val wPrime: WPrimeState? = null,
    val cardiacDriftPct: Double? = null,
    val cardiacDriftHistory: List<CardiacDriftSample> = emptyList(),
    val plannedFinishSeconds: Int? = null,
    val predictedFinishSeconds: Int? = null,
    val elapsedAttemptSeconds: Double? = null,
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

    /** Distance-proportional fallback schedule until phone plans provide time anchors. */
    val targetProgressMeters: Double?
        get() {
            val elapsed = elapsedAttemptSeconds ?: return null
            val finish = plannedFinishSeconds?.takeIf { it > 0 } ?: return null
            if (totalDistanceMeters <= 0.0) return null
            return (elapsed / finish * totalDistanceMeters).coerceIn(0.0, totalDistanceMeters)
        }

    companion object {
        val Idle = LiveUiState()
    }
}

data class ElevationSample(
    val distanceMeters: Double,
    val elevationMeters: Double,
)

data class CardiacDriftSample(
    val progressFraction: Float,
    val driftPct: Double,
)

/** Distance-keyed execution sample retained only in memory for the live profile visualization. */
data class PowerExecutionSample(
    val distanceMeters: Double,
    val actualWatts: Int,
    val targetWatts: Int,
)

data class WPrimePoint(
    val progressFraction: Float,
    val actualRemainingPct: Float,
    val plannedRemainingPct: Float?,
)

data class WPrimeState(
    val capacityJoules: Double,
    val actualBalanceJoules: Double,
    val plannedBalanceJoules: Double?,
    val plannedFinishBalanceJoules: Double?,
    val projectedFinishBalanceJoules: Double?,
    val criticalPowerWatts: Double,
    val estimated: Boolean,
    val history: List<WPrimePoint> = emptyList(),
    val actualBalanceChangeJoulesPerSecond: Double,
    val plannedBalanceChangeJoulesPerSecond: Double?,
    /** Monotonic 0..<1 visual phase; independent of reserve level and flow direction. */
    val flowAnimationPhase: Float = 0f,
) {
    val actualRemainingPct: Float
        get() = (actualBalanceJoules / capacityJoules * 100.0).toFloat().coerceIn(0f, 100f)
    val plannedRemainingPct: Float?
        get() = plannedBalanceJoules?.let { (it / capacityJoules * 100.0).toFloat().coerceIn(0f, 100f) }
    val projectedFinishPct: Float?
        get() = projectedFinishBalanceJoules?.let {
            (it / capacityJoules * 100.0).toFloat().coerceIn(0f, 100f)
        }
    val depletingTooFast: Boolean
        get() {
            val planned = plannedBalanceChangeJoulesPerSecond ?: return false
            if (actualBalanceChangeJoulesPerSecond >= 0.0) return false
            val allowedExtraDrain = maxOf(10.0, kotlin.math.abs(planned) * 0.2)
            return actualBalanceChangeJoulesPerSecond < planned - allowedExtraDrain
        }

    val energyFlowStatus: EnergyFlowStatus
        get() {
            val planned = plannedBalanceChangeJoulesPerSecond ?: return when {
                actualBalanceChangeJoulesPerSecond < 0.0 -> EnergyFlowStatus.CONTROLLED_BURN
                else -> EnergyFlowStatus.RECOVERING
            }
            val tolerance = maxOf(10.0, kotlin.math.abs(planned) * 0.2)
            return when {
                actualBalanceChangeJoulesPerSecond < 0.0 && planned >= 0.0 ->
                    EnergyFlowStatus.BURNING_DURING_RECOVERY
                actualBalanceChangeJoulesPerSecond >= 0.0 &&
                    planned > 0.0 && actualBalanceChangeJoulesPerSecond < planned - tolerance ->
                    EnergyFlowStatus.RECOVERING_TOO_SLOW
                actualBalanceChangeJoulesPerSecond < planned - tolerance ->
                    EnergyFlowStatus.DRAINING_TOO_FAST
                actualBalanceChangeJoulesPerSecond >= 0.0 -> EnergyFlowStatus.RECOVERING
                else -> EnergyFlowStatus.ON_ENERGY_PLAN
            }
        }
}

enum class EnergyFlowStatus(val label: String) {
    DRAINING_TOO_FAST("DRAINING TOO FAST"),
    BURNING_DURING_RECOVERY("BURNING · PLAN RECOVERY"),
    CONTROLLED_BURN("CONTROLLED BURN"),
    RECOVERING("RECOVERING"),
    RECOVERING_TOO_SLOW("RECOVERING TOO SLOW"),
    ON_ENERGY_PLAN("ON ENERGY PLAN"),
}

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

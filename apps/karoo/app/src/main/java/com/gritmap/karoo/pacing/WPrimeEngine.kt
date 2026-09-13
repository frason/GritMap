package com.gritmap.karoo.pacing

import com.gritmap.karoo.ui.state.PacingZone
import com.gritmap.karoo.ui.state.WPrimePoint
import com.gritmap.karoo.ui.state.WPrimeState
import kotlin.math.exp

data class WPrimeParameters(
    val criticalPowerWatts: Double,
    val capacityJoules: Double,
    val recoveryTauSeconds: Double,
    val estimated: Boolean,
) {
    companion object {
        fun estimatedFromFtp(ftpWatts: Int) = WPrimeParameters(
            criticalPowerWatts = ftpWatts * 0.95,
            capacityJoules = 20_000.0,
            recoveryTauSeconds = 546.0,
            estimated = true,
        )
    }
}

/** Deterministic 1 Hz W′ balance. Phone-supplied parameters can replace estimates later. */
class WPrimeEngine(private val parameters: WPrimeParameters) {
    private var balanceJoules = parameters.capacityJoules
    private var lastTimestampMs: Long? = null
    private var animationTick: Long = 0

    fun update(timestampMs: Long, powerWatts: Double): Double {
        animationTick += 1
        val previous = lastTimestampMs
        lastTimestampMs = timestampMs
        if (previous == null) return balanceJoules
        val dt = ((timestampMs - previous) / 1_000.0).coerceIn(0.0, 5.0)
        balanceJoules = step(balanceJoules, powerWatts, dt, parameters)
        return balanceJoules
    }

    fun stateForPlan(
        progressMeters: Double,
        totalDistanceMeters: Double,
        plannedFinishSeconds: Int?,
        zones: List<PacingZone>,
        history: List<WPrimePoint>,
        actualPowerWatts: Double,
        plannedPowerWatts: Double?,
    ): WPrimeState {
        val planSeconds = plannedFinishSeconds?.takeIf { it > 0 }
        val plannedAtProgress = if (planSeconds != null) {
            simulatePlan(0.0, progressMeters, parameters.capacityJoules, totalDistanceMeters, planSeconds, zones)
        } else null
        val plannedAtFinish = if (planSeconds != null) {
            simulatePlan(0.0, totalDistanceMeters, parameters.capacityJoules, totalDistanceMeters, planSeconds, zones)
        } else null
        val projectedAtFinish = if (planSeconds != null) {
            simulatePlan(
                progressMeters,
                totalDistanceMeters,
                balanceJoules,
                totalDistanceMeters,
                planSeconds,
                zones,
            )
        } else null
        return WPrimeState(
            capacityJoules = parameters.capacityJoules,
            actualBalanceJoules = balanceJoules,
            plannedBalanceJoules = plannedAtProgress,
            plannedFinishBalanceJoules = plannedAtFinish,
            projectedFinishBalanceJoules = projectedAtFinish,
            criticalPowerWatts = parameters.criticalPowerWatts,
            estimated = parameters.estimated,
            history = history,
            actualBalanceChangeJoulesPerSecond = balanceChangeRate(
                balanceJoules,
                actualPowerWatts,
                parameters,
            ),
            plannedBalanceChangeJoulesPerSecond = plannedPowerWatts?.let {
                balanceChangeRate(
                    plannedAtProgress ?: parameters.capacityJoules,
                    it,
                    parameters,
                )
            },
            flowAnimationPhase = (animationTick % 6L) / 6f,
        )
    }

    private fun simulatePlan(
        startMeters: Double,
        endMeters: Double,
        startingBalance: Double,
        totalMeters: Double,
        finishSeconds: Int,
        zones: List<PacingZone>,
    ): Double {
        if (totalMeters <= 0.0 || endMeters <= startMeters) return startingBalance
        val secondsPerMeter = finishSeconds / totalMeters
        var balance = startingBalance
        zones.forEach { zone ->
            val overlapStart = maxOf(startMeters, zone.startDistanceMeters)
            val overlapEnd = minOf(endMeters, zone.endDistanceMeters)
            if (overlapEnd > overlapStart) {
                balance = step(
                    balance,
                    zone.targetPowerWatts.toDouble(),
                    (overlapEnd - overlapStart) * secondsPerMeter,
                    parameters,
                )
            }
        }
        return balance
    }
}

internal fun balanceChangeRate(
    balanceJoules: Double,
    powerWatts: Double,
    parameters: WPrimeParameters,
): Double = if (powerWatts > parameters.criticalPowerWatts) {
    -(powerWatts - parameters.criticalPowerWatts)
} else {
    (parameters.capacityJoules - balanceJoules) / parameters.recoveryTauSeconds
}

internal fun step(
    balanceJoules: Double,
    powerWatts: Double,
    seconds: Double,
    parameters: WPrimeParameters,
): Double {
    if (seconds <= 0.0) return balanceJoules
    return if (powerWatts > parameters.criticalPowerWatts) {
        (balanceJoules - (powerWatts - parameters.criticalPowerWatts) * seconds)
            .coerceIn(0.0, parameters.capacityJoules)
    } else {
        val recoveredFraction = 1.0 - exp(-seconds / parameters.recoveryTauSeconds)
        (balanceJoules + (parameters.capacityJoules - balanceJoules) * recoveredFraction)
            .coerceIn(0.0, parameters.capacityJoules)
    }
}

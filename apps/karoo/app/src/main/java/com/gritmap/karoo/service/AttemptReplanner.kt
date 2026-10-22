package com.gritmap.karoo.service

import com.gritmap.karoo.BuildConfig
import com.gritmap.karoo.pacing.LiveReplanner
import com.gritmap.karoo.pacing.ReplanResult
import com.gritmap.karoo.pacing.ReplanSection
import com.gritmap.karoo.pacing.replanEnergyStep
import com.gritmap.karoo.ui.state.*
import kotlin.math.floor
import kotlin.math.pow

/** Owns live targets for one attempt. Imported plan and original goal stay immutable. */
internal class AttemptReplanner(private val enabled: Boolean = BuildConfig.LIVE_REPLANNER_ENABLED) {
    private var original: List<PacingZone>? = null
    private var previous: Pair<LiveTelemetry, LiveUiState>? = null
    private var lastBoundary = 0
    private var balance: Double? = null
    private var elapsedAtLastTick = 0.0
    private var latest: ReplanResult? = null

    fun apply(state: LiveUiState, sample: LiveTelemetry, elapsedSeconds: Double): LiveUiState {
        if (!enabled || state.pacingZones.isEmpty() || state.pacingZones.any { it.targetPowerWatts <= 0 } || state.pacingZones.size > 128 ||
            state.plannedFinishSeconds == null || state.plannedFinishSeconds !in 1..86400 || state.matchStatus !in listOf(MatchStatus.ACTIVE, MatchStatus.UNCERTAIN)) return state
        val baseline = original ?: state.pacingZones.toList().also { original = it }
        if (baseline.map { it.startDistanceMeters to it.endDistanceMeters } !=
            state.pacingZones.map { it.startDistanceMeters to it.endDistanceMeters }) return state
        val metadata = state.replanMetadata?.takeIf { it.ceilings.size == baseline.size && it.parameters.schemaVersion == 1 }
        val p = metadata?.parameters
        val last = previous
        if (last != null && sample.timestampMs <= last.first.timestampMs) return applyTargets(state)
        if (p != null) {
            val initialBalance = balance ?: p.wPrimeJoules
            balance = if (last == null) initialBalance else {
                val dt = (sample.timestampMs - last.first.timestampMs) / 1000.0
                val currentPower = sample.powerWatts
                val previousPower = last.first.powerWatts
                val known = dt <= 5 && currentPower != null && previousPower != null &&
                    state.sensorStatus.power && last.second.sensorStatus.power &&
                    currentPower.isFinite() && previousPower.isFinite() && currentPower >= 0 && previousPower >= 0
                val power = if (known) (currentPower!! + previousPower!!) / 2 else
                    maxOf(p.criticalPowerWatts, metadata.ceilings.max().toDouble())
                replanEnergyStep(initialBalance, power.coerceAtLeast(0.0), dt, p)
            }
        }
        elapsedAtLastTick = elapsedSeconds
        previous = sample to state
        val boundary = floor(state.progressMeters / 402.336).toInt()
        if (boundary > lastBoundary) {
            lastBoundary = boundary
            // Long GPS gaps/uncertain matching must not produce catch-up instructions from a jump.
            if (state.matchStatus == MatchStatus.ACTIVE && last != null &&
                sample.timestampMs - last.first.timestampMs <= 5000 && state.sensorStatus.gps) {
                val retained = latest?.targets
                val sections = baseline.mapIndexed { i, zone ->
                    ReplanSection(zone.startDistanceMeters, zone.endDistanceMeters,
                        if (zone.endDistanceMeters <= state.progressMeters) retained?.get(i) ?: zone.targetPowerWatts else zone.targetPowerWatts,
                        metadata?.ceilings?.getOrNull(i) ?: zone.targetPowerWatts,
                        if (state.hasCompleteElevationProfile) grade(state.elevationProfile, zone.startDistanceMeters, zone.endDistanceMeters) else null)
                }
                latest = LiveReplanner.replan(sections, state.progressMeters, elapsedSeconds,
                    state.plannedFinishSeconds, balance, p)
            }
        }
        return applyTargets(state)
    }

    private fun applyTargets(state: LiveUiState): LiveUiState {
        val result = latest ?: return state
        val baseline = original ?: return state
        val zones = baseline.mapIndexed { i, z -> z.copy(targetPowerWatts = result.targets[i]) }
        val active = zones.firstOrNull { state.progressMeters >= it.startDistanceMeters && state.progressMeters < it.endDistanceMeters }
        val goal = state.plannedFinishSeconds ?: return state
        val remaining = baseline.indices.sumOf { i ->
            val zone = baseline[i]
            val distance = (zone.endDistanceMeters - maxOf(state.progressMeters, zone.startDistanceMeters)).coerceAtLeast(0.0)
            val grade = if (state.hasCompleteElevationProfile) grade(state.elevationProfile, zone.startDistanceMeters, zone.endDistanceMeters) else null
            goal * distance / state.totalDistanceMeters *
                (zone.targetPowerWatts.toDouble() / zones[i].targetPowerWatts).pow(if ((grade ?: 0.0) >= 1.5) 1.0 else 1.0 / 3.0)
        }
        val estimate = elapsedAtLastTick + remaining
        val updated = result.copy(estimatedFinishSeconds = estimate,
            goalReachable = !result.constraintConflict && estimate <= goal + LiveReplanner.DEADBAND_SECONDS, gapSeconds = (estimate - goal).coerceAtLeast(0.0))
        return state.copy(pacingZones = zones, recommendation = state.recommendation?.let { r ->
            active?.let { r.copy(targetPowerWatts = it.targetPowerWatts,
                instruction = when { it.targetPowerWatts > (baseline.firstOrNull { b -> b.startDistanceMeters == it.startDistanceMeters }?.targetPowerWatts ?: it.targetPowerWatts) -> "Build smoothly"
                    else -> r.instruction }) } ?: r
        }, replanEstimate = updated)
    }

    private fun grade(profile: List<ElevationSample>, start: Double, end: Double): Double? {
        if (profile.size < 2) return null
        fun elevation(at: Double): Double? {
            val a = profile.lastOrNull { it.distanceMeters <= at } ?: return null
            val b = profile.firstOrNull { it.distanceMeters >= at } ?: return null
            if (!a.elevationMeters.isFinite() || !b.elevationMeters.isFinite()) return null
            return if (a.distanceMeters == b.distanceMeters) a.elevationMeters else
                a.elevationMeters + (b.elevationMeters - a.elevationMeters) * (at - a.distanceMeters) / (b.distanceMeters - a.distanceMeters)
        }
        val a = elevation(start) ?: return null
        val b = elevation(end) ?: return null
        return (b - a) / (end - start) * 100
    }
}

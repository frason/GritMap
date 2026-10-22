package com.gritmap.karoo.pacing

import com.gritmap.karoo.service.LiveTelemetry
import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.PacingZone
import com.gritmap.karoo.ui.state.SectionWorkSample

/** Integrates real joules, including proportional allocation of a tick crossing a section boundary. */
internal class SectionWorkTracker {
    private data class Work(var actual: Double = 0.0, var planned: Double = 0.0,
        var budget: Double? = null, var complete: Boolean = true)
    private val work = linkedMapOf<Double, Work>()
    private var previous: Pair<LiveTelemetry, LiveUiState>? = null

    fun add(sample: LiveTelemetry, state: LiveUiState): List<SectionWorkSample> {
        val last = previous
        if (last != null && sample.timestampMs <= last.first.timestampMs) return snapshot()
        previous = sample to state
        if (last == null) return snapshot()
        val dt = (sample.timestampMs - last.first.timestampMs) / 1000.0
        val start = last.second.progressMeters
        val end = state.progressMeters
        if (end < start || dt <= 0.0) return snapshot()
        val p0 = last.first.powerWatts?.takeIf { last.second.sensorStatus.power && it.isFinite() && it >= 0 }
        val p1 = sample.powerWatts?.takeIf { state.sensorStatus.power && it.isFinite() && it >= 0 }
        // Boundary changes invalidate history; future-target-only replanning preserves recorded work.
        val zones = last.second.pacingZones
        if (zones.map { it.startDistanceMeters to it.endDistanceMeters } !=
            state.pacingZones.map { it.startDistanceMeters to it.endDistanceMeters }) { work.clear(); return snapshot() }
        zones.forEach { zone ->
            val fractions = if (end > start) {
                val a = ((zone.startDistanceMeters - start) / (end - start)).coerceIn(0.0, 1.0)
                val b = ((zone.endDistanceMeters - start) / (end - start)).coerceIn(0.0, 1.0)
                if (b <= a) null else a to b
            } else if (start >= zone.startDistanceMeters && start < zone.endDistanceMeters) 0.0 to 1.0 else null
            fractions ?: return@forEach
            val value = work.getOrPut(zone.startDistanceMeters) { Work(budget = budget(zone, last.second)) }
            val (a, b) = fractions
            val seconds = dt * (b - a)
            val nextZone = state.pacingZones.first { it.startDistanceMeters == zone.startDistanceMeters }
            // A newly entered section uses its new target; a mid-section change takes effect now.
            val intervalTarget = if (zone.startDistanceMeters >= start) nextZone.targetPowerWatts else zone.targetPowerWatts
            value.planned += intervalTarget * seconds
            if (nextZone.targetPowerWatts != zone.targetPowerWatts) {
                val remaining = (zone.endDistanceMeters - maxOf(end, zone.startDistanceMeters)).coerceAtLeast(0.0)
                val planSeconds = state.plannedFinishSeconds
                if (planSeconds != null && state.totalDistanceMeters > 0) {
                    val correctionDistance = if (zone.startDistanceMeters >= start) zone.endDistanceMeters - zone.startDistanceMeters else remaining
                    value.budget = value.budget?.plus((nextZone.targetPowerWatts - zone.targetPowerWatts) *
                        planSeconds * correctionDistance / state.totalDistanceMeters)
                }
            }
            if (dt > 5.0 || p0 == null || p1 == null) value.complete = false else {
                val first = p0 + (p1 - p0) * a
                val lastPower = p0 + (p1 - p0) * b
                value.actual += (first + lastPower) / 2.0 * seconds
            }
        }
        return snapshot()
    }

    private fun budget(zone: PacingZone, state: LiveUiState): Double? {
        val seconds = state.plannedFinishSeconds?.takeIf { it > 0 } ?: return null
        if (state.totalDistanceMeters <= 0) return null
        return zone.targetPowerWatts * seconds.toDouble() * (zone.endDistanceMeters - zone.startDistanceMeters) / state.totalDistanceMeters
    }
    private fun snapshot() = work.entries.map { (start, value) ->
        SectionWorkSample(start, value.actual.takeIf { value.complete }, value.planned, value.budget)
    }
}

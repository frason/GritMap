package com.gritmap.karoo.pacing

import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.pow

/** Supplied assumptions, never measured physiology. Shared wire schema v1. */
data class ReplanParameters(
    val schemaVersion: Int = 1,
    val criticalPowerWatts: Double,
    val wPrimeJoules: Double,
    val wPrimeReserveFraction: Double,
    val maxStepWatts: Int,
    val hardMaxStepWatts: Int,
    val stepLimitMinGradePct: Double,
)

data class ReplanSection(
    val startMeters: Double,
    val endMeters: Double,
    val targetWatts: Int,
    val ceilingWatts: Int,
    val gradePct: Double?,
)

data class ReplanResult(
    val targets: List<Int>,
    val estimatedFinishSeconds: Double,
    val goalReachable: Boolean,
    val gapSeconds: Double,
    val changed: Boolean,
    val constraintConflict: Boolean = false,
)

/** Pure bounded optimizer. No model/runtime, database, or imported-plan mutation. */
object LiveReplanner {
    const val DEADBAND_SECONDS = 3.0

    fun replan(
        sections: List<ReplanSection>,
        progressMeters: Double,
        elapsedSeconds: Double,
        goalSeconds: Int,
        balanceJoules: Double?,
        parameters: ReplanParameters?,
    ): ReplanResult {
        require(sections.size in 1..128 && goalSeconds in 1..86400 && progressMeters.isFinite() && elapsedSeconds.isFinite())
        require(elapsedSeconds >= 0 && sections.all { it.targetWatts > 0 && it.ceilingWatts >= it.targetWatts && it.endMeters > it.startMeters })
        val total = sections.last().endMeters
        val progress = progressMeters.coerceIn(0.0, total)
        val active = sections.indexOfFirst { it.endMeters > progress }
        val original = sections.map { it.targetWatts }
        fun duration(i: Int, watts: Int): Double {
            val s = sections[i]
            val distance = (s.endMeters - max(progress, s.startMeters)).coerceAtLeast(0.0)
            // Simplified normalized response: climbing ~1/P, flat ~1/cuberoot(P).
            // No extra power requested on a descent or unknown grade.
            val exponent = if ((s.gradePct ?: 0.0) >= 1.5) 1.0 else 1.0 / 3.0
            return goalSeconds * distance / total * (s.targetWatts.toDouble() / watts).pow(exponent)
        }
        fun finish(targets: List<Int>) = elapsedSeconds + sections.indices.sumOf { duration(it, targets[it]) }
        fun result(targets: List<Int>): ReplanResult {
            val estimate = finish(targets)
            return ReplanResult(targets.toList(), estimate, estimate <= goalSeconds + DEADBAND_SECONDS,
                (estimate - goalSeconds).coerceAtLeast(0.0), targets != original)
        }
        if (active < 0) return result(original)
        val lag = elapsedSeconds - goalSeconds * progress / total
        // Old plans have no verified headroom. Never invent higher ceilings.
        if (parameters == null || balanceJoules == null) return result(original)
        val p = parameters
        val reserve = p.wPrimeJoules * p.wPrimeReserveFraction
        fun limit(a: Int, b: Int) = if (
            sections[a].gradePct == null || sections[b].gradePct == null ||
            (sections[a].gradePct!! >= p.stepLimitMinGradePct && sections[b].gradePct!! >= p.stepLimitMinGradePct)
        ) p.maxStepWatts else p.hardMaxStepWatts
        fun stepsSafe(targets: List<Int>): Boolean = (max(1, active)..targets.lastIndex).all {
            abs(targets[it] - targets[it - 1]) <= limit(it - 1, it)
        }
        fun energySafe(targets: List<Int>): Boolean {
            var balance = balanceJoules.coerceIn(0.0, p.wPrimeJoules)
            for (i in active..targets.lastIndex) {
                val watts = targets[i].toDouble()
                // A depleted rider can recover, but must not spend further until reserve returns.
                if (watts > p.criticalPowerWatts && balance < reserve) return false
                balance = replanEnergyStep(balance, watts, duration(i, targets[i]), p)
                if (watts > p.criticalPowerWatts && balance < reserve - 0.0001) return false
            }
            return true
        }
        val targets = original.toMutableList()
        // If actual effort depleted the reserve, reduce future work before seeking any catch-up.
        if (!energySafe(targets)) {
            for (i in active..targets.lastIndex) targets[i] = minOf(targets[i], p.criticalPowerWatts.toInt().coerceAtLeast(1))
            // Lower high neighbours; never raise a low ceiling to make a transition fit.
            repeat(targets.size) {
                for (i in active..targets.lastIndex) {
                    if (i > 0) targets[i] = minOf(targets[i], targets[i - 1] + limit(i - 1, i))
                    if (i < targets.lastIndex) targets[i] = minOf(targets[i], targets[i + 1] + limit(i, i + 1))
                }
            }
        }
        // A fixed completed section may make a safe transition impossible. Retain baseline rather
        // than publish a partial or invalid adjustment. The estimate still reports the deficit.
        if (!stepsSafe(targets) || !energySafe(targets)) return result(original).copy(constraintConflict = true, goalReachable = false)
        if (lag <= DEADBAND_SECONDS) return result(targets)
        val order = (active..targets.lastIndex).filter { (sections[it].gradePct ?: -1.0) >= 0.0 }
            .sortedWith(compareBy<Int> { sections[it].gradePct }.thenBy { it })
        // Prefer easier sections first, revisit blocked neighbours after the next section moves.
        // Cap evaluations even for unusually long/high-ceiling imported plans.
        var evaluations = 0
        var moved: Boolean
        do {
            moved = false
            for (i in order) {
                while (targets[i] < sections[i].ceilingWatts) {
                    if (finish(targets) <= goalSeconds + DEADBAND_SECONDS || ++evaluations > 8192) return result(targets)
                    targets[i]++
                    if (stepsSafe(targets) && energySafe(targets)) moved = true else { targets[i]--; break }
                }
            }
        } while (moved)
        return result(targets)
    }
}

/** Same ten-second differential integration convention as phone realisticPlan.ts. */
internal fun replanEnergyStep(balance: Double, power: Double, seconds: Double, p: ReplanParameters): Double {
    if (seconds <= 0) return balance
    if (power >= p.criticalPowerWatts) return (balance - (power - p.criticalPowerWatts) * seconds).coerceAtLeast(0.0)
    val steps = ceil(seconds / 10.0).toInt().coerceAtLeast(1)
    val dt = seconds / steps
    var remaining = balance
    repeat(steps) {
        remaining += (p.criticalPowerWatts - power) * (p.wPrimeJoules - remaining) * dt / p.wPrimeJoules
        remaining = remaining.coerceIn(0.0, p.wPrimeJoules)
    }
    return remaining
}

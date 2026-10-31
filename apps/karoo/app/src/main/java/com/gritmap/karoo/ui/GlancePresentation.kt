package com.gritmap.karoo.ui

import com.gritmap.karoo.ui.state.*
import kotlin.math.abs
import kotlin.math.roundToInt
import java.util.Locale

internal enum class GlanceField { PACING, PERFORMANCE, DRIFT, BALANCE }
internal enum class GlanceTone { EASE, ON, MORE, CAUTION, WARN, NEUTRAL }

/** Presentation thresholds are provisional; they never alter matching, power or physiology. */
internal object GlanceThresholds {
    const val ON_GOAL_SECONDS = 2.0
    const val BALANCE_LOW_FINISH_PCT = 10f
    const val BALANCE_WARN_FINISH_PCT = 3f
    const val BALANCE_WARN_NOW_PCT = 10f
    const val LAST_VALUE_MS = 5000L
}

internal data class GlancePresentation(
    val title: String, val verdict: String, val shortVerdict: String,
    val label: String, val hero: String, val unit: String,
    val support: String, val shortSupport: String, val tone: GlanceTone,
    val leftCard: Pair<String,String>? = null, val rightCard: Pair<String,String>? = null,
    val signalMissing: Boolean = false,
)

internal fun glanceClock(seconds: Double?): String {
    if (seconds == null || !seconds.isFinite() || seconds < 0) return "--:--"
    val n=seconds.coerceAtMost(604800.0).roundToInt()
    return if (n>=3600) "%d:%02d:%02d".format(Locale.US,n/3600,n/60%60,n%60) else "%d:%02d".format(Locale.US,n/60,n%60)
}
internal fun signed(value: Double, decimals: Int = 0): String =
    (if (value >= 0) "+" else "−") + String.format(Locale.US,"%.${decimals}f",abs(value))
internal fun effortTone(e: Effort?) = when(e) {
    Effort.RECOVER -> GlanceTone.EASE; Effort.PUSH -> GlanceTone.MORE
    Effort.HOLD -> GlanceTone.ON; else -> GlanceTone.NEUTRAL
}
internal fun effortWord(e: Effort?) = when(e) { Effort.RECOVER -> "EASE"; Effort.PUSH -> "PUSH"; Effort.HOLD -> "HOLD"; else -> "NO PLAN" }

internal fun glancePresentation(kind: GlanceField, s: LiveUiState): GlancePresentation {
    val active=s.matchStatus==MatchStatus.ACTIVE || s.matchStatus==MatchStatus.UNCERTAIN
    val model=when(kind) {
        GlanceField.PACING -> {
            val zone=s.pacingZones.firstOrNull { s.progressMeters>=it.startDistanceMeters && s.progressMeters<it.endDistanceMeters }
                ?: s.pacingZones.lastOrNull()?.takeIf { s.progressMeters==s.totalDistanceMeters }
            val target=s.recommendation?.targetPowerWatts?.takeIf { it>0 } ?: zone?.targetPowerWatts?.takeIf { it>0 }
            val word=effortWord(zone?.effort)
            val actual=s.rollingPowerWatts3s?.let { "YOU $it W" } ?: "WAITING FOR POWER"
            GlancePresentation("PACING",if(target==null) "NO PLAN" else word,if(target==null) "NO PLAN" else word,
                "TARGET",target?.toString() ?: "--","W",
                if(target==null) "WAITING FOR PLAN" else actual+(s.powerDeltaWatts?.let { "  ·  ${signed(it.toDouble())} W" } ?: ""),
                if(target==null) "WAITING" else actual,if(target==null) GlanceTone.NEUTRAL else effortTone(zone?.effort))
        }
        GlanceField.PERFORMANCE -> {
            val goal=s.plannedFinishSeconds?.takeIf { it>0 }
            val finish=(s.replanEstimate?.estimatedFinishSeconds ?: s.predictedFinishSeconds?.toDouble())?.takeIf { it.isFinite() && it>=0 }
            val gap=if(goal!=null && finish!=null) goal-finish else null
            val limited=s.replanEstimate?.constraintConflict==true
            val tone=when { gap==null -> GlanceTone.NEUTRAL; limited -> GlanceTone.CAUTION; abs(gap)<=GlanceThresholds.ON_GOAL_SECONDS -> GlanceTone.ON; gap>0 -> GlanceTone.EASE;else -> GlanceTone.MORE }
            val verdict=when { goal==null -> "NO GOAL";finish==null -> "WAITING";limited -> "REPLAN LIMITED";abs(gap!!)<=GlanceThresholds.ON_GOAL_SECONDS -> "ON GOAL";gap>0 -> "AHEAD";else -> "BEHIND" }
            GlancePresentation("PERFORMANCE",verdict,if(limited) "LIMITED" else verdict,if(limited) "BEST EST" else "VS GOAL",
                if(limited) glanceClock(finish) else gap?.let { signed(it) } ?: "--",if(limited) "" else "SEC",
                if(goal==null) "WAITING FOR GOAL" else if(finish==null) "WAITING FOR PACE" else if(limited) "EST · GOAL ${glanceClock(goal.toDouble())}" else "FINISH ${glanceClock(finish)} · GOAL ${glanceClock(goal.toDouble())}",
                if(goal==null) "WAITING" else if(limited) "GOAL ${glanceClock(goal.toDouble())}" else "FINISH ${glanceClock(finish)}",tone,
                "DONE" to "${(s.progressFraction*100).roundToInt()}%",
                "LAST ¼" to (s.segmentSplitDeltasSeconds.lastOrNull()?.let { signed(it.toDouble())+" s" } ?: "--"))
        }
        GlanceField.DRIFT -> {
            val mode=s.cardiacPresentationMode
            val drift=s.cardiacDriftPct?.takeIf { it.isFinite() }
            val forming=mode==CardiacPresentationMode.EMERGING_DRIFT
            val visible=mode==CardiacPresentationMode.CARDIAC_DRIFT || forming
            val tone=when { !visible || drift==null -> GlanceTone.NEUTRAL;forming -> GlanceTone.CAUTION;abs(drift)<3 -> GlanceTone.ON;abs(drift)<5 -> GlanceTone.CAUTION;else -> GlanceTone.WARN }
            val verdict=when { mode==CardiacPresentationMode.WAITING_FOR_HR -> "NO HR";!visible || drift==null -> "BASELINE";forming -> "DRIFT FORMING";abs(drift)<3 -> "STABLE";abs(drift)<5 -> "DRIFTING";else -> "HIGH" }
            val support=when { !visible -> "COLLECTING BASELINE";forming -> "EARLY TREND";s.cardiacDriftPowerSteady -> "POWER STEADY";else -> "POWER VARYING" }
            val cost=s.cardiacEfficiencyWattsPerBpm?.takeIf { it.isFinite() && it>0 }?.let { (100/it).roundToInt().toString() } ?: "--"
            GlancePresentation("CARDIAC DRIFT",verdict,when(verdict) { "DRIFT FORMING" -> "FORMING";"DRIFTING" -> "DRIFT";else -> verdict },
                if(visible) "HR DRIFT" else "HR RESPONSE",if(visible) drift?.let { signed(it,1) } ?: "--" else s.currentHeartRateBpm?.toString() ?: "--",if(visible) "%" else "BPM",support,if(!visible) "COLLECTING" else if(s.cardiacDriftPowerSteady) "STEADY" else "VARYING",tone,
                "HR COST" to cost,"PAIRED" to "${s.cardiacDriftPairedPct}%")
        }
        GlanceField.BALANCE -> {
            val b=s.wPrime
            val now=b?.actualRemainingPct?.takeIf { it.isFinite() }
            val finish=b?.projectedFinishPct?.takeIf { it.isFinite() }
            val tone=when { now==null -> GlanceTone.NEUTRAL;now<GlanceThresholds.BALANCE_WARN_NOW_PCT || (finish!=null && finish<GlanceThresholds.BALANCE_WARN_FINISH_PCT) -> GlanceTone.WARN;finish==null -> GlanceTone.NEUTRAL;finish<GlanceThresholds.BALANCE_LOW_FINISH_PCT -> GlanceTone.CAUTION;else -> GlanceTone.ON }
            val verdict=when { now==null -> "NO DATA";tone==GlanceTone.WARN -> "EASE NOW";finish==null -> "NO ESTIMATE";tone==GlanceTone.CAUTION -> "LOW";else -> "ON PLAN" }
            fun pct(p:Float?)=p?.takeIf { it.isFinite() }?.roundToInt()?.let { "$it%" } ?: "--"
            GlancePresentation("POWER BALANCE",verdict,when(verdict) {"ON PLAN" -> "OK";"EASE NOW" -> "EASE";"NO ESTIMATE" -> "NO EST";else -> verdict},
                if(b?.estimated!=false) "W' LEFT · EST" else "W' LEFT",now?.roundToInt()?.toString() ?: "--","%",
                if(now==null) "WAITING FOR POWER" else "PLAN ${pct(b?.plannedRemainingPct)} · FINISH ${pct(finish)}",
                if(now==null) "WAITING" else "FINISH ${pct(finish)}",tone,"PLAN" to pct(b?.plannedRemainingPct),"FINISH" to pct(finish))
        }
    }
    if(!active || model.verdict in listOf("NO PLAN","NO GOAL")) return model
    val missing=when {
        !s.sensorStatus.power && kind!=GlanceField.PERFORMANCE -> "NO POWER"
        !s.sensorStatus.gps && kind in listOf(GlanceField.PACING,GlanceField.PERFORMANCE) -> "NO GPS"
        !s.sensorStatus.heartRate && kind==GlanceField.DRIFT -> "NO HR"
        else -> null
    } ?: return model
    return model.copy(verdict=missing,shortVerdict=if(missing=="NO POWER") "NO PWR" else missing,tone=GlanceTone.WARN,
        support=when(missing) {"NO POWER" -> "POWER METER NOT FOUND";"NO GPS" -> "WAITING FOR GPS";else -> "HEART RATE NOT FOUND"},
        shortSupport=when(missing) {"NO POWER" -> "NO METER";"NO GPS" -> "NO GPS";else -> "NO HR"},signalMissing=true)
}

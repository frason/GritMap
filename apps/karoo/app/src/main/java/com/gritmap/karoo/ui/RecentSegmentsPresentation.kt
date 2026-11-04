package com.gritmap.karoo.ui

import com.gritmap.karoo.data.RecentSegmentResult
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.math.roundToLong

internal data class RecentResultPresentation(
    val name: String, val time: String, val goal: String, val comparison: String,
    val power: String, val heartRate: String, val age: String, val tone: GlanceTone,
)

internal fun resultClock(seconds: Double): String {
    if (!seconds.isFinite() || seconds < 0 || seconds > Long.MAX_VALUE / 2.0) return "—"
    val t=seconds.roundToLong()
    return if(t>=3600) String.format(Locale.US,"%d:%02d:%02d",t/3600,t/60%60,t%60)
        else String.format(Locale.US,"%d:%02d",t/60,t%60)
}

internal fun recentResultPresentation(result: RecentSegmentResult, nowMs: Long): RecentResultPresentation {
    val time=result.durationSeconds.takeIf{it.isFinite() && it>0}?.let{(if(result.approximate) "~" else "")+resultClock(it)} ?: "—"
    val goal=result.goalSeconds?.takeIf{it>0}
    val gap=if(time!="—" && goal!=null && !result.approximate) result.durationSeconds.roundToLong()-goal else null
    val comparison=when { goal==null -> "NO GOAL";gap==null -> "APPROXIMATE TIME";gap==0L -> "ON GOAL";gap<0 -> "AHEAD "+resultClock(abs(gap).toDouble());else -> "BEHIND "+resultClock(gap.toDouble()) }
    val tone=when {gap==null -> GlanceTone.NEUTRAL;gap==0L -> GlanceTone.ON;gap<0 -> GlanceTone.EASE;else -> GlanceTone.MORE}
    val elapsed=nowMs-result.completedAtMs
    val age=when {elapsed<0 -> "SAVED";elapsed<60_000 -> "JUST NOW";elapsed<3_600_000 -> "${elapsed/60_000} MIN AGO";elapsed<86_400_000 -> "${elapsed/3_600_000} H AGO";else -> "${elapsed/86_400_000} D AGO"}
    return RecentResultPresentation(result.segmentName,time,goal?.let{resultClock(it.toDouble())} ?: "—",comparison,
        result.averagePowerWatts?.takeIf{it.isFinite() && it>=0 && it<=10000}?.roundToInt()?.let{"$it W"} ?: "—",
        result.averageHeartRateBpm?.takeIf{it.isFinite() && it>0 && it<=300}?.roundToInt()?.toString() ?: "—",age,tone)
}

internal fun recentRowsForSize(width:Int,height:Int):Int = when {
    width<200 || height<110 -> 0
    height>=540 && width>=400 -> 3
    height>=540 -> 2
    else -> 1
}

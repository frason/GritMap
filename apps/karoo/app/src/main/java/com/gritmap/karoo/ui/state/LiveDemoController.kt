package com.gritmap.karoo.ui.state

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/** Process-local, non-persistent data-field simulator for physical Karoo UI testing. */
object LiveDemoController {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val mutableRunning = MutableStateFlow(false)
    val running: StateFlow<Boolean> = mutableRunning.asStateFlow()
    private var job: Job? = null

    @Synchronized
    fun start() {
        if (job?.isActive == true) return
        mutableRunning.value = true
        job = scope.launch {
            var tick = 0
            while (true) {
                LiveUiStore.publish(demoPlanState(tick))
                delay(1_000L)
                tick = (tick + 1) % DEMO_CYCLE_TICKS
            }
        }
    }

    @Synchronized
    fun stop(clear: Boolean = true) {
        job?.cancel()
        job = null
        mutableRunning.value = false
        if (clear) LiveUiStore.clear()
    }

    val isRunning: Boolean get() = mutableRunning.value
}

internal fun demoPlanState(tick: Int): LiveUiState {
    val safeTick = tick.coerceAtLeast(0) % DEMO_CYCLE_TICKS
    val activeTick = safeTick.coerceAtMost(DEMO_COMPLETION_TICK)
    val progressFraction = activeTick.toDouble() / DEMO_COMPLETION_TICK
    val progress = progressFraction * DEMO_DISTANCE_METERS
    val zones = demoPacingZones(DEMO_DISTANCE_METERS)
    val zone = zones.firstOrNull {
        progress >= it.startDistanceMeters && progress < it.endDistanceMeters
    } ?: zones.last()
    val powerOffsets = intArrayOf(-32, -18, -6, 4, 13, 27, 8, -9)
    val rollingPower = (zone.targetPowerWatts + powerOffsets[safeTick % powerOffsets.size])
        .coerceAtLeast(0)
    val plannedReservePct = (100.0 - progressFraction * 62.0).toFloat().coerceIn(10f, 100f)
    val actualReservePct = (plannedReservePct - powerOffsets[safeTick % powerOffsets.size] * 0.45f)
        .coerceIn(4f, 100f)
    val heartRate = (128 + progressFraction * 38).roundToInt()
    val driftHistory = (0..activeTick).map { point ->
        val pointProgress = point.toFloat() / DEMO_COMPLETION_TICK
        val pointDrift = -0.5 + pointProgress * 7.0
        CardiacDriftSample(
            pointProgress,
            pointDrift,
            180 + point * 45,
            100.0 + kotlin.math.sin(point.toDouble()) * 0.2,
            100.0 + pointDrift,
        )
    }
    val executionHistory = (0..activeTick).map { point ->
        val pointProgress = point.toDouble() / DEMO_COMPLETION_TICK
        val pointDistance = pointProgress * DEMO_DISTANCE_METERS
        val pointZone = zones.firstOrNull {
            pointDistance >= it.startDistanceMeters && pointDistance < it.endDistanceMeters
        } ?: zones.last()
        PowerExecutionSample(
            distanceMeters = pointDistance,
            actualWatts = (pointZone.targetPowerWatts + powerOffsets[point % powerOffsets.size])
                .coerceAtLeast(0),
            targetWatts = pointZone.targetPowerWatts,
        )
    }
    val instruction = when (zone.effort) {
        Effort.RECOVER -> "Settle and breathe"
        Effort.HOLD -> "Hold steady"
        Effort.PUSH -> "Push to the summit"
    }
    val targetGapMeters = when (safeTick) {
        in 0..6 -> doubleArrayOf(8.0, 5.0, 2.0, 0.0, -2.0, -5.0, -8.0)[safeTick]
        in 7..13 -> 120.0 - (safeTick - 7) * 4.0
        in 14..20 -> doubleArrayOf(8.0, 5.0, 2.0, 0.0, -2.0, -5.0, -8.0)[safeTick - 14]
        in 21..27 -> -120.0 + (safeTick - 21) * 4.0
        else -> 0.0
    }
    return LiveUiState(
        segmentName = "GM Demo Climb",
        progressMeters = progress,
        totalDistanceMeters = DEMO_DISTANCE_METERS,
        routeProfile = DEMO_ROUTE_PROFILE,
        elevationProfile = DEMO_ELEVATION_PROFILE,
        pacingZones = zones,
        recommendation = Recommendation(
            zone.targetPowerWatts,
            instruction,
            GuidanceIcon.valueOf(zone.effort.name),
        ),
        currentPowerWatts = rollingPower,
        rollingPowerWatts3s = rollingPower,
        currentHeartRateBpm = heartRate,
        powerExecutionHistory = executionHistory,
        wPrime = demoWPrime(
            progressFraction = progressFraction,
            actualReservePct = actualReservePct,
            plannedReservePct = plannedReservePct,
            actualPowerWatts = rollingPower.toDouble(),
            plannedPowerWatts = zone.targetPowerWatts.toDouble(),
        ),
        cardiacDriftPct = driftHistory.last().driftPct,
        cardiacDriftHistory = driftHistory,
        cardiacEfficiencyWattsPerBpm = rollingPower.toDouble() / heartRate,
        cardiacDriftRatePctPer10Min = driftHistory.last().driftPct * 0.8,
        cardiacDriftValidSeconds = 180 + activeTick * 45,
        cardiacDriftPairedPct = 96,
        cardiacDriftPowerSteady = true,
        plannedFinishSeconds = 160,
        elapsedAttemptSeconds = 160.0 *
            ((progress + targetGapMeters) / DEMO_DISTANCE_METERS).coerceIn(0.0, 1.0),
        predictedFinishSeconds = 168 - (safeTick % 9),
        planAdherencePct = (82 + safeTick % 12).coerceAtMost(93),
        sensorStatus = SensorStatus(
            gps = true,
            power = true,
            heartRate = true,
            cadence = true,
            speed = true,
            elevation = true,
        ),
        matchStatus = if (safeTick >= DEMO_COMPLETION_TICK) MatchStatus.COMPLETE else MatchStatus.ACTIVE,
    )
}

/** Rich, contiguous preview plan used only by the physical-device and page-editor demos. */
internal fun demoPacingZones(totalDistanceMeters: Double): List<PacingZone> {
    require(totalDistanceMeters > 0.0)
    val plan = listOf(
        225 to Effort.RECOVER,
        235 to Effort.RECOVER,
        250 to Effort.HOLD,
        260 to Effort.HOLD,
        270 to Effort.HOLD,
        285 to Effort.PUSH,
        295 to Effort.PUSH,
        255 to Effort.HOLD,
        230 to Effort.RECOVER,
        245 to Effort.RECOVER,
        265 to Effort.HOLD,
        275 to Effort.HOLD,
        290 to Effort.PUSH,
        300 to Effort.PUSH,
        270 to Effort.HOLD,
        240 to Effort.RECOVER,
        260 to Effort.HOLD,
        280 to Effort.HOLD,
        300 to Effort.PUSH,
        315 to Effort.PUSH,
    )
    val zoneLength = totalDistanceMeters / plan.size
    return plan.mapIndexed { index, (watts, effort) ->
        PacingZone(
            startDistanceMeters = index * zoneLength,
            endDistanceMeters = if (index == plan.lastIndex) totalDistanceMeters else (index + 1) * zoneLength,
            targetPowerWatts = watts,
            effort = effort,
        )
    }
}

private fun demoWPrime(
    progressFraction: Double,
    actualReservePct: Float,
    plannedReservePct: Float,
    actualPowerWatts: Double,
    plannedPowerWatts: Double,
): WPrimeState {
    val capacityJoules = 20_000.0
    val criticalPowerWatts = 266.0
    val finishPlanPct = 18f
    val projectedFinishPct = (finishPlanPct + actualReservePct - plannedReservePct)
        .coerceIn(0f, 100f)
    val history = (0..20).map { index ->
        val fraction = (progressFraction * index / 20.0).toFloat()
        WPrimePoint(
            progressFraction = fraction,
            actualRemainingPct = 100f - (100f - actualReservePct) * index / 20f,
            plannedRemainingPct = 100f - (100f - plannedReservePct) * index / 20f,
        )
    }
    fun balanceRate(powerWatts: Double, reservePct: Float): Double =
        if (powerWatts > criticalPowerWatts) {
            -(powerWatts - criticalPowerWatts)
        } else {
            (capacityJoules - capacityJoules * reservePct / 100.0) / 546.0
        }
    return WPrimeState(
        capacityJoules = capacityJoules,
        actualBalanceJoules = capacityJoules * actualReservePct / 100.0,
        plannedBalanceJoules = capacityJoules * plannedReservePct / 100.0,
        plannedFinishBalanceJoules = capacityJoules * finishPlanPct / 100.0,
        projectedFinishBalanceJoules = capacityJoules * projectedFinishPct / 100.0,
        criticalPowerWatts = criticalPowerWatts,
        estimated = true,
        history = history,
        actualBalanceChangeJoulesPerSecond = balanceRate(actualPowerWatts, actualReservePct),
        plannedBalanceChangeJoulesPerSecond = balanceRate(plannedPowerWatts, plannedReservePct),
        flowAnimationPhase = ((progressFraction * 18.0) % 1.0).toFloat(),
    )
}

private const val DEMO_DISTANCE_METERS = 600.0
private const val DEMO_COMPLETION_TICK = 28
private const val DEMO_CYCLE_TICKS = 34
private val DEMO_ELEVATION_PROFILE = listOf(
    ElevationSample(0.0, 42.0),
    ElevationSample(75.0, 45.0),
    ElevationSample(150.0, 54.0),
    ElevationSample(225.0, 68.0),
    ElevationSample(300.0, 73.0),
    ElevationSample(375.0, 88.0),
    ElevationSample(450.0, 96.0),
    ElevationSample(525.0, 112.0),
    ElevationSample(600.0, 126.0),
)
private val DEMO_ROUTE_PROFILE = listOf(
    RouteSample(0.0, 37.88000, -121.93000),
    RouteSample(75.0, 37.88045, -121.92955),
    RouteSample(150.0, 37.88105, -121.92970),
    RouteSample(225.0, 37.88155, -121.92915),
    RouteSample(300.0, 37.88215, -121.92895),
    RouteSample(375.0, 37.88265, -121.92935),
    RouteSample(450.0, 37.88325, -121.92905),
    RouteSample(525.0, 37.88385, -121.92855),
    RouteSample(600.0, 37.88445, -121.92875),
)

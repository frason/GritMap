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
    val zones = listOf(
        PacingZone(0.0, 180.0, 225, Effort.RECOVER),
        PacingZone(180.0, 430.0, 260, Effort.HOLD),
        PacingZone(430.0, DEMO_DISTANCE_METERS, 295, Effort.PUSH),
    )
    val zone = zones.firstOrNull {
        progress >= it.startDistanceMeters && progress < it.endDistanceMeters
    } ?: zones.last()
    val powerOffsets = intArrayOf(-32, -18, -6, 4, 13, 27, 8, -9)
    val rollingPower = (zone.targetPowerWatts + powerOffsets[safeTick % powerOffsets.size])
        .coerceAtLeast(0)
    val heartRate = (128 + progressFraction * 38).roundToInt()
    val driftHistory = (0..activeTick).map { point ->
        val pointProgress = point.toFloat() / DEMO_COMPLETION_TICK
        CardiacDriftSample(pointProgress, -0.5 + pointProgress * 7.0)
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
        cardiacDriftPct = driftHistory.last().driftPct,
        cardiacDriftHistory = driftHistory,
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

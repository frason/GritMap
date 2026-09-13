package com.gritmap.karoo.karoo

import com.gritmap.karoo.ui.state.Effort
import com.gritmap.karoo.ui.state.CardiacDriftSample
import com.gritmap.karoo.ui.state.ElevationSample
import com.gritmap.karoo.ui.state.GuidanceIcon
import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.MatchStatus
import com.gritmap.karoo.ui.state.PacingZone
import com.gritmap.karoo.ui.state.PowerExecutionSample
import com.gritmap.karoo.ui.state.WPrimePoint
import com.gritmap.karoo.ui.state.WPrimeState
import com.gritmap.karoo.ui.state.Recommendation
import com.gritmap.karoo.ui.state.SensorStatus
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlin.math.roundToInt

/** Representative data shown by Karoo while a rider edits a data page. */
internal val KarooPreviewState = LiveUiState(
    segmentName = "Coco Jumbo",
    progressMeters = 215.0,
    totalDistanceMeters = 533.0,
    elevationProfile = listOf(
        ElevationSample(0.0, 42.0),
        ElevationSample(70.0, 45.0),
        ElevationSample(145.0, 54.0),
        ElevationSample(215.0, 66.0),
        ElevationSample(300.0, 72.0),
        ElevationSample(390.0, 88.0),
        ElevationSample(470.0, 94.0),
        ElevationSample(533.0, 101.0),
    ),
    pacingZones = listOf(
        PacingZone(0.0, 145.0, 225, Effort.RECOVER),
        PacingZone(145.0, 390.0, 260, Effort.HOLD),
        PacingZone(390.0, 533.0, 295, Effort.PUSH),
    ),
    recommendation = Recommendation(260, "Hold steady", GuidanceIcon.HOLD),
    currentPowerWatts = 247,
    rollingPowerWatts3s = 247,
    currentHeartRateBpm = 142,
    wPrime = previewWPrime(215.0 / 533.0, 68f, 76f, 310.0, 295.0),
    cardiacDriftPct = 3.8,
    cardiacDriftHistory = listOf(
        CardiacDriftSample(0.0f, 0.0),
        CardiacDriftSample(0.2f, 0.8),
        CardiacDriftSample(0.4f, 1.7),
        CardiacDriftSample(0.6f, 2.5),
        CardiacDriftSample(0.8f, 3.2),
        CardiacDriftSample(1.0f, 3.8),
    ),
    plannedFinishSeconds = 160,
    predictedFinishSeconds = 168,
    elapsedAttemptSeconds = 68.0,
    planAdherencePct = 91,
    sensorStatus = SensorStatus(
        gps = true,
        power = true,
        heartRate = true,
        cadence = true,
        speed = true,
        elevation = true,
    ),
    matchStatus = MatchStatus.ACTIVE,
)

private const val PREVIEW_STEP_COUNT = 24
private const val PREVIEW_INTERVAL_MS = 1_000L

/** A deterministic looping ride used by Karoo's page editor for every GritMap data field. */
internal fun karooPreviewFlow(): Flow<LiveUiState> = flow {
    var step = 0
    while (true) {
        emit(karooPreviewStateAt(step))
        step = (step + 1) % PREVIEW_STEP_COUNT
        delay(PREVIEW_INTERVAL_MS)
    }
}

internal fun karooPreviewStateAt(step: Int): LiveUiState {
    val normalizedStep = Math.floorMod(step, PREVIEW_STEP_COUNT)
    // Advance at a steady physical rate so adaptive viewport zoom is visible as faster/slower
    // tick motion rather than being confused with changing simulated rider speed.
    val progressFraction = 0.15 + normalizedStep * (0.77 / (PREVIEW_STEP_COUNT - 1))
    val progressMeters = KarooPreviewState.totalDistanceMeters * progressFraction
    val zone = KarooPreviewState.pacingZones.first {
        progressMeters >= it.startDistanceMeters && progressMeters <= it.endDistanceMeters
    }
    val instruction = when (zone.effort) {
        Effort.RECOVER -> "Settle in"
        Effort.HOLD -> "Hold steady"
        Effort.PUSH -> "Push now"
    }
    val icon = when (zone.effort) {
        Effort.RECOVER -> GuidanceIcon.RECOVER
        Effort.HOLD -> GuidanceIcon.HOLD
        Effort.PUSH -> GuidanceIcon.PUSH
    }
    val powerOffsets = intArrayOf(-22, -12, -4, 3, 9, 16, 7, -6, -14, -2, 8, 14)
    val signalStep = normalizedStep % powerOffsets.size
    // Four visible phases: near target (tight/fast ticks), target far ahead (wide/slow), near
    // again, then rider far ahead. Each phase lasts six seconds in Karoo's 1 Hz preview.
    val targetGapMeters = doubleArrayOf(
        6.0, 4.0, 2.0, 0.0, -2.0, -4.0,
        120.0, 115.0, 110.0, 105.0, 100.0, 95.0,
        8.0, 5.0, 2.0, 0.0, -3.0, -6.0,
        -120.0, -115.0, -110.0, -105.0, -100.0, -95.0,
    )[normalizedStep]
    val actualPower = zone.targetPowerWatts + powerOffsets[signalStep]
    val heartRate = 126 + (progressFraction * 38).roundToInt()
    val driftValues = doubleArrayOf(-2.4, -1.8, -1.1, -0.4, 0.2, 0.9, 1.6, 2.4, 3.1, 3.8, 4.5, 5.2)
    val drift = driftValues[signalStep]
    val driftHistory = (0..normalizedStep).map { historyStep ->
        val historyProgress = 0.15 + historyStep * (0.77 / (PREVIEW_STEP_COUNT - 1))
        CardiacDriftSample(historyProgress.toFloat(), driftValues[historyStep % driftValues.size])
    }
    val executionHistory = (0..normalizedStep).map { historyStep ->
        val historyProgress = 0.15 + historyStep * (0.77 / (PREVIEW_STEP_COUNT - 1))
        val distance = KarooPreviewState.totalDistanceMeters * historyProgress
        val historyZone = KarooPreviewState.pacingZones.first {
            distance >= it.startDistanceMeters && distance <= it.endDistanceMeters
        }
        PowerExecutionSample(
            distanceMeters = distance,
            actualWatts = historyZone.targetPowerWatts + powerOffsets[historyStep % powerOffsets.size],
            targetWatts = historyZone.targetPowerWatts,
        )
    }
    val plannedReservePct = (100.0 - progressFraction * 62.0).toFloat().coerceIn(10f, 100f)
    val actualReservePct = (plannedReservePct - powerOffsets[signalStep] * 0.45f)
        .coerceIn(4f, 100f)

    return KarooPreviewState.copy(
        progressMeters = progressMeters,
        recommendation = Recommendation(zone.targetPowerWatts, instruction, icon),
        currentPowerWatts = actualPower,
        rollingPowerWatts3s = actualPower,
        currentHeartRateBpm = heartRate,
        powerExecutionHistory = executionHistory,
        wPrime = previewWPrime(
            progressFraction,
            actualReservePct,
            plannedReservePct,
            actualPower.toDouble(),
            zone.targetPowerWatts.toDouble(),
        ),
        cardiacDriftPct = drift,
        cardiacDriftHistory = driftHistory,
        predictedFinishSeconds = 164 + powerOffsets[signalStep] / -2,
        elapsedAttemptSeconds = KarooPreviewState.plannedFinishSeconds!! *
            ((progressMeters + targetGapMeters) / KarooPreviewState.totalDistanceMeters)
                .coerceIn(0.0, 1.0),
        planAdherencePct = (96 - kotlin.math.abs(powerOffsets[signalStep]) / 2).coerceIn(75, 99),
    )
}

internal fun stateForKarooView(liveState: LiveUiState, preview: Boolean): LiveUiState =
    if (preview) KarooPreviewState else liveState

private fun previewWPrime(
    progressFraction: Double,
    actualPct: Float,
    plannedPct: Float,
    actualPowerWatts: Double,
    plannedPowerWatts: Double,
): WPrimeState {
    val capacity = 20_000.0
    val samples = (0..20).map { index ->
        val fraction = (progressFraction * index / 20.0).toFloat()
        WPrimePoint(
            progressFraction = fraction,
            actualRemainingPct = 100f - (100f - actualPct) * index / 20f,
            plannedRemainingPct = 100f - (100f - plannedPct) * index / 20f,
        )
    }
    val finishPlanPct = 18f
    val projectedPct = (finishPlanPct + actualPct - plannedPct).coerceIn(0f, 100f)
    return WPrimeState(
        capacityJoules = capacity,
        actualBalanceJoules = capacity * actualPct / 100.0,
        plannedBalanceJoules = capacity * plannedPct / 100.0,
        plannedFinishBalanceJoules = capacity * finishPlanPct / 100.0,
        projectedFinishBalanceJoules = capacity * projectedPct / 100.0,
        criticalPowerWatts = 270.75,
        estimated = true,
        history = samples,
        actualBalanceChangeJoulesPerSecond = previewBalanceRate(
            actualPowerWatts,
            actualPct,
            capacity,
        ),
        plannedBalanceChangeJoulesPerSecond = previewBalanceRate(
            plannedPowerWatts,
            plannedPct,
            capacity,
        ),
        flowAnimationPhase = ((progressFraction * 18.0) % 1.0).toFloat(),
    )
}

private fun previewBalanceRate(powerWatts: Double, reservePct: Float, capacity: Double): Double {
    val cp = 270.75
    return if (powerWatts > cp) {
        -(powerWatts - cp)
    } else {
        (capacity - capacity * reservePct / 100.0) / 546.0
    }
}

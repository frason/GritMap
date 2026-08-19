package com.gritmap.karoo.karoo

import com.gritmap.karoo.ui.state.Effort
import com.gritmap.karoo.ui.state.ElevationSample
import com.gritmap.karoo.ui.state.GuidanceIcon
import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.MatchStatus
import com.gritmap.karoo.ui.state.PacingZone
import com.gritmap.karoo.ui.state.Recommendation
import com.gritmap.karoo.ui.state.SensorStatus

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
    plannedFinishSeconds = 160,
    predictedFinishSeconds = 168,
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

internal fun stateForKarooView(liveState: LiveUiState, preview: Boolean): LiveUiState =
    if (preview) KarooPreviewState else liveState

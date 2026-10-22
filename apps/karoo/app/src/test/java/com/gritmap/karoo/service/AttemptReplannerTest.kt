package com.gritmap.karoo.service

import com.gritmap.karoo.importing.ReplanMetadata
import com.gritmap.karoo.pacing.ReplanParameters
import com.gritmap.karoo.ui.state.*
import org.junit.Assert.*
import org.junit.Test

class AttemptReplannerTest {
    private val zones = (0..3).map { PacingZone(it * 402.336,(it+1) * 402.336,250,Effort.HOLD) }
    private val meta = ReplanMetadata(ReplanParameters(criticalPowerWatts=250.0,wPrimeJoules=20000.0,
        wPrimeReserveFraction=.15,maxStepWatts=20,hardMaxStepWatts=80,stepLimitMinGradePct=1.5),listOf(270,270,270,270))
    private fun state(distance: Double) = LiveUiState(progressMeters=distance,totalDistanceMeters=1609.344,
        plannedFinishSeconds=800,pacingZones=zones,recommendation=Recommendation(250,"Hold",GuidanceIcon.HOLD),
        replanMetadata=meta,hasCompleteElevationProfile=true,
        elevationProfile=listOf(ElevationSample(0.0,0.0),ElevationSample(1609.344,80.4672)),
        sensorStatus=SensorStatus(gps=true,power=true),matchStatus=MatchStatus.ACTIVE)
    private fun tick(t: Long) = LiveTelemetry(t,powerWatts=230.0)

    @Test fun `disabled is identical and boundary targets persist across reconstructed state`() {
        val disabled = AttemptReplanner(false)
        assertEquals(state(403.0),disabled.apply(state(403.0),tick(220000),220.0))
        val engine = AttemptReplanner(true)
        engine.apply(state(398.0),tick(217000),217.0)
        val result = engine.apply(state(403.0),tick(220000),220.0)
        assertTrue(result.replanEstimate!!.changed)
        val next = engine.apply(state(405.0),tick(221000),221.0)
        assertEquals(result.pacingZones,next.pacingZones)
        assertNotEquals(result.replanEstimate!!.estimatedFinishSeconds,next.replanEstimate!!.estimatedFinishSeconds)
        assertEquals(800,next.plannedFinishSeconds)
        assertEquals(250,zones[1].targetPowerWatts) // imported source untouched
    }
    @Test fun `uncertain matching and long GPS gap do not trigger a catch up`() {
        val engine = AttemptReplanner(true)
        engine.apply(state(398.0),tick(210000),210.0)
        assertNull(engine.apply(state(405.0),tick(220000),220.0).replanEstimate)
        val uncertain = AttemptReplanner(true)
        uncertain.apply(state(398.0),tick(217000),217.0)
        assertNull(uncertain.apply(state(405.0).copy(matchStatus=MatchStatus.UNCERTAIN),tick(220000),220.0).replanEstimate)
    }
    @Test fun `legacy plans and missing elevation never acquire invented headroom`() {
        val legacy = AttemptReplanner(true)
        legacy.apply(state(398.0).copy(replanMetadata=null),tick(217000),217.0)
        val result=legacy.apply(state(405.0).copy(replanMetadata=null),tick(220000),220.0)
        assertEquals(zones,result.pacingZones)
        val missing = AttemptReplanner(true)
        missing.apply(state(398.0).copy(hasCompleteElevationProfile=false),tick(217000),217.0)
        assertEquals(zones,missing.apply(state(405.0).copy(hasCompleteElevationProfile=false),tick(220000),220.0).pacingZones)
    }
    @Test fun `completed adjusted targets freeze at next boundary`() {
        val engine=AttemptReplanner(true)
        engine.apply(state(398.0),tick(217000),217.0)
        val a=engine.apply(state(403.0),tick(220000),220.0)
        engine.apply(state(800.0),tick(417000),417.0)
        val b=engine.apply(state(807.0),tick(420000),420.0)
        assertEquals(a.pacingZones.take(2),b.pacingZones.take(2))
    }
}

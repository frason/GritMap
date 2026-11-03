package com.gritmap.karoo.pacing

import com.gritmap.karoo.service.LiveTelemetry
import com.gritmap.karoo.ui.state.CardiacReadiness
import org.junit.Assert.*
import org.junit.Test

class CardiacBaselineTest {
    private fun sample(ms: Long, power: Double? = 200.0, hr: Double? = 140.0) =
        LiveTelemetry(timestampMs=ms, powerWatts=power, heartRateBpm=hr)

    @Test fun `countdown rounds up and freezes on ineligible input without counting interruption`() {
        val t=CardiacDriftTracker()
        assertEquals(180,t.add(sample(0),0f).baselineState.remainingSeconds)
        assertEquals(180,t.add(sample(999),0f).baselineState.remainingSeconds)
        assertEquals(179,t.add(sample(1000),0f).baselineState.remainingSeconds)
        val coast=t.add(sample(2000,0.0),0f)
        assertEquals(179,coast.baselineState.remainingSeconds)
        assertEquals(CardiacReadiness.LOW_POWER,coast.baselineState.readiness)
        assertEquals(179,t.add(sample(3000),0f).baselineState.remainingSeconds)
        assertEquals(178,t.add(sample(4000),0f).baselineState.remainingSeconds)
    }

    @Test fun `continuous ineligible episode announces one reset and notice expires`() {
        val t=CardiacDriftTracker()
        for(s in 0..120)t.add(sample(s*1000L),0f)
        for(s in 121..131)t.add(sample(s*1000L,0.0),0f)
        val reset=t.add(sample(132000,0.0),0f).baselineState
        assertEquals(180,reset.remainingSeconds);assertEquals(1,reset.restartCount)
        assertTrue(reset.justRestarted);assertFalse(reset.established)
        for(s in 133..145)assertEquals(1,t.add(sample(s*1000L,0.0),0f).baselineState.restartCount)
        val resumed=t.add(sample(146000),0f).baselineState
        assertFalse(resumed.justRestarted);assertEquals(180,resumed.remainingSeconds)
    }

    @Test fun `time at zero never claims ready before power steadiness qualifies`() {
        val t=CardiacDriftTracker();var last=t.add(sample(0),0f)
        for(s in 1..1200)last=t.add(sample(s*1000L,if(s%2==0)150.0 else 250.0),0f)
        assertEquals(0,last.baselineState.remainingSeconds)
        assertFalse(last.baselineState.established)
        assertEquals(CardiacReadiness.VARIABLE_POWER,last.baselineState.readiness)
        assertNull(last.driftPct)
    }

    @Test fun `ready transition and mature display preserve the original qualified baseline`() {
        val t=CardiacDriftTracker()
        for(s in 0 until 180)assertFalse(t.add(sample(s*1000L),0f).baselineState.established)
        val ready=t.add(sample(180000),0f)
        assertEquals(0,ready.baselineState.remainingSeconds)
        assertTrue(ready.baselineState.established);assertTrue(ready.baselineState.justEstablished)
        assertEquals(CardiacReadiness.READY,ready.baselineState.readiness)
        assertEquals(0.0,ready.driftPct!!,0.0)
        for(s in 181..185)t.add(sample(s*1000L),0f)
        assertFalse(t.add(sample(186000),0f).baselineState.justEstablished)
    }

    @Test fun `established reference with different workload never returns to countdown`() {
        val t=CardiacDriftTracker();var last=t.add(sample(0),0f)
        for(s in 1..840)last=t.add(sample(s*1000L,if(s<=240)200.0 else 300.0),0f)
        assertTrue(last.baselineState.established);assertEquals(0,last.baselineState.remainingSeconds)
        assertEquals(CardiacReadiness.DIFFERENT_EFFORT,last.baselineState.readiness)
        assertNull(last.driftPct);assertTrue(last.powerSteady)
    }

    @Test fun `missing and low signals are distinguished from collecting`() {
        val cases=listOf(Triple(null,140.0,CardiacReadiness.NO_POWER),Triple(200.0,null,CardiacReadiness.NO_HR),
            Triple(99.0,140.0,CardiacReadiness.LOW_POWER),Triple(200.0,79.0,CardiacReadiness.LOW_HR),
            Triple(Double.NaN,140.0,CardiacReadiness.NO_POWER))
        for((p,h,want)in cases)assertEquals(want,CardiacDriftTracker().add(sample(0,p,h),0f).baselineState.readiness)
    }

    @Test fun `strict gap boundary and ignored backwards samples keep reset semantics`() {
        val t=CardiacDriftTracker()
        for(s in 0..180)t.add(sample(s*1000L),0f)
        assertEquals(0,t.add(sample(190000),0f).baselineState.restartCount)
        val ignored=t.add(sample(189000),0f)
        assertEquals(0,ignored.baselineState.restartCount);assertEquals(182,ignored.validSeconds)
        val reset=t.add(sample(200001),0f).baselineState
        assertEquals(1,reset.restartCount);assertTrue(reset.justRestarted);assertEquals(180,reset.remainingSeconds)
    }
}

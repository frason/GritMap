package com.gritmap.karoo.ui.state

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LiveDemoControllerTest {
    @Test
    fun `demo progresses through plan zones with complete field data`() {
        val recover = demoPlanState(1)
        val hold = demoPlanState(12)
        val push = demoPlanState(24)

        assertEquals(GuidanceIcon.RECOVER, recover.recommendation?.icon)
        assertEquals(GuidanceIcon.HOLD, hold.recommendation?.icon)
        assertEquals(GuidanceIcon.PUSH, push.recommendation?.icon)
        assertEquals(160, hold.plannedFinishSeconds)
        assertTrue(hold.predictedFinishSeconds != null)
        assertTrue(hold.rollingPowerWatts3s != null)
        assertTrue(hold.currentHeartRateBpm != null)
        assertTrue(hold.wattsPerHeartRate != null)
        assertTrue(hold.planAdherencePct != null)
    }

    @Test
    fun `demo reaches completion then loops to the start`() {
        val complete = demoPlanState(28)
        val restarted = demoPlanState(34)

        assertEquals(MatchStatus.COMPLETE, complete.matchStatus)
        assertEquals(1f, complete.progressFraction)
        assertEquals(MatchStatus.ACTIVE, restarted.matchStatus)
        assertEquals(0f, restarted.progressFraction)
    }
}

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
        assertEquals(13, hold.powerExecutionHistory.size)
        assertEquals(hold.progressMeters, hold.powerExecutionHistory.last().distanceMeters, 0.001)
        assertTrue(hold.powerExecutionHistory.all { it.actualWatts > 0 && it.targetWatts > 0 })
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

    @Test
    fun `demo exposes close and far virtual pacer phases`() {
        val close = demoPlanState(3)
        val farAhead = demoPlanState(7)
        val farBehind = demoPlanState(21)

        assertEquals(0.0, requireNotNull(close.targetProgressMeters) - close.progressMeters, 0.001)
        assertEquals(120.0, requireNotNull(farAhead.targetProgressMeters) - farAhead.progressMeters, 0.001)
        assertEquals(-120.0, requireNotNull(farBehind.targetProgressMeters) - farBehind.progressMeters, 0.001)
    }
}

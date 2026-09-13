package com.gritmap.karoo.karoo

import com.gritmap.karoo.ui.state.GuidanceIcon
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class KarooPreviewStateTest {
    @Test
    fun `preview advances progress sensors predictions and drift`() {
        val early = karooPreviewStateAt(0)
        val late = karooPreviewStateAt(10)

        assertTrue(late.progressMeters > early.progressMeters)
        assertNotEquals(late.rollingPowerWatts3s, early.rollingPowerWatts3s)
        assertTrue(requireNotNull(late.currentHeartRateBpm) > requireNotNull(early.currentHeartRateBpm))
        assertTrue(requireNotNull(early.cardiacDriftPct) < 0.0)
        assertTrue(requireNotNull(late.cardiacDriftPct) > 0.0)
        assertTrue(late.cardiacDriftHistory.size > early.cardiacDriftHistory.size)
        assertNotEquals(late.predictedFinishSeconds, early.predictedFinishSeconds)
    }

    @Test
    fun `preview traverses recover hold and push zones`() {
        assertEquals(GuidanceIcon.RECOVER, karooPreviewStateAt(0).recommendation?.icon)
        assertEquals(GuidanceIcon.HOLD, karooPreviewStateAt(5).recommendation?.icon)
        assertEquals(GuidanceIcon.PUSH, karooPreviewStateAt(23).recommendation?.icon)
    }

    @Test
    fun `preview loop wraps deterministically`() {
        assertEquals(karooPreviewStateAt(0), karooPreviewStateAt(24))
        assertEquals(karooPreviewStateAt(1), karooPreviewStateAt(25))
    }
}

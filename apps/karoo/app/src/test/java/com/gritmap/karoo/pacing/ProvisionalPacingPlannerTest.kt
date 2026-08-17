package com.gritmap.karoo.pacing

import org.junit.Assert.assertEquals
import org.junit.Test

class ProvisionalPacingPlannerTest {
    @Test fun createsOneFullLengthZoneAt95PercentFtp() {
        val plan = ProvisionalPacingPlanner.create(SegmentPacingInput(1234.0, 300))
        assertEquals(PacingPlan.Source.PROVISIONAL, plan.source)
        assertEquals(285, plan.zones.single().targetPowerWatts)
        assertEquals(1234.0, plan.zones.single().endDistanceMeters, 0.0)
    }
}

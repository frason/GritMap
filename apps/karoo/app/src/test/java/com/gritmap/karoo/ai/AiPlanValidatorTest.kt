package com.gritmap.karoo.ai

import com.gritmap.karoo.pacing.PacingClassification
import com.gritmap.karoo.pacing.PacingPlan
import com.gritmap.karoo.pacing.PacingZone
import com.gritmap.karoo.pacing.RecommendationIcon
import org.junit.Assert.assertTrue
import org.junit.Test

class AiPlanValidatorTest {
    private fun zone(start: Double, end: Double, watts: Int) = PacingZone(
        start, end, watts, PacingClassification.HOLD, RecommendationIcon.HOLD, "Hold steady",
    )

    @Test fun acceptsCompleteContiguousPlanAtFtpLimit() {
        val plan = PacingPlan(zones = listOf(zone(0.0, 500.0, 350), zone(500.0, 1000.0, 450)), source = PacingPlan.Source.NEEDLE)
        assertTrue(AiPlanValidator().validate(plan, 1000.0, 300).isSuccess)
    }

    @Test fun rejectsGapAndPowerAbove150PercentFtp() {
        val gap = PacingPlan(zones = listOf(zone(0.0, 400.0, 250), zone(401.0, 1000.0, 250)), source = PacingPlan.Source.NEEDLE)
        val unsafe = PacingPlan(zones = listOf(zone(0.0, 1000.0, 451)), source = PacingPlan.Source.NEEDLE)
        assertTrue(AiPlanValidator().validate(gap, 1000.0, 300).isFailure)
        assertTrue(AiPlanValidator().validate(unsafe, 1000.0, 300).isFailure)
    }

    @Test fun parsesOfficialCactusCompletionEnvelope() {
        val nested = "{\\\"schemaVersion\\\":1,\\\"zones\\\":[{\\\"startDistanceMeters\\\":0,\\\"endDistanceMeters\\\":100,\\\"targetPowerWatts\\\":250,\\\"classification\\\":\\\"hold\\\",\\\"icon\\\":\\\"hold\\\",\\\"instruction\\\":\\\"Steady\\\"}]}"
        val envelope = """{"success":true,"cloud_handoff":false,"response":"$nested"}"""
        val parsed = AiPacingResponseParser.parse(envelope)
        assertTrue(AiPlanValidator().validate(parsed, 100.0, 300).isSuccess)
    }
}

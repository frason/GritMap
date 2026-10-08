package com.gritmap.karoo.physiology

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RrObservationValidatorTest {
    @Test
    fun `preserves valid observations and flags hard acquisition failures`() {
        val validator = RrObservationValidator()

        val valid = validator.validate(elapsedMs = 1_000L, rrIntervalMs = 780)
        val rangeFailure = validator.validate(elapsedMs = 2_000L, rrIntervalMs = 100)
        val timeFailure = validator.validate(elapsedMs = 1_500L, rrIntervalMs = 790)
        val sourceFailure = validator.validate(elapsedMs = 3_000L, rrIntervalMs = 800, sourceValid = false)

        assertTrue(valid.valid)
        assertEquals(780, valid.rrIntervalMs)
        assertEquals(RrArtifactReason.INTERVAL_OUT_OF_RANGE, rangeFailure.artifactReason)
        assertEquals(RrArtifactReason.TIMESTAMP_OUT_OF_ORDER, timeFailure.artifactReason)
        assertEquals(RrArtifactReason.SOURCE_MARKED_INVALID, sourceFailure.artifactReason)
        assertFalse(sourceFailure.valid)
    }
}

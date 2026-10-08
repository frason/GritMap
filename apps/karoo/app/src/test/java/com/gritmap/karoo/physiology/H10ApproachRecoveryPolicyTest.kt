package com.gritmap.karoo.physiology

import com.gritmap.karoo.physiology.H10ApproachRecoveryPolicy.RetryDecision
import org.junit.Assert.assertEquals
import org.junit.Test

class H10ApproachRecoveryPolicyTest {
    @Test
    fun `uses bounded increasing retry delays then exhausts`() {
        val policy = H10ApproachRecoveryPolicy(listOf(2L, 5L, 10L))

        assertEquals(RetryDecision.Retry(1, 2L), policy.nextRetry())
        assertEquals(RetryDecision.Retry(2, 5L), policy.nextRetry())
        assertEquals(RetryDecision.Retry(3, 10L), policy.nextRetry())
        assertEquals(RetryDecision.Exhausted, policy.nextRetry())
        assertEquals(RetryDecision.Exhausted, policy.nextRetry())
    }

    @Test
    fun `successful connection restores complete retry budget`() {
        val policy = H10ApproachRecoveryPolicy(listOf(2L, 5L))
        policy.nextRetry()
        policy.nextRetry()

        policy.connected()

        assertEquals(RetryDecision.Retry(1, 2L), policy.nextRetry())
    }

    @Test
    fun `release restores retry budget for a later approach`() {
        val policy = H10ApproachRecoveryPolicy(listOf(2L))
        policy.nextRetry()
        assertEquals(RetryDecision.Exhausted, policy.nextRetry())

        policy.released()

        assertEquals(RetryDecision.Retry(1, 2L), policy.nextRetry())
    }
}

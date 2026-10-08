package com.gritmap.karoo.physiology

/**
 * Pure, deterministic retry budget for approach-time H10 preparation.
 *
 * The service owns the actual Android BLE calls. Keeping timing decisions here makes GATT failure
 * handling testable without a Bluetooth stack and prevents an endless reconnect loop on a ride.
 */
class H10ApproachRecoveryPolicy(
    private val retryDelaysMs: List<Long> = DEFAULT_RETRY_DELAYS_MS,
) {
    private var nextRetryIndex = 0

    val failures: Int get() = nextRetryIndex

    fun nextRetry(): RetryDecision {
        val delay = retryDelaysMs.getOrNull(nextRetryIndex) ?: return RetryDecision.Exhausted
        nextRetryIndex += 1
        return RetryDecision.Retry(attempt = nextRetryIndex, delayMs = delay)
    }

    fun connected() {
        nextRetryIndex = 0
    }

    fun released() {
        nextRetryIndex = 0
    }

    sealed interface RetryDecision {
        data class Retry(val attempt: Int, val delayMs: Long) : RetryDecision
        data object Exhausted : RetryDecision
    }

    companion object {
        val DEFAULT_RETRY_DELAYS_MS = listOf(2_000L, 5_000L, 10_000L)
    }
}

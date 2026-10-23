package com.gritmap.karoo.importing

import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout

/** Only transport failures may retry; protocol refusals, changed manifests and cancellation escape. */
internal fun isRecoverableGattStatus(status: Int): Boolean =
    // Invalid/stale handles or database, internal/busy/congested stack, timeout/failure.
    // ATT authorization (8) and value-not-allowed (19) are protocol refusals, not link loss.
    status in setOf(1, 18, 129, 132, 133, 143, 147, 257)

internal suspend fun <T> withDirectBleRecovery(
    reconnect: suspend () -> Unit,
    onRetry: (Int) -> Unit = {},
    operation: suspend () -> T,
): T {
    return try {
        operation()
    } catch (first: DirectBleDisconnectedException) {
        // Stay below the phone's 30-second inactivity window, including connection setup.
        withTimeout(20_000L) {
            var last = first
            repeat(3) { attempt ->
                onRetry(attempt + 1)
                try {
                    reconnect()
                    return@withTimeout operation()
                } catch (error: DirectBleDisconnectedException) {
                    last = error
                    if (attempt < 2) delay(250L)
                }
            }
            throw last
        }
    }
}

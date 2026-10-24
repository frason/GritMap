package com.gritmap.karoo.importing

import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull

/** Null means discovery expired; transfer failures/timeouts and caller cancellation propagate. */
internal suspend fun <Peer : Any, Result : Any> discoverThenTransfer(
    discoveryTimeoutMs: Long,
    transferTimeoutMs: Long,
    discover: suspend () -> Peer?,
    transfer: suspend (Peer) -> Result,
): Result? {
    require(discoveryTimeoutMs > 0 && transferTimeoutMs > 0)
    val peer = withTimeoutOrNull(discoveryTimeoutMs) {
        var found = discover()
        while (found == null) {
            delay(100L)
            found = discover()
        }
        found
    } ?: return null
    return withTimeout(transferTimeoutMs) { transfer(peer) }
}

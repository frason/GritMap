package com.gritmap.karoo.importing

import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withTimeout
import org.junit.Assert.*
import org.junit.Test

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class DirectBleReceiveWindowTest {
    @Test fun `late discovery leaves full separate transfer window`() = runTest {
        val result = discoverThenTransfer(120_000L, 600_000L,
            discover = { delay(110_000L); "phone" },
            transfer = { delay(180_000L); "imported" },
        )
        assertEquals("imported", result)
        assertEquals(290_000L, testScheduler.currentTime)
    }

    @Test fun `discovery expiry never starts transfer`() = runTest {
        var transfers = 0
        val result = discoverThenTransfer(120_000L, 600_000L,
            discover = { delay(15_000L); null as String? },
            transfer = { transfers++; "unexpected" },
        )
        assertNull(result)
        assertEquals(0, transfers)
        assertEquals(120_000L, testScheduler.currentTime)
    }

    @Test fun `connected transfer timeout is not reported as missing phone`() = runTest {
        val error = runCatching {
            discoverThenTransfer(120_000L, 600_000L,
                discover = { "phone" }, transfer = { delay(700_000L); "late" },
            )
        }.exceptionOrNull()
        assertTrue(error is TimeoutCancellationException)
        assertEquals(600_000L, testScheduler.currentTime)
    }

    @Test fun `caller cancellation during discovery propagates`() = runTest {
        val error = runCatching {
            withTimeout(1000L) {
                discoverThenTransfer(120_000L, 600_000L,
                    discover = { delay(15_000L); "phone" }, transfer = { "unexpected" },
                )
            }
        }.exceptionOrNull()
        assertTrue(error is TimeoutCancellationException)
        assertEquals(1000L, testScheduler.currentTime)
    }
}

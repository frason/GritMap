package com.gritmap.karoo.importing

import java.security.MessageDigest
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class DirectBleRecoveryTest {
    @Test fun `resume retains completed bytes and retries unfinished chunk after fresh connection`() = runTest {
        val bytes = "abcdefghijkl".encodeToByteArray()
        val hash = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        val offsets = mutableListOf<Int>()
        var dropped = false
        var reconnects = 0
        val result = readDirectTransferResource(DirectTransferResource(bytes.size, hash), 4) { offset, expected ->
            withDirectBleRecovery(reconnect = { reconnects++ }) {
                offsets += offset
                if (offset == 4 && !dropped) {
                    dropped = true
                    throw DirectBleDisconnectedException("write failed (1)")
                }
                bytes.copyOfRange(offset, offset + expected)
            }
        }
        assertArrayEquals(bytes, result)
        assertEquals(listOf(0, 4, 4, 8), offsets)
        assertEquals(1, reconnects)
    }

    @Test fun `reconnection setup failures consume bounded retry budget`() = runTest {
        var reconnects = 0
        var reads = 0
        val result = withDirectBleRecovery(reconnect = {
            reconnects++
            if (reconnects < 3) throw DirectBleDisconnectedException("radio restarting")
        }) {
            if (++reads == 1) throw DirectBleDisconnectedException("radio off")
            "chunk"
        }
        assertEquals("chunk", result)
        assertEquals(3, reconnects)
        assertEquals(2, reads)
    }

    @Test fun `persistent failures stop after three reconnections`() = runTest {
        var reconnects = 0
        val error = runCatching {
            withDirectBleRecovery(reconnect = { reconnects++ }) {
                throw DirectBleDisconnectedException("link down")
            }
        }.exceptionOrNull()
        assertTrue(error is DirectBleDisconnectedException)
        assertEquals(3, reconnects)
    }

    @Test fun `changed transfer is fatal before reading another chunk`() = runTest {
        var reads = 0
        val error = runCatching {
            withDirectBleRecovery(reconnect = { throw IllegalArgumentException("transfer changed") }) {
                reads++
                throw DirectBleDisconnectedException("link down")
            }
        }.exceptionOrNull()
        assertTrue(error is IllegalArgumentException)
        assertEquals(1, reads)
    }

    @Test fun `refusals and user cancellation do not reconnect`() = runTest {
        for (failure in listOf(IllegalStateException("write not permitted"), CancellationException("cancel"))) {
            var reconnects = 0
            val actual = runCatching {
                withDirectBleRecovery(reconnect = { reconnects++ }) { throw failure }
            }.exceptionOrNull()
            assertSame(failure, actual)
            assertEquals(0, reconnects)
        }
    }

    @Test fun `recovery deadline bounds a hanging reconnect`() = runTest {
        val start = testScheduler.currentTime
        val error = runCatching {
            withDirectBleRecovery(reconnect = { delay(60_000L) }) {
                throw DirectBleDisconnectedException("link down")
            }
        }.exceptionOrNull()
        assertTrue(error is TimeoutCancellationException)
        assertEquals(20_000L, testScheduler.currentTime - start)
    }

    @Test fun `transport statuses recover but permission and payload errors do not`() {
        for (status in listOf(1, 18, 129, 132, 133, 143, 147, 257)) assertTrue(isRecoverableGattStatus(status))
        for (status in listOf(0, 2, 3, 5, 6, 7, 8, 13, 15, 19)) assertFalse(isRecoverableGattStatus(status))
    }
}

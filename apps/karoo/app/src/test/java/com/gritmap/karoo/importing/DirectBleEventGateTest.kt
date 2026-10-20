package com.gritmap.karoo.importing

import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import org.junit.Assert.*
import org.junit.Test

class DirectBleEventGateTest {
    private sealed interface Event {
        data object Mtu : Event
        data object Services : Event
        data class Read(val characteristic: String, val bytes: String) : Event
    }
    @Test fun `duplicate setup callbacks cannot satisfy a chunk read`() = runBlocking {
        val gate = DirectBleEventGate<Event>()
        gate.expect("read data") { it is Event.Read && it.characteristic == "data" }
        val read = async { gate.await() }
        gate.complete(Event.Mtu)
        gate.complete(Event.Services)
        gate.complete(Event.Read("manifest", "stale"))
        yield()
        assertFalse(read.isCompleted)
        gate.complete(Event.Read("data", "chunk"))
        assertEquals(Event.Read("data", "chunk"), read.await())
    }
    @Test fun `disconnect mid chunk fails read and subsequent operations`() = runBlocking {
        val gate = DirectBleEventGate<Event>()
        gate.expect("read data at 512") { it is Event.Read }
        gate.fail(DirectBleDisconnectedException("link dropped"))
        gate.complete(Event.Read("data", "late callback"))
        val error = runCatching { gate.await() }.exceptionOrNull()
        assertTrue(error is DirectBleDisconnectedException)
        assertTrue(error!!.message!!.contains("read data at 512"))
        gate.expect("write receipt") { true }
        assertTrue(runCatching { gate.await() }.exceptionOrNull() is DirectBleDisconnectedException)
    }
}

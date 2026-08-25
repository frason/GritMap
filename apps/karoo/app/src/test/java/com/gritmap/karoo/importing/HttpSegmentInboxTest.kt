package com.gritmap.karoo.importing

import java.net.Socket
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class HttpSegmentInboxTest {

    @Test
    fun `receives a real POST body over a socket connection`() = runBlocking {
        // port = 0 -> OS-assigned ephemeral port, so parallel test runs never collide.
        val inbox = HttpSegmentInbox(port = 0, timeoutMs = 5_000)
        val pendingDeferred = async { inbox.pending() }

        val port = awaitBoundPort(inbox)
        val body = """{"schemaVersion":1,"id":"x"}"""
        val response = postRaw(port, body)

        val items = pendingDeferred.await()
        assertEquals(1, items.size)
        assertEquals(body, items[0].payload)
        assertTrue("expected a 200 response, got: $response", response.startsWith("HTTP/1.1 200"))
    }

    @Test
    fun `returns an empty list when nothing connects before the timeout`() = runBlocking {
        val inbox = HttpSegmentInbox(port = 0, timeoutMs = 200)
        val items = inbox.pending()
        assertTrue(items.isEmpty())
    }

    @Test
    fun `rejects a non-POST request with 405 and does not surface it as an item`() = runBlocking {
        val inbox = HttpSegmentInbox(port = 0, timeoutMs = 5_000)
        val pendingDeferred = async {
            runCatching { inbox.pending() }
        }

        val port = awaitBoundPort(inbox)
        val response = sendRaw(port, "GET / HTTP/1.1\r\nHost: x\r\nContent-Length: 0\r\n\r\n")

        val result = pendingDeferred.await()
        assertTrue(result.isFailure)
        assertTrue(response.startsWith("HTTP/1.1 405"))
    }

    @Test
    fun `rejects an oversized Content-Length with 413`() = runBlocking {
        val inbox = HttpSegmentInbox(port = 0, timeoutMs = 5_000)
        val pendingDeferred = async {
            runCatching { inbox.pending() }
        }

        val port = awaitBoundPort(inbox)
        val response = sendRaw(port, "POST / HTTP/1.1\r\nContent-Length: 999999999\r\n\r\n")

        val result = pendingDeferred.await()
        assertTrue(result.isFailure)
        assertTrue(response.startsWith("HTTP/1.1 413"))
    }

    @Test
    fun `stop() ends an in-progress wait early`() = runBlocking {
        val inbox = HttpSegmentInbox(port = 0, timeoutMs = 30_000)
        val pendingDeferred = async { runCatching { inbox.pending() } }
        awaitBoundPort(inbox)

        inbox.stop()

        withTimeout(5_000) {
            val result = pendingDeferred.await()
            // A closed ServerSocket makes accept() throw -- either outcome (failure, or an
            // empty/failed result) is acceptable; what matters is stop() doesn't hang forever.
            assertTrue(result.isFailure || result.getOrNull()?.isEmpty() == true)
        }
    }

    private suspend fun awaitBoundPort(inbox: HttpSegmentInbox): Int {
        var port: Int? = null
        withTimeout(2_000) {
            while (port == null) {
                port = inbox.boundPort
                if (port == null) delay(10)
            }
        }
        return requireNotNull(port)
    }

    /** Sends a raw HTTP request (with a proper Content-Length) and returns the raw response text. */
    private fun postRaw(port: Int, body: String): String {
        val bytes = body.toByteArray(Charsets.UTF_8)
        val request = "POST /transfer HTTP/1.1\r\n" +
            "Host: localhost\r\n" +
            "Content-Type: application/json\r\n" +
            "Content-Length: ${bytes.size}\r\n\r\n" +
            body
        return sendRaw(port, request)
    }

    private fun sendRaw(port: Int, request: String): String {
        Socket("127.0.0.1", port).use { socket ->
            socket.getOutputStream().apply {
                write(request.toByteArray(Charsets.UTF_8))
                flush()
            }
            return socket.getInputStream().bufferedReader(Charsets.UTF_8).readText()
        }
    }
}

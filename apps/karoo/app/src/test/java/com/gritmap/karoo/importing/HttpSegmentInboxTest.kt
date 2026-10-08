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
    fun `invalid connection does not consume receive session before valid POST`() = runBlocking {
        val inbox = HttpSegmentInbox(port = 0, timeoutMs = 5_000)
        val pendingDeferred = async { inbox.pending() }

        val port = awaitBoundPort(inbox)
        val response = sendRaw(port, "GET / HTTP/1.1\r\nHost: x\r\nContent-Length: 0\r\n\r\n")
        val body = """{"schemaVersion":1,"id":"after-probe"}"""
        val validResponse = postRaw(port, body)

        assertTrue(response.startsWith("HTTP/1.1 405"))
        assertTrue(validResponse.startsWith("HTTP/1.1 200"))
        assertEquals(body, pendingDeferred.await().single().payload)
    }

    @Test
    fun `rejects an oversized Content-Length with 413`() = runBlocking {
        val inbox = HttpSegmentInbox(port = 0, timeoutMs = 5_000)
        val pendingDeferred = async { inbox.pending() }

        val port = awaitBoundPort(inbox)
        val response = sendRaw(port, "POST / HTTP/1.1\r\nContent-Length: 999999999\r\n\r\n")

        assertTrue(response.startsWith("HTTP/1.1 413"))
        inbox.stop()
        assertTrue(pendingDeferred.await().isEmpty())
    }

    @Test
    fun `stop() ends an in-progress wait early`() = runBlocking {
        val inbox = HttpSegmentInbox(port = 0, timeoutMs = 30_000)
        val pendingDeferred = async { inbox.pending() }
        awaitBoundPort(inbox)

        inbox.stop()

        withTimeout(5_000) {
            assertTrue(pendingDeferred.await().isEmpty())
        }
    }

    @Test
    fun `bare TCP probe cannot consume the next valid transfer`() = runBlocking {
        val inbox = HttpSegmentInbox(port = 0, timeoutMs = 5_000)
        val pendingDeferred = async { inbox.pending() }
        val port = awaitBoundPort(inbox)

        Socket("127.0.0.1", port).use { /* connect and close exactly like nc -z */ }
        val body = """{"packageType":"gritmap-transfer"}"""
        assertTrue(postRaw(port, body).startsWith("HTTP/1.1 200"))
        assertEquals(body, pendingDeferred.await().single().payload)
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

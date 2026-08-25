package com.gritmap.karoo.importing

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.OutputStream
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketTimeoutException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Local-network transport for the phone-to-Karoo segment transfer, per
 * apps/karoo/TRANSFER_PACKAGE.md ("Transport is not part of the contract... a future local
 * HTTP... transport... may deliver the same UTF-8 JSON document"). Implements the same
 * [SegmentInbox] boundary [StagedFileSegmentInbox] does, so [SegmentInboxProcessor]'s
 * existing, tested parse/validate/persist logic runs completely unchanged -- this class only
 * gets JSON bytes from a phone on the same WiFi network instead of from a staged file.
 *
 * [pending] deliberately blocks (up to [timeoutMs]) waiting for one incoming connection --
 * a real deviation from the file-inbox's instant "list what's there" semantics, but the right
 * fit for a manual, user-initiated "wait for one phone send" flow. Not a persistent listener:
 * one call accepts at most one transfer, then the socket is closed.
 */
class HttpSegmentInbox(
    private val port: Int = DEFAULT_PORT,
    private val timeoutMs: Int = DEFAULT_TIMEOUT_MS,
) : SegmentInbox {
    @Volatile
    private var serverSocket: ServerSocket? = null

    /**
     * The actually-bound port once [pending] has opened its socket -- differs from the
     * constructor's [port] when it was `0` (OS-assigned ephemeral port, used by tests to
     * avoid colliding with another process already on [DEFAULT_PORT]).
     */
    val boundPort: Int? get() = serverSocket?.localPort

    override suspend fun pending(): List<InboxItem> = withContext(Dispatchers.IO) {
        val server = ServerSocket(port)
        server.soTimeout = timeoutMs
        serverSocket = server
        try {
            val socket = server.accept()
            val payload = socket.use { readHttpPostBody(it) }
            listOf(InboxItem(id = NETWORK_ITEM_ID, displayName = "Phone transfer", payload = payload))
        } catch (timeout: SocketTimeoutException) {
            emptyList()
        } finally {
            runCatching { server.close() }
            serverSocket = null
        }
    }

    override suspend fun acknowledge(item: InboxItem) {
        // Nothing to move -- the payload only ever existed as bytes on the wire.
    }

    override suspend fun reject(item: InboxItem, reason: String) {
        // Nothing to move; the sender already got the HTTP error response written by
        // readHttpPostBody's caller. Rejection is surfaced to the Karoo UI by
        // SegmentInboxProcessor's own InboxProcessingResult.failed map.
    }

    /** Stops an in-progress [pending] wait early (e.g. the user taps Cancel). */
    fun stop() {
        runCatching { serverSocket?.close() }
    }

    companion object {
        const val DEFAULT_PORT = 8734
        private const val DEFAULT_TIMEOUT_MS = 120_000
        private const val NETWORK_ITEM_ID = "network-transfer"

        /** The device's LAN IPv4 address, for display so the phone user can type it in. */
        fun localIpAddress(): String? =
            NetworkInterface.getNetworkInterfaces()?.asSequence()
                ?.flatMap { it.inetAddresses.asSequence() }
                ?.firstOrNull { address ->
                    !address.isLoopbackAddress && address.hostAddress?.contains(':') == false
                }
                ?.hostAddress
    }
}

/**
 * Reads just enough of a raw HTTP/1.1 POST request to extract its body: parses headers up to
 * the blank-line terminator, requires POST + a valid Content-Length, then reads exactly that
 * many body bytes. No chunked-transfer-encoding, keep-alive, or other HTTP/1.1 features --
 * this is a single-purpose LAN receiver, not a general HTTP server, matching the "lightweight"
 * scope of a manual phone-to-Karoo transfer.
 */
private fun readHttpPostBody(socket: Socket): String {
    socket.soTimeout = SOCKET_READ_TIMEOUT_MS
    val input = socket.getInputStream()
    val output = socket.getOutputStream()

    // Headers end at the first blank line: CRLF CRLF (RFC 7230), i.e. the last four bytes
    // received equal \r\n\r\n -- not a bare double-LF, which is a different byte sequence
    // entirely and would never match a real HTTP client's output.
    val headerBytes = ByteArrayOutputStream()
    val tail = IntArray(4) { -1 }
    while (true) {
        val byte = input.read()
        if (byte == -1) throw IOException("Connection closed before headers completed")
        headerBytes.write(byte)
        tail[0] = tail[1]; tail[1] = tail[2]; tail[2] = tail[3]; tail[3] = byte
        if (tail[0] == '\r'.code && tail[1] == '\n'.code && tail[2] == '\r'.code && tail[3] == '\n'.code) {
            break
        }
        if (headerBytes.size() > MAX_HEADER_BYTES) {
            writeResponse(output, 431, "Request Header Fields Too Large")
            throw IOException("Headers exceeded $MAX_HEADER_BYTES bytes")
        }
    }

    val headerLines = headerBytes.toString(Charsets.ISO_8859_1.name()).split("\r\n")
    val requestLine = headerLines.firstOrNull().orEmpty()
    if (!requestLine.startsWith("POST ")) {
        writeResponse(output, 405, "Method Not Allowed")
        throw IOException("Unsupported request line: $requestLine")
    }

    val contentLength = headerLines
        .firstOrNull { it.startsWith("Content-Length:", ignoreCase = true) }
        ?.substringAfter(":")
        ?.trim()
        ?.toIntOrNull()
    if (contentLength == null) {
        writeResponse(output, 411, "Length Required")
        throw IOException("Missing or invalid Content-Length header")
    }
    if (contentLength <= 0 || contentLength > MAX_BODY_BYTES) {
        writeResponse(output, 413, "Payload Too Large")
        throw IOException("Content-Length $contentLength out of bounds")
    }

    val bodyBytes = ByteArray(contentLength)
    var readTotal = 0
    while (readTotal < contentLength) {
        val readNow = input.read(bodyBytes, readTotal, contentLength - readTotal)
        if (readNow == -1) throw IOException("Connection closed before body completed")
        readTotal += readNow
    }

    writeResponse(output, 200, "OK")
    return String(bodyBytes, Charsets.UTF_8)
}

private fun writeResponse(output: OutputStream, statusCode: Int, reasonPhrase: String) {
    val body = reasonPhrase
    val response = "HTTP/1.1 $statusCode $reasonPhrase\r\n" +
        "Content-Type: text/plain\r\n" +
        "Content-Length: ${body.toByteArray(Charsets.UTF_8).size}\r\n" +
        "Connection: close\r\n\r\n$body"
    output.write(response.toByteArray(Charsets.UTF_8))
    output.flush()
}

private const val MAX_BODY_BYTES = 1_000_000
private const val MAX_HEADER_BYTES = 16_384
private const val SOCKET_READ_TIMEOUT_MS = 15_000

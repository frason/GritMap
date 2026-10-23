package com.gritmap.karoo.importing

import android.bluetooth.BluetoothDevice
import android.content.Context
import android.util.Log
import java.net.URL
import java.security.MessageDigest
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.async
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

class DirectBleTransferReceiver(
    context: Context,
    private val segmentExists: suspend (String) -> Boolean,
    private val importPackage: suspend (String) -> TransferImportResult,
    private val gattClient: DirectBleGattClient = DirectBleGattClient(context),
    private val manifestParser: DirectTransferManifestParser = DirectTransferManifestParser(),
    private val packageBuilder: DirectTransferPackageBuilder = DirectTransferPackageBuilder(),
    private val publicClient: TransferResourceClient = HttpsTransferResourceClient(),
) {
    suspend fun receive(device: BluetoothDevice): TransferImportResult {
        val started = System.nanoTime()
        var connection: DirectBleGattClient.Connection? = null
        var manifest: DirectTransferManifest? = null
        var receiptAttempted = false
        try {
            connection = gattClient.connect(device)
            manifest = manifestParser.parse(connection.readManifest())
            val existing = segmentExists(manifest.segmentFingerprint)
            // Keep one GATT connection across resources. Fetch the segment before the plan
            // so the phone's plan-served receipt deadline does not include a large download.
            suspend fun resource(name: DirectTransferResourceName, descriptor: DirectTransferResource): ByteArray =
                readResource(device, manifest, name, descriptor, requireNotNull(connection)) { connection = it }
            val segment = if (existing) null else {
                val publicSegment = if (manifest.segment.isPublic) {
                    val url = URL("https://raw.githubusercontent.com/frason/GritMap/main/registry/segments/${manifest.segmentFingerprint}.json")
                    // HTTP uses blocking IO. Keep the phone session alive even if a socket
                    // takes longer than a coroutine timeout to return.
                    coroutineScope {
                        val download = async {
                            runCatching { publicClient.get(url, DirectTransferManifestParser.MAX_SEGMENT_BYTES) }.getOrNull()
                        }
                        while (!download.isCompleted) {
                            withTimeoutOrNull(5_000L) { download.join() }
                            if (!download.isCompleted) {
                                val current = manifestParser.parse(requireNotNull(connection).readManifest())
                                require(current.transferId == manifest.transferId) { "Bluetooth transfer changed during download" }
                            }
                        }
                        download.await()
                    }?.takeIf { it.size == manifest.segment.bytes && sha256(it) == manifest.segment.sha256 }
                } else null
                publicSegment ?: resource(DirectTransferResourceName.SEGMENT, manifest.segment)
            }
            val plan = resource(DirectTransferResourceName.PLAN, manifest.plan)
            val rider = manifest.rider?.let { resource(DirectTransferResourceName.RIDER, it) }
            val packageJson = packageBuilder.build(manifest, plan, segment, rider)
            val result = withTimeout(RECEIPT_DEADLINE_MS) {
                val imported = importPackage(packageJson)
                receiptAttempted = true
                connection = deliverReceipt(
                    device = device,
                    manifest = manifest,
                    current = connection,
                    receipt = directTransferReceipt(manifest.transferId, true, if (existing) "ok_segment_existing" else "ok"),
                )
                imported
            }
            Log.i("GritMapLive", "ble_imported existing=$existing durationMs=${(System.nanoTime() - started) / 1_000_000}")
            return result
        } catch (error: Exception) {
            currentCoroutineContext().ensureActive()
            val currentManifest = manifest
            if (!receiptAttempted && currentManifest != null && connection != null) {
                runCatching {
                    connection = deliverReceipt(
                        device = device,
                        manifest = currentManifest,
                        current = connection,
                        receipt = directTransferReceipt(currentManifest.transferId, false, rejectionCode(error)),
                    )
                }
            }
            throw error
        } finally {
            connection?.close()
        }
    }

    private suspend fun readResource(
        device: BluetoothDevice,
        manifest: DirectTransferManifest,
        name: DirectTransferResourceName,
        descriptor: DirectTransferResource,
        initial: DirectBleGattClient.Connection,
        onConnection: (DirectBleGattClient.Connection) -> Unit,
    ): ByteArray {
        var connection = initial
        val output = try {
            readDirectTransferResource(descriptor, manifest.chunkBytes) { offset, expected ->
                withDirectBleRecovery(
                    reconnect = {
                        connection.close()
                        connection = gattClient.connect(device).also(onConnection)
                        val again = manifestParser.parse(connection.readManifest())
                        require(again == manifest) { "Bluetooth transfer changed while reconnecting" }
                    },
                    onRetry = { attempt ->
                        Log.i("GritMapLive", "ble_resume resource=${name.wireName} offset=$offset attempt=$attempt")
                    },
                ) {
                    connection.readChunk(name, offset, expected)
                }
            }
        } finally {
            onConnection(connection)
        }
        Log.i("GritMapLive", "ble_resource resource=${name.wireName} bytes=${output.size}")
        return output
    }

    private suspend fun deliverReceipt(
        device: BluetoothDevice,
        manifest: DirectTransferManifest,
        current: DirectBleGattClient.Connection?,
        receipt: ByteArray,
    ): DirectBleGattClient.Connection {
        var connection = current
        try {
            requireNotNull(connection) { "Bluetooth disconnected before receipt" }.writeReceipt(receipt)
            return connection
        } catch (first: Exception) {
            currentCoroutineContext().ensureActive()
            connection?.close()
            val retry = gattClient.connect(device)
            try {
                val again = manifestParser.parse(retry.readManifest())
                require(again.transferId == manifest.transferId) { "Bluetooth transfer changed before receipt retry" }
                // The phone closes a completed session after accepting the first write. If its
                // response was lost, writeNotPermitted on this single retry means delivered.
                retry.writeReceipt(receipt, retry = true)
                return retry
            } catch (retryError: Exception) {
                retry.close()
                retryError.addSuppressed(first)
                throw retryError
            }
        }
    }

    private fun rejectionCode(error: Exception): String = when {
        error is TimeoutCancellationException -> "timeout"
        error is DirectTransferHashMismatch -> "bad_hash"
        error.message?.contains("segment", ignoreCase = true) == true -> "bad_segment"
        error.message?.contains("plan", ignoreCase = true) == true -> "bad_plan"
        error.message?.contains("fingerprint", ignoreCase = true) == true -> "fingerprint_mismatch"
        error.message?.contains("FTP", ignoreCase = true) == true -> "ftp_mismatch"
        error.message?.contains("size", ignoreCase = true) == true || error.message?.contains("large", ignoreCase = true) == true -> "too_large"
        else -> "other"
    }

    private fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
        .digest(bytes).joinToString("") { "%02x".format(it) }

    companion object {
        private const val RECEIPT_DEADLINE_MS = 30_000L
    }
}

package com.gritmap.karoo.importing

import android.bluetooth.BluetoothDevice
import android.content.Context
import java.net.URL
import java.security.MessageDigest
import kotlinx.coroutines.withTimeout

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
        var connection: DirectBleGattClient.Connection? = null
        var manifest: DirectTransferManifest? = null
        var receiptAttempted = false
        try {
            connection = gattClient.connect(device)
            manifest = manifestParser.parse(connection.readManifest())
            val existing = segmentExists(manifest.segmentFingerprint)
            connection.close()
            connection = null
            // Resolve the potentially slow public segment before the final BLE reads so the
            // receipt deadline starts from the last plan/rider Data read, as the wire contract
            // requires.
            val segment = if (existing) null else {
                readSegment(device, manifest) { connection = it }
            }
            connection?.close()
            connection = null
            val plan = readResource(device, manifest, DirectTransferResourceName.PLAN, manifest.plan) { connection = it }
            val rider = manifest.rider?.let {
                connection?.close()
                connection = null
                readResource(device, manifest, DirectTransferResourceName.RIDER, it) { connection = it }
            }
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
            return result
        } catch (error: Exception) {
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

    private suspend fun readSegment(
        device: BluetoothDevice,
        manifest: DirectTransferManifest,
        onConnection: (DirectBleGattClient.Connection) -> Unit,
    ): ByteArray {
        if (manifest.segment.isPublic) {
            val url = URL("https://raw.githubusercontent.com/frason/GritMap/main/registry/segments/${manifest.segmentFingerprint}.json")
            runCatching { publicClient.get(url, DirectTransferManifestParser.MAX_SEGMENT_BYTES) }
                .getOrNull()
                ?.takeIf { it.size == manifest.segment.bytes && sha256(it) == manifest.segment.sha256 }
                ?.let { return it }
        }
        return readResource(device, manifest, DirectTransferResourceName.SEGMENT, manifest.segment, onConnection)
    }

    private suspend fun readResource(
        device: BluetoothDevice,
        manifest: DirectTransferManifest,
        name: DirectTransferResourceName,
        descriptor: DirectTransferResource,
        onConnection: (DirectBleGattClient.Connection) -> Unit,
    ): ByteArray {
        val output = ByteArray(descriptor.bytes)
        var offset = 0
        var retries = 0
        var connection = gattClient.connect(device).also(onConnection)
        try {
            val resumedManifest = manifestParser.parse(connection.readManifest())
            require(resumedManifest.transferId == manifest.transferId) { "Bluetooth transfer changed while reconnecting" }
            while (offset < descriptor.bytes) {
                val expected = minOf(manifest.chunkBytes, descriptor.bytes - offset)
                try {
                    val chunk = connection.readChunk(name, offset, expected)
                    chunk.copyInto(output, offset)
                    offset += chunk.size
                    retries = 0
                } catch (error: Exception) {
                    connection.close()
                    if (++retries > MAX_RECONNECTS) throw error
                    connection = gattClient.connect(device).also(onConnection)
                    val again = manifestParser.parse(connection.readManifest())
                    require(again.transferId == manifest.transferId) { "Bluetooth transfer changed while reconnecting" }
                }
            }
        } finally {
            // Keep the most recent connection alive for the next resource and final receipt.
            onConnection(connection)
        }
        if (sha256(output) != descriptor.sha256) throw DirectTransferHashMismatch("${name.wireName} SHA-256 mismatch")
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
        private const val MAX_RECONNECTS = 3
        private const val RECEIPT_DEADLINE_MS = 30_000L
    }
}

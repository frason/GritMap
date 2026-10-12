package com.gritmap.karoo.importing

import android.bluetooth.BluetoothDevice
import android.bluetooth.le.ScanCallback
import android.content.Context
import io.hammerhead.karooext.KarooSystemService
import io.hammerhead.karooext.models.ReleaseBluetooth
import io.hammerhead.karooext.models.RequestBluetooth
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull

sealed interface BleTransferReceiveResult {
    data class Imported(val result: TransferImportResult) : BleTransferReceiveResult
    data object TimedOut : BleTransferReceiveResult
}

/**
 * A user-triggered, bounded BLE receive session.
 *
 * Bluetooth is requested from Karoo only while this session is active and is always released.
 * Scanning stops before GATT connects, which avoids the reliability problems seen when scanning
 * and connecting concurrently on constrained head units.
 */
class BleTransferReceiveSession(
    context: Context,
    private val receiver: TransferCapsuleReceiver,
    private val client: BleTransferTokenClient = BleTransferTokenClient(context),
    private val karooSystem: KarooSystemService = KarooSystemService(context.applicationContext),
) {
    suspend fun receive(timeoutMs: Long = DEFAULT_RECEIVE_TIMEOUT_MS): BleTransferReceiveResult {
        require(timeoutMs > 0) { "Receive timeout must be positive" }
        val connected = CompletableDeferred<Boolean>()
        karooSystem.connect { value -> connected.complete(value) }

        try {
            check(withTimeout(KAROO_CONNECT_TIMEOUT_MS) { connected.await() }) {
                "Could not connect to Karoo Bluetooth service"
            }
            karooSystem.dispatch(RequestBluetooth(BLUETOOTH_RESOURCE_ID))
            check(waitForAdapter()) { "Bluetooth did not become available" }

            return try {
                withTimeout(timeoutMs) {
                    while (true) {
                        val token = scanAndReadToken() ?: continue
                        return@withTimeout BleTransferReceiveResult.Imported(receiver.receive(token))
                    }
                    @Suppress("UNREACHABLE_CODE")
                    BleTransferReceiveResult.TimedOut
                }
            } catch (_: TimeoutCancellationException) {
                BleTransferReceiveResult.TimedOut
            }
        } finally {
            karooSystem.dispatch(ReleaseBluetooth(BLUETOOTH_RESOURCE_ID))
            karooSystem.disconnect()
        }
    }

    private suspend fun waitForAdapter(): Boolean {
        repeat(BLUETOOTH_READY_RETRIES) {
            if (client.isAdapterOn()) return true
            delay(BLUETOOTH_READY_RETRY_MS)
        }
        return client.isAdapterOn()
    }

    private suspend fun scanAndReadToken(): TransferCapsuleToken? {
        val sightings = Channel<BluetoothDevice>(Channel.CONFLATED)
        var scan: ScanCallback? = null
        return try {
            scan = client.startScan { sightings.trySend(it) } ?: return null
            val device = withTimeoutOrNull(SCAN_ATTEMPT_TIMEOUT_MS) { sightings.receive() } ?: return null
            client.stopScan(scan)
            scan = null
            client.read(device)
        } finally {
            scan?.let(client::stopScan)
            sightings.close()
        }
    }

    companion object {
        const val DEFAULT_RECEIVE_TIMEOUT_MS = 2 * 60_000L
        private const val BLUETOOTH_RESOURCE_ID = "gritmap-transfer-manual"
        private const val KAROO_CONNECT_TIMEOUT_MS = 5_000L
        private const val BLUETOOTH_READY_RETRIES = 10
        private const val BLUETOOTH_READY_RETRY_MS = 500L
        private const val SCAN_ATTEMPT_TIMEOUT_MS = 15_000L
    }
}

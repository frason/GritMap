package com.gritmap.karoo.importing

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.ParcelUuid
import android.util.Log
import java.util.UUID
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Discovers a foreground iPhone advertising a one-time GritMap transfer token.
 *
 * The phone's rotating BLE address is never retained and the devices are never bonded. The token
 * is read immediately from a custom characteristic, after which the GATT connection is closed.
 */
@SuppressLint("MissingPermission")
class BleTransferTokenClient(
    context: Context,
    private val parser: TransferTokenParser = TransferTokenParser(),
) {
    private val appContext = context.applicationContext
    private val bluetoothManager = appContext.getSystemService(BluetoothManager::class.java)
    private val adapter get() = bluetoothManager?.adapter

    fun isAdapterOn(): Boolean = adapter?.isEnabled == true

    fun startScan(onMatch: (BluetoothDevice) -> Unit): ScanCallback? {
        val scanner = adapter?.bluetoothLeScanner ?: return null
        val filter = ScanFilter.Builder().setServiceUuid(ParcelUuid(SERVICE_UUID)).build()
        // This scan only runs during the explicit two-minute receive window, so favor a quick
        // foreground handoff instead of paying the latency cost of a persistent low-power scan.
        val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
        val callback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                result.device?.let(onMatch)
            }

            override fun onScanFailed(errorCode: Int) {
                Log.e(TAG, "token scan failed: $errorCode")
            }
        }
        return try {
            scanner.startScan(listOf(filter), settings, callback)
            callback
        } catch (error: RuntimeException) {
            Log.e(TAG, "could not start token scan", error)
            null
        }
    }

    fun stopScan(callback: ScanCallback) {
        runCatching { adapter?.bluetoothLeScanner?.stopScan(callback) }
    }

    suspend fun read(device: BluetoothDevice): TransferCapsuleToken? =
        withTimeoutOrNull(READ_TIMEOUT_MS) { readToken(device) }

    private suspend fun readToken(device: BluetoothDevice): TransferCapsuleToken? {
        val result = CompletableDeferred<ByteArray>()
        var gatt: BluetoothGatt? = null
        val callback = object : BluetoothGattCallback() {
            override fun onConnectionStateChange(connection: BluetoothGatt, status: Int, newState: Int) {
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    result.completeExceptionally(IllegalStateException("BLE connection failed ($status)"))
                    return
                }
                when (newState) {
                    BluetoothProfile.STATE_CONNECTED -> {
                        if (!connection.requestMtu(PREFERRED_MTU)) connection.discoverServices()
                    }
                    BluetoothProfile.STATE_DISCONNECTED -> if (!result.isCompleted) {
                        result.completeExceptionally(IllegalStateException("BLE disconnected before token read"))
                    }
                }
            }

            override fun onMtuChanged(connection: BluetoothGatt, mtu: Int, status: Int) {
                connection.discoverServices()
            }

            override fun onServicesDiscovered(connection: BluetoothGatt, status: Int) {
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    result.completeExceptionally(IllegalStateException("BLE service discovery failed ($status)"))
                    return
                }
                val characteristic = connection.getService(SERVICE_UUID)?.getCharacteristic(TOKEN_CHARACTERISTIC_UUID)
                if (characteristic == null || !connection.readCharacteristic(characteristic)) {
                    result.completeExceptionally(IllegalStateException("Transfer token characteristic is unavailable"))
                }
            }

            @Suppress("DEPRECATION")
            override fun onCharacteristicRead(
                connection: BluetoothGatt,
                characteristic: BluetoothGattCharacteristic,
                status: Int,
            ) {
                if (characteristic.uuid != TOKEN_CHARACTERISTIC_UUID) return
                if (status == BluetoothGatt.GATT_SUCCESS) {
                    result.complete(characteristic.value?.copyOf() ?: byteArrayOf())
                } else {
                    result.completeExceptionally(IllegalStateException("Transfer token read failed ($status)"))
                }
            }
        }

        return try {
            gatt = device.connectGatt(appContext, false, callback, BluetoothDevice.TRANSPORT_LE)
            parser.parse(result.await())
        } catch (error: Exception) {
            Log.w(TAG, "transfer token read failed: ${error.message}")
            null
        } finally {
            runCatching { gatt?.disconnect() }
            runCatching { gatt?.close() }
        }
    }

    companion object {
        private const val TAG = "GritMapBleTransfer"
        private const val PREFERRED_MTU = 185
        private const val READ_TIMEOUT_MS = 15_000L
        val SERVICE_UUID: UUID = UUID.fromString("e7a4e868-0a21-45d6-ac63-5812c740ba12")
        val TOKEN_CHARACTERISTIC_UUID: UUID = UUID.fromString("58fc915a-a32c-42c1-babd-fa58123409d7")
    }
}

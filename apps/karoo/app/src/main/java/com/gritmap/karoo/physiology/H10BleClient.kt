package com.gritmap.karoo.physiology

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import java.util.UUID
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class H10Device(
    val address: String,
    val name: String,
    val rssi: Int,
)

enum class H10ConnectionState {
    IDLE,
    SCANNING,
    CONNECTING,
    DISCOVERING,
    SUBSCRIBING,
    CONNECTED,
    DISCONNECTED,
    ERROR,
}

data class H10BleState(
    val connectionState: H10ConnectionState = H10ConnectionState.IDLE,
    val devices: List<H10Device> = emptyList(),
    val connectedDevice: H10Device? = null,
    val status: String = "Ready",
    val latestMeasurement: BleHeartRateMeasurement? = null,
    val malformedPacketCount: Int = 0,
)

@SuppressLint("MissingPermission")
class H10BleClient(
    context: Context,
    private val onMeasurement: (BleHeartRateMeasurement, notificationElapsedRealtimeMs: Long) -> Unit,
    private val elapsedRealtimeMs: () -> Long,
    private val onConnectedDevice: (H10Device) -> Unit = {},
) : AutoCloseable {
    private val appContext = context.applicationContext
    private val bluetoothManager = appContext.getSystemService(BluetoothManager::class.java)
    private val adapter: BluetoothAdapter? get() = bluetoothManager?.adapter
    private val mutableState = MutableStateFlow(H10BleState())
    val state: StateFlow<H10BleState> = mutableState.asStateFlow()
    private val devicesByAddress = linkedMapOf<String, Pair<android.bluetooth.BluetoothDevice, H10Device>>()
    private var gatt: BluetoothGatt? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private val scanTimeout = Runnable { finishScan("Scan complete") }

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val bluetoothDevice = result.device ?: return
            val displayName = runCatching { bluetoothDevice.name }.getOrNull()
                ?: result.scanRecord?.deviceName
                ?: "Polar HR sensor"
            val device = H10Device(bluetoothDevice.address, displayName, result.rssi)
            devicesByAddress[device.address] = bluetoothDevice to device
            mutableState.update { current -> current.copy(
                connectionState = H10ConnectionState.SCANNING,
                devices = devicesByAddress.values.map { it.second }.sortedByDescending { it.rssi },
                status = "Found ${devicesByAddress.size} heart-rate sensor(s)",
            ) }
        }

        override fun onScanFailed(errorCode: Int) {
            mutableState.update { current -> current.copy(
                connectionState = H10ConnectionState.ERROR,
                status = "Bluetooth scan failed ($errorCode)",
            ) }
        }
    }

    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            if (this@H10BleClient.gatt !== gatt) {
                gatt.close()
                return
            }
            if (status != BluetoothGatt.GATT_SUCCESS) {
                updateError("H10 connection error ($status)")
                gatt.close()
                this@H10BleClient.gatt = null
                return
            }
            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    mutableState.update { current -> current.copy(
                        connectionState = H10ConnectionState.DISCOVERING,
                        status = "Connected; discovering heart-rate service…",
                    ) }
                    if (!gatt.discoverServices()) updateError("Could not start service discovery")
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    mutableState.update { current -> current.copy(
                        connectionState = H10ConnectionState.DISCONNECTED,
                        status = "H10 disconnected",
                    ) }
                    gatt.close()
                    if (this@H10BleClient.gatt === gatt) this@H10BleClient.gatt = null
                }
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (this@H10BleClient.gatt !== gatt) return
            if (status != BluetoothGatt.GATT_SUCCESS) {
                updateError("Heart-rate service discovery failed ($status)")
                return
            }
            val characteristic = gatt.getService(HEART_RATE_SERVICE_UUID)
                ?.getCharacteristic(HEART_RATE_MEASUREMENT_UUID)
            if (characteristic == null) {
                updateError("Device has no Bluetooth Heart Rate Measurement service")
                return
            }
            mutableState.update { current -> current.copy(
                connectionState = H10ConnectionState.SUBSCRIBING,
                status = "Subscribing to BPM and RR…",
            ) }
            if (!gatt.setCharacteristicNotification(characteristic, true)) {
                updateError("Could not enable heart-rate notifications")
                return
            }
            val descriptor = characteristic.getDescriptor(CLIENT_CHARACTERISTIC_CONFIG_UUID)
            if (descriptor == null) {
                updateError("Heart-rate notification descriptor is missing")
                return
            }
            @Suppress("DEPRECATION")
            descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            @Suppress("DEPRECATION")
            if (!gatt.writeDescriptor(descriptor)) {
                updateError("Could not subscribe to heart-rate notifications")
            }
        }

        override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
            if (this@H10BleClient.gatt !== gatt) return
            if (descriptor.uuid != CLIENT_CHARACTERISTIC_CONFIG_UUID) return
            if (status == BluetoothGatt.GATT_SUCCESS) {
                mutableState.value.connectedDevice?.let(onConnectedDevice)
                mutableState.update { current -> current.copy(
                    connectionState = H10ConnectionState.CONNECTED,
                    status = "H10 Enhanced connected; waiting for RR…",
                ) }
            } else {
                updateError("Heart-rate subscription failed ($status)")
            }
        }

        @Deprecated("Kept for Android 12/API 31 compatibility")
        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
            if (this@H10BleClient.gatt !== gatt) return
            if (characteristic.uuid == HEART_RATE_MEASUREMENT_UUID) {
                @Suppress("DEPRECATION")
                handleMeasurement(characteristic.value?.copyOf() ?: return)
            }
        }

        private fun handleMeasurement(bytes: ByteArray) {
            val measurement = runCatching { BleHeartRateMeasurementParser.parse(bytes) }
                .getOrElse {
                    mutableState.update { current ->
                        current.copy(
                            malformedPacketCount = current.malformedPacketCount + 1,
                            status = "Connected; skipped malformed heart-rate packet",
                        )
                    }
                    return
                }
            mutableState.update { current -> current.copy(
                connectionState = H10ConnectionState.CONNECTED,
                status = if (measurement.rrIntervalsMs.isEmpty()) {
                    "Connected; BPM received, waiting for RR"
                } else {
                    "H10 Enhanced connected"
                },
                latestMeasurement = measurement,
            ) }
            onMeasurement(measurement, elapsedRealtimeMs())
        }
    }

    fun startScan() {
        stopScan()
        devicesByAddress.clear()
        mutableState.value = H10BleState(
            connectionState = H10ConnectionState.SCANNING,
            status = "Scanning for Bluetooth heart-rate sensors…",
        )
        val scanner = adapter?.bluetoothLeScanner
        if (scanner == null) {
            updateError("Bluetooth is unavailable or disabled")
            return
        }
        val filter = ScanFilter.Builder().setServiceUuid(ParcelUuid(HEART_RATE_SERVICE_UUID)).build()
        val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
        scanner.startScan(listOf(filter), settings, scanCallback)
        mainHandler.postDelayed(scanTimeout, SCAN_DURATION_MS)
    }

    fun stopScan() {
        mainHandler.removeCallbacks(scanTimeout)
        runCatching { adapter?.bluetoothLeScanner?.stopScan(scanCallback) }
        if (mutableState.value.connectionState == H10ConnectionState.SCANNING) {
            mutableState.update { current -> current.copy(
                connectionState = H10ConnectionState.IDLE,
                status = "Scan stopped",
            ) }
        }
    }

    fun connect(address: String) {
        val entry = devicesByAddress[address]
        if (entry == null) {
            updateError("Selected sensor is no longer available")
            return
        }
        connectDevice(entry.first, entry.second)
    }

    fun connectKnown(address: String) {
        val bluetoothDevice = runCatching { adapter?.getRemoteDevice(address) }.getOrNull()
        if (bluetoothDevice == null) {
            updateError("Saved H10 is unavailable")
            return
        }
        val known = H10Device(
            address = bluetoothDevice.address,
            name = runCatching { bluetoothDevice.name }.getOrNull() ?: "Saved H10",
            rssi = Int.MIN_VALUE,
        )
        connectDevice(bluetoothDevice, known)
    }

    fun disconnect() {
        gatt?.disconnect()
        gatt?.close()
        gatt = null
        mutableState.update { current -> current.copy(
            connectionState = H10ConnectionState.DISCONNECTED,
            connectedDevice = null,
            status = "Disconnected",
        ) }
    }

    override fun close() {
        mainHandler.removeCallbacks(scanTimeout)
        stopScan()
        disconnect()
    }

    private fun updateError(message: String) {
        mutableState.update { current -> current.copy(
            connectionState = H10ConnectionState.ERROR,
            status = message,
        ) }
    }

    private fun connectDevice(
        bluetoothDevice: android.bluetooth.BluetoothDevice,
        device: H10Device,
    ) {
        stopScan()
        gatt?.close()
        mutableState.update { current -> current.copy(
            connectionState = H10ConnectionState.CONNECTING,
            connectedDevice = device,
            status = "Connecting to ${device.name}…",
        ) }
        gatt = bluetoothDevice.connectGatt(
            appContext,
            false,
            gattCallback,
            android.bluetooth.BluetoothDevice.TRANSPORT_LE,
        )
    }

    private fun finishScan(prefix: String) {
        mainHandler.removeCallbacks(scanTimeout)
        runCatching { adapter?.bluetoothLeScanner?.stopScan(scanCallback) }
        if (mutableState.value.connectionState == H10ConnectionState.SCANNING) {
            val count = devicesByAddress.size
            mutableState.update { current -> current.copy(
                connectionState = H10ConnectionState.IDLE,
                status = "$prefix; found $count sensor(s)",
            ) }
        }
    }

    companion object {
        private val HEART_RATE_SERVICE_UUID: UUID = UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb")
        private val HEART_RATE_MEASUREMENT_UUID: UUID = UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb")
        private val CLIENT_CHARACTERISTIC_CONFIG_UUID: UUID =
            UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        private const val SCAN_DURATION_MS = 12_000L
    }
}

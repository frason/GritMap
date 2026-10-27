package com.gritmap.karoo.importing

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.content.BroadcastReceiver
import android.content.Intent
import android.content.IntentFilter
import android.util.Log
import java.util.UUID
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.coroutines.delay
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

@SuppressLint("MissingPermission")
class DirectBleGattClient(private val context: Context) {
    suspend fun connect(device: BluetoothDevice): Connection {
        val connection = Connection(context.applicationContext, device)
        try {
            connection.open()
            return connection
        } catch (error: Exception) {
            connection.close()
            throw error
        }
    }

    class Connection internal constructor(
        private val context: Context,
        private val device: BluetoothDevice,
    ) {
        private var gatt: BluetoothGatt? = null
        private val events = DirectBleEventGate<GattEvent>()
        private val disconnected = CompletableDeferred<Unit>()
        private var radioReceiverRegistered = false
        private val radioReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action == BluetoothAdapter.ACTION_STATE_CHANGED &&
                    intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR) != BluetoothAdapter.STATE_ON
                ) {
                    disconnected.complete(Unit)
                    events.fail(DirectBleDisconnectedException("Bluetooth radio unavailable"))
                }
            }
        }
        var negotiatedMtu: Int = 23
            private set

        private val callback = object : BluetoothGattCallback() {
            override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
                if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                    disconnected.complete(Unit)
                    events.fail(DirectBleDisconnectedException("BLE disconnected (status=$status)"))
                } else complete(GattEvent.Connection(status, newState))
            }
            override fun onMtuChanged(g: BluetoothGatt, mtu: Int, status: Int) {
                complete(GattEvent.Mtu(status, mtu))
            }
            override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
                complete(GattEvent.Services(status))
            }
            @Suppress("DEPRECATION")
            override fun onCharacteristicRead(g: BluetoothGatt, c: BluetoothGattCharacteristic, status: Int) {
                complete(GattEvent.Read(status, c.uuid, c.value?.copyOf() ?: byteArrayOf()))
            }
            override fun onCharacteristicWrite(g: BluetoothGatt, c: BluetoothGattCharacteristic, status: Int) {
                complete(GattEvent.Write(status, c.uuid))
            }
        }

        internal suspend fun open() {
            val adapter = context.getSystemService(BluetoothManager::class.java).adapter
            val ready = withTimeoutOrNull(8_000L) {
                while (adapter?.isEnabled != true) delay(200L)
                true
            } ?: false
            if (!ready) throw DirectBleDisconnectedException("Bluetooth radio unavailable")
            context.registerReceiver(radioReceiver, IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED))
            radioReceiverRegistered = true
            events.expect("connect") { it is GattEvent.Connection }
            gatt = device.connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)
            val connected = await() as? GattEvent.Connection ?: error("Unexpected BLE connection event")
            if (connected.status != BluetoothGatt.GATT_SUCCESS || connected.state != BluetoothProfile.STATE_CONNECTED) {
                throw DirectBleDisconnectedException("BLE connection failed (${connected.status})")
            }
            events.expect("MTU") { it is GattEvent.Mtu }
            if (requireNotNull(gatt).requestMtu(PREFERRED_MTU)) {
                val event = await() as? GattEvent.Mtu ?: error("Unexpected BLE MTU event")
                if (event.status == BluetoothGatt.GATT_SUCCESS) negotiatedMtu = event.mtu
            }
            events.expect("service discovery") { it is GattEvent.Services }
            check(requireNotNull(gatt).discoverServices()) { "Could not start BLE service discovery" }
            val services = await() as? GattEvent.Services ?: error("Unexpected BLE service event")
            check(services.status == BluetoothGatt.GATT_SUCCESS) { "BLE service discovery failed (${services.status})" }
            requireCharacteristic(MANIFEST_UUID)
            requireCharacteristic(REQUEST_UUID)
            requireCharacteristic(DATA_UUID)
            requireCharacteristic(STATUS_UUID)
            // Old phone builds have no characteristic: continue their unchanged baseline exchange.
            if (gatt?.getService(SERVICE_UUID)?.getCharacteristic(CAPABILITIES_UUID) != null) {
                write(CAPABILITIES_UUID, ReceiverCapabilities().encode().encodeToByteArray())
                Log.i("GritMapLive", "ble_receiver_capabilities sent=true")
            }
            Log.i("GritMapLive", "ble_connected mtu=$negotiatedMtu")
        }

        suspend fun readManifest(): ByteArray = read(MANIFEST_UUID)

        suspend fun readChunk(resource: DirectTransferResourceName, offset: Int, expectedBytes: Int): ByteArray {
            write(REQUEST_UUID, directTransferRequest(resource, offset))
            val value = read(DATA_UUID)
            check(value.size == expectedBytes) {
                "Short logical BLE chunk at $offset: expected $expectedBytes, got ${value.size}"
            }
            return value
        }

        /** Test-only caller drops this GATT link and requires the actual disconnect callback. */
        internal suspend fun disconnectForTest() {
            requireNotNull(gatt).disconnect()
            check(withTimeoutOrNull(2_000L) { disconnected.await(); true } == true) {
                "Test link disconnect callback not received"
            }
            Log.i("GritMapLive", "ble_test_disconnected callback=true")
        }

        suspend fun writeReceipt(bytes: ByteArray, retry: Boolean = false) {
            try {
                write(STATUS_UUID, bytes)
            } catch (error: GattStatusException) {
                if (!(retry && error.status == BluetoothGatt.GATT_WRITE_NOT_PERMITTED)) throw error
            }
        }

        private suspend fun read(uuid: UUID): ByteArray {
            events.expect("read $uuid") { it is GattEvent.Read && it.uuid == uuid }
            if (!requireNotNull(gatt).readCharacteristic(requireCharacteristic(uuid))) {
                throw DirectBleDisconnectedException("Could not start BLE read")
            }
            val event = await() as? GattEvent.Read ?: error("Unexpected BLE read event")
            checkStatus(event.status, "BLE read $uuid failed")
            check(event.uuid == uuid) { "BLE read returned wrong characteristic" }
            return event.value
        }

        @Suppress("DEPRECATION")
        private suspend fun write(uuid: UUID, value: ByteArray) {
            val characteristic = requireCharacteristic(uuid)
            characteristic.value = value
            characteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            events.expect("write $uuid") { it is GattEvent.Write && it.uuid == uuid }
            if (!requireNotNull(gatt).writeCharacteristic(characteristic)) {
                throw DirectBleDisconnectedException("Could not start BLE write")
            }
            val event = await() as? GattEvent.Write ?: error("Unexpected BLE write event")
            checkStatus(event.status, "BLE write $uuid failed")
            check(event.uuid == uuid) { "BLE write returned wrong characteristic" }
        }

        private fun requireCharacteristic(uuid: UUID): BluetoothGattCharacteristic =
            requireNotNull(gatt?.getService(SERVICE_UUID)?.getCharacteristic(uuid)) {
                "Direct Bluetooth transfer is unsupported"
            }

        private fun checkStatus(status: Int, message: String) {
            if (status == BluetoothGatt.GATT_SUCCESS) return
            if (isRecoverableGattStatus(status)) throw DirectBleDisconnectedException("$message ($status)")
            throw GattStatusException(status, message)
        }

        private suspend fun await(): GattEvent =
            withTimeoutOrNull(OPERATION_TIMEOUT_MS) { events.await() } ?: run {
                currentCoroutineContext().ensureActive()
                throw DirectBleDisconnectedException("BLE operation timed out")
            }

        private fun complete(event: GattEvent) = events.complete(event)

        suspend fun close() = withContext(NonCancellable) {
            if (radioReceiverRegistered) {
                context.unregisterReceiver(radioReceiver)
                radioReceiverRegistered = false
            }
            val current = gatt ?: return@withContext
            try {
                runCatching { current.disconnect() }
                withTimeoutOrNull(2_000L) { disconnected.await() }
            } finally {
                current.close()
                gatt = null
            }
        }
    }

    class GattStatusException(val status: Int, message: String) : IllegalStateException("$message ($status)")

    private sealed interface GattEvent {
        data class Connection(val status: Int, val state: Int) : GattEvent
        data class Mtu(val status: Int, val mtu: Int) : GattEvent
        data class Services(val status: Int) : GattEvent
        data class Read(val status: Int, val uuid: UUID, val value: ByteArray) : GattEvent
        data class Write(val status: Int, val uuid: UUID) : GattEvent
    }

    companion object {
        const val PREFERRED_MTU = 517
        private const val OPERATION_TIMEOUT_MS = 8_000L
        val CAPABILITIES_UUID: UUID = UUID.fromString(ReceiverCapabilities.BLE_UUID)
        val SERVICE_UUID: UUID = UUID.fromString("e7a4e868-0a21-45d6-ac63-5812c740ba12")
        val MANIFEST_UUID: UUID = UUID.fromString("a9c5876c-8f5f-48be-aae7-eb47ef573c41")
        val REQUEST_UUID: UUID = UUID.fromString("59e28123-c142-4b89-acba-57d76e483b72")
        val DATA_UUID: UUID = UUID.fromString("83e82ba5-a7f4-47c5-bf6c-6473178bef68")
        val STATUS_UUID: UUID = UUID.fromString("c0bb77af-3bd8-4c60-b669-91ac74c778b9")
    }
}

package com.gritmap.karoo.importing

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothProfile
import android.content.Context
import java.io.Closeable
import java.util.UUID
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeout

@SuppressLint("MissingPermission")
class DirectBleGattClient(private val context: Context) {
    suspend fun connect(device: BluetoothDevice): Connection {
        val connection = Connection(context.applicationContext, device)
        connection.open()
        return connection
    }

    class Connection internal constructor(
        private val context: Context,
        private val device: BluetoothDevice,
    ) : Closeable {
        private var gatt: BluetoothGatt? = null
        private var pending = CompletableDeferred<GattEvent>()
        var negotiatedMtu: Int = 23
            private set

        private val callback = object : BluetoothGattCallback() {
            override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
                complete(GattEvent.Connection(status, newState))
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
            pending = CompletableDeferred()
            gatt = device.connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)
            val connected = await() as? GattEvent.Connection ?: error("Unexpected BLE connection event")
            check(connected.status == BluetoothGatt.GATT_SUCCESS && connected.state == BluetoothProfile.STATE_CONNECTED) {
                "BLE connection failed (${connected.status})"
            }
            pending = CompletableDeferred()
            if (requireNotNull(gatt).requestMtu(PREFERRED_MTU)) {
                val event = await() as? GattEvent.Mtu ?: error("Unexpected BLE MTU event")
                if (event.status == BluetoothGatt.GATT_SUCCESS) negotiatedMtu = event.mtu
            }
            pending = CompletableDeferred()
            check(requireNotNull(gatt).discoverServices()) { "Could not start BLE service discovery" }
            val services = await() as? GattEvent.Services ?: error("Unexpected BLE service event")
            check(services.status == BluetoothGatt.GATT_SUCCESS) { "BLE service discovery failed (${services.status})" }
            requireCharacteristic(MANIFEST_UUID)
            requireCharacteristic(REQUEST_UUID)
            requireCharacteristic(DATA_UUID)
            requireCharacteristic(STATUS_UUID)
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

        suspend fun writeReceipt(bytes: ByteArray, retry: Boolean = false) {
            try {
                write(STATUS_UUID, bytes)
            } catch (error: GattStatusException) {
                if (!(retry && error.status == BluetoothGatt.GATT_WRITE_NOT_PERMITTED)) throw error
            }
        }

        private suspend fun read(uuid: UUID): ByteArray {
            pending = CompletableDeferred()
            check(requireNotNull(gatt).readCharacteristic(requireCharacteristic(uuid))) { "Could not start BLE read" }
            val event = await() as? GattEvent.Read ?: error("Unexpected BLE read event")
            if (event.status != BluetoothGatt.GATT_SUCCESS) throw GattStatusException(event.status, "BLE read failed")
            check(event.uuid == uuid) { "BLE read returned wrong characteristic" }
            return event.value
        }

        @Suppress("DEPRECATION")
        private suspend fun write(uuid: UUID, value: ByteArray) {
            val characteristic = requireCharacteristic(uuid)
            characteristic.value = value
            characteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            pending = CompletableDeferred()
            check(requireNotNull(gatt).writeCharacteristic(characteristic)) { "Could not start BLE write" }
            val event = await() as? GattEvent.Write ?: error("Unexpected BLE write event")
            if (event.status != BluetoothGatt.GATT_SUCCESS) throw GattStatusException(event.status, "BLE write failed")
            check(event.uuid == uuid) { "BLE write returned wrong characteristic" }
        }

        private fun requireCharacteristic(uuid: UUID): BluetoothGattCharacteristic =
            requireNotNull(gatt?.getService(SERVICE_UUID)?.getCharacteristic(uuid)) {
                "Direct Bluetooth transfer is unsupported"
            }

        private suspend fun await(): GattEvent = withTimeout(OPERATION_TIMEOUT_MS) { pending.await() }

        private fun complete(event: GattEvent) {
            if (!pending.isCompleted) pending.complete(event)
        }

        override fun close() {
            runCatching { gatt?.disconnect() }
            runCatching { gatt?.close() }
            gatt = null
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
        private const val OPERATION_TIMEOUT_MS = 15_000L
        val SERVICE_UUID: UUID = UUID.fromString("e7a4e868-0a21-45d6-ac63-5812c740ba12")
        val MANIFEST_UUID: UUID = UUID.fromString("a9c5876c-8f5f-48be-aae7-eb47ef573c41")
        val REQUEST_UUID: UUID = UUID.fromString("59e28123-c142-4b89-acba-57d76e483b72")
        val DATA_UUID: UUID = UUID.fromString("83e82ba5-a7f4-47c5-bf6c-6473178bef68")
        val STATUS_UUID: UUID = UUID.fromString("c0bb77af-3bd8-4c60-b669-91ac74c778b9")
    }
}

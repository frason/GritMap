package com.gritmap.karoo.physiology

import android.content.Context
import android.content.Intent
import com.gritmap.karoo.service.LiveSegmentService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Process-local UI state published by the ride service. Room is never used as a live bus. */
object H10ServiceState {
    private val mutableBleState = MutableStateFlow(H10BleState(status = "Ride service not connected"))
    private val mutableCaptureState = MutableStateFlow(H10CaptureState())

    val bleState: StateFlow<H10BleState> = mutableBleState.asStateFlow()
    val captureState: StateFlow<H10CaptureState> = mutableCaptureState.asStateFlow()

    internal fun publish(state: H10BleState) {
        mutableBleState.value = state
    }

    internal fun publish(state: H10CaptureState) {
        mutableCaptureState.value = state
    }

    internal fun serviceStopped() {
        mutableBleState.value = mutableBleState.value.copy(
            connectionState = H10ConnectionState.DISCONNECTED,
            connectedDevice = null,
            status = "Ride service stopped",
        )
        mutableCaptureState.value = mutableCaptureState.value.copy(
            capturing = false,
            status = "Capture stopped with ride service",
        )
    }
}

object H10ServiceCommands {
    const val ACTION_SCAN = "com.gritmap.karoo.h10.SCAN"
    const val ACTION_CONNECT = "com.gritmap.karoo.h10.CONNECT"
    const val ACTION_DISCONNECT = "com.gritmap.karoo.h10.DISCONNECT"
    const val ACTION_START_CAPTURE = "com.gritmap.karoo.h10.START_CAPTURE"
    const val ACTION_STOP_CAPTURE = "com.gritmap.karoo.h10.STOP_CAPTURE"
    const val EXTRA_DEVICE_ADDRESS = "device_address"

    fun scan(context: Context) = send(context, ACTION_SCAN)

    fun connect(context: Context, address: String) = send(
        context,
        ACTION_CONNECT,
        EXTRA_DEVICE_ADDRESS to address,
    )

    fun disconnect(context: Context) = send(context, ACTION_DISCONNECT)

    fun startCapture(context: Context) = send(context, ACTION_START_CAPTURE)

    fun stopCapture(context: Context) = send(context, ACTION_STOP_CAPTURE)

    fun ensureService(context: Context) = send(context, LiveSegmentService.ACTION_ENSURE_RUNNING)

    private fun send(context: Context, action: String, extra: Pair<String, String>? = null) {
        val intent = Intent(context, LiveSegmentService::class.java).setAction(action)
        extra?.let { intent.putExtra(it.first, it.second) }
        context.startService(intent)
    }
}

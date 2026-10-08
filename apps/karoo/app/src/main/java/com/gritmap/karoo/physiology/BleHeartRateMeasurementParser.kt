package com.gritmap.karoo.physiology

import kotlin.math.roundToInt

data class BleHeartRateMeasurement(
    val heartRateBpm: Int,
    val rrIntervalsMs: List<Int>,
    val sensorContactSupported: Boolean,
    val sensorContactDetected: Boolean?,
    val rrIntervals1024: List<Int> = rrIntervalsMs.map(::roundedMsToRr1024),
)

/** Pure parser for the Bluetooth SIG Heart Rate Measurement characteristic (0x2A37). */
object BleHeartRateMeasurementParser {
    private const val HEART_RATE_16_BIT = 0x01
    private const val SENSOR_CONTACT_DETECTED = 0x02
    private const val SENSOR_CONTACT_SUPPORTED = 0x04
    private const val ENERGY_EXPENDED_PRESENT = 0x08
    private const val RR_INTERVAL_PRESENT = 0x10

    fun parse(value: ByteArray): BleHeartRateMeasurement {
        require(value.isNotEmpty()) { "Heart Rate Measurement is empty" }
        val flags = value[0].toInt() and 0xff
        var offset = 1

        val heartRate = if (flags and HEART_RATE_16_BIT != 0) {
            requireRemaining(value, offset, 2, "16-bit heart rate")
            readUInt16Le(value, offset).also { offset += 2 }
        } else {
            requireRemaining(value, offset, 1, "8-bit heart rate")
            (value[offset].toInt() and 0xff).also { offset += 1 }
        }

        if (flags and ENERGY_EXPENDED_PRESENT != 0) {
            requireRemaining(value, offset, 2, "energy expended")
            offset += 2
        }

        val rrIntervals1024 = mutableListOf<Int>()
        if (flags and RR_INTERVAL_PRESENT != 0) {
            require((value.size - offset) % 2 == 0) { "RR interval payload has a trailing byte" }
            while (offset < value.size) {
                // Bluetooth HRS encodes RR in 1/1024-second units.
                val rrUnits = readUInt16Le(value, offset)
                rrIntervals1024 += rrUnits
                offset += 2
            }
        } else {
            require(offset == value.size) { "Unexpected Heart Rate Measurement trailing data" }
        }

        val contactSupported = flags and SENSOR_CONTACT_SUPPORTED != 0
        return BleHeartRateMeasurement(
            heartRateBpm = heartRate,
            rrIntervalsMs = rrIntervals1024.map(::rr1024ToRoundedMs),
            sensorContactSupported = contactSupported,
            sensorContactDetected = if (contactSupported) {
                flags and SENSOR_CONTACT_DETECTED != 0
            } else {
                null
            },
            rrIntervals1024 = rrIntervals1024,
        )
    }

    private fun requireRemaining(value: ByteArray, offset: Int, count: Int, field: String) {
        require(value.size - offset >= count) { "Heart Rate Measurement is missing $field" }
    }

    private fun readUInt16Le(value: ByteArray, offset: Int): Int =
        (value[offset].toInt() and 0xff) or ((value[offset + 1].toInt() and 0xff) shl 8)
}

fun rr1024ToRoundedMs(value: Int): Int = (value * 1_000.0 / 1_024.0).roundToInt()

fun roundedMsToRr1024(value: Int): Int = (value * 1_024.0 / 1_000.0).roundToInt()

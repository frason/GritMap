package com.gritmap.karoo.physiology

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BleHeartRateMeasurementParserTest {
    @Test
    fun `parses H10 style 8-bit heart rate and multiple RR intervals`() {
        val measurement = BleHeartRateMeasurementParser.parse(
            byteArrayOf(
                0x16, // RR present, contact supported and detected, 8-bit HR
                0x78, // 120 BPM
                0x00, 0x02, // 512 units = 500 ms
                0x10, 0x02, // 528 units = 515.625 ms -> 516 ms
            ),
        )

        assertEquals(120, measurement.heartRateBpm)
        assertEquals(listOf(500, 516), measurement.rrIntervalsMs)
        assertEquals(listOf(512, 528), measurement.rrIntervals1024)
        assertTrue(measurement.sensorContactSupported)
        assertTrue(measurement.sensorContactDetected == true)
    }

    @Test
    fun `parses 16-bit heart rate with energy field and no RR`() {
        val measurement = BleHeartRateMeasurementParser.parse(
            byteArrayOf(
                0x09, // 16-bit HR and energy present
                0x2c, 0x01, // 300 BPM (format coverage, not a validity assertion)
                0x34, 0x12, // ignored energy value
            ),
        )

        assertEquals(300, measurement.heartRateBpm)
        assertTrue(measurement.rrIntervalsMs.isEmpty())
        assertFalse(measurement.sensorContactSupported)
        assertNull(measurement.sensorContactDetected)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `rejects truncated RR payload`() {
        BleHeartRateMeasurementParser.parse(byteArrayOf(0x10, 60, 0x01))
    }
}

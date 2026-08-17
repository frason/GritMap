package com.gritmap.karoo.ai

import org.junit.Assert.assertEquals
import org.junit.Test

class TelemetryV1Test {
    @Test fun hasStableVersionedWireOrder() {
        val values = TelemetryV1(1f, 2f, 3f, 4f, 5f, 6f, 7f, 8f, 9f, 10f, 11f, 12f).toFloatArray()
        assertEquals(TelemetryV1.ARRAY_SIZE, values.size)
        assertEquals(listOf(1f, 1f, 2f, 3f, 4f, 5f, 6f, 7f, 8f, 9f, 10f, 11f, 12f), values.toList())
    }
}

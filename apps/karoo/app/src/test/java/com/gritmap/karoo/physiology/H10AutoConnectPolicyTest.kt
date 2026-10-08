package com.gritmap.karoo.physiology

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class H10AutoConnectPolicyTest {
    @Test
    fun `selects one explicit Polar sensor among unrelated devices`() {
        val polar = H10Device("AA:BB:CC:DD:EE:01", "Polar H10 123456", -55)
        assertEquals(
            polar,
            selectAutomaticH10Device(
                listOf(H10Device("AA:BB:CC:DD:EE:02", "Other HR", -30), polar),
            ),
        )
    }

    @Test
    fun `selects sole generic heart rate service device`() {
        val only = H10Device("AA:BB:CC:DD:EE:01", "HR Sensor", -50)
        assertEquals(only, selectAutomaticH10Device(listOf(only)))
    }

    @Test
    fun `refuses to guess between multiple plausible sensors`() {
        assertNull(
            selectAutomaticH10Device(
                listOf(
                    H10Device("AA:BB:CC:DD:EE:01", "Polar H10 One", -40),
                    H10Device("AA:BB:CC:DD:EE:02", "Polar H10 Two", -50),
                ),
            ),
        )
    }
}

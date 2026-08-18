package com.gritmap.karoo.service

import java.nio.file.Files
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BoundedDiagnosticLogTest {
    @Test
    fun `records sanitized lines and returns newest tail`() {
        val directory = Files.createTempDirectory("gritmap-diagnostics").toFile()
        val file = directory.resolve("live.log")
        var now = 10L
        val log = BoundedDiagnosticLog(file, maxBytes = 1_000) { now++ }

        log.append("ride_state", "state=Recording\nunsafe")
        log.append("gps", "count=10")

        assertEquals(listOf("11\tgps\tcount=10"), log.tail(1))
        assertFalse(file.readText().contains('\r'))
        assertTrue(file.readText().contains("state=Recording unsafe"))
    }

    @Test
    fun `rotates before exceeding bounded active file`() {
        val directory = Files.createTempDirectory("gritmap-diagnostics-rotate").toFile()
        val file = directory.resolve("live.log")
        val log = BoundedDiagnosticLog(file, maxBytes = 45) { 100L }

        repeat(5) { log.append("event", "value=$it") }

        assertTrue(file.exists())
        assertTrue(directory.resolve("live.log.previous").exists())
        assertTrue(file.length() <= 45)
    }
}

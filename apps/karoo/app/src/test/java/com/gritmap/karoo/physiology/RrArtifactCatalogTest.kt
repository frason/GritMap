package com.gritmap.karoo.physiology

import java.nio.file.Files
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RrArtifactCatalogTest {
    @Test
    fun `lists valid partial captures newest first and ignores unrelated files`() {
        val directory = Files.createTempDirectory("rr-catalog-test")
        RrArtifactWriter(directory, "older", 100L).use { writer ->
            writer.append(RrObservation(800L, 800, true))
            writer.checkpoint()
        }
        RrArtifactWriter(directory, "newer", 200L).use { writer ->
            writer.append(RrObservation(900L, 900, true))
            writer.checkpoint()
        }
        Files.write(directory.resolve("not-rr.txt"), "ignore".toByteArray())

        val captures = RrArtifactCatalog.recoverablePartials(directory)

        assertEquals(listOf(200L, 100L), captures.map { it.rideStartTimestampMs })
        assertEquals(listOf(1, 1), captures.map { it.sampleCount })
        assertTrue(captures.all { it.ignoredTrailingBytes == 0 })
    }
}

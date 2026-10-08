package com.gritmap.karoo.physiology

import java.nio.file.Files
import java.nio.file.StandardOpenOption
import java.io.DataOutputStream
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RrArtifactStoreTest {
    @Test
    fun `finalizes an atomic hash-verifiable artifact`() {
        val directory = Files.createTempDirectory("rr-artifact-test")
        val writer = RrArtifactWriter(directory, "ride-123", 1_700_000_000_000L)
        writer.append(RrObservation(800L, 800, true))
        writer.append(
            RrObservation(1_600L, 120, false, RrArtifactReason.INTERVAL_OUT_OF_RANGE),
        )

        val finalized = writer.finalizeArtifact()
        val recovered = RrArtifactWriter.recover(finalized.path)

        assertTrue(Files.exists(finalized.path))
        assertFalse(Files.exists(directory.resolve("ride-123.rr.partial")))
        assertEquals(64, finalized.sha256.length)
        assertEquals(2L, finalized.sampleCount)
        assertEquals(1_700_000_000_000L, recovered.rideStartTimestampMs)
        assertEquals(2, recovered.observations.size)
        assertEquals(RrArtifactReason.INTERVAL_OUT_OF_RANGE, recovered.observations[1].artifactReason)
        assertEquals(0, recovered.ignoredTrailingBytes)
    }

    @Test
    fun `recovers complete records from a truncated partial artifact`() {
        val directory = Files.createTempDirectory("rr-recovery-test")
        val writer = RrArtifactWriter(directory, "ride-456", 42L)
        writer.append(RrObservation(900L, 900, true))
        writer.checkpoint()
        writer.close()
        val partial = directory.resolve("ride-456.rr.partial")
        Files.write(partial, byteArrayOf(1, 2, 3), StandardOpenOption.APPEND)

        val recovered = RrArtifactWriter.recover(partial)

        assertEquals(1, recovered.observations.size)
        assertEquals(3, recovered.ignoredTrailingBytes)
        assertEquals(900, recovered.observations.single().rrIntervalMs)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `rejects ride IDs that could escape app-private storage`() {
        RrArtifactWriter(Files.createTempDirectory("rr-safe-path-test"), "../ride", 0L)
    }

    @Test
    fun `never overwrites a recoverable partial artifact`() {
        val directory = Files.createTempDirectory("rr-no-overwrite-test")
        RrArtifactWriter(directory, "same-ride", 1L).apply {
            append(RrObservation(800L, 800, true))
            checkpoint()
            close()
        }

        val error = runCatching { RrArtifactWriter(directory, "same-ride", 1L) }.exceptionOrNull()

        assertTrue(error != null)
        assertEquals(1, RrArtifactWriter.recover(directory.resolve("same-ride.rr.partial")).observations.size)
    }

    @Test
    fun `finalized artifact writes atomic segment and attempt identity metadata`() {
        val directory = Files.createTempDirectory("rr-identity-test")
        val identity = RrCaptureIdentity("capture-1", "segment-1", "attempt-1")
        val writer = RrArtifactWriter(directory, "capture-1", 123L, identity)
        writer.append(RrObservation(800L, 800, true))

        val finalized = writer.finalizeArtifact()
        val metadata = Files.readAllBytes(requireNotNull(finalized.metadataPath)).decodeToString()

        assertEquals(identity, finalized.identity)
        assertTrue(metadata.contains("\"captureId\":\"capture-1\""))
        assertTrue(metadata.contains("\"segmentId\":\"segment-1\""))
        assertTrue(metadata.contains("\"attemptId\":\"attempt-1\""))
        assertTrue(metadata.contains("\"sha256\":\"${finalized.sha256}\""))
        assertFalse(Files.exists(directory.resolve("capture-1.rr.json.partial")))
    }

    @Test
    fun `schema two preserves native 1024-second interval exactly`() {
        val directory = Files.createTempDirectory("rr-v2-precision-test")
        val writer = RrArtifactWriter(directory, "precision", 1L)
        writer.append(RrObservation(516L, 516, true, rrInterval1024 = 528))

        val finalized = writer.finalizeArtifact()
        val recovered = RrArtifactWriter.recover(finalized.path)

        assertEquals(2, recovered.schemaVersion)
        assertEquals(528, recovered.observations.single().rrInterval1024)
        assertEquals(516, recovered.observations.single().rrIntervalMs)
    }

    @Test
    fun `schema two reader remains backward compatible with schema one milliseconds`() {
        val path = Files.createTempFile("rr-v1-compatibility", ".rr")
        DataOutputStream(Files.newOutputStream(path)).use { output ->
            output.write(byteArrayOf('G'.code.toByte(), 'M'.code.toByte(), 'R'.code.toByte(), 'R'.code.toByte()))
            output.writeInt(1)
            output.writeLong(123L)
            output.writeLong(800L)
            output.writeInt(516)
            output.writeBoolean(true)
            output.writeByte(0)
        }

        val recovered = RrArtifactWriter.recover(path)

        assertEquals(1, recovered.schemaVersion)
        assertEquals(516, recovered.observations.single().rrIntervalMs)
        assertEquals(528, recovered.observations.single().rrInterval1024)
    }
}

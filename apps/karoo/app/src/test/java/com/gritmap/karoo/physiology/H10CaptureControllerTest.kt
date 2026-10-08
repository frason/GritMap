package com.gritmap.karoo.physiology

import java.nio.file.Files
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class H10CaptureControllerTest {
    @Test
    fun `captures every packet RR and finalizes a recoverable artifact`() {
        val directory = Files.createTempDirectory("h10-capture-test")
        var elapsedRealtime = 10_000L
        val controller = H10CaptureController(
            artifactDirectory = directory,
            wallClockMs = { 1_700_000_000_000L },
            elapsedRealtimeMs = { elapsedRealtime },
        )
        controller.startCapture()
        assertEquals(0, controller.state.value.recoverablePartialCount)
        elapsedRealtime = 12_000L

        controller.onMeasurement(
            measurement = BleHeartRateMeasurement(
                heartRateBpm = 120,
                rrIntervalsMs = listOf(500, 510),
                sensorContactSupported = true,
                sensorContactDetected = true,
            ),
            notificationElapsedRealtimeMs = elapsedRealtime,
        )
        val finalized = requireNotNull(controller.stopCapture())
        val recovered = RrArtifactWriter.recover(finalized.path)

        assertEquals(2L, finalized.sampleCount)
        assertEquals(listOf(1_490L, 2_000L), recovered.observations.map { it.elapsedMs })
        assertEquals(listOf(500, 510), recovered.observations.map { it.rrIntervalMs })
        assertEquals(120, controller.state.value.currentBpm)
        assertEquals(100, controller.state.value.validRrPct)
        assertFalse(controller.state.value.capturing)
        assertTrue(controller.state.value.status.startsWith("Saved 2"))
    }

    @Test
    fun `dropout reanchors capture and persists an explicit invalid gap beat`() {
        val directory = Files.createTempDirectory("h10-gap-test")
        var elapsedRealtime = 10_000L
        val controller = H10CaptureController(
            artifactDirectory = directory,
            wallClockMs = { 1_700_000_000_000L },
            elapsedRealtimeMs = { elapsedRealtime },
        )
        controller.startCapture()
        elapsedRealtime = 11_000L
        controller.onMeasurement(
            BleHeartRateMeasurement(60, listOf(1_000), true, true),
            elapsedRealtime,
        )
        elapsedRealtime = 15_000L
        controller.onMeasurement(
            BleHeartRateMeasurement(60, listOf(1_000), true, true),
            elapsedRealtime,
        )

        val recovered = RrArtifactWriter.recover(requireNotNull(controller.stopCapture()).path)

        assertEquals(listOf(1_000L, 5_000L), recovered.observations.map { it.elapsedMs })
        assertEquals(RrArtifactReason.GAP_AFTER_DROPOUT, recovered.observations.last().artifactReason)
        assertFalse(recovered.observations.last().valid)
        assertEquals(1L, controller.state.value.rrGapCount)
        assertFalse(controller.state.value.enhancedMetricsAllowed)
    }

    @Test
    fun `approach identity is upgraded with selected attempt before finalization`() {
        val directory = Files.createTempDirectory("h10-identity-test")
        val controller = H10CaptureController(
            artifactDirectory = directory,
            wallClockMs = { 1_700_000_000_000L },
            elapsedRealtimeMs = { 10_000L },
        )
        controller.startCapture(segmentId = "candidate-segment")

        controller.updateCaptureIdentity("selected-segment", "attempt-123")
        val finalized = requireNotNull(controller.stopCapture())

        assertEquals("selected-segment", finalized.identity?.segmentId)
        assertEquals("attempt-123", finalized.identity?.attemptId)
        assertTrue(
            Files.readAllBytes(requireNotNull(finalized.metadataPath)).decodeToString()
                .contains("attempt-123"),
        )
    }
}

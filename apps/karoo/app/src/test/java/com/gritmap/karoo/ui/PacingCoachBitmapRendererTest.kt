package com.gritmap.karoo.ui

import com.gritmap.karoo.karoo.KarooPreviewState
import com.gritmap.karoo.ui.state.Effort
import com.gritmap.karoo.ui.state.PacingZone
import com.gritmap.karoo.ui.state.PowerExecutionSample
import com.gritmap.karoo.ui.state.demoPacingZones
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.io.FileOutputStream

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [31])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class PacingCoachBitmapRendererTest {
    private val zones = listOf(
        PacingZone(0.0, 100.0, 225, Effort.RECOVER),
        PacingZone(100.0, 200.0, 260, Effort.HOLD),
        PacingZone(200.0, 300.0, 295, Effort.PUSH),
    )

    @Test
    fun `coach counter calls plan stretches sections`() {
        assertEquals("HOLD  ·  3/8 SECTIONS", pacingSectionCounterLabel(Effort.HOLD, 2, 8))
    }

    @Test
    fun `zone stack centers the zone containing current progress`() {
        assertEquals(1, currentZoneIndex(zones, 145.0))
        assertEquals(2, currentZoneIndex(zones, 300.0))
    }

    @Test
    fun `past current and future completion fills are deterministic`() {
        assertEquals(1f, zoneCompletion(145.0, zones[0], 0, 1))
        assertEquals(0.45f, zoneCompletion(145.0, zones[1], 1, 1), 0.001f)
        assertEquals(0f, zoneCompletion(145.0, zones[2], 2, 1))
        assertEquals(155f, completionTop(100f, 200f, 0.45f), 0.001f)
    }

    @Test
    fun `actual power settles to average of samples collected within zone`() {
        val state = KarooPreviewState.copy(
            powerExecutionHistory = listOf(
                PowerExecutionSample(110.0, 250, 260),
                PowerExecutionSample(140.0, 270, 260),
                PowerExecutionSample(170.0, 260, 260),
                PowerExecutionSample(220.0, 310, 295),
            ),
        )
        assertEquals(260, currentZoneAveragePower(state, zones[1]))
        assertEquals(310, completedZoneAveragePower(state, zones[2]))
    }

    @Test
    fun `current zone falls back to live power while completed zone requires samples`() {
        val state = KarooPreviewState.copy(
            rollingPowerWatts3s = 271,
            powerExecutionHistory = emptyList(),
        )
        assertEquals(271, currentZoneAveragePower(state, zones[1]))
        assertEquals(null, completedZoneAveragePower(state, zones[0]))
    }

    @Test
    fun `renderer produces requested responsive bitmap size`() {
        val bitmap = PacingCoachBitmapRenderer().render(KarooPreviewState, 448, 500)
        assertEquals(448, bitmap.width)
        assertEquals(500, bitmap.height)
        assertTrue(bitmap.byteCount > 0)
        val output = File("build/reports/pacing-coach-preview.png")
        output.parentFile?.mkdirs()
        FileOutputStream(output).use { bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
    }

    @Test
    fun `demo plan has twenty contiguous zones spanning the segment`() {
        val demoZones = demoPacingZones(600.0)
        assertEquals(20, demoZones.size)
        assertEquals(0.0, demoZones.first().startDistanceMeters, 0.0)
        assertEquals(600.0, demoZones.last().endDistanceMeters, 0.0)
        demoZones.zipWithNext().forEach { (left, right) ->
            assertEquals(left.endDistanceMeters, right.startDistanceMeters, 0.0)
        }
    }

    @Test
    fun `visible stack orders future above current and past below`() {
        assertEquals(listOf(3, 2, 1), pacingStackOrder(currentIndex = 2, lastIndex = 3, radius = 1))
        assertEquals(listOf(19, 18, 17), pacingStackOrder(currentIndex = 19, lastIndex = 19, radius = 2))
        assertEquals(listOf(2, 1, 0), pacingStackOrder(currentIndex = 0, lastIndex = 19, radius = 2))
    }

    @Test
    fun `continuous stack position does not jump at a zone boundary`() {
        assertEquals(8.99f, continuousStackPosition(8, 0.99f, 19), 0.001f)
        assertEquals(9.0f, continuousStackPosition(9, 0f, 19), 0.001f)
        assertEquals(19f, continuousStackPosition(19, 1f, 19), 0.001f)
    }

    @Test
    fun `context rows become smaller and substantially more transparent`() {
        val current = stackEmphasis(0f)
        val adjacent = stackEmphasis(1f)
        val far = stackEmphasis(2f)
        assertTrue(current.first > adjacent.first && adjacent.first > far.first)
        assertTrue(current.second > adjacent.second && adjacent.second > far.second)
        assertTrue(far.second < 80)
    }
}

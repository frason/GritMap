package com.gritmap.karoo.ui

import android.graphics.Color
import com.gritmap.karoo.karoo.KarooPreviewState
import com.gritmap.karoo.ui.state.CardiacDriftSample
import com.gritmap.karoo.ui.state.H10DfaSample
import com.gritmap.karoo.ui.state.LiveUiState
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
class CardiacDriftBitmapRendererTest {
    @Test
    fun `renders colored bands and a visible drift trace`() {
        val bitmap = CardiacDriftBitmapRenderer().render(
            listOf(
                CardiacDriftSample(0f, -4.0),
                CardiacDriftSample(0.25f, -1.0),
                CardiacDriftSample(0.5f, 3.0),
                CardiacDriftSample(1f, 6.0),
            ),
            300,
            120,
        )

        assertEquals(300, bitmap.width)
        assertEquals(120, bitmap.height)
        val pixels = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
        assertTrue(pixels.toSet().size >= 4)
    }

    @Test
    fun `renders full power hr dashboard at actual Karoo aspect`() {
        val bitmap = CardiacDriftBitmapRenderer().renderDashboard(KarooPreviewState, 480, 624)
        assertEquals(480, bitmap.width)
        assertEquals(624, bitmap.height)
        val pixels = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
        assertTrue(pixels.toSet().size > 10)
        assertTrue(pixels.contains(Color.rgb(38, 135, 232)))
        assertTrue(pixels.contains(Color.rgb(32, 170, 91)))
        val preview = File("build/reports/cardiac-drift-preview/large.png")
        requireNotNull(preview.parentFile).mkdirs()
        FileOutputStream(preview).use {
            bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
        }

        val small = CardiacDriftBitmapRenderer().renderSmallThreshold(KarooPreviewState, 240, 150)
        FileOutputStream(File(preview.parentFile, "small.png")).use {
            small.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
        }
        val smallWide = CardiacDriftBitmapRenderer().renderCompactGauge(KarooPreviewState, 480, 150)
        FileOutputStream(File(preview.parentFile, "small-wide.png")).use {
            smallWide.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
        }
        assertEquals(240, small.width)
        assertEquals(480, smallWide.width)
    }

    @Test
    fun `long qualified H10 effort adds the experimental context strip`() {
        val state = KarooPreviewState.copy(
            plannedFinishSeconds = 600,
            cardiacDriftValidSeconds = 420,
            h10EnhancedAvailable = true,
            h10ValidRrPct = 98,
            h10DfaAlpha1 = 0.62,
            h10DfaHistory = listOf(
                H10DfaSample(120, 0.9),
                H10DfaSample(180, 0.7),
                H10DfaSample(240, 0.4),
            ),
        )
        val bitmap = CardiacDriftBitmapRenderer().renderDashboard(state, 480, 624)
        val pixels = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)

        assertTrue(pixels.contains(Color.rgb(239, 174, 55)))
        assertTrue(pixels.contains(Color.rgb(231, 91, 64)))
    }

    @Test
    fun `short effort remains a visible response dashboard without H10`() {
        val state = LiveUiState(
            currentHeartRateBpm = 148,
            currentPowerWatts = 255,
            rollingPowerWatts3s = 252,
            cardiacDriftValidSeconds = 90,
            cardiacDriftPairedPct = 94,
            plannedFinishSeconds = 180,
        )
        val bitmap = CardiacDriftBitmapRenderer().renderDashboard(state, 480, 624)
        val pixels = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
        assertTrue(pixels.toSet().size > 8)
    }
}

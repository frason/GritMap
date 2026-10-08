package com.gritmap.karoo.ui

import android.graphics.Color
import com.gritmap.karoo.karoo.KarooPreviewState
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
class SegmentPerformanceBitmapRendererTest {
    @Test
    fun `slower prediction is red and progress is blue`() {
        val bitmap = SegmentPerformanceBitmapRenderer().render(
            plannedSeconds = 400,
            predictedSeconds = 430,
            progressFraction = 0.5f,
            width = 300,
            height = 80,
        )

        val pixels = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
        assertTrue(pixels.contains(Color.rgb(231, 91, 64)))
        assertTrue(pixels.contains(Color.rgb(29, 125, 220)))
        assertEquals(300, bitmap.width)
    }

    @Test
    fun `compact timeline keeps plan centered and marks faster prediction green`() {
        val bitmap = SegmentPerformanceBitmapRenderer().renderCompactTimeline(
            plannedSeconds = 400,
            predictedSeconds = 380,
            progressFraction = 0.5f,
            width = 520,
            height = 64,
        )
        val pixels = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
        assertTrue(pixels.contains(Color.rgb(32, 170, 91)))
        assertTrue(pixels.contains(Color.rgb(29, 125, 220)))
        assertEquals(520, bitmap.width)
    }

    @Test
    fun `large dashboard renders time bank and split gain loss colors`() {
        val state = KarooPreviewState.copy(
            plannedFinishSeconds = 2_430,
            predictedFinishSeconds = 2_418,
            progressMeters = 6_598.0,
            totalDistanceMeters = 10_461.0,
            segmentSplitDeltasSeconds = listOf(2, 1, -3, 4, 2, -1, 3, 2, 1, -2, 2, 1),
        )
        val bitmap = SegmentPerformanceBitmapRenderer().renderDashboard(state, 480, 624)
        val pixels = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
        assertTrue(pixels.contains(Color.rgb(32, 190, 105)))
        assertTrue(pixels.contains(Color.rgb(239, 91, 69)))
        assertEquals(480, bitmap.width)
        val preview = File("build/reports/segment-performance-preview/large.png")
        requireNotNull(preview.parentFile).mkdirs()
        FileOutputStream(preview).use {
            bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
        }
    }

    @Test
    fun `large dashboard gives pre split state an intentional empty state`() {
        val bitmap = SegmentPerformanceBitmapRenderer().renderDashboard(
            KarooPreviewState.copy(progressMeters = 40.0, segmentSplitDeltasSeconds = emptyList()),
            480,
            624,
        )
        assertEquals(480, bitmap.width)
        writePreview("large-pre-split.png", bitmap)
    }

    @Test
    fun `compact field sizes have dedicated performance compositions`() {
        val renderer = SegmentPerformanceBitmapRenderer()
        val small = renderer.renderCompactDashboard(KarooPreviewState, 240, 120, false)
        val mediumWide = renderer.renderCompactDashboard(KarooPreviewState, 480, 190, true)
        assertEquals(240, small.width)
        assertEquals(190, mediumWide.height)
        writePreview("small.png", small)
        writePreview("medium-wide.png", mediumWide)
    }

    private fun writePreview(name: String, bitmap: android.graphics.Bitmap) {
        val preview = File("build/reports/segment-performance-preview/$name")
        requireNotNull(preview.parentFile).mkdirs()
        FileOutputStream(preview).use {
            bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
        }
    }
}

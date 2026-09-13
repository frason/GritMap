package com.gritmap.karoo.ui

import android.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

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
}

package com.gritmap.karoo.ui

import com.gritmap.karoo.ui.state.CardiacDriftSample
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
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
}

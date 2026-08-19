package com.gritmap.karoo.ui

import android.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [31])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class PowerBalanceBitmapRendererTest {
    @Test
    fun `bar draws actual effort and white target marker`() {
        val bitmap = PowerBalanceBitmapRenderer().render(
            actualWatts = 225,
            targetWatts = 300,
            width = 100,
            height = 20,
        )

        assertEquals(Color.rgb(29, 125, 220), bitmap.getPixel(25, 10))
        assertEquals(Color.WHITE, bitmap.getPixel(67, 10))
        assertEquals(Color.rgb(48, 53, 60), bitmap.getPixel(85, 10))
    }
}

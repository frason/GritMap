package com.gritmap.karoo.ui

import com.gritmap.karoo.ui.state.LiveUiState
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
class BetaEmptyStateRenderersTest {
    @Test
    fun `all graphical fields render intentional idle states without optional sensors or segments`() {
        val idle = LiveUiState.Idle
        val renders = listOf(
            PacingCoachBitmapRenderer().render(idle, 480, 624),
            ProfileBitmapRenderer().renderFirstPersonRoute(idle, 480, 420),
            SegmentPerformanceBitmapRenderer().renderDashboard(idle, 480, 624),
            WPrimeBalanceBitmapRenderer().renderCalculating(480, 624),
            CardiacDriftBitmapRenderer().renderDashboard(idle, 480, 624),
            H10CardiacBitmapRenderer().renderDashboard(idle, 480, 624),
        )

        renders.forEach { bitmap ->
            assertTrue(bitmap.width > 0)
            assertTrue(bitmap.height > 0)
            val pixels = IntArray(bitmap.width * bitmap.height)
            bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
            assertTrue("idle field must contain visible information", pixels.toSet().size > 1)
        }
    }

    @Test
    fun `H10 compact field explicitly renders while enhanced data is unavailable`() {
        val bitmap = H10CardiacBitmapRenderer().renderCompact(LiveUiState.Idle, 240, 150)
        assertEquals(240, bitmap.width)
        assertEquals(150, bitmap.height)
        val pixels = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
        assertTrue(pixels.toSet().size > 1)
    }
}

package com.gritmap.karoo.ui

import com.gritmap.karoo.karoo.KarooPreviewState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [31])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class H10CardiacBitmapRendererTest {
    @Test
    fun `renders H10 dashboard and compact field`() {
        val renderer = H10CardiacBitmapRenderer()
        val dashboard = renderer.renderDashboard(KarooPreviewState, 480, 624)
        val compact = renderer.renderCompact(KarooPreviewState, 240, 150)

        assertEquals(480, dashboard.width)
        assertEquals(624, dashboard.height)
        assertEquals(240, compact.width)
        assertEquals(150, compact.height)
        assertNotEquals(dashboard.getPixel(0, 0), dashboard.getPixel(240, 90))
    }
}

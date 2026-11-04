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
        // Export the same dashboard/compact choices used by H10CardiacDataType.
        val out = java.io.File("build/reports/karoo-h10").apply { mkdirs() }
        for ((theme, palette) in listOf("dark" to KarooVisualPalette.Dark, "light" to KarooVisualPalette.Light)) {
            for ((w, h) in listOf(480 to 620, 240 to 620, 480 to 200, 240 to 320, 480 to 120, 240 to 120)) {
                val native = H10CardiacBitmapRenderer(palette)
                val bitmap = if (h == 620) native.renderDashboard(KarooPreviewState, w, h)
                    else native.renderCompact(KarooPreviewState, w, h)
                java.io.File(out, "$theme-${w}x$h.png").outputStream().use {
                    bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
                }
            }
        }
    }
}

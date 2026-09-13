package com.gritmap.karoo.karoo

import com.gritmap.karoo.ui.state.GuidanceIcon
import io.hammerhead.karooext.models.ViewConfig
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class KarooFieldLayoutTest {
    @Test
    fun `full width layouts respond to actual height`() {
        assertEquals(KarooFieldLayout.SMALL_WIDE, layout(columns = 60, heightPx = 159))
        assertEquals(KarooFieldLayout.MEDIUM_WIDE, layout(columns = 60, heightPx = 160))
        assertEquals(KarooFieldLayout.LARGE, layout(columns = 60, heightPx = 250))
    }

    @Test
    fun `partial width layouts distinguish small medium and narrow`() {
        assertEquals(KarooFieldLayout.SMALL, layout(columns = 30, heightPx = 199))
        assertEquals(KarooFieldLayout.MEDIUM, layout(columns = 30, heightPx = 200))
        assertEquals(KarooFieldLayout.NARROW, layout(columns = 30, heightPx = 600))
    }

    @Test
    fun `compact profile becomes a pacing strip`() {
        val presentation = pacingProfilePresentation(KarooPreviewState, KarooFieldLayout.SMALL_WIDE)

        assertTrue(presentation.compactStrip)
        assertFalse(presentation.showHeader)
        assertEquals("HOLD", presentation.guidance)
    }

    @Test
    fun `short full width profile also uses horizontal pacing strip`() {
        val presentation = pacingProfilePresentation(KarooPreviewState, KarooFieldLayout.MEDIUM_WIDE)

        assertTrue(presentation.compactStrip)
        assertFalse(presentation.verticalPacer)
        assertTrue(presentation.showHeader)
        assertTrue(presentation.showFooter)
    }

    @Test
    fun `large profile preserves complete guidance and elevation graph`() {
        val presentation = pacingProfilePresentation(KarooPreviewState, KarooFieldLayout.LARGE)

        assertFalse(presentation.compactStrip)
        assertTrue(presentation.verticalPacer)
        assertTrue(presentation.showHeader)
        assertTrue(presentation.showGuidance)
        assertTrue(presentation.showFooter)
        assertEquals("HOLD", presentation.guidance)
        assertEquals("3s 247 W · -13 W", presentation.execution)
        assertEquals("318 m left", presentation.remaining)
    }

    @Test
    fun `effort palette is recover green hold blue and push red`() {
        assertEquals(0xFF20AA5B.toInt(), karooEffortColor(GuidanceIcon.RECOVER))
        assertEquals(0xFF1D7DDC.toInt(), karooEffortColor(GuidanceIcon.HOLD))
        assertEquals(0xFFE75B40.toInt(), karooEffortColor(GuidanceIcon.PUSH))
        assertEquals(0xFF000000.toInt(), karooEffortTextColor(GuidanceIcon.RECOVER))
        assertEquals(0xFFFFFFFF.toInt(), karooEffortTextColor(GuidanceIcon.HOLD))
        assertEquals(0xFFFFFFFF.toInt(), karooEffortTextColor(GuidanceIcon.PUSH))
    }

    private fun layout(columns: Int, heightPx: Int) = karooFieldLayout(
        ViewConfig(
            gridSize = columns to 15,
            viewSize = 600 to heightPx,
            textSize = 24,
        ),
    )
}

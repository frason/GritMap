package com.gritmap.karoo.karoo

import org.junit.Assert.assertEquals
import org.junit.Test

class CombinedDataTypesTest {
    @Test
    fun `coach combines target actual delta and next change`() {
        val text = pacingCoachText(KarooPreviewState)

        assertEquals("Hold steady", text.action)
        assertEquals("260 W", text.target)
        assertEquals("Actual 247 W · -13 W", text.actual)
        assertEquals("Push 295 W in 175 m", text.next)
    }

    @Test
    fun `performance combines prediction adherence and progress`() {
        val text = segmentPerformanceText(KarooPreviewState)

        assertEquals("Predicted 2:48", text.predictedFinish)
        assertEquals("Plan adherence 91%", text.adherence)
        assertEquals("215 / 533 m", text.progress)
    }

    @Test
    fun `duration includes hours only when needed`() {
        assertEquals("2:48", formatDuration(168))
        assertEquals("1:02:03", formatDuration(3_723))
    }
}

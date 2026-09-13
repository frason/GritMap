package com.gritmap.karoo.karoo

import io.hammerhead.karooext.models.ViewConfig
import io.hammerhead.karooext.models.StreamState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CombinedDataTypesTest {
    @Test
    fun `reserve comparison headline is concise and rounded`() {
        assertEquals("4% BELOW PLAN", reserveComparisonHeadline(78.2f, 82.0f))
        assertEquals("3% ABOVE PLAN", reserveComparisonHeadline(85.1f, 82.0f))
        assertEquals("ON PLAN", reserveComparisonHeadline(82.2f, 82.0f))
        assertEquals("WAITING FOR PLAN", reserveComparisonHeadline(82.0f, null))
    }
    @Test
    fun `coach combines target actual delta and next change`() {
        val text = pacingCoachText(KarooPreviewState)

        assertEquals("Hold steady", text.action)
        assertEquals("260 W", text.target)
        assertEquals("3s 247 W · -13 W", text.actual)
        assertEquals("Push 295 W in 175 m", text.next)
    }

    @Test
    fun `performance combines prediction adherence and progress`() {
        val text = segmentPerformanceText(KarooPreviewState)

        assertEquals("Plan 2:40", text.plannedFinish)
        assertEquals("Predicted 2:48", text.predictedFinish)
        assertEquals("Adherence 91% · +0:08", text.adherence)
        assertEquals("215 / 533 m", text.progress)
    }

    @Test
    fun `duration includes hours only when needed`() {
        assertEquals("2:48", formatDuration(168))
        assertEquals("1:02:03", formatDuration(3_723))
    }

    @Test
    fun `negative cardiac drift keeps its sign`() {
        assertEquals("-2.4%", formatCardiacDrift(-2.4))
        assertEquals("+1.8%", formatCardiacDrift(1.8))
    }

    @Test
    fun `trend directions use meaningful deadbands`() {
        val changing = karooPreviewStateAt(6)
        assertEquals("↓", powerTrend(changing))
        assertEquals("↑", cardiacDriftTrend(changing.cardiacDriftHistory))
    }

    @Test
    fun `power delta distinguishes on target under target and over target`() {
        assertEquals(POWER_DELTA_ON_TARGET, powerDeltaColor(-13, 270))
        assertEquals(POWER_DELTA_UNDER, powerDeltaColor(-40, 270))
        assertEquals(POWER_DELTA_OVER, powerDeltaColor(40, 270))
    }

    @Test
    fun `field size follows Karoo grid row span boundaries`() {
        assertEquals(KarooFieldSize.SMALL, karooFieldSize(config(rows = 15)))
        assertEquals(KarooFieldSize.MEDIUM, karooFieldSize(config(rows = 16)))
        assertEquals(KarooFieldSize.MEDIUM, karooFieldSize(config(rows = 29)))
        assertEquals(KarooFieldSize.LARGE, karooFieldSize(config(rows = 30)))
    }

    @Test
    fun `watts per heart rate can stream as a native numeric value`() {
        val stream = numericStreamState(
            value = KarooPreviewState.wattsPerHeartRate,
            matchStatus = KarooPreviewState.matchStatus,
            dataTypeId = WattsPerHeartRateDataType.TYPE_ID,
        )

        assertTrue(stream is StreamState.Streaming)
        val point = (stream as StreamState.Streaming).dataPoint
        assertEquals(
            requireNotNull(KarooPreviewState.wattsPerHeartRate),
            requireNotNull(point.singleValue),
            0.0001,
        )
    }

    private fun config(rows: Int) = ViewConfig(
        gridSize = 60 to rows,
        viewSize = 480 to rows * 12,
        textSize = 24,
    )
}

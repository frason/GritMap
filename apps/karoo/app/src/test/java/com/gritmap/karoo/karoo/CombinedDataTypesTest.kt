package com.gritmap.karoo.karoo

import io.hammerhead.karooext.models.ViewConfig
import io.hammerhead.karooext.models.StreamState
import com.gritmap.karoo.ui.state.Effort
import com.gritmap.karoo.ui.state.PacingZone
import com.gritmap.karoo.ui.state.UnitSystem
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

        assertEquals("Coco Jumbo  ·  705 ft / 1749 ft", text.header)
        assertEquals("Hold steady", text.action)
        assertEquals("260 W", text.target)
        assertEquals("3s 247 W · -13 W", text.actual)
        assertEquals("NEXT RECOVER  ·  245 W  ·  79 ft", text.next)
        assertEquals("3s BEHIND", text.paceRelation)
        assertEquals("LIVE  ·  ADAPTIVE", text.quality)
    }

    @Test
    fun `coach exposes estimated and stale guidance instead of presenting it as live`() {
        val uncertain = pacingCoachText(
            KarooPreviewState.copy(matchStatus = com.gritmap.karoo.ui.state.MatchStatus.UNCERTAIN),
        )
        assertEquals("ESTIMATED  ·  ROUTE UNCERTAIN", uncertain.quality)

        val stale = pacingCoachText(
            KarooPreviewState.copy(
                sensorStatus = KarooPreviewState.sensorStatus.copy(gps = false, power = false),
            ),
        )
        assertEquals("STALE  ·  GPS + POWER MISSING", stale.quality)
    }

    @Test
    fun `coach next preview follows adaptive plan zone boundaries`() {
        val shortSegment = KarooPreviewState.copy(
            progressMeters = 145.0,
            distanceUnitSystem = UnitSystem.METRIC,
            pacingZones = listOf(
                PacingZone(0.0, 100.0, 225, Effort.RECOVER),
                PacingZone(100.0, 200.0, 260, Effort.HOLD),
                PacingZone(200.0, 300.0, 295, Effort.PUSH),
            ),
        )

        val text = pacingCoachText(shortSegment)

        assertEquals("NEXT PUSH  ·  295 W  ·  55 m", text.next)
    }

    @Test
    fun `performance combines prediction adherence and progress`() {
        val text = segmentPerformanceText(KarooPreviewState)

        assertEquals("Plan 2:40", text.plannedFinish)
        assertEquals("Predicted 2:48", text.predictedFinish)
        assertEquals("Adherence 91% · +0:08", text.adherence)
        assertEquals("215 / 533 m", text.progress)
        assertEquals("0:08 BEHIND", text.variance)
    }

    @Test
    fun `finish variance uses fixed ahead behind semantics`() {
        assertEquals("0:20 AHEAD", finishVarianceLabel(400, 380))
        assertEquals("0:20 BEHIND", finishVarianceLabel(400, 420))
        assertEquals("ON PLAN", finishVarianceLabel(400, 400))
        assertEquals("--", finishVarianceLabel(null, 400))
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

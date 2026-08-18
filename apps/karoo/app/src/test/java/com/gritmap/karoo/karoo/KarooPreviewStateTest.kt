package com.gritmap.karoo.karoo

import com.gritmap.karoo.ui.state.Effort
import com.gritmap.karoo.ui.state.LiveUiState
import io.hammerhead.karooext.models.DataType
import io.hammerhead.karooext.models.StreamState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class KarooPreviewStateTest {
    @Test
    fun `preview has a complete representative pacing profile`() {
        val preview = stateForKarooView(LiveUiState.Idle, preview = true)

        assertEquals("Coco Jumbo", preview.segmentName)
        assertEquals(533.0, preview.totalDistanceMeters, 0.0)
        assertTrue(preview.elevationProfile.size >= 2)
        assertEquals(listOf(Effort.RECOVER, Effort.HOLD, Effort.PUSH), preview.pacingZones.map { it.effort })
        assertEquals(260, preview.recommendation?.targetPowerWatts)
    }

    @Test
    fun `numeric preview emits representative watts`() {
        val stream = targetPowerStreamState(KarooPreviewState, DATA_TYPE_ID) as StreamState.Streaming

        assertEquals(mapOf(DataType.Field.SINGLE to 260.0), stream.dataPoint.values)
    }

    @Test
    fun `non-preview uses unchanged live state`() {
        val live = LiveUiState(segmentName = "Live segment")

        assertSame(live, stateForKarooView(live, preview = false))
    }

    private companion object {
        const val DATA_TYPE_ID = "gritmap-live-pacing:target-power"
    }
}

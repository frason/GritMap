package com.gritmap.karoo.karoo

import com.gritmap.karoo.ui.state.GuidanceIcon
import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.MatchStatus
import com.gritmap.karoo.ui.state.Recommendation
import io.hammerhead.karooext.models.DataType
import io.hammerhead.karooext.models.StreamState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

class TargetPowerDataTypeTest {
    @Test
    fun `idle state searches without inventing a zero watt target`() {
        assertSame(StreamState.Searching, targetPowerStreamState(LiveUiState.Idle, DATA_TYPE_ID))
    }

    @Test
    fun `active state without a plan is unavailable rather than zero`() {
        val state = LiveUiState(matchStatus = MatchStatus.ACTIVE)

        assertSame(StreamState.NotAvailable, targetPowerStreamState(state, DATA_TYPE_ID))
    }

    @Test
    fun `recommendation streams one standard numeric target`() {
        val state = LiveUiState(
            matchStatus = MatchStatus.ACTIVE,
            recommendation = Recommendation(275, "Hold", GuidanceIcon.HOLD),
        )

        val result = targetPowerStreamState(state, DATA_TYPE_ID) as StreamState.Streaming

        assertEquals(DATA_TYPE_ID, result.dataPoint.dataTypeId)
        assertEquals(mapOf(DataType.Field.SINGLE to 275.0), result.dataPoint.values)
    }

    private companion object {
        const val DATA_TYPE_ID = "gritmap-live-pacing:target-power"
    }
}

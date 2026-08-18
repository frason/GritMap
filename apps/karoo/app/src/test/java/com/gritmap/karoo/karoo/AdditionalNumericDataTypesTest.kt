package com.gritmap.karoo.karoo

import com.gritmap.karoo.ui.state.MatchStatus
import io.hammerhead.karooext.models.DataType
import io.hammerhead.karooext.models.StreamState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

class AdditionalNumericDataTypesTest {
    @Test
    fun `power delta preserves negative values`() {
        val result = numericStreamState(-13.0, MatchStatus.ACTIVE, "delta") as StreamState.Streaming
        assertEquals(mapOf(DataType.Field.SINGLE to -13.0), result.dataPoint.values)
    }

    @Test
    fun `missing active metric is unavailable`() {
        assertSame(StreamState.NotAvailable, numericStreamState(null, MatchStatus.ACTIVE, "metric"))
    }

    @Test
    fun `idle metric searches`() {
        assertSame(StreamState.Searching, numericStreamState(null, MatchStatus.IDLE, "metric"))
    }
}

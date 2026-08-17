package com.gritmap.karoo.service

import com.gritmap.karoo.ui.state.LiveUiState
import org.junit.Assert.assertEquals
import org.junit.Test

class ActiveAttemptSessionTest {
    @Test
    fun `long effort keeps only bounded recent telemetry`() {
        val session = ActiveAttemptSession("attempt", "segment", 0L, LiveUiState.Idle)

        repeat(1_801) { second ->
            session.accept(LiveTelemetry(timestampMs = second * 1_000L, powerWatts = 200.0))
        }

        assertEquals(121, session.recentSamples().size)
        assertEquals(1_801L, session.totalSampleCount)
        assertEquals(200.0, session.averagePowerWatts!!, 0.0)
    }
}

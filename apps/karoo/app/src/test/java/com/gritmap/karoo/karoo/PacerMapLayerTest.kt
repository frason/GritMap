package com.gritmap.karoo.karoo

import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.MatchStatus
import com.gritmap.karoo.ui.state.RouteSample
import io.hammerhead.karooext.models.HidePolyline
import io.hammerhead.karooext.models.HideSymbols
import io.hammerhead.karooext.models.ShowPolyline
import io.hammerhead.karooext.models.ShowSymbols
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PacerMapLayerTest {
    private val route = listOf(
        RouteSample(0.0, 38.0, -122.0),
        RouteSample(100.0, 38.001, -121.999),
        RouteSample(200.0, 38.002, -121.998),
    )

    @Test
    fun `projects pacer between route samples`() {
        val point = requireNotNull(pointAtDistance(route, 50.0))
        assertEquals(38.0005, point.lat, 0.000001)
        assertEquals(-121.9995, point.lng, 0.000001)
    }

    @Test
    fun `active state shows route once and updates stable pacer symbol`() {
        val layer = PacerMapLayer()
        val state = activeState()
        val first = layer.effects(state)
        assertTrue(first.any { it is ShowPolyline })
        assertTrue(first.any { it is ShowSymbols })
        val second = layer.effects(state.copy(elapsedAttemptSeconds = 60.0))
        assertTrue(second.none { it is ShowPolyline })
        assertEquals(PacerMapLayer.PACER_SYMBOL_ID, (second.single() as ShowSymbols).symbols.single().id)
    }

    @Test
    fun `uncertain state removes both symbol and polyline`() {
        val layer = PacerMapLayer()
        layer.effects(activeState())
        val hidden = layer.effects(activeState().copy(matchStatus = MatchStatus.UNCERTAIN))
        assertTrue(hidden.any { it is HideSymbols })
        assertTrue(hidden.any { it is HidePolyline })
        assertTrue(layer.effects(LiveUiState.Idle).isEmpty())
    }

    @Test
    fun `polyline encoder matches canonical Google example`() {
        val canonical = listOf(
            RouteSample(0.0, 38.5, -120.2),
            RouteSample(1.0, 40.7, -120.95),
            RouteSample(2.0, 43.252, -126.453),
        )
        assertEquals("_p~iF~ps|U_ulLnnqC_mqNvxq`@", encodePolyline(canonical))
    }

    private fun activeState() = LiveUiState(
        matchStatus = MatchStatus.ACTIVE,
        routeProfile = route,
        totalDistanceMeters = 200.0,
        plannedFinishSeconds = 100,
        elapsedAttemptSeconds = 50.0,
    )
}

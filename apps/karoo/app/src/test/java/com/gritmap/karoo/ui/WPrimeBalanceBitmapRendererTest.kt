package com.gritmap.karoo.ui

import com.gritmap.karoo.ui.state.WPrimePoint
import com.gritmap.karoo.ui.state.WPrimeState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [31])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class WPrimeBalanceBitmapRendererTest {
    private val state = WPrimeState(
        capacityJoules = 20_000.0,
        actualBalanceJoules = 12_000.0,
        plannedBalanceJoules = 14_000.0,
        plannedFinishBalanceJoules = 4_000.0,
        projectedFinishBalanceJoules = 2_000.0,
        criticalPowerWatts = 270.0,
        estimated = true,
        history = listOf(
            WPrimePoint(0f, 100f, 100f),
            WPrimePoint(0.5f, 60f, 70f),
        ),
        actualBalanceChangeJoulesPerSecond = -39.0,
        plannedBalanceChangeJoulesPerSecond = -24.0,
    )

    @Test
    fun `responsive reserve graphics render requested geometry`() {
        val renderer = WPrimeBalanceBitmapRenderer()
        val compact = renderer.renderCompact(state, 300, 72)
        val tanks = renderer.renderTanks(state, 320, 150)
        val trajectory = renderer.renderTrajectory(state, 600, 280)

        assertEquals(300, compact.width)
        assertEquals(150, tanks.height)
        assertEquals(600, trajectory.width)
        val pixels = IntArray(trajectory.width * trajectory.height)
        trajectory.getPixels(pixels, 0, trajectory.width, 0, 0, trajectory.width, trajectory.height)
        assertTrue(pixels.toSet().size > 5)
    }
}

package com.gritmap.karoo.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import androidx.test.core.app.ApplicationProvider
import com.gritmap.karoo.karoo.KarooPreviewState
import com.gritmap.karoo.karoo.karooPreviewStateAt
import com.gritmap.karoo.ui.state.UnitSystem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.io.FileOutputStream

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [31])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ProfileBitmapRendererTest {
    @Test
    fun `export pacing road visual regression contact sheet`() {
        ApplicationProvider.getApplicationContext<android.content.Context>()
        val width = 448
        val height = 500
        val states = listOf(0, 6, 12, 18).map(::karooPreviewStateAt)
        val sheet = Bitmap.createBitmap(width * 2, height * 2, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(sheet)
        states.forEachIndexed { index, state ->
            val frame = ProfileBitmapRenderer().renderFirstPersonRoute(state, width, height)
            canvas.drawBitmap(frame, ((index % 2) * width).toFloat(), ((index / 2) * height).toFloat(), null)
            val frameOutput = File("build/reports/pacing-preview/frame-$index.png")
            requireNotNull(frameOutput.parentFile).mkdirs()
            FileOutputStream(frameOutput).use { stream ->
                assertTrue(frame.compress(Bitmap.CompressFormat.PNG, 100, stream))
            }
        }
        val output = File("build/reports/pacing-preview/contact-sheet.png")
        requireNotNull(output.parentFile).mkdirs()
        FileOutputStream(output).use { stream ->
            assertTrue(sheet.compress(Bitmap.CompressFormat.PNG, 100, stream))
        }
        assertTrue(output.length() > 0L)
    }

    @Test
    fun `profile bitmap honors light palette background`() {
        val bitmap = ProfileBitmapRenderer(KarooVisualPalette.Light)
            .renderVerticalPacer(com.gritmap.karoo.ui.state.LiveUiState.Idle, 20, 20)

        assertEquals(KarooVisualPalette.Light.background, bitmap.getPixel(10, 10))
    }

    @Test
    fun `plan strip uses recover green hold blue and push red`() {
        ApplicationProvider.getApplicationContext<android.content.Context>()
        val bitmap = ProfileBitmapRenderer().render(KarooPreviewState, 100, 100)

        assertEquals(Color.rgb(32, 170, 91), bitmap.getPixel(5, 97))
        assertEquals(Color.rgb(29, 125, 220), bitmap.getPixel(50, 97))
        assertEquals(Color.rgb(231, 91, 64), bitmap.getPixel(95, 97))

        val recoverBackground = bitmap.getPixel(5, 50)
        assertTrue(Color.green(recoverBackground) > Color.red(recoverBackground))
        assertTrue(Color.green(recoverBackground) > Color.blue(recoverBackground))
    }

    @Test
    fun `rider dot follows elevation curve rather than vertical midpoint`() {
        ApplicationProvider.getApplicationContext<android.content.Context>()
        val state = KarooPreviewState.copy(progressMeters = 500.0)
        val bitmap = ProfileBitmapRenderer().render(state, 100, 100)
        val markerX = (state.progressFraction * 100).toInt()

        // Near the end of this rising profile, the marker must be high in the chart.
        val hasWhiteMarkerNearCurve = (0..25).any { y ->
            val pixel = bitmap.getPixel((markerX + 4).coerceAtMost(99), y)
            Color.red(pixel) > 230 && Color.green(pixel) > 230 && Color.blue(pixel) > 230
        }
        assertTrue(hasWhiteMarkerNearCurve)
    }

    @Test
    fun `compact strip layers completed execution over muted upcoming plan`() {
        ApplicationProvider.getApplicationContext<android.content.Context>()
        val state = karooPreviewStateAt(6)
        val bitmap = ProfileBitmapRenderer().renderPacingStrip(state, 100, 30)

        val completed = bitmap.getPixel(20, 15)
        val upcoming = bitmap.getPixel(90, 15)
        assertTrue(completed != upcoming)
        // Upcoming location is still a muted red Push recommendation.
        assertTrue(Color.red(upcoming) > Color.green(upcoming))
        assertTrue(Color.red(upcoming) > Color.blue(upcoming))
    }

    @Test
    fun `compact strip shows red virtual rider ahead of white current rider`() {
        ApplicationProvider.getApplicationContext<android.content.Context>()
        val state = KarooPreviewState.copy(
            progressMeters = 200.0,
            totalDistanceMeters = 500.0,
            plannedFinishSeconds = 100,
            elapsedAttemptSeconds = 50.0,
        )
        val bitmap = ProfileBitmapRenderer().renderPacingStrip(state, 100, 30)

        val currentRider = bitmap.getPixel(40, 15)
        assertTrue(
            Color.red(currentRider) > 230 &&
                Color.green(currentRider) > 230 &&
                Color.blue(currentRider) > 230,
        )
        val targetRider = bitmap.getPixel(54, 15)
        assertTrue(Color.red(targetRider) > Color.green(targetRider))
        assertTrue(Color.red(targetRider) > Color.blue(targetRider))
    }

    @Test
    fun `compact on-pace riders preserve a separate timed target circle`() {
        ApplicationProvider.getApplicationContext<android.content.Context>()
        val state = KarooPreviewState.copy(
            progressMeters = 250.0,
            totalDistanceMeters = 500.0,
            plannedFinishSeconds = 100,
            elapsedAttemptSeconds = 50.0,
        )
        val bitmap = ProfileBitmapRenderer().renderPacingStrip(state, 100, 30)

        val whiteRider = bitmap.getPixel(50, 15)
        assertTrue(Color.red(whiteRider) > 230 && Color.green(whiteRider) > 230)
        val targetCircle = bitmap.getPixel(39, 15)
        assertTrue(Color.green(targetCircle) > Color.red(targetCircle))
    }

    @Test
    fun `large first person profile keeps route elevation and colored watt cards`() {
        ApplicationProvider.getApplicationContext<android.content.Context>()
        val state = KarooPreviewState.copy(
            progressMeters = 215.0,
            plannedFinishSeconds = 160,
            elapsedAttemptSeconds = 80.0,
            rollingPowerWatts3s = 260,
        )
        val bitmap = ProfileBitmapRenderer().renderFirstPersonRoute(state, 300, 500)

        assertEquals(300, bitmap.width)
        assertEquals(500, bitmap.height)
        // Target card follows the current HOLD plan and is therefore blue.
        val targetCard = bitmap.getPixel(25, 330)
        assertTrue(Color.blue(targetCard) > Color.red(targetCard))
        // Actual exactly on target uses the green execution background.
        val actualCard = bitmap.getPixel(275, 330)
        assertTrue(Color.green(actualCard) > Color.red(actualCard))
        // The lower fifth is retained for the full elevation overview, not left blank.
        val elevationHasContent = (390 until 495).any { y ->
            (5 until 295 step 5).any { x -> bitmap.getPixel(x, y) != KarooVisualPalette.Dark.background }
        }
        assertTrue(elevationHasContent)
    }

    @Test
    fun `virtual target rider moves ahead or behind from planned schedule`() {
        val behindPlan = KarooPreviewState.copy(
            progressMeters = 200.0,
            totalDistanceMeters = 500.0,
            plannedFinishSeconds = 100,
            elapsedAttemptSeconds = 50.0,
        )
        val aheadOfPlan = behindPlan.copy(progressMeters = 300.0)

        val redTargetAhead = requireNotNull(virtualPacerGap(behindPlan))
        val greenTargetBehind = requireNotNull(virtualPacerGap(aheadOfPlan))
        assertTrue(redTargetAhead.targetIsAhead)
        assertEquals(50.0, redTargetAhead.gapMeters, 0.001)
        assertTrue(!greenTargetBehind.targetIsAhead)
        assertEquals(-50.0, greenTargetBehind.gapMeters, 0.001)
        assertEquals(10, pacerTimeGapSeconds(behindPlan, redTargetAhead))
        assertEquals("+10s", formatPacerTimeGap(10))
        assertEquals("-1:12", formatPacerTimeGap(-72))
        assertEquals("-164 ft", formatSignedPacerDistance(-50.0, UnitSystem.IMPERIAL))
        assertEquals("+50 m", formatSignedPacerDistance(50.0, UnitSystem.METRIC))
    }

    @Test
    fun `virtual pacing scale zooms in near target and uses denser ticks`() {
        val closeRadius = adaptivePacerRadiusMeters(gapMeters = 8.0, totalDistanceMeters = 500.0)
        val farRadius = adaptivePacerRadiusMeters(gapMeters = 180.0, totalDistanceMeters = 500.0)

        assertEquals(55.0, closeRadius, 0.001)
        assertTrue(farRadius > closeRadius)
        assertEquals(10.0, pacerTickIntervalMeters(closeRadius), 0.001)
        assertEquals(10.0, pacerTickIntervalMeters(farRadius), 0.001)
    }

    @Test
    fun `first person camera expands materially for distant targets in either direction`() {
        assertEquals(200.0, firstPersonAheadMeters(5.0), 0.001)
        assertTrue(firstPersonAheadMeters(600.0) > 900.0)
        assertEquals(24.0, firstPersonPastMeters(5.0), 0.001)
        assertTrue(firstPersonPastMeters(-120.0) > 180.0)
    }

    @Test
    fun `vertical pacer renders distinct plan and actual halves`() {
        ApplicationProvider.getApplicationContext<android.content.Context>()
        val bitmap = ProfileBitmapRenderer().renderVerticalPacer(karooPreviewStateAt(8), 300, 500)
        val leftPast = bitmap.getPixel(40, 400)
        val rightPast = bitmap.getPixel(260, 400)
        assertTrue(leftPast != rightPast)
        val rider = bitmap.getPixel(150, 250)
        assertTrue(Color.red(rider) > 230 && Color.green(rider) > 230 && Color.blue(rider) > 230)
    }
}

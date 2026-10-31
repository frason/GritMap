package com.gritmap.karoo.ui

import android.content.Context
import android.graphics.*
import androidx.test.core.app.ApplicationProvider
import com.gritmap.karoo.karoo.*
import com.gritmap.karoo.ui.state.*
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[31])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class GlanceFieldsTest {
    private val context=ApplicationProvider.getApplicationContext<Context>()
    private val state=KarooPreviewState.copy(segmentName="Synthetic climb",headlineAttemptId="attempt-1",hasCompleteElevationProfile=true,progressMeters=533*.42,elapsedAttemptSeconds=62.4,
        pacingZones=listOf(PacingZone(0.0,300.0,280,Effort.HOLD),PacingZone(300.0,533.0,300,Effort.PUSH)),
        recommendation=Recommendation(280,"Hold",GuidanceIcon.HOLD),rollingPowerWatts3s=276,
        plannedFinishSeconds=160,predictedFinishSeconds=154,cardiacDriftPct=1.8,cardiacDriftHistory=KarooPreviewState.cardiacDriftHistory.map {it.copy(driftPct=it.driftPct*1.8/3.8)})

    @Test fun `pacing ids remain registered and both use shared native adapter`() {
        assertEquals("pacing-coach",PacingCoachDataType.TYPE_ID)
        assertEquals("live-pacing",PacingProfileDataType.TYPE_ID)
        assertTrue(GlanceGraphicDataType::class.java.isAssignableFrom(PacingCoachDataType::class.java))
        assertTrue(GlanceGraphicDataType::class.java.isAssignableFrom(PacingProfileDataType::class.java))
    }
    @Test fun `performance deadband is presentation only and missing estimate is honest`() {
        for(delta in listOf(-2,0,2)) assertEquals("ON GOAL",glancePresentation(GlanceField.PERFORMANCE,state.copy(predictedFinishSeconds=160+delta)).verdict)
        assertEquals("BEHIND",glancePresentation(GlanceField.PERFORMANCE,state.copy(predictedFinishSeconds=163)).verdict)
        assertEquals("AHEAD",glancePresentation(GlanceField.PERFORMANCE,state.copy(predictedFinishSeconds=157)).verdict)
        assertEquals("WAITING",glancePresentation(GlanceField.PERFORMANCE,state.copy(predictedFinishSeconds=null)).verdict)
        assertEquals(3.0,com.gritmap.karoo.pacing.LiveReplanner.DEADBAND_SECONDS,0.0)
    }
    @Test fun `balance missing finish is not treated as an OK forecast`() {
        val b=state.wPrime!!
        assertEquals("NO ESTIMATE",glancePresentation(GlanceField.BALANCE,state.copy(wPrime=b.copy(projectedFinishBalanceJoules=null))).verdict)
        assertEquals("LOW",glancePresentation(GlanceField.BALANCE,state.copy(wPrime=b.copy(actualBalanceJoules=10000.0,projectedFinishBalanceJoules=b.capacityJoules*.04))).verdict)
        assertEquals("EASE NOW",glancePresentation(GlanceField.BALANCE,state.copy(wPrime=b.copy(actualBalanceJoules=b.capacityJoules*.09))).verdict)
    }
    @Test fun `cardiac formation gates negative values and five percent retain current semantics`() {
        assertEquals("BASELINE",glancePresentation(GlanceField.DRIFT,state.copy(cardiacDriftValidSeconds=179)).verdict)
        assertEquals("DRIFT FORMING",glancePresentation(GlanceField.DRIFT,state.copy(cardiacDriftValidSeconds=180)).verdict)
        assertEquals("HIGH",glancePresentation(GlanceField.DRIFT,state.copy(cardiacDriftPct=-6.0,cardiacDriftValidSeconds=360)).verdict)
        assertEquals("HIGH",glancePresentation(GlanceField.DRIFT,state.copy(cardiacDriftPct=5.0)).verdict)
        assertEquals("POWER VARYING",glancePresentation(GlanceField.DRIFT,state.copy(cardiacDriftPowerSteady=false)).support)
    }
    @Test fun `no plan is never presented as a generated watt target`() {
        val model=glancePresentation(GlanceField.PACING,LiveUiState.Idle)
        assertEquals("NO PLAN",model.verdict);assertEquals("--",model.hero)
    }
    @Test fun `last valid number expires and cannot leak across attempts`() {
        var clock=1000L
        val renderer=GlanceFieldRenderer(GlanceField.PACING,KarooVisualPalette.Dark,context.resources) {clock}
        assertEquals("280",renderer.present(state).hero)
        val missing=state.copy(sensorStatus=state.sensorStatus.copy(power=false,gps=false),recommendation=null,pacingZones=state.pacingZones.map {it.copy(targetPowerWatts=300)})
        clock=2000
        assertEquals("280",renderer.present(missing).hero)
        clock=6001
        assertEquals("--",renderer.present(missing).hero)
        renderer.present(state)
        assertEquals("--",renderer.present(missing.copy(headlineAttemptId="attempt-2")).hero)
    }
    @Test fun `held cardiac value keeps its original unit when HR disappears`() {
        var clock=0L
        val renderer=GlanceFieldRenderer(GlanceField.DRIFT,KarooVisualPalette.Dark,context.resources) {clock}
        val baseline=state.copy(cardiacDriftValidSeconds=100)
        assertEquals("BPM",renderer.present(baseline).unit)
        clock=1000
        val lost=renderer.present(baseline.copy(currentHeartRateBpm=null,sensorStatus=baseline.sensorStatus.copy(heartRate=false)))
        assertEquals("BPM",lost.unit)
        assertTrue(lost.label.startsWith("LAST"))
        clock=6000
        assertEquals("--",renderer.present(baseline.copy(currentHeartRateBpm=null,sensorStatus=baseline.sensorStatus.copy(heartRate=false))).hero)
    }
    @Test fun `render matrix covers all layouts themes and states including pathological geometry`() {
        val dimensions=listOf(Triple(KarooFieldLayout.LARGE,480,620),Triple(KarooFieldLayout.MEDIUM_WIDE,480,200),Triple(KarooFieldLayout.SMALL_WIDE,480,120),Triple(KarooFieldLayout.NARROW,240,620),Triple(KarooFieldLayout.MEDIUM,240,320),Triple(KarooFieldLayout.SMALL,240,120))
        val samples=listOf(state,state.copy(progressMeters=533*.55,elapsedAttemptSeconds=99.2,predictedFinishSeconds=168,cardiacDriftPct=4.2,cardiacDriftHistory=state.cardiacDriftHistory.map {it.copy(driftPct=it.driftPct*4.2/1.8)},recommendation=Recommendation(300,"Push",GuidanceIcon.PUSH),rollingPowerWatts3s=255,pacingZones=listOf(PacingZone(0.0,300.0,300,Effort.PUSH),PacingZone(300.0,533.0,280,Effort.HOLD)),wPrime=state.wPrime!!.copy(projectedFinishBalanceJoules=800.0)),LiveUiState.Idle,state.copy(sensorStatus=state.sensorStatus.copy(power=false,gps=false,heartRate=false)))
        val out=File("build/reports/karoo-glance").apply {mkdirs()}
        for((theme,palette) in listOf("dark" to KarooVisualPalette.Dark,"light" to KarooVisualPalette.Light)) for(kind in GlanceField.entries) {
            val sheet=Bitmap.createBitmap(2000,1500,Bitmap.Config.ARGB_8888)
            val canvas=Canvas(sheet);canvas.drawColor(Color.GRAY)
            val warning=when(kind) {
                GlanceField.PACING -> state.copy(sensorStatus=state.sensorStatus.copy(power=false))
                GlanceField.PERFORMANCE -> state.copy(replanEstimate=com.gritmap.karoo.pacing.ReplanResult(state.pacingZones.map {it.targetPowerWatts},172.0,false,12.0,false,true))
                GlanceField.DRIFT -> state.copy(cardiacDriftPct=6.8,cardiacDriftHistory=state.cardiacDriftHistory.map {it.copy(driftPct=it.driftPct*6.8/1.8)})
                GlanceField.BALANCE -> state.copy(wPrime=state.wPrime!!.copy(actualBalanceJoules=state.wPrime!!.capacityJoules*.09,projectedFinishBalanceJoules=0.0))
            }
            val cases=samples.take(3)+warning
            dimensions.forEachIndexed { row,(layout,width,height) -> cases.forEachIndexed { column,s ->
                val bitmap=GlanceFieldRenderer(kind,palette,context.resources).let { renderer ->
                    renderer.present(state)
                    renderer.render(s,width,height,layout)
                }
                assertEquals(width,bitmap.width);assertEquals(height,bitmap.height)
                val pixels=IntArray(width*height);bitmap.getPixels(pixels,0,width,0,0,width,height)
                assertTrue("visible $theme $kind $layout",pixels.toSet().size>5)
                File(out,"${kind.name.lowercase()}-$theme-${layout.name.lowercase()}-$column.png").outputStream().use {bitmap.compress(Bitmap.CompressFormat.PNG,100,it)}
                val scale=minOf(480f/width,230f/height)
                canvas.drawBitmap(bitmap,null,RectF(column*500f,row*250f,column*500f+width*scale,row*250f+height*scale),null)
            }}
            File(out,"${kind.name.lowercase()}-$theme-sheet.png").outputStream().use {sheet.compress(Bitmap.CompressFormat.PNG,100,it)}
            val renderer=GlanceFieldRenderer(kind,palette,context.resources)
            for((w,h) in listOf(1 to 1,20 to 620,240 to 199,240 to 200,240 to 599,240 to 600,480 to 159,480 to 160,480 to 249,480 to 250)) {
                val config=io.hammerhead.karooext.models.ViewConfig(gridSize=(if(w>=400)60 else 30) to 15,viewSize=w to h,textSize=16)
                renderer.render(state.copy(progressMeters=0.0),w,h,karooFieldLayout(config))
                renderer.render(state.copy(progressMeters=533.0),w,h,karooFieldLayout(config))
            }
        }
    }
}

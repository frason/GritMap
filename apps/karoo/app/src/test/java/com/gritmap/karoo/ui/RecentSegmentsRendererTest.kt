package com.gritmap.karoo.ui

import android.content.Context
import android.graphics.*
import androidx.test.core.app.ApplicationProvider
import com.gritmap.karoo.data.*
import com.gritmap.karoo.karoo.*
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
class RecentSegmentsRendererTest {
    private val now=1_000_000_000L
    private val sample=recentPreviewResults(now).first()

    @Test fun `result compares captured goal at displayed precision not a forecast deadband`() {
        fun present(seconds:Double)=recentResultPresentation(sample.copy(durationSeconds=seconds,goalSeconds=600),now)
        assertEquals("ON GOAL",present(600.4).comparison)
        assertEquals("BEHIND 0:01",present(600.6).comparison)
        assertEquals("AHEAD 0:01",present(599.4).comparison)
        val legacy=recentResultPresentation(sample.copy(approximate=true,goalSeconds=null),now)
        assertTrue(legacy.time.startsWith("~"));assertEquals("—",legacy.goal);assertEquals("NO GOAL",legacy.comparison)
        assertEquals("APPROXIMATE TIME",recentResultPresentation(sample.copy(approximate=true),now).comparison)
        assertEquals("1:01:40",resultClock(3700.0))
        assertEquals("—",recentResultPresentation(sample.copy(averagePowerWatts=Double.NaN),now).power)
        assertEquals("SAVED",recentResultPresentation(sample.copy(completedAtMs=now+1000),now).age)
    }

    @Test fun `highlight shrinks from completion and expires without removing results`() {
        assertEquals(30_000L,recentResultHighlightRemainingMs(now,now))
        assertEquals(15_000L,recentResultHighlightRemainingMs(now-15_000,now))
        assertEquals(1L,recentResultHighlightRemainingMs(now-29_999,now))
        assertEquals(0L,recentResultHighlightRemainingMs(now-30_000,now))
        assertEquals(0L,recentResultHighlightRemainingMs(now+1,now))
        assertEquals(0L,recentResultHighlightRemainingMs(0,now))
        val fresh=RecentResultsState.Ready(listOf(sample.copy(completedAtMs=now)))
        assertTrue(recentResultsDescription(fresh,now+15_000).contains("15 seconds remaining"))
        assertFalse(recentResultsDescription(fresh,now+30_000).contains("highlight"))
        assertTrue(recentResultsDescription(fresh,now+30_000).contains("Climb A"))
        val renderer=RecentSegmentsBitmapRenderer(KarooVisualPalette.Dark)
        val full=renderer.render(fresh,240,120,now)
        val half=renderer.render(fresh,240,120,now+15_000)
        val expired=renderer.render(fresh,240,120,now+30_000)
        assertEquals(Color.WHITE,full.getPixel(180,102))
        assertNotEquals(Color.WHITE,half.getPixel(180,102))
        assertEquals(Color.WHITE,half.getPixel(50,102))
        assertNotEquals(Color.WHITE,expired.getPixel(50,102))
    }

    @Test fun `new field is separate and compact sizes cannot receive full multi-row composition`() {
        assertEquals("recent-segment-results",RecentSegmentsDataType.TYPE_ID)
        assertEquals(3,recentRowsForSize(480,620));assertEquals(2,recentRowsForSize(240,620))
        assertEquals(1,recentRowsForSize(480,250));assertEquals(1,recentRowsForSize(240,120))
        assertEquals(0,recentRowsForSize(240,96))
        val description=recentResultsDescription(RecentResultsState.Ready(recentPreviewResults(now)),now,1)
        assertTrue(description.contains("Climb A"));assertFalse(description.contains("Climb B"))
        assertTrue(recentResultsDescription(RecentResultsState.Ready(emptyList()),now).contains("No completed"))
    }

    @Test fun `recent results render all sizes themes missing values and empty states`() {
        val sizes=listOf(480 to 620,240 to 620,480 to 200,240 to 320,480 to 120,240 to 120)
        val rows=recentPreviewResults(now)
        val cases=listOf("highlight-full" to RecentResultsState.Ready(rows.mapIndexed{i,r->if(i==0)r.copy(completedAtMs=now) else r}),
            "highlight-half" to RecentResultsState.Ready(rows.mapIndexed{i,r->if(i==0)r.copy(completedAtMs=now-15_000) else r}),
            "three" to RecentResultsState.Ready(rows),"single" to RecentResultsState.Ready(rows.take(1)),
            "legacy" to RecentResultsState.Ready(listOf(sample.copy(approximate=true,goalSeconds=null))),
            "long" to RecentResultsState.Ready(listOf(sample.copy(segmentName="Synthetic long segment name that must remain accessible",durationSeconds=3700.0,goalSeconds=3600))),
            "empty" to RecentResultsState.Ready(emptyList()),"loading" to RecentResultsState.Loading,"error" to RecentResultsState.Unavailable)
        val out=File("build/reports/karoo-recent-results").apply{mkdirs()}
        for((theme,palette)in listOf("dark" to KarooVisualPalette.Dark,"light" to KarooVisualPalette.Light)) {
            val sheet=Bitmap.createBitmap(2600,1500,Bitmap.Config.ARGB_8888);val canvas=Canvas(sheet);canvas.drawColor(Color.GRAY)
            for((index,size)in sizes.withIndex())for((column,pair)in cases.withIndex()) {
                val (name,state)=pair;val (w,h)=size
                val bitmap=RecentSegmentsBitmapRenderer(palette).render(state,w,h,now)
                assertEquals(w,bitmap.width);assertEquals(h,bitmap.height)
                File(out,"$theme-$name-${w}x$h.png").outputStream().use{bitmap.compress(Bitmap.CompressFormat.PNG,100,it)}
                val scale=minOf(270f/w,230f/h)
                canvas.drawBitmap(bitmap,null,RectF(column*285f,index*250f,column*285f+w*scale,index*250f+h*scale),null)
            }
            File(out,"$theme-sheet.png").outputStream().use{sheet.compress(Bitmap.CompressFormat.PNG,100,it)}
            for((w,h)in listOf(1 to 1,20 to 620,240 to 96,480 to 249))RecentSegmentsBitmapRenderer(palette).render(cases.first().second,w,h,now)
        }
    }
}

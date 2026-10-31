package com.gritmap.karoo.ui

import android.content.res.Resources
import android.graphics.*
import android.os.SystemClock
import com.gritmap.karoo.R
import com.gritmap.karoo.karoo.KarooFieldLayout
import com.gritmap.karoo.ui.state.*
import kotlin.math.*

/** Native Canvas counterpart of the Figma Karoo glance system. Geometry stays data driven. */
internal class GlanceFieldRenderer(
    private val kind: GlanceField,
    private val palette: KarooVisualPalette,
    private val resources: Resources,
    private val clockMs: () -> Long = SystemClock::elapsedRealtime,
) {
    private val light=Color.red(palette.background)>128
    private val background=Color.parseColor(if(light) "#F4F5F7" else "#0B0D10")
    private val surface=Color.parseColor(if(light) "#FFFFFF" else "#1B1F25")
    private val secondary=Color.parseColor(if(light) "#3A414D" else "#C9CED6")
    private val foreground=Color.parseColor(if(light) "#0B0D10" else "#FFFFFF")
    private var lastHero: GlancePresentation?=null
    private var lastHeroAt=Long.MIN_VALUE
    private var attemptKey: String?=null
    private var lastElapsed: Double?=null

    fun render(state: LiveUiState,width:Int,height:Int,layout:KarooFieldLayout): Bitmap {
        val w=width.coerceAtLeast(1).toFloat();val h=height.coerceAtLeast(1).toFloat()
        val bitmap=Bitmap.createBitmap(w.toInt(),h.toInt(),Bitmap.Config.ARGB_8888)
        val canvas=Canvas(bitmap);canvas.drawColor(background)
        val model=present(state)
        val margin=min(16f,min(w,h)*.13f)
        val content=RectF(margin,margin,w-margin,h-margin)
        // Short wide fields compose horizontally, never a miniature vertical dashboard.
        if(layout==KarooFieldLayout.SMALL_WIDE || layout==KarooFieldLayout.MEDIUM_WIDE) {
            wide(canvas,model,content,h>=160f)
        } else if(h<190f || content.height()<120f) {
            block(canvas,model,content)
        } else if(layout==KarooFieldLayout.LARGE && h>=560 && w>=320) {
            large(canvas,model,state,content)
        } else {
            vertical(canvas,model,state,content,layout==KarooFieldLayout.NARROW && h>=560)
        }
        return bitmap
    }

    internal fun present(state:LiveUiState):GlancePresentation {
        var model=glancePresentation(kind,state)
        val key=state.headlineAttemptId ?: state.segmentName
        val elapsed=state.elapsedAttemptSeconds
        if(key!=attemptKey || (elapsed!=null && lastElapsed!=null && elapsed<lastElapsed!!) || state.matchStatus==MatchStatus.IDLE) {
            lastHero=null;lastHeroAt=Long.MIN_VALUE;attemptKey=key
        }
        lastElapsed=elapsed
        val now=clockMs()
        val knownPlanTarget=kind==GlanceField.PACING && state.sensorStatus.gps && model.hero!="--"
        val liveHrResponse=kind==GlanceField.DRIFT && state.cardiacPresentationMode==CardiacPresentationMode.HR_RESPONSE && state.currentHeartRateBpm!=null && state.sensorStatus.heartRate
        if(model.signalMissing && !knownPlanTarget && !liveHrResponse) {
            val held=lastHero?.takeIf {now-lastHeroAt in 0..GlanceThresholds.LAST_VALUE_MS}
            model=if(held==null)model.copy(hero="--") else model.copy(hero=held.hero,unit=held.unit,label="LAST "+held.label)
        } else if(model.hero!="--") {lastHero=model;lastHeroAt=now}
        return model
    }

    private fun fill(t:GlanceTone)=Color.parseColor(when(t) {
        GlanceTone.EASE -> "#4CC3FF";GlanceTone.ON -> "#2FD27A";GlanceTone.MORE -> "#FF9A1F"
        GlanceTone.CAUTION -> "#FFD60A";GlanceTone.WARN -> "#FF5A4F";GlanceTone.NEUTRAL -> if(light) "#E1E4EA" else "#2A2F38"
    })
    private fun ink(t:GlanceTone)=if(!light || t==GlanceTone.NEUTRAL) { if(t==GlanceTone.NEUTRAL) secondary else fill(t) }
        else Color.parseColor(when(t) {GlanceTone.EASE -> "#0A5F94";GlanceTone.ON -> "#13703C";GlanceTone.MORE -> "#A24F00";GlanceTone.CAUTION -> "#7A5C00";GlanceTone.WARN -> "#B3261E";else -> "#3A414D"})
    private fun paint(color:Int,size:Float=0f)=Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color=color;textSize=size;typeface=Typeface.create("sans-serif-condensed",Typeface.BOLD)
    }
    private fun text(c:Canvas,value:String,box:RectF,size:Float,color:Int,align:Paint.Align=Paint.Align.CENTER):Float {
        if(box.width()<=0 || box.height()<=0 || value.isEmpty()) return 0f
        val p=paint(color,size)
        val measured=p.measureText(value).coerceAtLeast(1f)
        val fh=(p.fontMetrics.descent-p.fontMetrics.ascent).coerceAtLeast(1f)
        p.textSize*=min(1f,min(box.width()/measured,box.height()/fh))
        p.textAlign=align
        val x=when(align) {Paint.Align.LEFT -> box.left;Paint.Align.RIGHT -> box.right;else -> box.centerX()}
        c.save();c.clipRect(box)
        c.drawText(value,x,box.centerY()-(p.fontMetrics.ascent+p.fontMetrics.descent)/2,p)
        c.restore()
        return p.textSize
    }
    private fun badge(c:Canvas,m:GlancePresentation,r:RectF,short:Boolean=false) {
        c.drawRoundRect(r,12f,12f,paint(fill(m.tone)))
        val word=if(short) m.shortVerdict else m.verdict
        val color=if(m.tone==GlanceTone.NEUTRAL) foreground else Color.BLACK
        val icon=GlanceIcons.get(resources,m.tone)
        val desired=if(r.width()>300) 64f else 48f
        val p=paint(color,desired)
        val iconSize=min(37f,r.height()*.5f)
        val gap=if(icon==null) 0f else 8f
        val available=(r.width()-16-iconSize-gap).coerceAtLeast(1f)
        p.textSize*=min(1f,available/p.measureText(word).coerceAtLeast(1f))
        val groupWidth=p.measureText(word)+(if(icon==null) 0f else iconSize+gap)
        val left=r.centerX()-groupWidth/2
        if(icon!=null) c.drawBitmap(icon,null,RectF(left,r.centerY()-iconSize/2,left+iconSize,r.centerY()+iconSize/2),Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
        val tx=if(icon==null) left else left+iconSize+gap
        text(c,word,RectF(tx,r.top+4,r.right-8,r.bottom-4),p.textSize,color,Paint.Align.LEFT)
    }
    private fun hero(c:Canvas,m:GlancePresentation,r:RectF,size:Float,unit:Boolean=true) {
        val color=if(m.signalMissing) secondary else ink(m.tone)
        val up=paint(secondary,48f)
        val unitWidth=if(unit && m.unit.isNotBlank() && m.hero!="--") up.measureText(m.unit)+10 else 0f
        val valueBox=RectF(r.left,r.top,r.right-unitWidth,r.bottom)
        val used=text(c,m.hero,valueBox,size,color)
        if(unitWidth>0) {
            val vp=paint(color,used)
            val valueWidth=vp.measureText(m.hero)
            val start=(r.centerX()+(valueWidth-unitWidth)/2+8).coerceAtMost(r.right-unitWidth+10)
            text(c,m.unit,RectF(start,r.centerY(),r.right,r.bottom),48f,secondary,Paint.Align.LEFT)
        }
    }
    private fun wide(c:Canvas,m:GlancePresentation,r:RectF,support:Boolean) {
        val split=r.left+r.width()*.54f
        val right=RectF(split+6,r.top,r.right,r.bottom)
        val bh=min(if(support)84f else 88f,if(support) r.height()*.52f else r.height())
        badge(c,m,RectF(right.left,right.top,right.right,right.top+bh),true)
        if(support) {
            text(c,m.label,RectF(r.left,r.top,split-8,r.top+28),28f,secondary)
            hero(c,m,RectF(r.left,r.top+30,split-8,r.bottom),120f)
            text(c,m.shortSupport,RectF(right.left,right.top+bh+8,right.right,right.bottom),40f,foreground)
        } else hero(c,m,RectF(r.left,r.top,split-8,r.bottom),96f,false)
    }
    private fun block(c:Canvas,m:GlancePresentation,r:RectF) {
        c.drawRoundRect(r,12f,12f,paint(fill(m.tone)))
        val color=if(m.tone==GlanceTone.NEUTRAL) foreground else Color.BLACK
        val icon=GlanceIcons.get(resources,m.tone)
        val size=min(37f,r.height()*.35f)
        if(icon!=null) c.drawBitmap(icon,null,RectF(r.left+12,r.centerY()-size/2,r.left+12+size,r.centerY()+size/2),Paint(Paint.FILTER_BITMAP_FLAG))
        // Unit remains with the hero when the label is absent, to distinguish seconds/percent/watts.
        text(c,m.hero+(if(m.hero=="--") "" else if(m.unit=="SEC") "s" else m.unit),RectF(r.left+(if(icon==null) 8f else size+24),r.top+6,r.right-8,r.bottom-6),80f,color)
    }
    private fun large(c:Canvas,m:GlancePresentation,s:LiveUiState,r:RectF) {
        text(c,m.title,RectF(r.left,r.top,r.centerX()+10,r.top+32),28f,secondary,Paint.Align.LEFT)
        val context=if(kind==GlanceField.DRIFT) glanceClock(s.cardiacDriftValidSeconds.toDouble())+" VALID" else distance(s.progressMeters,s.distanceUnitSystem)+" / "+distance(s.totalDistanceMeters,s.distanceUnitSystem)
        text(c,context,RectF(r.centerX(),r.top,r.right,r.top+32),28f,secondary,Paint.Align.RIGHT)
        badge(c,m,RectF(r.left,r.top+40,r.right,r.top+128))
        text(c,m.label,RectF(r.left,r.top+132,r.right,r.top+166),28f,secondary)
        hero(c,m,RectF(r.left,r.top+166,r.right,r.top+322),168f)
        text(c,m.support,RectF(r.left,r.top+328,r.right,r.top+386),48f,foreground)
        val chart=RectF(r.left,r.top+396,r.right,r.bottom-90)
        if(chart.height()>=30) chart(c,m,s,chart)
        footer(c,m,s,RectF(r.left,r.bottom-76,r.right,r.bottom-8),false)
    }
    private fun vertical(c:Canvas,m:GlancePresentation,s:LiveUiState,r:RectF,tall:Boolean) {
        val bh=min(88f,r.height()*.24f)
        badge(c,m,RectF(r.left,r.top,r.right,r.top+bh),r.width()<300)
        val labelTop=r.top+bh+8
        text(c,m.label,RectF(r.left,labelTop,r.right,labelTop+30),28f,secondary)
        val heroTop=labelTop+32
        val heroHeight=min(132f,r.height()*.36f)
        hero(c,m,RectF(r.left,heroTop,r.right,heroTop+heroHeight),120f,r.width()>=300)
        val supportTop=heroTop+heroHeight+8
        text(c,m.shortSupport,RectF(r.left,supportTop,r.right,min(r.bottom,supportTop+52)),40f,foreground)
        if(tall) {
            val chartTop=max(supportTop+68,r.top+r.height()*.51f)
            chart(c,m,s,RectF(r.left,chartTop,r.right,min(r.bottom-100,chartTop+126)))
            footer(c,m,s,RectF(r.left,r.bottom-68,r.right,r.bottom),true)
        }
    }
    private fun footer(c:Canvas,m:GlancePresentation,s:LiveUiState,r:RectF,narrow:Boolean) {
        if(kind==GlanceField.PACING) {
            c.drawRoundRect(r,12f,12f,paint(surface))
            val next=s.nextPacingZone
            val tone=if(m.signalMissing) GlanceTone.NEUTRAL else effortTone(next?.effort)
            c.drawRect(r.left,r.top,r.left+14,r.bottom,paint(fill(tone)))
            val value=next?.let { effortWord(it.effort)+" "+it.targetPowerWatts+(if(narrow) "" else " W") } ?: "--"
            val split=if(narrow) r.right else r.left+r.width()*.6f
            text(c,value,RectF(r.left+28,r.top+8,split-6,r.bottom-8),40f,foreground,Paint.Align.LEFT)
            if(!narrow && next!=null) text(c,"IN "+distance((next.startDistanceMeters-s.progressMeters).coerceAtLeast(0.0),s.distanceUnitSystem),RectF(split,r.top+8,r.right-8,r.bottom-8),40f,secondary,Paint.Align.RIGHT)
            return
        }
        val left=m.leftCard ?: return
        val right=m.rightCard
        fun card(pair:Pair<String,String>,box:RectF) {
            c.drawRoundRect(box,8f,8f,paint(surface))
            val split=box.left+box.width()*.45f
            text(c,pair.first,RectF(box.left+8,box.top+6,split,box.bottom-6),28f,secondary,Paint.Align.LEFT)
            text(c,pair.second,RectF(split+4,box.top+6,box.right-8,box.bottom-6),48f,foreground,Paint.Align.RIGHT)
        }
        if(narrow || right==null) card(left,r) else {
            val mid=r.centerX();card(left,RectF(r.left,r.top,mid-4,r.bottom));card(right,RectF(mid+4,r.top,r.right,r.bottom))
        }
    }
    private fun chart(c:Canvas,m:GlancePresentation,s:LiveUiState,r:RectF) {
        if(r.width()<40 || r.height()<40) return
        when(kind) {
            GlanceField.PACING -> terrain(c,m,s,r)
            GlanceField.PERFORMANCE -> {
                val y=r.centerY();val bar=RectF(r.left,y-15,r.right,y+15)
                c.drawRoundRect(bar,15f,15f,paint(if(light) Color.parseColor("#E1E4EA") else Color.parseColor("#2A2F38")))
                c.drawLine(r.centerX(),y-24,r.centerX(),y+24,paint(secondary).apply { strokeWidth=3f })
                val goal=s.plannedFinishSeconds;val est=s.replanEstimate?.estimatedFinishSeconds ?: s.predictedFinishSeconds?.toDouble()
                if(goal!=null && est!=null && est.isFinite() && !m.signalMissing) {
                    val x=r.centerX()+((goal-est).coerceIn(-60.0,60.0)/120*r.width()).toFloat()
                    c.drawCircle(x.coerceIn(r.left+18,r.right-18),y,18f,paint(ink(m.tone)))
                    c.drawCircle(x.coerceIn(r.left+18,r.right-18),y,18f,paint(foreground).apply {style=Paint.Style.STROKE;strokeWidth=3f})
                }
                text(c,"BEHIND",RectF(r.left,y+27,r.centerX(),r.bottom),28f,secondary,Paint.Align.LEFT)
                text(c,"AHEAD",RectF(r.centerX(),y+27,r.right,r.bottom),28f,secondary,Paint.Align.RIGHT)
            }
            GlanceField.BALANCE -> {
                val bar=RectF(r.left+3,r.top+4,r.right-12,r.bottom-34)
                if(bar.height()<10) return
                c.drawRoundRect(bar,10f,10f,paint(foreground).apply {style=Paint.Style.STROKE;strokeWidth=4f})
                c.drawRect(bar.right+4,bar.centerY()-10,bar.right+9,bar.centerY()+10,paint(foreground))
                val value=s.wPrime?.actualRemainingPct?.takeIf { it.isFinite() }
                if(value!=null && !m.signalMissing) c.drawRoundRect(RectF(bar.left+4,bar.top+4,bar.left+4+(bar.width()-8)*value/100,bar.bottom-4),6f,6f,paint(fill(m.tone)))
                s.wPrime?.plannedRemainingPct?.takeIf { it.isFinite() }?.let { p ->
                    val x=bar.left+bar.width()*p.coerceIn(0f,100f)/100
                    c.drawLine(x,bar.top-5,x,bar.bottom+5,paint(foreground).apply {strokeWidth=3f})
                }
                text(c,"LINE = PLAN",RectF(r.left,bar.bottom+8,r.right,r.bottom),28f,secondary,Paint.Align.LEFT)
            }
            GlanceField.DRIFT -> {
                if(s.cardiacDriftPct==null || s.cardiacDriftValidSeconds<180 || m.signalMissing) return
                val history=s.cardiacDriftHistory.filter { it.driftPct.isFinite() }
                if(history.isEmpty()) return
                val low=min(-2.0,history.minOf {it.driftPct}).coerceAtLeast(-20.0)
                val high=max(8.0,history.maxOf {it.driftPct}).coerceAtMost(20.0)
                fun chartY(value:Double)=r.bottom-10-(r.height()-20)*((value.coerceIn(low,high)-low)/(high-low)).toFloat()
                c.drawRect(r,paint(fill(GlanceTone.WARN)))
                c.drawRect(r.left,chartY(5.0),r.right,chartY(-5.0),paint(fill(GlanceTone.CAUTION)))
                c.drawRect(r.left,chartY(3.0),r.right,chartY(-3.0),paint(fill(GlanceTone.ON)))
                val path=Path();val minT=history.first().elapsedSeconds;val span=(history.last().elapsedSeconds-minT).coerceAtLeast(1)
                history.forEachIndexed { i,p ->
                    val x=r.left+8+(r.width()-16)*(p.elapsedSeconds-minT)/span
                    val y=chartY(p.driftPct)
                    if(i==0)path.moveTo(x,y)else path.lineTo(x,y)
                }
                c.drawPath(path,paint(foreground).apply {style=Paint.Style.STROKE;strokeWidth=5f;strokeJoin=Paint.Join.ROUND})
                val endY=chartY(history.last().driftPct)
                c.drawCircle(r.right-8,endY,8f,paint(background))
                c.drawCircle(r.right-8,endY,5f,paint(foreground))
            }
        }
    }
    private fun terrain(c:Canvas,m:GlancePresentation,s:LiveUiState,r:RectF) {
        if(r.width()<50 || r.height()<50 || !s.hasCompleteElevationProfile || s.totalDistanceMeters<=0 || s.pacingZones.isEmpty()) return
        val points=s.elevationProfile.filter { it.distanceMeters.isFinite() && it.elevationMeters.isFinite() }.sortedBy {it.distanceMeters}
        if(points.size<2) return
        c.save();c.clipRect(r)
        c.drawRoundRect(r,10f,10f,paint(surface))
        fun x(d:Double)=r.left+(d/s.totalDistanceMeters).coerceIn(0.0,1.0).toFloat()*r.width()
        val minE=points.minOf {it.elevationMeters};val span=(points.maxOf {it.elevationMeters}-minE).coerceAtLeast(1.0)
        fun y(e:Double)=r.bottom-20-(r.height()-40).coerceAtLeast(1f)*((e-minE)/span).toFloat()
        if(!m.signalMissing) s.pacingZones.forEach { z ->
            val p=paint(fill(effortTone(z.effort)))
            c.drawRect(x(z.startDistanceMeters),r.top,x(z.endDistanceMeters),r.bottom,p)
        }
        val path=Path();points.forEachIndexed { i,p -> if(i==0)path.moveTo(x(p.distanceMeters),y(p.elevationMeters))else path.lineTo(x(p.distanceMeters),y(p.elevationMeters)) }
        c.drawPath(path,paint(foreground).apply {style=Paint.Style.STROKE;strokeWidth=5f;strokeJoin=Paint.Join.ROUND})
        fun at(distance:Double):Pair<Float,Float> {
            val d=distance.coerceIn(0.0,s.totalDistanceMeters)
            val a=points.lastOrNull {it.distanceMeters<=d} ?: points.first()
            val b=points.firstOrNull {it.distanceMeters>=d} ?: points.last()
            val e=if(a.distanceMeters==b.distanceMeters)a.elevationMeters else a.elevationMeters+(b.elevationMeters-a.elevationMeters)*(d-a.distanceMeters)/(b.distanceMeters-a.distanceMeters)
            return x(d).coerceIn(r.left+24,r.right-24) to y(e).coerceIn(r.top+24,r.bottom-24)
        }
        if(s.sensorStatus.gps) {
            s.targetProgressMeters?.let { d -> val (px,py)=at(d);c.drawCircle(px,py,18f,paint(background).apply {style=Paint.Style.STROKE;strokeWidth=10f});c.drawCircle(px,py,18f,paint(foreground).apply {style=Paint.Style.STROKE;strokeWidth=6f}) }
            val (px,py)=at(s.progressMeters);c.drawCircle(px,py,15f,paint(background));c.drawCircle(px,py,13f,paint(foreground))
        }
        c.restore()
    }
    private fun distance(meters:Double,units:UnitSystem):String {
        val d=meters.takeIf { it.isFinite() }?.coerceAtLeast(0.0) ?: return "--"
        return if(units==UnitSystem.IMPERIAL) { if(d<160.9344) "${(d*3.28084).roundToInt()} FT" else String.format(java.util.Locale.US,"%.1f MI",d/1609.344) }
        else if(d<1000) "${d.roundToInt()} M" else String.format(java.util.Locale.US,"%.1f KM",d/1000)
    }
}

private object GlanceIcons {
    private val cache=mutableMapOf<Int,Bitmap>()
    @Synchronized fun get(resources:Resources,tone:GlanceTone):Bitmap? {
        val id=when(tone) {GlanceTone.ON -> R.drawable.gm_glance_on;GlanceTone.MORE -> R.drawable.gm_glance_more;GlanceTone.EASE -> R.drawable.gm_glance_ease;GlanceTone.CAUTION -> R.drawable.gm_glance_caution;GlanceTone.WARN -> R.drawable.gm_glance_warn;GlanceTone.NEUTRAL -> return null}
        return cache.getOrPut(id) {BitmapFactory.decodeResource(resources,id)}
    }
}

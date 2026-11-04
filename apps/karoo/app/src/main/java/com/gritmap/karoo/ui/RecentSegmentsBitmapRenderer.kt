package com.gritmap.karoo.ui

import android.graphics.*
import com.gritmap.karoo.data.RecentResultsState
import kotlin.math.min

/** Inline result review: independent of GPS, current attempt, distance and unverified taps. */
internal class RecentSegmentsBitmapRenderer(palette:KarooVisualPalette) {
    private val light=Color.red(palette.background)>128
    private val background=Color.parseColor(if(light) "#F4F5F7" else "#0B0D10")
    private val surface=Color.parseColor(if(light) "#FFFFFF" else "#1B1F25")
    private val foreground=Color.parseColor(if(light) "#0B0D10" else "#FFFFFF")
    private val secondary=Color.parseColor(if(light) "#3A414D" else "#C9CED6")
    private fun paint(color:Int,size:Float)=Paint(Paint.ANTI_ALIAS_FLAG).apply{
        this.color=color;textSize=size;typeface=Typeface.create("sans-serif-condensed",Typeface.BOLD)
    }
    private fun text(c:Canvas,value:String,r:RectF,size:Float,color:Int,align:Paint.Align=Paint.Align.LEFT) {
        if(r.width()<=0 || r.height()<=0)return
        val p=paint(color,size)
        val height=p.fontMetrics.descent-p.fontMetrics.ascent
        p.textSize*=min(1f,min(r.width()/p.measureText(value).coerceAtLeast(1f),r.height()/height.coerceAtLeast(1f)))
        p.textAlign=align
        val x=when(align){Paint.Align.LEFT->r.left;Paint.Align.RIGHT->r.right;else->r.centerX()}
        c.save();c.clipRect(r);c.drawText(value,x,r.centerY()-(p.fontMetrics.ascent+p.fontMetrics.descent)/2,p);c.restore()
    }
    private fun name(c:Canvas,value:String,r:RectF,size:Float) {
        val p=paint(foreground,size);var label=value
        while(label.length>1 && p.measureText(label)>r.width()) label=label.dropLast(1)
        if(label!=value)label=label.dropLast(1)+"…"
        text(c,label,r,size,foreground)
    }
    private fun accent(t:GlanceTone)=Color.parseColor(when(t){
        GlanceTone.ON->if(light)"#13703C" else "#2FD27A"
        GlanceTone.EASE->if(light)"#0A5F94" else "#4CC3FF"
        GlanceTone.MORE->if(light)"#A24F00" else "#FF9A1F"
        else->if(light)"#3A414D" else "#C9CED6"
    })
    fun render(state:RecentResultsState,width:Int,height:Int,nowMs:Long):Bitmap {
        val w=width.coerceAtLeast(1);val h=height.coerceAtLeast(1)
        val bitmap=Bitmap.createBitmap(w,h,Bitmap.Config.ARGB_8888);val c=Canvas(bitmap);c.drawColor(background)
        val margin=min(16f,min(w,h)*.1f);val r=RectF(margin,margin,w-margin,h-margin)
        val capacity=recentRowsForSize(w,h)
        if(capacity==0){text(c,"ENLARGE FIELD",r,28f,secondary,Paint.Align.CENTER);return bitmap}
        if(h>=180) {
            text(c,"RECENT SEGMENTS",RectF(r.left,r.top,r.right,r.top+30),28f,secondary)
            r.top+=42
        }
        val rows=(state as? RecentResultsState.Ready)?.results.orEmpty().take(capacity)
        if(rows.isEmpty()) {
            val message=when(state){RecentResultsState.Loading->"LOADING RESULTS";RecentResultsState.Unavailable->"RESULTS UNAVAILABLE";else->"NO COMPLETED SEGMENTS YET"}
            text(c,message,RectF(r.left,r.centerY()-35,r.right,r.centerY()),30f,foreground,Paint.Align.CENTER)
            text(c,if(state is RecentResultsState.Unavailable)"Will retry" else "Local Karoo results",RectF(r.left,r.centerY()+4,r.right,r.centerY()+32),22f,secondary,Paint.Align.CENTER)
            return bitmap
        }
        val rowHeight=min((r.height()-10f*(rows.size-1))/rows.size,if(w>=400)180f else 260f)
        rows.forEachIndexed { i,result ->
            val box=RectF(r.left,r.top+i*(rowHeight+10),r.right,r.top+i*(rowHeight+10)+rowHeight)
            c.drawRoundRect(box,12f,12f,paint(surface,0f))
            val model=recentResultPresentation(result,nowMs)
            c.drawRect(box.left,box.top+12,box.left+4,box.bottom-12,paint(accent(model.tone),0f))
            val inner=RectF(box.left+12,box.top+6,box.right-10,box.bottom-6)
            val large=inner.height()>=150
            val nameHeight=if(large)30f else 22f
            val ageWidth=if(large && inner.width()>330)110f else 0f
            name(c,model.name,RectF(inner.left,inner.top,inner.right-ageWidth,inner.top+nameHeight),if(large)32f else 22f)
            if(ageWidth>0)text(c,model.age,RectF(inner.right-ageWidth,inner.top,inner.right,inner.top+nameHeight),20f,secondary,Paint.Align.RIGHT)
            var y=inner.top+nameHeight+3
            if(large && ageWidth==0f){text(c,model.age,RectF(inner.left,y,inner.right,y+22),20f,secondary);y+=27}
            val split=inner.centerX();val labelH=if(large)22f else 15f
            text(c,"TIME",RectF(inner.left,y,split-6,y+labelH),if(large)20f else 16f,secondary)
            text(c,"GOAL",RectF(split+6,y,inner.right,y+labelH),if(large)20f else 16f,secondary)
            y+=labelH
            val numbersH=if(large)52f else min(36f,(inner.bottom-y)*.6f)
            text(c,model.time,RectF(inner.left,y,split-6,y+numbersH),if(large)54f else 38f,foreground)
            text(c,model.goal,RectF(split+6,y,inner.right,y+numbersH),if(large)54f else 38f,foreground)
            y+=numbersH+3
            val gapH=if(large)30f else (inner.bottom-y).coerceAtLeast(1f)
            text(c,model.comparison,RectF(inner.left,y,inner.right,y+gapH),if(large)28f else 22f,accent(model.tone))
            y+=gapH+5
            if(large && inner.bottom-y>=18)text(c,"AVG ${model.power} · HR ${model.heartRate}",RectF(inner.left,y,inner.right,min(y+28,inner.bottom)),24f,secondary)
        }
        return bitmap
    }
}

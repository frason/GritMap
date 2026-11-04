package com.gritmap.karoo.karoo

import android.content.Context
import android.widget.RemoteViews
import com.gritmap.karoo.R
import com.gritmap.karoo.data.*
import com.gritmap.karoo.service.LiveServiceStarter
import com.gritmap.karoo.ui.*
import io.hammerhead.karooext.extension.DataTypeImpl
import io.hammerhead.karooext.internal.ViewEmitter
import io.hammerhead.karooext.models.UpdateGraphicConfig
import io.hammerhead.karooext.models.ViewConfig
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

@OptIn(ExperimentalCoroutinesApi::class)
class RecentSegmentsDataType(extensionId:String):DataTypeImpl(extensionId,TYPE_ID) {
    override fun startView(context:Context,config:ViewConfig,emitter:ViewEmitter) {
        emitter.onNext(UpdateGraphicConfig(showHeader=false))
        val scope=CoroutineScope(SupervisorJob()+Dispatchers.Default)
        val renderer=RecentSegmentsBitmapRenderer(karooVisualPalette(context))
        scope.launch {
            if(!config.preview)LiveServiceStarter.startIfPermitted(context,"recent-results-view")
            val states=if(config.preview)flowOf(RecentResultsState.Ready(recentPreviewResults()))
                else RecentSegmentResultsRepository(DatabaseProvider.get(context)).observe()
            // Tick only the fresh result at 1 Hz; older results retain the coarse age clock.
            val timedStates=states.flatMapLatest { state -> flow {
                while(currentCoroutineContext().isActive) {
                    emit(state)
                    val first=(state as? RecentResultsState.Ready)?.results?.firstOrNull()
                    val remaining=first?.let{recentResultHighlightRemainingMs(it.completedAtMs,System.currentTimeMillis())} ?: 0L
                    delay(if(remaining>0)minOf(1_000L,remaining) else 30_000L)
                }
            }}
            var lastEmit:Long?=null
            timedStates.conflate().collect { state ->
                lastEmit?.let{delay((1_000-(android.os.SystemClock.elapsedRealtime()-it)).coerceAtLeast(0))}
                val now=System.currentTimeMillis()
                val views=RemoteViews(context.packageName,R.layout.karoo_glance_field)
                views.setImageViewBitmap(R.id.karoo_glance_image,renderer.render(state,config.viewSize.first,config.viewSize.second,now))
                views.setContentDescription(R.id.karoo_glance_image,recentResultsDescription(state,now,recentRowsForSize(config.viewSize.first,config.viewSize.second)))
                emitter.updateView(views);lastEmit=android.os.SystemClock.elapsedRealtime()
            }
        }
        emitter.setCancellable{scope.cancel()}
    }
    companion object {const val TYPE_ID="recent-segment-results"}
}

internal fun recentResultsDescription(state:RecentResultsState,now:Long,visibleLimit:Int=3):String = if(visibleLimit<=0) "Recent segments, enlarge field to review results" else when(state) {
    RecentResultsState.Loading -> "Recent segments, loading results"
    RecentResultsState.Unavailable -> "Recent segments, results unavailable, retrying"
    is RecentResultsState.Ready -> if(state.results.isEmpty())"No completed segments yet on this Karoo" else
        "Recent local Karoo results. "+(state.results.firstOrNull()?.let {
            val remaining=recentResultHighlightRemainingMs(it.completedAtMs,now)
            if(remaining>0) "Latest result highlight, ${(remaining+999)/1000} seconds remaining. " else ""
        } ?: "")+state.results.take(visibleLimit).joinToString(". "){r->recentResultPresentation(r,now).let{m->
            "${m.name}, ${if(r.approximate)"approximate " else ""}time ${m.time}, goal ${m.goal}, ${m.comparison}, average power ${m.power}, heart rate ${m.heartRate}, ${m.age}"
        }}
}

internal fun recentPreviewResults(now:Long=System.currentTimeMillis())=listOf(
    RecentSegmentResult("preview-a","segment-a","Climb A",now-120_000,860.0,840,false,230.0,148.0),
    RecentSegmentResult("preview-b","segment-b","Climb B",now-540_000,550.0,570,false,215.0,142.0),
    RecentSegmentResult("preview-c","segment-c","Long climb",now-1_500_000,3700.0,null,false,null,null),
)

package com.gritmap.karoo.karoo

import android.content.Context
import android.os.SystemClock
import android.widget.RemoteViews
import com.gritmap.karoo.R
import com.gritmap.karoo.service.LiveServiceStarter
import com.gritmap.karoo.ui.*
import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.LiveUiStore
import io.hammerhead.karooext.extension.DataTypeImpl
import io.hammerhead.karooext.internal.ViewEmitter
import io.hammerhead.karooext.models.UpdateGraphicConfig
import io.hammerhead.karooext.models.ViewConfig
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collect

/** Both pacing registrations share this full-field adapter; no legacy XML chrome can shrink it. */
abstract class GlanceGraphicDataType internal constructor(
    extensionId:String,typeId:String,private val kind:GlanceField,
    private val state:StateFlow<LiveUiState> = LiveUiStore.state,
):DataTypeImpl(extensionId,typeId) {
    override fun startView(context:Context,config:ViewConfig,emitter:ViewEmitter) {
        emitter.onNext(UpdateGraphicConfig(showHeader=false))
        val renderer=GlanceFieldRenderer(kind,karooVisualPalette(context),context.resources)
        val scope=CoroutineScope(SupervisorJob()+Dispatchers.Default)
        scope.launch {
            var lastEmit:Long?=null
            suspend fun submit(value:LiveUiState) {
                val now=SystemClock.elapsedRealtime()
                lastEmit?.let { last -> delay((1000-(now-last)).coerceAtLeast(0)) }
                // Take the newest conflated state after throttling, not a stale queued sample.
                val latest=if(config.preview)value else state.value
                val bitmap=renderer.render(latest,config.viewSize.first,config.viewSize.second,karooFieldLayout(config))
                val views=RemoteViews(context.packageName,R.layout.karoo_glance_field)
                views.setImageViewBitmap(R.id.karoo_glance_image,bitmap)
                views.setContentDescription(R.id.karoo_glance_image,glancePresentation(kind,latest).let { "${it.title}, ${it.verdict}, ${it.hero} ${it.unit}, ${it.support}" })
                emitter.updateView(views)
                lastEmit=SystemClock.elapsedRealtime()
            }
            if(config.preview)karooPreviewFlow().collect { submit(it) }
            else {LiveServiceStarter.startIfPermitted(context,"glance-$typeId-view");state.collect { submit(it) }}
        }
        emitter.setCancellable {scope.cancel()}
    }
}

package com.gritmap.karoo.karoo

import android.content.Context
import com.gritmap.karoo.ui.state.LiveUiState
import com.gritmap.karoo.ui.state.LiveUiStore
import com.gritmap.karoo.ui.state.MatchStatus
import io.hammerhead.karooext.extension.DataTypeImpl
import io.hammerhead.karooext.internal.Emitter
import io.hammerhead.karooext.internal.ViewEmitter
import io.hammerhead.karooext.models.DataPoint
import io.hammerhead.karooext.models.DataType
import io.hammerhead.karooext.models.StreamState
import io.hammerhead.karooext.models.UpdateNumericConfig
import io.hammerhead.karooext.models.ViewConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicInteger

/** A standard Karoo numeric field containing only the current pacing target. */
class TargetPowerDataType(
    extensionId: String,
    private val state: StateFlow<LiveUiState> = LiveUiStore.state,
) : DataTypeImpl(extensionId, TYPE_ID) {
    private val previewViewCount = AtomicInteger(0)
    private val previewActive = MutableStateFlow(false)

    override fun startStream(emitter: Emitter<StreamState>) {
        val scope = CoroutineScope(Job() + Dispatchers.Default)
        scope.launch {
            combine(state, previewActive) { liveState, preview ->
                targetPowerStreamState(stateForKarooView(liveState, preview), dataTypeId)
            }.collect(emitter::onNext)
        }
        emitter.setCancellable { scope.cancel() }
    }

    override fun startView(context: Context, config: ViewConfig, emitter: ViewEmitter) {
        emitter.onNext(UpdateNumericConfig(formatDataTypeId = DataType.Type.POWER))
        if (config.preview) {
            previewViewCount.incrementAndGet()
            previewActive.value = true
            emitter.setCancellable {
                if (previewViewCount.decrementAndGet() <= 0) {
                    previewViewCount.set(0)
                    previewActive.value = false
                }
            }
        }
    }

    companion object {
        const val TYPE_ID = "target-power"
    }
}

internal fun targetPowerStreamState(state: LiveUiState, dataTypeId: String): StreamState {
    val target = state.recommendation?.targetPowerWatts
    return when {
        target != null -> StreamState.Streaming(
            DataPoint(dataTypeId, mapOf(DataType.Field.SINGLE to target.toDouble())),
        )
        state.matchStatus == MatchStatus.IDLE -> StreamState.Searching
        else -> StreamState.NotAvailable
    }
}

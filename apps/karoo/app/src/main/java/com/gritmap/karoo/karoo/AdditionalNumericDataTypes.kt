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
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

abstract class PreviewNumericDataType(
    extensionId: String,
    typeId: String,
    private val formatDataTypeId: String,
    private val state: StateFlow<LiveUiState> = LiveUiStore.state,
) : DataTypeImpl(extensionId, typeId) {
    private val previewViewCount = AtomicInteger(0)
    private val previewActive = MutableStateFlow(false)

    protected abstract fun value(state: LiveUiState): Double?

    override fun startStream(emitter: Emitter<StreamState>) {
        val scope = CoroutineScope(Job() + Dispatchers.Default)
        scope.launch {
            combine(state, previewActive) { liveState, preview ->
                val displayState = stateForKarooView(liveState, preview)
                numericStreamState(
                    value(displayState),
                    displayState.matchStatus,
                    dataTypeId,
                )
            }.collect(emitter::onNext)
        }
        emitter.setCancellable { scope.cancel() }
    }

    override fun startView(context: Context, config: ViewConfig, emitter: ViewEmitter) {
        emitter.onNext(UpdateNumericConfig(formatDataTypeId = formatDataTypeId))
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
}

class PowerDeltaDataType(extensionId: String) : PreviewNumericDataType(
    extensionId,
    TYPE_ID,
    DataType.Type.POWER,
) {
    override fun value(state: LiveUiState): Double? = state.powerDeltaWatts?.toDouble()

    companion object { const val TYPE_ID = "power-delta" }
}

class PredictedFinishDataType(extensionId: String) : PreviewNumericDataType(
    extensionId,
    TYPE_ID,
    DataType.Type.ELAPSED_TIME,
) {
    override fun value(state: LiveUiState): Double? = state.predictedFinishSeconds?.toDouble()

    companion object { const val TYPE_ID = "predicted-finish" }
}

internal fun numericStreamState(
    value: Double?,
    matchStatus: MatchStatus,
    dataTypeId: String,
): StreamState = when {
    value != null -> StreamState.Streaming(
        DataPoint(dataTypeId, mapOf(DataType.Field.SINGLE to value)),
    )
    matchStatus == MatchStatus.IDLE -> StreamState.Searching
    else -> StreamState.NotAvailable
}

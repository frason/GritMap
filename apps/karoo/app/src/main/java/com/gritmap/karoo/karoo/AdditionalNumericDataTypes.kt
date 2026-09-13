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
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.collectLatest
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
            previewActive.collectLatest { preview ->
                (if (preview) karooPreviewFlow() else state).collect { displayState ->
                    emitter.onNext(
                        numericStreamState(
                            value(displayState),
                            displayState.matchStatus,
                            dataTypeId,
                        ),
                    )
                }
            }
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
    override fun value(state: LiveUiState): Double? = predictedFinishElapsedTimeValue(state)

    companion object { const val TYPE_ID = "predicted-finish" }
}

/** Karoo's native elapsed-time formatter consumes milliseconds, while domain state uses seconds. */
internal fun predictedFinishElapsedTimeValue(state: LiveUiState): Double? =
    state.predictedFinishSeconds?.times(1_000.0)

/** Native Karoo numeric treatment for GritMap's calculated power-to-heart-rate ratio. */
class WattsPerHeartRateDataType(extensionId: String) : PreviewNumericDataType(
    extensionId,
    TYPE_ID,
    // Intensity factor supplies the native decimal precision needed by this unitless ratio.
    // The extension field name communicates the W/bpm meaning; Karoo has no custom-unit API.
    DataType.Type.INTENSITY_FACTOR,
) {
    override fun value(state: LiveUiState): Double? = state.wattsPerHeartRate

    companion object { const val TYPE_ID = "watts-per-hr" }
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

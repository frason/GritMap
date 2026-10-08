package com.gritmap.karoo.physiology

import android.os.SystemClock
import java.nio.file.Path
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID

data class H10CaptureState(
    val capturing: Boolean = false,
    val currentBpm: Int? = null,
    val latestRrMs: Int? = null,
    val totalRrCount: Long = 0L,
    val rrGapCount: Long = 0L,
    val validRrPct: Int = 0,
    val enhancedMetricsAllowed: Boolean = false,
    val contactDetected: Boolean? = null,
    val rrHeartRateBpm: Double? = null,
    val rmssdMs: Double? = null,
    val sdnnMs: Double? = null,
    val dfaAlpha1: Double? = null,
    val dfaAlpha1History: List<DfaAlpha1Sample> = emptyList(),
    val recoverablePartialCount: Int = 0,
    val persistenceError: String? = null,
    val captureIdentity: RrCaptureIdentity? = null,
    val status: String = "Capture stopped",
    val finalizedArtifact: FinalizedRrArtifact? = null,
)

data class DfaAlpha1Sample(val elapsedMs: Long, val value: Double)

class H10CaptureController(
    private val artifactDirectory: Path,
    private val wallClockMs: () -> Long = System::currentTimeMillis,
    private val elapsedRealtimeMs: () -> Long = SystemClock::elapsedRealtime,
) : AutoCloseable {
    private val mutableState = MutableStateFlow(
        H10CaptureState(
            recoverablePartialCount = RrArtifactCatalog.recoverablePartials(artifactDirectory).size,
        ),
    )
    val state: StateFlow<H10CaptureState> = mutableState.asStateFlow()
    private var validator = RrObservationValidator()
    private var liveBuffer = RrLiveBuffer()
    private var timestampMapper = RrPacketTimestampMapper()
    private var persistenceWorker: RrArtifactPersistenceWorker? = null
    private var captureStartElapsedRealtimeMs: Long? = null
    private var lastCheckpointElapsedMs = 0L
    private var captureIdentity: RrCaptureIdentity? = null
    private val dfaHistory = ArrayDeque<DfaAlpha1Sample>()
    private var lastDfaHistoryElapsedMs = Long.MIN_VALUE

    @Synchronized
    fun startCapture(segmentId: String? = null, attemptId: String? = null) {
        stopWithoutFinalize()
        validator = RrObservationValidator()
        liveBuffer = RrLiveBuffer()
        timestampMapper = RrPacketTimestampMapper()
        dfaHistory.clear()
        lastDfaHistoryElapsedMs = Long.MIN_VALUE
        val recoverableBeforeStart = RrArtifactCatalog.recoverablePartials(artifactDirectory).size
        val startWallClock = wallClockMs()
        val identity = RrCaptureIdentity(
            captureId = UUID.randomUUID().toString(),
            segmentId = segmentId,
            attemptId = attemptId,
        )
        val artifactId = if (segmentId == null) {
            "diagnostic-${identity.captureId}"
        } else {
            "segment-${identity.captureId}"
        }
        persistenceWorker = RrArtifactPersistenceWorker(
            sink = RrArtifactWriter(artifactDirectory, artifactId, startWallClock, identity),
            onFailure = ::onPersistenceFailure,
        )
        captureIdentity = identity
        captureStartElapsedRealtimeMs = elapsedRealtimeMs()
        lastCheckpointElapsedMs = 0L
        mutableState.value = H10CaptureState(
            capturing = true,
            recoverablePartialCount = recoverableBeforeStart,
            captureIdentity = identity,
            status = "Capturing RR…",
        )
    }

    @Synchronized
    fun updateCaptureIdentity(segmentId: String, attemptId: String) {
        val updated = (captureIdentity ?: return).copy(segmentId = segmentId, attemptId = attemptId)
        if (persistenceWorker?.updateIdentity(updated) == true) {
            captureIdentity = updated
            mutableState.value = mutableState.value.copy(captureIdentity = updated)
        }
    }

    @Synchronized
    fun onMeasurement(
        measurement: BleHeartRateMeasurement,
        notificationElapsedRealtimeMs: Long,
    ) {
        val previous = mutableState.value
        mutableState.value = previous.copy(
            currentBpm = measurement.heartRateBpm,
            contactDetected = measurement.sensorContactDetected,
        )
        val activeWorker = persistenceWorker ?: return
        val captureStart = captureStartElapsedRealtimeMs ?: return
        val packetElapsedMs = (notificationElapsedRealtimeMs - captureStart).coerceAtLeast(0L)
        val mappedPacket = timestampMapper.mapPacket(
            packetElapsedMs = packetElapsedMs,
            rrIntervalsMs = measurement.rrIntervalsMs,
        )
        val sourceValid = measurement.sensorContactDetected != false
        var quality = liveBuffer.snapshot()
        measurement.rrIntervalsMs.zip(mappedPacket.endpointsMs).forEachIndexed {
                index, (rrIntervalMs, endpointMs) ->
            if (endpointMs < 0L) return@forEachIndexed
            val validated = validator.validate(
                elapsedMs = endpointMs,
                rrIntervalMs = rrIntervalMs,
                sourceValid = sourceValid,
                rrInterval1024 = measurement.rrIntervals1024.getOrElse(index) {
                    roundedMsToRr1024(rrIntervalMs)
                },
            )
            val observation = if (mappedPacket.gapBeforePacket && index == 0) {
                validated.copy(valid = false, artifactReason = RrArtifactReason.GAP_AFTER_DROPOUT)
            } else {
                validated
            }
            activeWorker.append(observation)
            quality = liveBuffer.add(observation)
        }
        val metrics = RrWindowMetricsCalculator.calculate(quality.window)
        metrics?.dfaAlpha1?.let { alpha ->
            if (packetElapsedMs - lastDfaHistoryElapsedMs >= DFA_HISTORY_INTERVAL_MS) {
                dfaHistory.addLast(DfaAlpha1Sample(packetElapsedMs, alpha))
                while (dfaHistory.size > MAX_DFA_HISTORY_SAMPLES) dfaHistory.removeFirst()
                lastDfaHistoryElapsedMs = packetElapsedMs
            }
        }
        mutableState.value = mutableState.value.copy(
            latestRrMs = measurement.rrIntervalsMs.lastOrNull(),
            totalRrCount = quality.totalCount,
            rrGapCount = mutableState.value.rrGapCount + if (mappedPacket.gapBeforePacket) 1L else 0L,
            validRrPct = quality.validPct,
            enhancedMetricsAllowed = quality.enhancedMetricsAllowed,
            rrHeartRateBpm = metrics?.heartRateFromRrBpm,
            rmssdMs = metrics?.rmssdMs,
            sdnnMs = metrics?.sdnnMs,
            dfaAlpha1 = metrics?.dfaAlpha1,
            dfaAlpha1History = dfaHistory.toList(),
            status = when {
                measurement.rrIntervalsMs.isEmpty() -> "BPM received; no RR in packet"
                mappedPacket.gapBeforePacket ->
                    "Capturing; recovered after ${mappedPacket.gapDurationMs} ms RR gap"
                !sourceValid -> "Capturing; sensor contact not detected"
                quality.enhancedMetricsAllowed -> "Capturing; enhanced metrics ready"
                else -> "Capturing; establishing a valid RR window"
            },
        )
        if (packetElapsedMs - lastCheckpointElapsedMs >= CHECKPOINT_INTERVAL_MS) {
            activeWorker.checkpoint()
            lastCheckpointElapsedMs = packetElapsedMs
        }
    }

    @Synchronized
    fun checkpoint() {
        persistenceWorker?.checkpoint()
    }

    @Synchronized
    fun stopCapture(): FinalizedRrArtifact? {
        val activeWorker = persistenceWorker ?: return null
        val finalized = try {
            activeWorker.finalizeArtifact()
        } catch (error: Exception) {
            clearActiveCapture()
            mutableState.value = mutableState.value.copy(
                capturing = false,
                enhancedMetricsAllowed = false,
                persistenceError = "${error.javaClass.simpleName}: ${error.message}",
                status = "RR storage failed; partial artifact retained",
                recoverablePartialCount = RrArtifactCatalog.recoverablePartials(artifactDirectory).size,
            )
            throw error
        }
        clearActiveCapture()
        mutableState.value = mutableState.value.copy(
            capturing = false,
            status = "Saved ${finalized.sampleCount} RR samples",
            finalizedArtifact = finalized,
            captureIdentity = finalized.identity,
            recoverablePartialCount = RrArtifactCatalog.recoverablePartials(artifactDirectory).size,
        )
        return finalized
    }

    override fun close() {
        synchronized(this) { stopWithoutFinalize() }
    }

    private fun stopWithoutFinalize() {
        persistenceWorker?.close()
        clearActiveCapture()
    }

    private fun clearActiveCapture() {
        persistenceWorker = null
        captureIdentity = null
        captureStartElapsedRealtimeMs = null
        lastCheckpointElapsedMs = 0L
    }

    private fun onPersistenceFailure(error: Throwable) {
        mutableState.value = mutableState.value.copy(
            enhancedMetricsAllowed = false,
            persistenceError = "${error.javaClass.simpleName}: ${error.message}",
            status = "RR storage failed; capture will remain recoverable",
        )
    }

    private companion object {
        const val CHECKPOINT_INTERVAL_MS = 30_000L
        const val DFA_HISTORY_INTERVAL_MS = 5_000L
        const val MAX_DFA_HISTORY_SAMPLES = 120
    }
}

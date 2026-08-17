package com.gritmap.karoo.ai

import com.gritmap.karoo.pacing.PacingPlan
import com.gritmap.karoo.pacing.ProvisionalPacingPlanner
import com.gritmap.karoo.pacing.SegmentPacingInput
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

data class NativeMemoryStats(val runtimeAllocatedBytes: Long, val processResidentBytes: Long)

interface NeedleBridge {
    fun initNeedle(modelPath: String): Boolean
    fun generatePlan(requestJson: String): String
    fun processTelemetry(metrics: FloatArray): String
    fun shutdownNeedle()
    fun nativeMemoryStats(): LongArray
}

class NeedleAgentManager(
    private val bridge: NeedleBridge = JniNeedleBridge,
    private val validator: AiPlanValidator = AiPlanValidator(),
    private val generationTimeoutMillis: Long = 5_000,
) {
    // A single worker is the serialization gate. A timed-out native call may continue,
    // but no second inference can overlap it.
    private val inferenceExecutor: ExecutorService = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "needle-inference").apply { isDaemon = true }
    }

    suspend fun initialize(modelPath: String) = withContext(Dispatchers.IO) {
        val initialized = inferenceExecutor.submit<Boolean> { bridge.initNeedle(modelPath) }.get()
        check(initialized) { "Needle runtime/model initialization failed" }
    }

    suspend fun generatePlanOrFallback(input: SegmentPacingInput): PacingPlan {
        val fallback = ProvisionalPacingPlanner.create(input)
        return withContext(Dispatchers.IO) {
            val future = inferenceExecutor.submit<PacingPlan?> {
                val target = input.targetFinishTimeSeconds?.toString() ?: "null"
                val request = """{"schemaVersion":1,"segmentLengthMeters":${input.segmentLengthMeters},"ftpWatts":${input.ftpWatts},"targetFinishTimeSeconds":$target}"""
                runCatching { AiPacingResponseParser.parse(bridge.generatePlan(request)) }
                    .mapCatching { validator.validate(it, input.segmentLengthMeters, input.ftpWatts).getOrThrow() }
                    .getOrNull()
            }
            try {
                future.get(generationTimeoutMillis, TimeUnit.MILLISECONDS) ?: fallback
            } catch (_: TimeoutException) {
                // JNI is not assumed interruptible. Leave it serialized on the worker.
                fallback
            } catch (_: Exception) {
                fallback
            }
        }
    }

    suspend fun processTelemetry(telemetry: TelemetryV1): String? = withContext(Dispatchers.IO) {
        runCatching { inferenceExecutor.submit<String> { bridge.processTelemetry(telemetry.toFloatArray()) }.get() }.getOrNull()
    }

    fun memoryStats(): NativeMemoryStats {
        val values = bridge.nativeMemoryStats()
        return NativeMemoryStats(values.getOrElse(0) { -1 }, values.getOrElse(1) { -1 })
    }

    fun shutdown() {
        runCatching { inferenceExecutor.submit { bridge.shutdownNeedle() }.get(5, TimeUnit.SECONDS) }
        inferenceExecutor.shutdownNow()
    }

    private object JniNeedleBridge : NeedleBridge {
        init { System.loadLibrary("gritmap_needle_bridge") }
        external override fun initNeedle(modelPath: String): Boolean
        external override fun generatePlan(requestJson: String): String
        external override fun processTelemetry(metrics: FloatArray): String
        external override fun shutdownNeedle()
        external override fun nativeMemoryStats(): LongArray
    }
}

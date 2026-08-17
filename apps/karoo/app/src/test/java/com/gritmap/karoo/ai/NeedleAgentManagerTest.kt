package com.gritmap.karoo.ai

import com.gritmap.karoo.pacing.PacingPlan
import com.gritmap.karoo.pacing.SegmentPacingInput
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NeedleAgentManagerTest {
    @Test fun invalidNativePlanFallsBack() = runBlocking {
        val manager = NeedleAgentManager(FakeBridge("{\"schemaVersion\":1,\"zones\":[]}"), generationTimeoutMillis = 100)
        val plan = manager.generatePlanOrFallback(SegmentPacingInput(1000.0, 300))
        assertEquals(PacingPlan.Source.PROVISIONAL, plan.source)
        manager.shutdown()
    }

    @Test fun timeoutReturnsFallbackWithoutConcurrentInference() = runBlocking {
        val bridge = FakeBridge(validPlan(), delayMillis = 75)
        val manager = NeedleAgentManager(bridge, generationTimeoutMillis = 10)
        val started = System.nanoTime()
        val plan = manager.generatePlanOrFallback(SegmentPacingInput(1000.0, 300))
        assertEquals(PacingPlan.Source.PROVISIONAL, plan.source)
        assertTrue((System.nanoTime() - started) / 1_000_000 < 70)
        manager.shutdown()
        assertEquals(1, bridge.maximumConcurrentCalls)
    }

    private fun validPlan() = """{"schemaVersion":1,"zones":[{"startDistanceMeters":0,"endDistanceMeters":1000,"targetPowerWatts":280,"classification":"hold","icon":"hold","instruction":"Hold steady"}]}"""

    private class FakeBridge(private val response: String, private val delayMillis: Long = 0) : NeedleBridge {
        private var active = 0
        var maximumConcurrentCalls = 0
        override fun initNeedle(modelPath: String) = true
        @Synchronized override fun generatePlan(requestJson: String): String {
            active++
            maximumConcurrentCalls = maxOf(maximumConcurrentCalls, active)
            Thread.sleep(delayMillis)
            active--
            return response
        }
        override fun processTelemetry(metrics: FloatArray) = "{}"
        override fun shutdownNeedle() = Unit
        override fun nativeMemoryStats() = longArrayOf(1, 2)
    }
}

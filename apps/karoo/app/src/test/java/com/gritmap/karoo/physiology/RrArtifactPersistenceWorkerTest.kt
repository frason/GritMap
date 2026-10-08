package com.gritmap.karoo.physiology

import java.nio.file.Path
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RrArtifactPersistenceWorkerTest {
    @Test
    fun `preserves append order before checkpoint and finalize`() {
        val sink = RecordingSink()
        val worker = RrArtifactPersistenceWorker(sink, queueCapacity = 8)

        worker.append(RrObservation(100L, 800, true))
        worker.append(RrObservation(200L, 810, true))
        worker.checkpoint()
        val finalized = worker.finalizeArtifact()

        assertEquals(listOf(100L, 200L), sink.observations.map { it.elapsedMs })
        assertEquals(1, sink.checkpoints)
        assertEquals(2L, finalized.sampleCount)
        assertEquals("gritmap-rr-writer", sink.threadNames.distinct().single())
    }

    @Test
    fun `slow disk never blocks callback and bounded overflow reports failure`() {
        val appendStarted = CountDownLatch(1)
        val releaseAppend = CountDownLatch(1)
        val failureSeen = CountDownLatch(1)
        val sink = RecordingSink(onAppend = {
            appendStarted.countDown()
            releaseAppend.await(2, TimeUnit.SECONDS)
        })
        val worker = RrArtifactPersistenceWorker(
            sink = sink,
            queueCapacity = 1,
            onFailure = { failureSeen.countDown() },
        )
        assertTrue(worker.append(RrObservation(1L, 800, true)))
        assertTrue(appendStarted.await(1, TimeUnit.SECONDS))
        assertTrue(worker.append(RrObservation(2L, 800, true)))

        val startedNs = System.nanoTime()
        assertFalse(worker.append(RrObservation(3L, 800, true)))
        val elapsedMs = (System.nanoTime() - startedNs) / 1_000_000

        assertTrue("append blocked for $elapsedMs ms", elapsedMs < 50L)
        assertTrue(failureSeen.await(1, TimeUnit.SECONDS))
        releaseAppend.countDown()
        worker.close()
    }

    @Test
    fun `sink error fails finalization and is surfaced once`() {
        var failureCount = 0
        val sink = RecordingSink(failAppend = true)
        val worker = RrArtifactPersistenceWorker(sink, onFailure = { failureCount++ })
        worker.append(RrObservation(1L, 800, true))
        // Finalize is ordered behind append, so it observes the persisted failure deterministically.
        val error = runCatching { worker.finalizeArtifact() }.exceptionOrNull()

        assertTrue(error != null)
        assertEquals(1, failureCount)
    }

    private class RecordingSink(
        private val onAppend: () -> Unit = {},
        private val failAppend: Boolean = false,
    ) : RrArtifactSink {
        val observations = mutableListOf<RrObservation>()
        val threadNames = mutableListOf<String>()
        var checkpoints = 0

        override fun append(observation: RrObservation) {
            threadNames += Thread.currentThread().name
            onAppend()
            if (failAppend) error("disk unavailable")
            observations += observation
        }

        override fun checkpoint() {
            threadNames += Thread.currentThread().name
            checkpoints++
        }

        override fun updateIdentity(identity: RrCaptureIdentity) = Unit

        override fun finalizeArtifact(): FinalizedRrArtifact {
            threadNames += Thread.currentThread().name
            return FinalizedRrArtifact(Path.of("test.rr"), "hash", observations.size.toLong(), 2)
        }

        override fun close() = Unit
    }
}

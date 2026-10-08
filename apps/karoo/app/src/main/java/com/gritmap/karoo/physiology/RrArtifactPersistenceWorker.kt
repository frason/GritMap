package com.gritmap.karoo.physiology

import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

/**
 * Single-owner persistence queue. Bluetooth callbacks only perform a non-blocking [append]; disk
 * writes, checkpoints, fsync, hashing and rename all execute on the dedicated worker thread.
 */
class RrArtifactPersistenceWorker(
    private val sink: RrArtifactSink,
    queueCapacity: Int = DEFAULT_QUEUE_CAPACITY,
    private val onFailure: (Throwable) -> Unit = {},
) : AutoCloseable {
    private sealed interface Command {
        data class Append(val observation: RrObservation) : Command
        data object Checkpoint : Command
        data class UpdateIdentity(val identity: RrCaptureIdentity) : Command
        data class Finalize(val result: CompletableFuture<FinalizedRrArtifact>) : Command
        data class Close(val result: CompletableFuture<Unit>) : Command
    }

    private val queue = ArrayBlockingQueue<Command>(queueCapacity)
    private val failure = AtomicReference<Throwable?>(null)
    private val accepting = AtomicBoolean(true)
    private val worker = Thread(::runLoop, "gritmap-rr-writer").apply {
        isDaemon = true
        start()
    }

    init {
        require(queueCapacity > 0)
    }

    /** Non-blocking by design: a full queue fails capture instead of stalling the GATT callback. */
    fun append(observation: RrObservation): Boolean {
        if (!accepting.get() || failure.get() != null) return false
        if (queue.offer(Command.Append(observation))) return true
        recordFailure(RrPersistenceQueueFullException(queue.remainingCapacity()))
        return false
    }

    fun checkpoint(): Boolean {
        if (!accepting.get() || failure.get() != null) return false
        if (queue.offer(Command.Checkpoint)) return true
        recordFailure(RrPersistenceQueueFullException(queue.remainingCapacity()))
        return false
    }

    fun updateIdentity(identity: RrCaptureIdentity): Boolean {
        if (!accepting.get() || failure.get() != null) return false
        if (queue.offer(Command.UpdateIdentity(identity))) return true
        recordFailure(RrPersistenceQueueFullException(queue.remainingCapacity()))
        return false
    }

    fun finalizeArtifact(timeoutSeconds: Long = FINALIZE_TIMEOUT_SECONDS): FinalizedRrArtifact {
        accepting.set(false)
        val result = CompletableFuture<FinalizedRrArtifact>()
        enqueueTerminal(Command.Finalize(result))
        return result.get(timeoutSeconds, TimeUnit.SECONDS)
    }

    override fun close() {
        if (!accepting.getAndSet(false) && !worker.isAlive) return
        val result = CompletableFuture<Unit>()
        enqueueTerminal(Command.Close(result))
        runCatching { result.get(FINALIZE_TIMEOUT_SECONDS, TimeUnit.SECONDS) }
    }

    private fun enqueueTerminal(command: Command) {
        while (true) {
            check(worker.isAlive) { "RR persistence worker stopped" }
            if (queue.offer(command, TERMINAL_OFFER_MS, TimeUnit.MILLISECONDS)) return
            // Wait for previously accepted observations; terminal operations never overtake them.
        }
    }

    private fun runLoop() {
        while (true) {
            when (val command = queue.take()) {
                is Command.Append -> if (failure.get() == null) runSink { sink.append(command.observation) }
                Command.Checkpoint -> if (failure.get() == null) runSink(sink::checkpoint)
                is Command.UpdateIdentity -> if (failure.get() == null) {
                    runSink { sink.updateIdentity(command.identity) }
                }
                is Command.Finalize -> {
                    val error = failure.get()
                    if (error != null) {
                        runCatching(sink::close)
                        command.result.completeExceptionally(
                            RrPersistenceException("RR persistence failed", error),
                        )
                    } else {
                        runCatching(sink::finalizeArtifact)
                            .onSuccess(command.result::complete)
                            .onFailure {
                                recordFailure(it)
                                command.result.completeExceptionally(it)
                            }
                    }
                    return
                }
                is Command.Close -> {
                    runCatching(sink::close)
                        .onSuccess { command.result.complete(Unit) }
                        .onFailure(command.result::completeExceptionally)
                    return
                }
            }
        }
    }

    private inline fun runSink(block: () -> Unit) {
        runCatching(block).onFailure(::recordFailure)
    }

    private fun recordFailure(error: Throwable) {
        if (failure.compareAndSet(null, error)) onFailure(error)
    }

    companion object {
        const val DEFAULT_QUEUE_CAPACITY = 2_048
        private const val TERMINAL_OFFER_MS = 50L
        private const val FINALIZE_TIMEOUT_SECONDS = 30L
    }
}

class RrPersistenceQueueFullException(remainingCapacity: Int) :
    IllegalStateException("RR persistence queue full (remaining=$remainingCapacity)")

class RrPersistenceException(message: String, cause: Throwable) : IllegalStateException(message, cause)

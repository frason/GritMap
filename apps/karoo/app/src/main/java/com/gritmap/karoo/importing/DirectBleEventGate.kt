package com.gritmap.karoo.importing

import kotlinx.coroutines.CompletableDeferred

/** Routes only the callback belonging to the current serialized GATT operation. */
internal class DirectBleEventGate<T> {
    private var pending = CompletableDeferred<T>()
    private var accepts: (T) -> Boolean = { false }
    private var terminal: Exception? = null
    private var operation = "idle"

    @Synchronized fun expect(name: String, predicate: (T) -> Boolean) {
        operation = name
        accepts = predicate
        pending = CompletableDeferred()
        terminal?.let { pending.completeExceptionally(it) }
    }

    @Synchronized fun complete(event: T) {
        if (accepts(event)) pending.complete(event)
    }

    @Synchronized fun fail(error: Exception) {
        terminal = error
        pending.completeExceptionally(DirectBleDisconnectedException("$operation: ${error.message}"))
    }

    suspend fun await(): T = synchronized(this) { pending }.await()
}

internal class DirectBleDisconnectedException(message: String) : IllegalStateException(message)

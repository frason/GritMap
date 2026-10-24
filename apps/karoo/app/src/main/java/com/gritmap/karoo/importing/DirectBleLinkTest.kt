package com.gritmap.karoo.importing

/** Diagnostic builds only: one real link drop after a complete segment chunk, never a radio reset. */
internal class DirectBleLinkTest(private val afterBytes: Int = 0) {
    private var used = false

    fun afterChunk(resource: DirectTransferResourceName, completedBytes: Int): Boolean {
        if (afterBytes <= 0 || used || resource != DirectTransferResourceName.SEGMENT || completedBytes < afterBytes) {
            return false
        }
        used = true
        return true
    }
}

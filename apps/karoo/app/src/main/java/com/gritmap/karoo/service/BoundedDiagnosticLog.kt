package com.gritmap.karoo.service

import java.io.File

/** Small, local, bounded diagnostic trail suitable for post-ride failure analysis. */
class BoundedDiagnosticLog(
    private val file: File,
    private val maxBytes: Long = 256_000,
    private val nowMs: () -> Long = System::currentTimeMillis,
) {
    init {
        require(maxBytes > 0)
    }

    @Synchronized
    fun append(event: String, details: String = "") {
        file.parentFile?.mkdirs()
        val safeEvent = sanitize(event)
        val safeDetails = sanitize(details)
        val line = buildString {
            append(nowMs())
            append('\t')
            append(safeEvent)
            if (safeDetails.isNotBlank()) {
                append('\t')
                append(safeDetails)
            }
            append('\n')
        }
        val bytes = line.toByteArray(Charsets.UTF_8)
        if (file.length() + bytes.size > maxBytes) rotate()
        file.appendBytes(bytes)
    }

    @Synchronized
    fun tail(maxLines: Int = 20): List<String> {
        if (!file.exists()) return emptyList()
        return file.useLines { lines -> lines.toList().takeLast(maxLines.coerceAtLeast(0)) }
    }

    private fun rotate() {
        val previous = File(file.parentFile, "${file.name}.previous")
        if (previous.exists()) previous.delete()
        if (file.exists()) file.renameTo(previous)
    }

    private fun sanitize(value: String): String = value
        .replace('\n', ' ')
        .replace('\r', ' ')
        .replace('\t', ' ')
        .take(1_000)
}

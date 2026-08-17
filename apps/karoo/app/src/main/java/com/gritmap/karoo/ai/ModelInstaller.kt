package com.gritmap.karoo.ai

import android.content.Context
import java.io.File
import java.io.InputStream
import java.security.MessageDigest
import java.nio.file.StandardCopyOption.ATOMIC_MOVE
import java.nio.file.StandardCopyOption.REPLACE_EXISTING

fun interface ModelSource {
    fun open(): InputStream
}

class AssetModelSource(
    private val context: Context,
    private val assetName: String,
) : ModelSource {
    override fun open(): InputStream = context.assets.open(assetName)
}

/** Installs a pinned model atomically. A file is never reusable without re-verification. */
class ModelInstaller(
    private val privateFilesDirectory: File,
    private val source: ModelSource,
    expectedSha256: String,
    private val installedFileName: String = "needle-v1.cactus",
) {
    private val expectedSha256 = expectedSha256.lowercase().also {
        require(it.matches(Regex("[0-9a-f]{64}")) && it.any { character -> character != '0' }) {
            "A real, non-placeholder SHA-256 digest is required"
        }
    }

    @Synchronized
    fun installOrVerify(): File {
        require(installedFileName.matches(Regex("[A-Za-z0-9._-]+"))) { "Unsafe model filename" }
        check(privateFilesDirectory.mkdirs() || privateFilesDirectory.isDirectory) { "Cannot create model directory" }
        val destination = File(privateFilesDirectory, installedFileName)
        if (destination.isFile && sha256(destination) == expectedSha256) return destination

        val temporary = File(privateFilesDirectory, ".$installedFileName.tmp")
        temporary.delete()
        try {
            source.open().use { input -> temporary.outputStream().use(input::copyTo) }
            check(sha256(temporary) == expectedSha256) { "Needle model SHA-256 mismatch" }
            java.nio.file.Files.move(temporary.toPath(), destination.toPath(), ATOMIC_MOVE, REPLACE_EXISTING)
            check(sha256(destination) == expectedSha256) { "Installed Needle model verification failed" }
            return destination
        } finally {
            temporary.delete()
        }
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().buffered().use { input ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}

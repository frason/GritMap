package com.gritmap.karoo.ai

import java.io.ByteArrayInputStream
import java.nio.file.Files
import java.security.MessageDigest
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.fail
import org.junit.Test

class ModelInstallerTest {
    @Test fun installsAndVerifiesPinnedBytes() {
        val bytes = "real model bytes".toByteArray()
        val directory = Files.createTempDirectory("needle-model-test").toFile()
        try {
            val installer = ModelInstaller(directory, ModelSource { ByteArrayInputStream(bytes) }, digest(bytes))
            val result = installer.installOrVerify()
            assertArrayEquals(bytes, result.readBytes())
            assertFalse(directory.resolve(".needle-v1.cactus.tmp").exists())
        } finally {
            directory.deleteRecursively()
        }
    }

    @Test fun rejectsWrongContentAndPlaceholderDigest() {
        val directory = Files.createTempDirectory("needle-model-test").toFile()
        try {
            expectThrows<IllegalStateException> {
                ModelInstaller(directory, ModelSource { ByteArrayInputStream(byteArrayOf(1)) }, digest(byteArrayOf(2))).installOrVerify()
            }
            expectThrows<IllegalArgumentException> {
                ModelInstaller(directory, ModelSource { ByteArrayInputStream(byteArrayOf()) }, "0".repeat(64))
            }
        } finally {
            directory.deleteRecursively()
        }
    }

    private fun digest(bytes: ByteArray) = MessageDigest.getInstance("SHA-256")
        .digest(bytes).joinToString("") { "%02x".format(it) }

    private inline fun <reified T : Throwable> expectThrows(block: () -> Unit) {
        try {
            block()
            fail("Expected ${T::class.java.simpleName}")
        } catch (error: Throwable) {
            if (error !is T) throw error
        }
    }
}

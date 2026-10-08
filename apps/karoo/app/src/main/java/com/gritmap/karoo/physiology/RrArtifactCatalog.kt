package com.gritmap.karoo.physiology

import java.nio.file.Files
import java.nio.file.Path

data class RecoverableRrArtifact(
    val path: Path,
    val sampleCount: Int,
    val ignoredTrailingBytes: Int,
    val rideStartTimestampMs: Long,
)

object RrArtifactCatalog {
    fun recoverablePartials(directory: Path): List<RecoverableRrArtifact> {
        if (!Files.isDirectory(directory)) return emptyList()
        val recoveredArtifacts = mutableListOf<RecoverableRrArtifact>()
        Files.newDirectoryStream(directory, "*.rr.partial").use { paths ->
            paths.forEach { path ->
                runCatching {
                    val recovered = RrArtifactWriter.recover(path)
                    RecoverableRrArtifact(
                        path = path,
                        sampleCount = recovered.observations.size,
                        ignoredTrailingBytes = recovered.ignoredTrailingBytes,
                        rideStartTimestampMs = recovered.rideStartTimestampMs,
                    )
                }.getOrNull()?.let(recoveredArtifacts::add)
            }
        }
        return recoveredArtifacts.sortedByDescending { it.rideStartTimestampMs }
    }
}

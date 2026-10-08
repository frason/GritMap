package com.gritmap.karoo.physiology

import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.Closeable
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.EOFException
import java.io.FileOutputStream
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

private val RR_MAGIC = byteArrayOf('G'.code.toByte(), 'M'.code.toByte(), 'R'.code.toByte(), 'R'.code.toByte())
private const val HEADER_SIZE_BYTES = 4 + Int.SIZE_BYTES + Long.SIZE_BYTES
private const val RECORD_SIZE_BYTES = Long.SIZE_BYTES + Int.SIZE_BYTES + 1 + 1

data class FinalizedRrArtifact(
    val path: Path,
    val sha256: String,
    val sampleCount: Long,
    val schemaVersion: Int,
    val identity: RrCaptureIdentity? = null,
    val metadataPath: Path? = null,
)

data class RecoveredRrArtifact(
    val schemaVersion: Int,
    val rideStartTimestampMs: Long,
    val observations: List<RrObservation>,
    val ignoredTrailingBytes: Int,
)

/**
 * Append-only, fixed-record RR artifact writer. The caller supplies app-private storage. A
 * `.partial` file remains recoverable after process death and is atomically renamed on success.
 */
interface RrArtifactSink : Closeable {
    fun append(observation: RrObservation)
    fun checkpoint()
    fun updateIdentity(identity: RrCaptureIdentity)
    fun finalizeArtifact(): FinalizedRrArtifact
}

class RrArtifactWriter(
    directory: Path,
    rideId: String,
    private val rideStartTimestampMs: Long,
    initialIdentity: RrCaptureIdentity? = null,
) : RrArtifactSink {
    private val safeRideId = requireSafeRideId(rideId)
    private val partialPath = directory.resolve("$safeRideId.rr.partial")
    private val finalPath = directory.resolve("$safeRideId.rr")
    private val fileOutput: FileOutputStream
    private val output: DataOutputStream
    private var sampleCount = 0L
    private var finished = false
    private var identity = initialIdentity

    init {
        Files.createDirectories(directory)
        check(!Files.exists(finalPath)) { "Final RR artifact already exists: $finalPath" }
        Files.createFile(partialPath)
        fileOutput = FileOutputStream(partialPath.toFile(), false)
        output = DataOutputStream(BufferedOutputStream(fileOutput))
        output.write(RR_MAGIC)
        output.writeInt(RR_ARTIFACT_SCHEMA_VERSION)
        output.writeLong(rideStartTimestampMs)
        flushDurably()
    }

    @Synchronized
    override fun append(observation: RrObservation) {
        check(!finished) { "RR artifact is already finalized" }
        output.writeLong(observation.elapsedMs)
        output.writeInt(observation.rrInterval1024)
        output.writeBoolean(observation.valid)
        output.writeByte(observation.artifactReason.code.toInt())
        sampleCount++
    }

    @Synchronized
    override fun checkpoint() {
        check(!finished) { "RR artifact is already finalized" }
        flushDurably()
    }

    override fun updateIdentity(identity: RrCaptureIdentity) {
        check(!finished) { "RR artifact is already finalized" }
        this.identity = identity
    }

    @Synchronized
    override fun finalizeArtifact(): FinalizedRrArtifact {
        check(!finished) { "RR artifact is already finalized" }
        flushDurably()
        output.close()
        finished = true
        try {
            Files.move(
                partialPath,
                finalPath,
                StandardCopyOption.ATOMIC_MOVE,
            )
        } catch (_: AtomicMoveNotSupportedException) {
            Files.move(partialPath, finalPath)
        }
        val artifactHash = sha256(finalPath)
        val metadataPath = identity?.let { captureIdentity ->
            writeMetadata(captureIdentity, artifactHash, sampleCount)
        }
        return FinalizedRrArtifact(
            path = finalPath,
            sha256 = artifactHash,
            sampleCount = sampleCount,
            schemaVersion = RR_ARTIFACT_SCHEMA_VERSION,
            identity = identity,
            metadataPath = metadataPath,
        )
    }

    override fun close() {
        if (!finished) {
            flushDurably()
            output.close()
        }
    }

    private fun flushDurably() {
        output.flush()
        fileOutput.fd.sync()
    }

    private fun writeMetadata(
        captureIdentity: RrCaptureIdentity,
        artifactHash: String,
        finalizedSampleCount: Long,
    ): Path {
        val target = finalPath.resolveSibling("${finalPath.fileName}.json")
        val temporary = target.resolveSibling("${target.fileName}.partial")
        val json = buildJsonObject {
            put("metadataVersion", 1)
            put("captureId", captureIdentity.captureId)
            captureIdentity.segmentId?.let { put("segmentId", it) }
            captureIdentity.attemptId?.let { put("attemptId", it) }
            put("rrSchemaVersion", RR_ARTIFACT_SCHEMA_VERSION)
            put("captureStartTimestampMs", rideStartTimestampMs)
            put("sampleCount", finalizedSampleCount)
            put("sha256", artifactHash)
        }
        Files.write(temporary, Json.encodeToString(json).encodeToByteArray())
        try {
            Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE)
        } catch (_: AtomicMoveNotSupportedException) {
            Files.move(temporary, target)
        }
        return target
    }

    companion object {
        fun recover(path: Path): RecoveredRrArtifact {
            val fileSize = Files.size(path)
            require(fileSize >= HEADER_SIZE_BYTES) { "RR artifact header is incomplete" }
            DataInputStream(BufferedInputStream(Files.newInputStream(path))).use { input ->
                val magic = ByteArray(RR_MAGIC.size)
                input.readFully(magic)
                require(magic.contentEquals(RR_MAGIC)) { "Invalid RR artifact magic" }
                val schemaVersion = input.readInt()
                require(schemaVersion in 1..RR_ARTIFACT_SCHEMA_VERSION) {
                    "Unsupported RR artifact schema $schemaVersion"
                }
                val rideStartTimestampMs = input.readLong()
                val completeRecordBytes = fileSize - HEADER_SIZE_BYTES
                val completeRecordCount = completeRecordBytes / RECORD_SIZE_BYTES
                val ignoredTrailingBytes = (completeRecordBytes % RECORD_SIZE_BYTES).toInt()
                val observations = ArrayList<RrObservation>(completeRecordCount.toInt())
                repeat(completeRecordCount.toInt()) {
                    try {
                        val elapsedMs = input.readLong()
                        val storedInterval = input.readInt()
                        val rrInterval1024 = if (schemaVersion >= 2) {
                            storedInterval
                        } else {
                            roundedMsToRr1024(storedInterval)
                        }
                        observations += RrObservation(
                            elapsedMs = elapsedMs,
                            rrIntervalMs = if (schemaVersion >= 2) {
                                rr1024ToRoundedMs(storedInterval)
                            } else {
                                storedInterval
                            },
                            valid = input.readBoolean(),
                            artifactReason = RrArtifactReason.fromCode(input.readByte()),
                            rrInterval1024 = rrInterval1024,
                        )
                    } catch (error: EOFException) {
                        throw IllegalArgumentException("RR artifact ended inside a complete record", error)
                    }
                }
                return RecoveredRrArtifact(
                    schemaVersion = schemaVersion,
                    rideStartTimestampMs = rideStartTimestampMs,
                    observations = observations,
                    ignoredTrailingBytes = ignoredTrailingBytes,
                )
            }
        }

        private fun requireSafeRideId(rideId: String): String {
            require(rideId.matches(Regex("[A-Za-z0-9._-]{1,128}"))) { "Unsafe ride ID" }
            require(rideId != "." && rideId != "..") { "Unsafe ride ID" }
            return rideId
        }

        private fun sha256(path: Path): String {
            val digest = MessageDigest.getInstance("SHA-256")
            Files.newInputStream(path).use { input ->
                val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    digest.update(buffer, 0, read)
                }
            }
            return digest.digest().joinToString("") { "%02x".format(it) }
        }
    }
}

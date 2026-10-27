package com.gritmap.karoo.importing

import java.security.MessageDigest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import kotlinx.serialization.json.put

data class DirectTransferResource(
    val bytes: Int,
    val sha256: String,
    val isPublic: Boolean = false,
)

data class DirectTransferManifest(
    val transferId: String,
    val createdAtMs: Long,
    val segmentFingerprint: String,
    val chunkBytes: Int,
    val plan: DirectTransferResource,
    val segment: DirectTransferResource,
    val rider: DirectTransferResource?,
    val record: DirectTransferResource? = null,
)

class DirectTransferManifestParser(private val json: Json = Json { ignoreUnknownKeys = false }) {
    fun parse(bytes: ByteArray): DirectTransferManifest {
        require(bytes.size <= MAX_MANIFEST_BYTES) { "Transfer manifest is too large" }
        val root = json.parseToJsonElement(bytes.toString(Charsets.UTF_8)).jsonObject
        val allowed = setOf("v", "transferId", "createdAtMs", "segmentFingerprint", "chunkBytes", "plan", "segment", "rider", "record")
        require(root.keys.all(allowed::contains)) { "Unknown transfer manifest property" }
        require(root.keys.containsAll(allowed - setOf("rider", "record"))) { "Transfer manifest is missing a property" }
        require(root.getValue("v").jsonPrimitive.int == VERSION) { "Unsupported transfer version" }
        val transferId = root.getValue("transferId").jsonPrimitive.content
        require(transferId.matches(TRANSFER_ID)) { "Invalid transfer id" }
        val createdAtMs = root.getValue("createdAtMs").jsonPrimitive.long
        require(createdAtMs > 0) { "Invalid transfer timestamp" }
        val fingerprint = root.getValue("segmentFingerprint").jsonPrimitive.content
        require(fingerprint.matches(SHA256)) { "Invalid segment fingerprint" }
        val chunkBytes = root.getValue("chunkBytes").jsonPrimitive.int
        require(chunkBytes in MIN_CHUNK_BYTES..MAX_CHUNK_BYTES) { "Invalid chunk size" }
        return DirectTransferManifest(
            transferId, createdAtMs, fingerprint, chunkBytes,
            parseResource(root.getValue("plan").jsonObject, MAX_PLAN_BYTES, false),
            parseResource(root.getValue("segment").jsonObject, MAX_SEGMENT_BYTES, true),
            root["rider"]?.jsonObject?.let { parseResource(it, MAX_RIDER_BYTES, false) },
            root["record"]?.jsonObject?.let { parseResource(it, MAX_RECORD_BYTES, false) },
        )
    }

    private fun parseResource(value: JsonObject, cap: Int, allowPublic: Boolean): DirectTransferResource {
        val allowed = if (allowPublic) setOf("bytes", "sha256", "public") else setOf("bytes", "sha256")
        require(value.keys.all(allowed::contains) && value.keys.containsAll(setOf("bytes", "sha256"))) {
            "Invalid transfer resource properties"
        }
        val length = value.getValue("bytes").jsonPrimitive.int
        require(length in 1..cap) { "Transfer resource exceeds its size limit" }
        val hash = value.getValue("sha256").jsonPrimitive.content
        require(hash.matches(SHA256)) { "Invalid transfer resource hash" }
        val publicValue = value["public"]?.jsonPrimitive?.booleanOrNull
        require(publicValue == null || (allowPublic && publicValue)) { "Invalid public resource flag" }
        return DirectTransferResource(length, hash, publicValue == true)
    }

    companion object {
        const val VERSION = 2
        const val MAX_MANIFEST_BYTES = 512
        const val MIN_CHUNK_BYTES = 20
        const val MAX_CHUNK_BYTES = 512
        const val MAX_PLAN_BYTES = 128 * 1024
        const val MAX_SEGMENT_BYTES = 512 * 1024
        const val MAX_RECORD_BYTES = 8192
        const val MAX_RIDER_BYTES = 16 * 1024
        private val TRANSFER_ID = Regex("[A-Za-z0-9_-]{22}")
        private val SHA256 = Regex("[0-9a-f]{64}")
    }
}

enum class DirectTransferResourceName(val wireName: String) { PLAN("plan"), SEGMENT("segment"), RIDER("rider"), RECORD("record") }

fun directTransferRequest(resource: DirectTransferResourceName, offset: Int): ByteArray =
    "{\"resource\":\"${resource.wireName}\",\"offset\":$offset}".encodeToByteArray().also {
        require(offset >= 0) { "Invalid resource offset" }
        require(it.size <= 64) { "Transfer request is too large" }
    }

fun directTransferReceipt(transferId: String, imported: Boolean, code: String): ByteArray {
    require(transferId.matches(Regex("[A-Za-z0-9_-]{22}"))) { "Invalid receipt transfer id" }
    require(code.matches(Regex("[a-z0-9_]{1,32}"))) { "Invalid receipt code" }
    return buildJsonObject {
        put("transferId", transferId)
        put("status", if (imported) "imported" else "rejected")
        put("code", code)
    }.toString().encodeToByteArray().also { require(it.size <= 128) }
}

class DirectTransferHashMismatch(message: String) : IllegalArgumentException(message)

suspend fun readDirectTransferResource(
    descriptor: DirectTransferResource,
    chunkBytes: Int,
    startOffset: Int = 0,
    readChunk: suspend (offset: Int, expectedBytes: Int) -> ByteArray,
): ByteArray {
    require(startOffset == 0) { "Partial buffers must be owned by the transport" }
    val output = ByteArray(descriptor.bytes)
    var offset = 0
    while (offset < descriptor.bytes) {
        val expected = minOf(chunkBytes, descriptor.bytes - offset)
        val chunk = readChunk(offset, expected)
        require(chunk.size == expected) { "Short logical BLE chunk at $offset: expected $expected, got ${chunk.size}" }
        chunk.copyInto(output, offset)
        offset += chunk.size
    }
    val actual = MessageDigest.getInstance("SHA-256").digest(output).joinToString("") { "%02x".format(it) }
    if (!MessageDigest.isEqual(actual.encodeToByteArray(), descriptor.sha256.encodeToByteArray())) {
        throw DirectTransferHashMismatch("BLE resource SHA-256 mismatch")
    }
    return output
}

class DirectTransferPackageBuilder(private val json: Json = Json { ignoreUnknownKeys = false }) {
    fun build(manifest: DirectTransferManifest, plan: ByteArray, segment: ByteArray?, rider: ByteArray?, record: ByteArray? = null): String {
        val planObject = json.parseToJsonElement(plan.toString(Charsets.UTF_8)).jsonObject
        val segmentObject = segment?.let { json.parseToJsonElement(it.toString(Charsets.UTF_8)).jsonObject }
        val riderObject = rider?.let { json.parseToJsonElement(it.toString(Charsets.UTF_8)).jsonObject }
        val recordObject = record?.let { json.parseToJsonElement(it.toString(Charsets.UTF_8)).jsonObject }
        return buildJsonObject {
            put("schemaVersion", 1)
            put("packageType", TransferPackageParser.PACKAGE_TYPE)
            put("packageId", manifest.transferId)
            put("createdAtMs", manifest.createdAtMs)
            segmentObject?.let { put("segment", it) }
            riderObject?.let { put("riderHistory", it) }
            recordObject?.let { put("segmentRecord", it) }
            put("baselinePacingPlan", planObject)
        }.toString()
    }
}

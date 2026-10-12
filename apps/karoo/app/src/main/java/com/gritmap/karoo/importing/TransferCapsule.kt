package com.gritmap.karoo.importing

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import kotlinx.serialization.json.put

@JvmInline
value class TransferCapsuleToken private constructor(val value: String) {
    companion object {
        private val TOKEN_PATTERN = Regex("[A-Za-z0-9_-]{22}")

        fun parse(value: String): TransferCapsuleToken {
            require(TOKEN_PATTERN.matches(value)) { "Invalid transfer token" }
            return TransferCapsuleToken(value)
        }
    }
}

data class TransferCapsuleResource(
    val url: URL,
    val sha256: String,
)

data class TransferCapsule(
    val packageId: String,
    val createdAtMs: Long,
    val expiresAtMs: Long,
    val segment: TransferCapsuleResource,
    val plan: TransferCapsuleResource,
)

class TransferTokenParser(
    private val json: Json = Json { ignoreUnknownKeys = false },
) {
    fun parse(bytes: ByteArray): TransferCapsuleToken {
        require(bytes.size <= MAX_TOKEN_PAYLOAD_BYTES) { "Transfer token payload is too large" }
        val root = json.parseToJsonElement(bytes.toString(Charsets.UTF_8)).jsonObject
        require(root.keys == setOf("v", "t")) { "Invalid transfer token payload" }
        require(root.getValue("v").jsonPrimitive.content == "1") { "Unsupported transfer token version" }
        return TransferCapsuleToken.parse(root.getValue("t").jsonPrimitive.content)
    }

    companion object {
        const val MAX_TOKEN_PAYLOAD_BYTES = 96
    }
}

class TransferCapsuleParser(
    private val nowMs: () -> Long = System::currentTimeMillis,
    private val json: Json = Json { ignoreUnknownKeys = false },
) {
    fun parse(bytes: ByteArray): TransferCapsule {
        require(bytes.size <= MAX_CAPSULE_BYTES) { "Transfer capsule is too large" }
        val root = json.parseToJsonElement(bytes.toString(Charsets.UTF_8)).jsonObject
        val allowed = setOf(
            "schemaVersion", "capsuleType", "packageId", "createdAtMs", "expiresAtMs", "segment", "plan",
        )
        require(root.keys.all(allowed::contains) && root.keys.containsAll(allowed)) {
            "Invalid transfer capsule properties"
        }
        require(root.getValue("schemaVersion").jsonPrimitive.content == "1") {
            "Unsupported transfer capsule schemaVersion"
        }
        require(root.getValue("capsuleType").jsonPrimitive.content == CAPSULE_TYPE) {
            "Invalid transfer capsule type"
        }
        val packageId = root.getValue("packageId").jsonPrimitive.content
        require(packageId.isNotBlank() && packageId.length <= 100) { "Invalid transfer package id" }
        val createdAtMs = root.getValue("createdAtMs").jsonPrimitive.long
        val expiresAtMs = root.getValue("expiresAtMs").jsonPrimitive.long
        require(createdAtMs > 0 && expiresAtMs > createdAtMs) { "Invalid transfer capsule lifetime" }
        require(expiresAtMs - createdAtMs <= MAX_CAPSULE_LIFETIME_MS) { "Transfer capsule lifetime is too long" }
        require(expiresAtMs > nowMs()) { "Transfer capsule has expired" }
        return TransferCapsule(
            packageId = packageId,
            createdAtMs = createdAtMs,
            expiresAtMs = expiresAtMs,
            segment = parseResource(root.getValue("segment").jsonObject),
            plan = parseResource(root.getValue("plan").jsonObject),
        )
    }

    private fun parseResource(value: JsonObject): TransferCapsuleResource {
        require(value.keys == setOf("url", "sha256")) { "Invalid transfer resource properties" }
        val rawUrl = value.getValue("url").jsonPrimitive.content
        require(rawUrl.length <= MAX_URL_LENGTH) { "Transfer resource URL is too long" }
        val uri = URI(rawUrl)
        require(uri.scheme.equals("https", ignoreCase = true) && uri.host != null && uri.userInfo == null) {
            "Transfer resources must use HTTPS"
        }
        val hash = value.getValue("sha256").jsonPrimitive.content
        require(SHA256_PATTERN.matches(hash)) { "Invalid transfer resource SHA-256" }
        return TransferCapsuleResource(uri.toURL(), hash)
    }

    companion object {
        const val CAPSULE_TYPE = "gritmap-transfer-capsule"
        const val MAX_CAPSULE_BYTES = 16 * 1024
        const val MAX_CAPSULE_LIFETIME_MS = 15 * 60_000L
        private const val MAX_URL_LENGTH = 2_048
        private val SHA256_PATTERN = Regex("[0-9a-f]{64}")
    }
}

fun interface TransferResourceClient {
    suspend fun get(url: URL, maxBytes: Int): ByteArray
}

class HttpsTransferResourceClient : TransferResourceClient {
    override suspend fun get(url: URL, maxBytes: Int): ByteArray = withContext(Dispatchers.IO) {
        require(url.protocol.equals("https", ignoreCase = true)) { "Only HTTPS transfer resources are allowed" }
        val connection = (url.openConnection() as HttpURLConnection).apply {
            connectTimeout = CONNECT_TIMEOUT_MS
            readTimeout = READ_TIMEOUT_MS
            instanceFollowRedirects = false
            requestMethod = "GET"
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Cache-Control", "no-store")
        }
        try {
            val status = connection.responseCode
            if (status !in 200..299) throw IOException("Transfer server returned HTTP $status")
            val declaredLength = connection.contentLengthLong
            if (declaredLength > maxBytes) throw IOException("Transfer response exceeds $maxBytes bytes")
            connection.inputStream.use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(8 * 1024)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    if (output.size() + count > maxBytes) throw IOException("Transfer response exceeds $maxBytes bytes")
                    output.write(buffer, 0, count)
                }
                output.toByteArray()
            }
        } finally {
            connection.disconnect()
        }
    }

    companion object {
        private const val CONNECT_TIMEOUT_MS = 10_000
        private const val READ_TIMEOUT_MS = 15_000
    }
}

class TransferCapsuleReceiver(
    private val resourceClient: TransferResourceClient,
    private val importPackage: suspend (String) -> TransferImportResult,
    private val capsuleParser: TransferCapsuleParser = TransferCapsuleParser(),
    private val json: Json = Json { ignoreUnknownKeys = false },
    private val capsuleBaseUrl: String = DEFAULT_CAPSULE_BASE_URL,
) {
    suspend fun receive(token: TransferCapsuleToken): TransferImportResult {
        val capsuleUrl = URL("$capsuleBaseUrl${token.value}")
        val capsule = capsuleParser.parse(resourceClient.get(capsuleUrl, TransferCapsuleParser.MAX_CAPSULE_BYTES))
        val segmentBytes = resourceClient.get(capsule.segment.url, MAX_SEGMENT_BYTES)
        requireSha256(segmentBytes, capsule.segment.sha256, "segment")
        val planBytes = resourceClient.get(capsule.plan.url, MAX_PLAN_BYTES)
        requireSha256(planBytes, capsule.plan.sha256, "plan")

        val segment = json.parseToJsonElement(segmentBytes.toString(Charsets.UTF_8)).jsonObject
        val plan = json.parseToJsonElement(planBytes.toString(Charsets.UTF_8)).jsonObject
        val transfer = buildJsonObject {
            put("schemaVersion", 1)
            put("packageType", TransferPackageParser.PACKAGE_TYPE)
            put("packageId", capsule.packageId)
            put("createdAtMs", capsule.createdAtMs)
            put("segment", segment)
            put("baselinePacingPlan", plan)
        }
        return importPackage(transfer.toString())
    }

    private fun requireSha256(bytes: ByteArray, expected: String, label: String) {
        val actual = MessageDigest.getInstance("SHA-256").digest(bytes).toHex()
        require(MessageDigest.isEqual(actual.toByteArray(), expected.toByteArray())) {
            "$label SHA-256 mismatch"
        }
    }

    companion object {
        const val DEFAULT_CAPSULE_BASE_URL = "https://gritmap.app/t/"
        const val MAX_SEGMENT_BYTES = 512 * 1024
        const val MAX_PLAN_BYTES = 128 * 1024
    }
}

private fun ByteArray.toHex(): String = joinToString(separator = "") { "%02x".format(it) }

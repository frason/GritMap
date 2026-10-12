package com.gritmap.karoo.importing

import java.net.URL
import java.security.MessageDigest
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TransferCapsuleTest {
    private val now = 1_700_000_000_000L
    private val token = "X7kP3m9Qw2AbCd4Ef6Gh8J"
    private val segment = """
        {"schemaVersion":1,"id":"wall","name":"Local Wall","direction":"forward",
         "matching":{"corridorMeters":30,"requiredCoveragePct":0.9},
         "referencePolyline":[
           {"lat":37.0,"lng":-122.0,"distanceMeters":0,"elevationMeters":10},
           {"lat":37.001,"lng":-122.0,"distanceMeters":111,"elevationMeters":20}]}
    """.trimIndent()
    private val fingerprint = SegmentJsonParser().parse(segment).fingerprint
    private val plan = """
        {"schemaVersion":1,"id":"plan-1","segmentFingerprint":"$fingerprint","createdAtMs":$now,
         "generator":{"type":"phone-ai","modelVersion":"phone-model-1"},"ftpWatts":250,
         "targetFinishTimeSeconds":60,"zones":[{"startDistanceMeters":0,"endDistanceMeters":111,
         "targetPowerWatts":300,"classification":"hold","icon":"hold","instruction":"Hold"}]}
    """.trimIndent()

    @Test fun `compact 128-bit token payload stays below SendPin-sized envelope`() {
        val payload = """{"v":1,"t":"$token"}""".encodeToByteArray()
        assertTrue(payload.size < 71)
        assertEquals(token, TransferTokenParser().parse(payload).value)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `token parser rejects padded or short tokens`() {
        TransferTokenParser().parse("""{"v":1,"t":"short=="}""".encodeToByteArray())
    }

    @Test fun `receiver verifies resources and composes existing transfer package`() = runBlocking {
        val capsuleUrl = "https://gritmap.app/t/$token"
        val segmentUrl = "https://segments.gritmap.app/wall.json"
        val planUrl = "https://transfer.gritmap.app/plan-once"
        val capsule = capsule(segmentUrl, planUrl, sha256(segment), sha256(plan))
        val responses = mapOf(
            capsuleUrl to capsule.encodeToByteArray(),
            segmentUrl to segment.encodeToByteArray(),
            planUrl to plan.encodeToByteArray(),
        )
        var imported: String? = null
        val receiver = TransferCapsuleReceiver(
            resourceClient = TransferResourceClient { url, _ -> responses.getValue(url.toString()) },
            importPackage = {
                imported = it
                val parsed = TransferPackageParser().parse(it)
                TransferImportResult(parsed.packageId, parsed.segment?.name, true, false, true)
            },
            capsuleParser = TransferCapsuleParser(nowMs = { now }),
        )

        val result = receiver.receive(TransferCapsuleToken.parse(token))

        assertEquals("capsule-1", result.packageId)
        assertEquals("Local Wall", result.segmentName)
        assertTrue(requireNotNull(imported).contains("\"baselinePacingPlan\""))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `receiver rejects tampered segment before import`() {
        runBlocking {
            val segmentUrl = "https://segments.gritmap.app/wall.json"
            val planUrl = "https://transfer.gritmap.app/plan-once"
            val capsuleUrl = "https://gritmap.app/t/$token"
            val responses = mapOf(
                capsuleUrl to capsule(segmentUrl, planUrl, "0".repeat(64), sha256(plan)).encodeToByteArray(),
                segmentUrl to segment.encodeToByteArray(),
                planUrl to plan.encodeToByteArray(),
            )
            val receiver = TransferCapsuleReceiver(
                resourceClient = TransferResourceClient { url, _ -> responses.getValue(url.toString()) },
                importPackage = { error("must not import") },
                capsuleParser = TransferCapsuleParser(nowMs = { now }),
            )
            receiver.receive(TransferCapsuleToken.parse(token))
        }
    }

    @Test(expected = IllegalArgumentException::class)
    fun `capsule parser rejects expired capability`() {
        TransferCapsuleParser(nowMs = { now + 600_001 }).parse(
            capsule(
                "https://segments.gritmap.app/wall.json",
                "https://transfer.gritmap.app/plan-once",
                sha256(segment),
                sha256(plan),
            ).encodeToByteArray(),
        )
    }

    @Test(expected = IllegalArgumentException::class)
    fun `capsule parser rejects non-HTTPS resource`() {
        TransferCapsuleParser(nowMs = { now }).parse(
            capsule(
                "http://segments.gritmap.app/wall.json",
                "https://transfer.gritmap.app/plan-once",
                sha256(segment),
                sha256(plan),
            ).encodeToByteArray(),
        )
    }

    private fun capsule(segmentUrl: String, planUrl: String, segmentHash: String, planHash: String) = """
        {"schemaVersion":1,"capsuleType":"gritmap-transfer-capsule","packageId":"capsule-1",
         "createdAtMs":$now,"expiresAtMs":${now + 600_000},
         "segment":{"url":"$segmentUrl","sha256":"$segmentHash"},
         "plan":{"url":"$planUrl","sha256":"$planHash"}}
    """.trimIndent()

    private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.encodeToByteArray())
        .joinToString("") { "%02x".format(it) }
}

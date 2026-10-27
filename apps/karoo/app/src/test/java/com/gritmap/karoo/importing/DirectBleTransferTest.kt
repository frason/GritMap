package com.gritmap.karoo.importing

import java.security.MessageDigest
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DirectBleTransferTest {
    @Test fun `strict manifest parser accepts the v2 contract`() {
        val manifest = DirectTransferManifestParser().parse(manifestBytes())
        assertEquals("X7kP3m9Qw2AbCd4Ef6Gh8J", manifest.transferId)
        assertEquals(512, manifest.chunkBytes)
        assertTrue(manifest.segment.isPublic)
        assertEquals(3, manifest.rider?.bytes)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `manifest rejects unknown keys`() {
        DirectTransferManifestParser().parse(
            manifestBytes().toString(Charsets.UTF_8).dropLast(1).plus(",\"extra\":1}").encodeToByteArray(),
        )
    }

    @Test fun `chunk reassembly checks logical lengths and hash`() = runBlocking {
        val bytes = "abcdefghij".encodeToByteArray()
        val descriptor = DirectTransferResource(bytes.size, sha(bytes))
        val offsets = mutableListOf<Int>()
        val result = readDirectTransferResource(descriptor, 4) { offset, expected ->
            offsets += offset
            bytes.copyOfRange(offset, offset + expected)
        }
        assertTrue(result.contentEquals(bytes))
        assertEquals(listOf(0, 4, 8), offsets)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `short logical read is not mistaken for end of resource`() = runBlocking {
        val bytes = "abcdefghij".encodeToByteArray()
        readDirectTransferResource(DirectTransferResource(bytes.size, sha(bytes)), 4) { offset, expected ->
            bytes.copyOfRange(offset, offset + expected - 1)
        }
        Unit
    }

    @Test(expected = DirectTransferHashMismatch::class)
    fun `hash mismatch fails before parsing`() = runBlocking {
        val bytes = "abcdefghij".encodeToByteArray()
        readDirectTransferResource(DirectTransferResource(bytes.size, "0".repeat(64)), 4) { offset, expected ->
            bytes.copyOfRange(offset, offset + expected)
        }
        Unit
    }

    @Test fun `installed segment package omits segment but keeps rider and plan`() {
        val plan = "{\"schemaVersion\":1,\"id\":\"p\"}".encodeToByteArray()
        val rider = "{\"schemaVersion\":1}".encodeToByteArray()
        val parsed = DirectTransferManifestParser().parse(manifestBytes())
        val root = Json.parseToJsonElement(DirectTransferPackageBuilder().build(parsed, plan, null, rider)).jsonObject
        assertFalse(root.containsKey("segment"))
        assertTrue(root.containsKey("riderHistory"))
        assertTrue(root.containsKey("baselinePacingPlan"))
    }

    @Test fun `receipt uses stable wire shape`() {
        assertEquals(
            "{\"transferId\":\"X7kP3m9Qw2AbCd4Ef6Gh8J\",\"status\":\"imported\",\"code\":\"ok_segment_existing\"}",
            directTransferReceipt("X7kP3m9Qw2AbCd4Ef6Gh8J", true, "ok_segment_existing").toString(Charsets.UTF_8),
        )
    }

    @Test fun `optional record descriptor is bounded and maps to transfer extension`() = runBlocking {
        val record="{\"schemaVersion\":1}".encodeToByteArray()
        fun bytes(size:Int)=JsonObject(Json.parseToJsonElement(manifestBytes().toString(Charsets.UTF_8)).jsonObject - "rider").toString().dropLast(1).plus(",\"record\":{\"bytes\":$size,\"sha256\":\"${sha(record)}\"}}").encodeToByteArray()
        val manifest=DirectTransferManifestParser().parse(bytes(record.size))
        assertEquals(record.size,manifest.record!!.bytes)
        assertTrue(runCatching { DirectTransferManifestParser().parse(bytes(8193)) }.isFailure)
        assertTrue(readDirectTransferResource(manifest.record!!,20) { offset,count -> record.copyOfRange(offset,offset+count) }.contentEquals(record))
        val root=Json.parseToJsonElement(DirectTransferPackageBuilder().build(manifest,"{}".encodeToByteArray(),null,null,record)).jsonObject
        assertTrue(root.containsKey("segmentRecord"))
        assertEquals("{\"resource\":\"record\",\"offset\":0}",directTransferRequest(DirectTransferResourceName.RECORD,0).toString(Charsets.UTF_8))
    }

    private fun manifestBytes(): ByteArray {
        val plan = "plan".encodeToByteArray()
        val segment = "segment".encodeToByteArray()
        val rider = "rid".encodeToByteArray()
        return """{"v":2,"transferId":"X7kP3m9Qw2AbCd4Ef6Gh8J","createdAtMs":1791570000000,"segmentFingerprint":"${"a".repeat(64)}","chunkBytes":512,"plan":{"bytes":${plan.size},"sha256":"${sha(plan)}"},"segment":{"bytes":${segment.size},"sha256":"${sha(segment)}","public":true},"rider":{"bytes":${rider.size},"sha256":"${sha(rider)}"}}""".encodeToByteArray()
    }

    private fun sha(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
        .digest(bytes).joinToString("") { "%02x".format(it) }
}

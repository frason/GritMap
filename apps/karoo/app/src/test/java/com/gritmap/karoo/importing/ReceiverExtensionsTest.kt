package com.gritmap.karoo.importing

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.io.File

class ReceiverExtensionsTest {
    private val root = generateSequence(File(".").absoluteFile) { it.parentFile }.first { File(it,"fixtures/contracts/segment-record-v1.json").exists() }
    private fun fixture() = Json.parseToJsonElement(File(root,"fixtures/contracts/segment-record-v1.json").readText()).jsonObject
    private fun rejected(o: JsonObject) { assertTrue(runCatching { SegmentRecord.parse(o) }.isFailure) }
    @Test fun `advertisement matches shared fixture and flags are independent`() {
        val expected=Json.parseToJsonElement(File(root,"fixtures/contracts/receiver-capabilities-v1.json").readText())
        assertEquals(expected,Json.parseToJsonElement(ReceiverCapabilities(true,true,74).encode()))
        assertEquals(emptyList<String>(),Json.parseToJsonElement(ReceiverCapabilities(false,false,74).encode()).jsonObject.getValue("features").jsonArray.map { it.jsonPrimitive.content })
        assertEquals(listOf("planCeilingsV1"),Json.parseToJsonElement(ReceiverCapabilities(true,false,74).encode()).jsonObject.getValue("features").jsonArray.map { it.jsonPrimitive.content })
    }
    @Test fun `record requires bounded exact numbers origin and finish`() {
        val f=fixture(); val record=SegmentRecord.parse(f)
        record.validateLength(10460.736)
        assertTrue(runCatching { record.validateLength(10.0) }.isFailure)
        rejected(JsonObject(f + ("bestDurationSeconds" to JsonPrimitive("2400"))))
        rejected(JsonObject(f + ("schemaVersion" to JsonPrimitive(2))))
        rejected(JsonObject(f + ("extra" to JsonPrimitive(1))))
        rejected(JsonObject(f + ("riderId" to JsonPrimitive("name"))))
        rejected(JsonObject(f + ("effortCount" to JsonPrimitive(-1))))
        rejected(JsonObject(f + ("splits" to JsonArray(listOf(f.getValue("splits").jsonArray.last())))))
        val wrong=buildJsonObject { put("distanceMeters",10460.736);put("elapsedSeconds",2399) }
        rejected(JsonObject(f + ("splits" to JsonArray(listOf(f.getValue("splits").jsonArray.first(),wrong)))))
    }
    @Test fun `record extension rejects when disabled and accepts record only when enabled`() {
        val packageJson=buildJsonObject { put("schemaVersion",1);put("packageType","gritmap-transfer");put("packageId","synthetic-record");put("createdAtMs",1000);put("segmentRecord",fixture()) }.toString()
        assertTrue(runCatching { TransferPackageParser(segmentRecordsEnabled=false).parse(packageJson) }.isFailure)
        assertEquals(2400.0,TransferPackageParser(segmentRecordsEnabled=true).parse(packageJson).segmentRecord!!.bestDurationSeconds,0.0)
    }
}

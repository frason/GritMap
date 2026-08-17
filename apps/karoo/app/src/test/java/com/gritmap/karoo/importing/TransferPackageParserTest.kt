package com.gritmap.karoo.importing

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class TransferPackageParserTest {
    private val segmentJson = """
        {"schemaVersion":1,"id":"wall","name":"Local Wall","direction":"forward",
         "matching":{"corridorMeters":30,"requiredCoveragePct":0.9},
         "referencePolyline":[
           {"lat":37.0,"lng":-122.0,"distanceMeters":0,"elevationMeters":10},
           {"lat":37.001,"lng":-122.0,"distanceMeters":111,"elevationMeters":20}]}
    """.trimIndent()
    private val fingerprint = SegmentJsonParser().parse(segmentJson).fingerprint

    @Test fun `parses atomic segment profile and phone AI baseline package`() {
        val result = TransferPackageParser().parse(validPackage())

        assertEquals("transfer-1", result.packageId)
        assertEquals(fingerprint, result.segment?.fingerprint)
        assertEquals(250, result.riderHistory?.profile?.ftpWatts)
        assertEquals("phone-ai", result.baselinePlan?.source)
        assertEquals(1, result.baselinePlan?.plan?.zones?.size)
    }

    @Test(expected = ImportValidationException::class)
    fun `rejects baseline for different geography`() {
        TransferPackageParser().parse(validPackage().replace(fingerprint, "0".repeat(64)))
    }

    @Test(expected = ImportValidationException::class)
    fun `rejects unsafe target above 150 percent FTP`() {
        TransferPackageParser().parse(validPackage().replace("\"targetPowerWatts\":300", "\"targetPowerWatts\":400"))
    }

    private fun validPackage() = """
        {
          "schemaVersion":1,
          "packageType":"gritmap-transfer",
          "packageId":"transfer-1",
          "createdAtMs":1000,
          "segment":$segmentJson,
          "riderHistory":{
            "schemaVersion":1,
            "profile":{"ftpWatts":250,"weightKg":70},
            "trainingLoads":[],
            "samples":[]
          },
          "baselinePacingPlan":{
            "schemaVersion":1,
            "id":"plan-1",
            "segmentFingerprint":"$fingerprint",
            "createdAtMs":1000,
            "generator":{"type":"phone-ai","modelVersion":"phone-model-1"},
            "ftpWatts":250,
            "targetFinishTimeSeconds":60,
            "zones":[{
              "startDistanceMeters":0,
              "endDistanceMeters":111,
              "targetPowerWatts":300,
              "classification":"hold",
              "icon":"hold",
              "instruction":"Hold a controlled effort"
            }]
          }
        }
    """.trimIndent()
}

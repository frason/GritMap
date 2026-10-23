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

    private fun withMetadata(version: Int = 1) = validPackage()
        .replace("\"zones\":[{", "\"replan\":{\"schemaVersion\":$version,\"criticalPowerWatts\":250,\"wPrimeJoules\":20000,\"wPrimeReserveFraction\":0.15,\"maxStepWatts\":20,\"hardMaxStepWatts\":80,\"stepLimitMinGradePct\":1.5},\"zones\":[{")
        .replace("\"targetPowerWatts\":300", "\"targetPowerWatts\":300,\"ceilingPowerWatts\":320")

    @Test fun `optional metadata round trips without changing original targets`() {
        val plan = TransferPackageParser(planCeilingsEnabled = true).parse(withMetadata()).baselinePlan!!
        assertEquals(300, plan.plan.zones.single().targetPowerWatts)
        assertEquals(listOf(320), plan.replanMetadata!!.ceilings)
        assertEquals(plan.replanMetadata, ReplanMetadata.decode(plan.replanMetadata.encode(),listOf(300),250))
    }
    @Test fun `unknown extension version keeps baseline and ignores ceilings`() {
        val plan = TransferPackageParser(planCeilingsEnabled = true).parse(withMetadata(99)).baselinePlan!!
        assertEquals(300,plan.plan.zones.single().targetPowerWatts)
        org.junit.Assert.assertNull(plan.replanMetadata)
    }
    @Test(expected = ImportValidationException::class)
    fun `rejects ceiling below target`() {
        TransferPackageParser(planCeilingsEnabled = true).parse(withMetadata().replace("\"ceilingPowerWatts\":320","\"ceilingPowerWatts\":299"))
    }
    @Test(expected = ImportValidationException::class)
    fun `rejects malformed reserve`() {
        TransferPackageParser(planCeilingsEnabled = true).parse(withMetadata().replace("0.15","1.1"))
    }
    @Test(expected = ImportValidationException::class)
    fun `rejects ceilings without parameters`() {
        TransferPackageParser(planCeilingsEnabled = true).parse(validPackage().replace("\"targetPowerWatts\":300", "\"targetPowerWatts\":300,\"ceilingPowerWatts\":320"))
    }

    @Test fun `disabled ceilings preserve baseline but do not retain experimental metadata`() {
        val plan = TransferPackageParser(planCeilingsEnabled = false).parse(withMetadata()).baselinePlan!!
        assertEquals(300,plan.plan.zones.single().targetPowerWatts)
        org.junit.Assert.assertNull(plan.replanMetadata)
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

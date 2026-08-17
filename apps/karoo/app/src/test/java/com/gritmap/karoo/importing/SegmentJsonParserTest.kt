package com.gritmap.karoo.importing

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class SegmentJsonParserTest {
    private val parser = SegmentJsonParser()
    private val valid = """
        {"schemaVersion":1,"id":"wall","name":"Local Wall","direction":"forward",
         "matching":{"corridorMeters":30,"requiredCoveragePct":0.9},
         "referencePolyline":[
           {"lat":37.0,"lng":-122.0,"distanceMeters":0,"elevationMeters":10},
           {"lat":37.001,"lng":-122.0,"distanceMeters":111,"elevationMeters":20}]}
    """.trimIndent()

    @Test fun parsesAndFingerprintsCanonicalGeography() {
        val a = parser.parse(valid)
        val renamed = parser.parse(valid.replace("Local Wall", "Renamed"))
        assertEquals(2, a.referencePolyline.size)
        assertEquals(a.fingerprint, renamed.fingerprint)
        assertEquals(30, a.corridorMeters)
    }

    @Test fun matchingParametersAffectFingerprint() {
        val a = parser.parse(valid)
        val b = parser.parse(valid.replace("\"corridorMeters\":30", "\"corridorMeters\":31"))
        assertNotEquals(a.fingerprint, b.fingerprint)
    }

    @Test(expected = ImportValidationException::class)
    fun rejectsReverseDirection() { parser.parse(valid.replace("forward", "reverse")) }

    @Test(expected = ImportValidationException::class)
    fun rejectsNonIncreasingDistance() { parser.parse(valid.replace("\"distanceMeters\":111", "\"distanceMeters\":0")) }
}


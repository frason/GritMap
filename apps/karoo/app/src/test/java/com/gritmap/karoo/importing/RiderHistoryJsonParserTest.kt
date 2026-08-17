package com.gritmap.karoo.importing

import org.junit.Assert.assertEquals
import org.junit.Test

class RiderHistoryJsonParserTest {
    @Test fun parsesVersionedHistory() {
        val result = RiderHistoryJsonParser().parse("""
          {"schemaVersion":1,"profile":{"ftpWatts":280,"weightKg":72.5,"maxHeartRateBpm":190},
           "trainingLoads":[{"periodStartMs":1,"periodEndMs":2,"load":42}],
           "samples":[{"segmentId":"s","attemptId":"a","distanceMeters":0,"powerWatts":250},
                      {"segmentId":"s","attemptId":"a","distanceMeters":10,"powerWatts":260}]}
        """.trimIndent())
        assertEquals(280, result.profile.ftpWatts)
        assertEquals(2, result.samples.size)
    }
}


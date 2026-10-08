package com.gritmap.karoo.physiology

import org.junit.Assert.assertEquals
import org.junit.Test

class RrPacketTimestampMapperTest {
    @Test
    fun `maps multiple packet intervals backwards from notification time`() {
        val mapper = RrPacketTimestampMapper()
        assertEquals(
            listOf(8_500L, 9_000L, 10_000L),
            mapper.elapsedEndpointsMs(
                packetElapsedMs = 10_000L,
                rrIntervalsMs = listOf(750, 500, 1_000),
            ),
        )
    }

    @Test
    fun `returns no timestamps for packet without RR`() {
        assertEquals(emptyList<Long>(), RrPacketTimestampMapper().elapsedEndpointsMs(10L, emptyList()))
    }

    @Test
    fun `delivery stall cannot move valid beat timestamps backwards`() {
        val mapper = RrPacketTimestampMapper()
        assertEquals(listOf(1_000L, 2_000L), mapper.elapsedEndpointsMs(2_000L, listOf(1_000, 1_000)))

        assertEquals(
            listOf(2_995L, 3_995L),
            mapper.elapsedEndpointsMs(2_020L, listOf(1_000, 1_000)),
        )
    }

    @Test
    fun `dropout reanchors immediately and marks a discontinuity`() {
        val mapper = RrPacketTimestampMapper()
        assertEquals(listOf(1_000L, 2_000L), mapper.mapPacket(2_000L, listOf(1_000, 1_000)).endpointsMs)

        val afterDropout = mapper.mapPacket(6_000L, listOf(1_000))

        assertEquals(listOf(6_000L), afterDropout.endpointsMs)
        assertEquals(true, afterDropout.gapBeforePacket)
        assertEquals(3_000L, afterDropout.gapDurationMs)
        assertEquals(
            listOf(7_000L),
            mapper.mapPacket(7_000L, listOf(1_000)).endpointsMs,
        )
    }

    @Test
    fun `ordinary notification jitter does not create a gap`() {
        val mapper = RrPacketTimestampMapper()
        mapper.mapPacket(1_000L, listOf(1_000))

        val next = mapper.mapPacket(2_150L, listOf(1_000))

        assertEquals(false, next.gapBeforePacket)
        assertEquals(listOf(2_005L), next.endpointsMs)
    }
}

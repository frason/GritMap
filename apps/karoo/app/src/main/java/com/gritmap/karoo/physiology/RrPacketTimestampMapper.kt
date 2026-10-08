package com.gritmap.karoo.physiology

/**
 * Builds a beat timeline from the sensor's RR intervals rather than notification arrival jitter.
 * Arrival time anchors the first packet and then only nudges the timeline by a bounded amount.
 */
class RrPacketTimestampMapper(
    private val maximumArrivalCorrectionMs: Long = 5L,
    private val minimumGapThresholdMs: Long = 2_000L,
) {
    private var lastEndpointMs: Long? = null

    init {
        require(maximumArrivalCorrectionMs >= 0L)
        require(minimumGapThresholdMs > 0L)
    }

    fun mapPacket(packetElapsedMs: Long, rrIntervalsMs: List<Int>): RrMappedPacket {
        if (rrIntervalsMs.isEmpty()) return RrMappedPacket(emptyList())
        val previousEndpoint = lastEndpointMs
        if (previousEndpoint == null) {
            val result = anchoredEndpoints(packetElapsedMs, rrIntervalsMs)
            lastEndpointMs = result.last()
            return RrMappedPacket(result.toList())
        }

        var endpoint = previousEndpoint
        val result = LongArray(rrIntervalsMs.size)
        rrIntervalsMs.forEachIndexed { index, intervalMs ->
            endpoint += intervalMs.coerceAtLeast(0)
            result[index] = endpoint
        }
        val arrivalDifferenceMs = packetElapsedMs - result.last()
        val gapThresholdMs = maxOf(
            minimumGapThresholdMs,
            (rrIntervalsMs.last().coerceAtLeast(0) * GAP_INTERVAL_MULTIPLIER).toLong(),
        )
        if (arrivalDifferenceMs > gapThresholdMs) {
            val anchored = anchoredEndpoints(packetElapsedMs, rrIntervalsMs)
            lastEndpointMs = anchored.last()
            return RrMappedPacket(
                endpointsMs = anchored.toList(),
                gapBeforePacket = true,
                gapDurationMs = arrivalDifferenceMs,
            )
        }
        val correction = arrivalDifferenceMs.coerceIn(
            -maximumArrivalCorrectionMs,
            maximumArrivalCorrectionMs,
        )
        result.indices.forEach { result[it] += correction }
        lastEndpointMs = result.last()
        return RrMappedPacket(result.toList())
    }

    fun elapsedEndpointsMs(packetElapsedMs: Long, rrIntervalsMs: List<Int>): List<Long> =
        mapPacket(packetElapsedMs, rrIntervalsMs).endpointsMs

    private fun anchoredEndpoints(packetElapsedMs: Long, rrIntervalsMs: List<Int>): LongArray {
        var endpoint = packetElapsedMs
        val result = LongArray(rrIntervalsMs.size)
        for (index in rrIntervalsMs.indices.reversed()) {
            result[index] = endpoint
            if (index > 0) endpoint -= rrIntervalsMs[index].coerceAtLeast(0)
        }
        return result
    }

    private companion object {
        const val GAP_INTERVAL_MULTIPLIER = 1.5
    }
}

data class RrMappedPacket(
    val endpointsMs: List<Long>,
    val gapBeforePacket: Boolean = false,
    val gapDurationMs: Long = 0L,
)

package com.gritmap.karoo.physiology

const val RR_ARTIFACT_SCHEMA_VERSION: Int = 2

data class RrCaptureIdentity(
    val captureId: String,
    val segmentId: String? = null,
    val attemptId: String? = null,
)

enum class RrArtifactReason(val code: Byte) {
    NONE(0),
    INTERVAL_OUT_OF_RANGE(1),
    TIMESTAMP_OUT_OF_ORDER(2),
    SOURCE_MARKED_INVALID(3),
    GAP_AFTER_DROPOUT(4),
    ;

    companion object {
        fun fromCode(code: Byte): RrArtifactReason = entries.firstOrNull { it.code == code }
            ?: SOURCE_MARKED_INVALID
    }
}

/** A beat interval aligned to elapsed ride time, without duplicating the Karoo ride stream. */
data class RrObservation(
    val elapsedMs: Long,
    val rrIntervalMs: Int,
    val valid: Boolean,
    val artifactReason: RrArtifactReason = RrArtifactReason.NONE,
    val rrInterval1024: Int = roundedMsToRr1024(rrIntervalMs),
)

data class RrQualitySnapshot(
    val window: List<RrObservation>,
    val totalCount: Long,
    val validCount: Long,
    val artifactCount: Long,
    val validPct: Int,
    val consecutiveValidDurationMs: Long,
    val enhancedMetricsAllowed: Boolean,
)

/**
 * Conservative first-pass validation. Advanced ectopic-beat correction belongs in a versioned
 * analysis algorithm; acquisition preserves the original interval and flags only hard failures.
 */
class RrObservationValidator(
    private val minimumIntervalMs: Int = 240,
    private val maximumIntervalMs: Int = 2_200,
) {
    private var lastElapsedMs: Long? = null

    fun validate(
        elapsedMs: Long,
        rrIntervalMs: Int,
        sourceValid: Boolean = true,
        rrInterval1024: Int = roundedMsToRr1024(rrIntervalMs),
    ): RrObservation {
        val previousElapsed = lastElapsedMs
        val reason = when {
            !sourceValid -> RrArtifactReason.SOURCE_MARKED_INVALID
            elapsedMs < 0L || (previousElapsed != null && elapsedMs < previousElapsed) ->
                RrArtifactReason.TIMESTAMP_OUT_OF_ORDER
            rrIntervalMs !in minimumIntervalMs..maximumIntervalMs ->
                RrArtifactReason.INTERVAL_OUT_OF_RANGE
            else -> RrArtifactReason.NONE
        }
        if (previousElapsed == null || elapsedMs >= previousElapsed) lastElapsedMs = elapsedMs
        return RrObservation(
            elapsedMs = elapsedMs,
            rrIntervalMs = rrIntervalMs,
            valid = reason == RrArtifactReason.NONE,
            artifactReason = reason,
            rrInterval1024 = rrInterval1024,
        )
    }
}

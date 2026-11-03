package com.gritmap.karoo.ui.state

/** Explanation of the existing tracker gates; does not change eligibility or its reference. */
enum class CardiacReadiness {
    COLLECTING, NO_POWER, NO_HR, LOW_POWER, LOW_HR, MORE_SAMPLES,
    VARIABLE_POWER, DIFFERENT_EFFORT, READY,
}

data class CardiacBaselineState(
    val remainingSeconds: Int,
    val established: Boolean,
    val readiness: CardiacReadiness,
    val restartCount: Int,
    val justRestarted: Boolean,
    val justEstablished: Boolean,
)

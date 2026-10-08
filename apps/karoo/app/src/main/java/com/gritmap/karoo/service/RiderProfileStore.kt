package com.gritmap.karoo.service

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Current athlete settings reported by Karoo. These are rider state, never segment state. */
data class KarooRiderProfile(
    val ftpWatts: Int,
    val weightKg: Double,
    val maxHeartRateBpm: Int?,
)

object RiderProfileStore {
    private val mutable = MutableStateFlow<KarooRiderProfile?>(null)
    val profile: StateFlow<KarooRiderProfile?> = mutable.asStateFlow()

    fun publish(profile: KarooRiderProfile) {
        mutable.value = profile
    }
}

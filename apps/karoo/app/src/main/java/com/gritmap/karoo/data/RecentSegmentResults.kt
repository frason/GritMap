package com.gritmap.karoo.data

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.retryWhen

data class RecentSegmentResult(
    val attemptId: String,
    val segmentId: String,
    val segmentName: String,
    val completedAtMs: Long,
    val durationSeconds: Double,
    val goalSeconds: Int?,
    val approximate: Boolean,
    val averagePowerWatts: Double?,
    val averageHeartRateBpm: Double?,
)

sealed interface RecentResultsState {
    data object Loading : RecentResultsState
    data object Unavailable : RecentResultsState
    data class Ready(val results: List<RecentSegmentResult>) : RecentResultsState
}

/** Independent of live attempt/GPS state. Room invalidates on completion, rename and deletion. */
class RecentSegmentResultsRepository(private val database: KarooDatabase) {
    fun observe(): Flow<RecentResultsState> = database.attemptDao().recentCompleted(20)
        .map<List<RecentSegmentResult>, RecentResultsState> { RecentResultsState.Ready(it) }
        .onStart { emit(RecentResultsState.Loading) }
        .retryWhen { error, _ ->
            if (error is CancellationException) throw error
            emit(RecentResultsState.Unavailable)
            delay(5_000)
            true
        }
}

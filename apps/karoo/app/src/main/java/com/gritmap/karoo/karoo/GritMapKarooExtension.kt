package com.gritmap.karoo.karoo

import com.gritmap.karoo.BuildConfig
import com.gritmap.karoo.service.LiveDiagnostics
import com.gritmap.karoo.service.LiveServiceStarter
import io.hammerhead.karooext.extension.KarooExtension

class GritMapKarooExtension : KarooExtension(EXTENSION_ID, BuildConfig.VERSION_NAME) {
    override fun onCreate() {
        super.onCreate()
        LiveDiagnostics.record(this, "extension_created")
        LiveServiceStarter.startIfPermitted(this, "extension")
    }

    override val types by lazy {
        listOf(
            PacingCoachDataType(extension),
            TargetPowerDataType(extension),
            PowerDeltaDataType(extension),
            PredictedFinishDataType(extension),
            PacingProfileDataType(extension),
            SegmentPerformanceDataType(extension),
            WattsPerHeartRateDataType(extension),
            PowerBalanceDataType(extension),
        )
    }

    companion object {
        const val EXTENSION_ID = "gritmap-live-pacing"
    }
}

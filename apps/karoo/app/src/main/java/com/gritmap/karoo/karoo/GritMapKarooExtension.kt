package com.gritmap.karoo.karoo

import com.gritmap.karoo.service.LiveDiagnostics
import com.gritmap.karoo.service.LiveServiceStarter
import io.hammerhead.karooext.extension.KarooExtension

class GritMapKarooExtension : KarooExtension(EXTENSION_ID, "0.2.0") {
    override fun onCreate() {
        super.onCreate()
        LiveDiagnostics.record(this, "extension_created")
        LiveServiceStarter.startIfPermitted(this, "extension")
    }

    override val types by lazy {
        listOf(
            TargetPowerDataType(extension),
            PacingProfileDataType(extension),
        )
    }

    companion object {
        const val EXTENSION_ID = "gritmap-live-pacing"
    }
}

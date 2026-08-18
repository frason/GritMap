package com.gritmap.karoo.karoo

import io.hammerhead.karooext.extension.KarooExtension

class GritMapKarooExtension : KarooExtension(EXTENSION_ID, "0.1.0") {
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

package com.gritmap.karoo.importing

import com.gritmap.karoo.BuildConfig
import kotlinx.serialization.json.*

/** Receipt of a field is advertised only when this build will retain it. No rider identifiers. */
data class ReceiverCapabilities(
    val planCeilings: Boolean = BuildConfig.PLAN_CEILINGS_ENABLED,
    val segmentRecords: Boolean = BuildConfig.SEGMENT_RECORDS_ENABLED,
    val versionCode: Int = BuildConfig.VERSION_CODE,
) {
    fun encode(): String = buildJsonObject {
        put("v", 1)
        put("transferV", 2)
        put("versionCode", versionCode)
        put("features", JsonArray(buildList {
            if (planCeilings) add(JsonPrimitive("planCeilingsV1"))
            if (segmentRecords) add(JsonPrimitive("segmentRecordV1"))
        }))
        put("maxManifestBytes", 512)
        put("maxRecordBytes", 8192)
    }.toString()

    companion object {
        const val BLE_UUID = "9aa66e90-1c9e-46e1-9e52-45fd6a40847a"
    }
}

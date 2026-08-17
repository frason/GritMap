package com.gritmap.karoo.importing

import androidx.room.withTransaction
import com.gritmap.karoo.ai.AiPacingResponseParser
import com.gritmap.karoo.ai.AiPlanValidator
import com.gritmap.karoo.data.KarooDatabase
import com.gritmap.karoo.data.PacingPlanEntity
import com.gritmap.karoo.data.PacingZoneEntity
import com.gritmap.karoo.domain.RiderHistoryPackage
import com.gritmap.karoo.domain.SegmentDefinition
import com.gritmap.karoo.pacing.PacingPlan
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long

data class TransferPackage(
    val packageId: String,
    val createdAtMs: Long,
    val segment: SegmentDefinition?,
    val riderHistory: RiderHistoryPackage?,
    val baselinePlan: ImportedBaselinePlan?,
)

data class ImportedBaselinePlan(
    val id: String,
    val segmentFingerprint: String,
    val createdAtMs: Long,
    val source: String,
    val generatorModelVersion: String,
    val ftpWatts: Int,
    val targetFinishTimeSeconds: Int?,
    val plan: PacingPlan,
)

data class TransferImportResult(
    val packageId: String,
    val segmentName: String?,
    val segmentWasNew: Boolean,
    val riderProfileUpdated: Boolean,
    val baselinePlanUpdated: Boolean,
)

class TransferPackageParser(
    private val json: Json = Json { ignoreUnknownKeys = false },
    private val segmentParser: SegmentJsonParser = SegmentJsonParser(),
    private val historyParser: RiderHistoryJsonParser = RiderHistoryJsonParser(),
    private val planValidator: AiPlanValidator = AiPlanValidator(),
) {
    fun parse(input: String): TransferPackage {
        val root = json.parseToJsonElement(input).requireObject("root")
        val allowed = setOf(
            "schemaVersion", "packageType", "packageId", "createdAtMs",
            "segment", "riderHistory", "baselinePacingPlan",
        )
        if (!root.keys.all(allowed::contains)) fail("Unknown transfer-package property")
        if (root.requiredInt("schemaVersion") != 1) fail("Unsupported transfer schemaVersion")
        if (root.requiredString("packageType") != PACKAGE_TYPE) fail("Invalid packageType")
        val packageId = root.requiredString("packageId").also {
            if (it.isBlank() || it.length > 100) fail("Invalid packageId")
        }
        val createdAtMs = try {
            root["createdAtMs"]?.jsonPrimitive?.long ?: fail("missing createdAtMs")
        } catch (_: Exception) {
            fail("invalid createdAtMs")
        }
        if (createdAtMs <= 0) fail("createdAtMs must be positive")

        val segment = root["segment"]?.let { segmentParser.parse(it.toString()) }
        val history = root["riderHistory"]?.let { historyParser.parse(it.toString()) }
        val baseline = root["baselinePacingPlan"]?.let { parseBaseline(it.jsonObject) }
        if (segment == null && history == null && baseline == null) fail("Transfer package is empty")
        if (segment != null && baseline != null && baseline.segmentFingerprint != segment.fingerprint) {
            fail("Baseline plan does not target the packaged segment fingerprint")
        }
        if (history != null && baseline != null && baseline.ftpWatts != history.profile.ftpWatts) {
            fail("Baseline plan FTP does not match the packaged rider profile")
        }
        return TransferPackage(packageId, createdAtMs, segment, history, baseline)
    }

    private fun parseBaseline(value: JsonObject): ImportedBaselinePlan {
        val allowed = setOf(
            "schemaVersion", "id", "segmentFingerprint", "createdAtMs", "generator",
            "ftpWatts", "targetFinishTimeSeconds", "zones",
        )
        if (!value.keys.all(allowed::contains)) fail("Unknown baseline-plan property")
        if (value.requiredInt("schemaVersion") != 1) fail("Unsupported baseline plan schemaVersion")
        val id = value.requiredString("id").also { if (it.isBlank()) fail("Plan id must not be blank") }
        val fingerprint = value.requiredString("segmentFingerprint").also {
            if (!it.matches(Regex("[0-9a-fA-F]{64}"))) fail("Invalid segment fingerprint")
        }.lowercase()
        val createdAtMs = try {
            value["createdAtMs"]?.jsonPrimitive?.long ?: fail("missing plan createdAtMs")
        } catch (_: Exception) {
            fail("invalid plan createdAtMs")
        }
        val generator = value.requiredObject("generator")
        if (!generator.keys.all(setOf("type", "modelVersion")::contains)) fail("Unknown generator property")
        val source = generator.requiredString("type")
        if (source !in ALLOWED_SOURCES) fail("Unknown pacing-plan generator type")
        val modelVersion = generator.requiredString("modelVersion").also {
            if (it.isBlank() || it.length > 100) fail("Invalid modelVersion")
        }
        val ftp = value.requiredInt("ftpWatts")
        if (ftp !in 1..1_000) fail("Invalid plan FTP")
        val target = value["targetFinishTimeSeconds"]?.jsonPrimitive?.intOrNull
        if (target != null && target <= 0) fail("Invalid target finish time")
        val planJson = JsonObject(
            mapOf(
                "schemaVersion" to requireNotNull(value["schemaVersion"]),
                "zones" to (value["zones"] ?: fail("missing zones")),
            ),
        ).toString()
        val plan = try {
            AiPacingResponseParser.parse(planJson)
        } catch (error: Exception) {
            fail("Invalid baseline plan: ${error.message}")
        }
        val segmentLength = plan.zones.lastOrNull()?.endDistanceMeters ?: fail("Plan has no zones")
        planValidator.validate(plan, segmentLength, ftp).getOrElse {
            fail("Unsafe baseline plan: ${it.message}")
        }
        return ImportedBaselinePlan(
            id, fingerprint, createdAtMs, source, modelVersion, ftp, target, plan,
        )
    }

    companion object {
        const val PACKAGE_TYPE = "gritmap-transfer"
        private val ALLOWED_SOURCES = setOf("phone-ai", "cloud-ai", "manual")
    }
}

class TransferPackageRepository(
    private val database: KarooDatabase,
    private val parser: TransferPackageParser = TransferPackageParser(),
    private val segmentImporter: SegmentImportRepository = SegmentImportRepository(database),
    private val historyImporter: RiderHistoryImportRepository = RiderHistoryImportRepository(database),
) {
    suspend fun importPackage(json: String): TransferImportResult {
        val transfer = parser.parse(json)
        return database.withTransaction {
            val packagedSegment = transfer.segment
            val existingByFingerprint = packagedSegment?.let {
                database.segmentDao().segmentByFingerprint(it.fingerprint)
            }
            if (packagedSegment != null) {
                val existingById = database.segmentDao().segment(packagedSegment.id)
                if (existingById != null && existingById.fingerprint != packagedSegment.fingerprint) {
                    fail("Segment id already exists with different immutable geography")
                }
                if (existingByFingerprint == null) segmentImporter.importDefinition(packagedSegment)
            }
            transfer.riderHistory?.let { historyImporter.importHistory(it) }

            val plan = transfer.baselinePlan
            if (plan != null) {
                val segment = database.segmentDao().segmentByFingerprint(plan.segmentFingerprint)
                    ?: fail("Baseline plan references an uninstalled segment")
                val segmentLength = database.segmentDao().points(segment.id).lastOrNull()?.distanceMeters
                    ?: fail("Installed segment has no reference points")
                val planLength = plan.plan.zones.lastOrNull()?.endDistanceMeters
                    ?: fail("Baseline plan has no zones")
                if (kotlin.math.abs(segmentLength - planLength) > 0.01) {
                    fail("Baseline plan does not cover the complete segment distance")
                }
                val profileFtp = database.riderHistoryDao().profile()?.ftpWatts
                    ?: fail("Baseline plan requires an installed rider profile")
                if (profileFtp != plan.ftpWatts) fail("Baseline plan FTP does not match installed rider profile")
                database.pacingDao().replacePlan(
                    PacingPlanEntity(
                        id = plan.id,
                        segmentId = segment.id,
                        segmentFingerprint = plan.segmentFingerprint,
                        createdAtMs = plan.createdAtMs,
                        source = plan.source,
                        generatorModelVersion = plan.generatorModelVersion,
                        ftpWatts = plan.ftpWatts,
                        targetFinishTimeSeconds = plan.targetFinishTimeSeconds,
                        isBaseline = true,
                    ),
                    plan.plan.zones.map {
                        PacingZoneEntity(
                            planId = plan.id,
                            startDistanceMeters = it.startDistanceMeters,
                            endDistanceMeters = it.endDistanceMeters,
                            targetPowerWatts = it.targetPowerWatts,
                            classification = it.classification.name,
                            icon = it.icon.name,
                            instruction = it.instruction,
                        )
                    },
                )
            }
            TransferImportResult(
                packageId = transfer.packageId,
                segmentName = packagedSegment?.name,
                segmentWasNew = packagedSegment != null && existingByFingerprint == null,
                riderProfileUpdated = transfer.riderHistory != null,
                baselinePlanUpdated = plan != null,
            )
        }
    }

}

package com.gritmap.karoo.importing

import android.content.Context
import java.io.File
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class InboxItem(
    val id: String,
    val displayName: String,
    val payload: String,
)

interface SegmentInbox {
    suspend fun pending(): List<InboxItem>
    suspend fun acknowledge(item: InboxItem)
    suspend fun reject(item: InboxItem, reason: String)
}

/** Development/file transport. HTTP sync can implement the same interface later. */
class StagedFileSegmentInbox(
    context: Context,
    private val folderName: String = "packages",
) : SegmentInbox {
    private val root = requireNotNull(context.getExternalFilesDir(null)) {
        "External app storage unavailable"
    }
    private val pendingFolder = File(root, "imports/$folderName")
    private val processedFolder = File(root, "imports/processed")
    private val failedFolder = File(root, "imports/failed")

    override suspend fun pending(): List<InboxItem> = withContext(Dispatchers.IO) {
        check(pendingFolder.mkdirs() || pendingFolder.isDirectory) {
            "Unable to create ${pendingFolder.absolutePath}"
        }
        pendingFolder.listFiles().orEmpty()
            .filter { it.isFile && it.extension.equals("json", ignoreCase = true) }
            .sortedWith(compareBy<File>({ it.lastModified() }, { it.name }))
            .map {
                require(it.length() <= MAX_STAGED_BYTES) { "${it.name} exceeds staged import limit" }
                InboxItem(it.absolutePath, it.name, it.readText())
            }
    }

    override suspend fun acknowledge(item: InboxItem) = withContext(Dispatchers.IO) {
        move(item, processedFolder, null)
    }

    override suspend fun reject(item: InboxItem, reason: String) = withContext(Dispatchers.IO) {
        move(item, failedFolder, reason.take(MAX_ERROR_LENGTH))
    }

    private fun move(item: InboxItem, destinationFolder: File, error: String?) {
        check(destinationFolder.mkdirs() || destinationFolder.isDirectory)
        val source = File(item.id)
        check(source.parentFile?.canonicalFile == pendingFolder.canonicalFile) { "Unsafe inbox item path" }
        val destination = File(destinationFolder, source.name)
        if (destination.exists()) destination.delete()
        check(source.renameTo(destination)) { "Unable to move ${source.name}" }
        error?.let { File(destinationFolder, "${source.name}.error.txt").writeText(it) }
    }

    companion object {
        const val MAX_STAGED_BYTES = 1_000_000L
        private const val MAX_ERROR_LENGTH = 500
    }
}

data class InboxProcessingResult(
    val imported: List<String>,
    val duplicates: List<String>,
    val failed: Map<String, String>,
)

class SegmentInboxProcessor(
    private val inbox: SegmentInbox,
    private val segmentLibrary: SegmentLibraryRepository,
    private val transferRepository: TransferPackageRepository,
) {
    suspend fun processAll(): InboxProcessingResult {
        val imported = mutableListOf<String>()
        val duplicates = mutableListOf<String>()
        val failed = linkedMapOf<String, String>()
        inbox.pending().forEach { item ->
            try {
                val root = Json.parseToJsonElement(item.payload).jsonObject
                if (root["packageType"]?.jsonPrimitive?.content == TransferPackageParser.PACKAGE_TYPE) {
                    val result = transferRepository.importPackage(item.payload)
                    if (result.segmentWasNew || result.riderProfileUpdated || result.baselinePlanUpdated) {
                        imported += item.displayName
                    } else {
                        duplicates += item.displayName
                    }
                } else {
                    when (segmentLibrary.importRawSegment(item.payload)) {
                        RawSegmentImportResult.IMPORTED -> imported += item.displayName
                        RawSegmentImportResult.DUPLICATE -> duplicates += item.displayName
                    }
                }
                inbox.acknowledge(item)
            } catch (error: Exception) {
                val message = error.message ?: error::class.java.simpleName
                failed[item.displayName] = message
                runCatching { inbox.reject(item, message) }
            }
        }
        return InboxProcessingResult(imported, duplicates, failed)
    }
}

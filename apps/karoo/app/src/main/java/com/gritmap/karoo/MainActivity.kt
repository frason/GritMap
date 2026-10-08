package com.gritmap.karoo

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import com.gritmap.karoo.data.DatabaseProvider
import com.gritmap.karoo.data.SegmentLibraryRow
import com.gritmap.karoo.importing.HttpSegmentInbox
import com.gritmap.karoo.importing.RiderHistoryImportRepository
import com.gritmap.karoo.importing.SegmentImportRepository
import com.gritmap.karoo.importing.SegmentInboxProcessor
import com.gritmap.karoo.importing.SegmentLibraryRepository
import com.gritmap.karoo.importing.StagedFileSegmentInbox
import com.gritmap.karoo.importing.TransferPackageRepository
import com.gritmap.karoo.physiology.H10DiagnosticActivity
import com.gritmap.karoo.service.LiveDiagnostics
import com.gritmap.karoo.service.LiveServiceStarter
import com.gritmap.karoo.service.RiderProfileStore
import com.gritmap.karoo.service.KarooRiderProfile
import com.gritmap.karoo.ui.KarooHomeScreen
import com.gritmap.karoo.ui.state.LiveDemoController
import java.io.IOException
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val database = DatabaseProvider.get(this)
        val segmentImporter = SegmentImportRepository(database)
        val historyImporter = RiderHistoryImportRepository(database)
        val segmentLibrary = SegmentLibraryRepository(database)
        val transferImporter = TransferPackageRepository(database)

        setContent {
            var status by remember { mutableStateOf("Ready") }
            var segments by remember { mutableStateOf<List<SegmentLibraryRow>>(emptyList()) }
            var pendingDeleteId by remember { mutableStateOf<String?>(null) }
            var locationGranted by remember {
                mutableStateOf(LiveServiceStarter.hasLocationPermission(this@MainActivity))
            }
            var overlayGranted by remember { mutableStateOf(Settings.canDrawOverlays(this@MainActivity)) }
            var diagnosticLines by remember { mutableStateOf<List<String>>(emptyList()) }
            var receiveInbox by remember { mutableStateOf<HttpSegmentInbox?>(null) }
            val demoRunning by LiveDemoController.running.collectAsState()
            val liveRiderProfile by RiderProfileStore.profile.collectAsState()
            var storedRiderProfile by remember { mutableStateOf<KarooRiderProfile?>(null) }
            val riderProfile = liveRiderProfile ?: storedRiderProfile
            suspend fun refreshLibrary() {
                segments = segmentLibrary.list()
            }
            suspend fun refreshDiagnostics() {
                diagnosticLines = LiveDiagnostics.recent(this@MainActivity, 8)
            }
            val locationPermissionLauncher = rememberLauncherForActivityResult(
                ActivityResultContracts.RequestMultiplePermissions(),
            ) {
                locationGranted = LiveServiceStarter.hasLocationPermission(this@MainActivity)
                if (locationGranted) {
                    LiveServiceStarter.startIfPermitted(this@MainActivity, "permission-result")
                    status = "Location enabled; live matching service started"
                } else {
                    LiveDiagnostics.record(this@MainActivity, "location_permission_denied")
                    status = "Location permission denied; live segment matching is disabled"
                }
                lifecycleScope.launch { refreshDiagnostics() }
            }
            val overlayPermissionLauncher = rememberLauncherForActivityResult(
                ActivityResultContracts.StartActivityForResult(),
            ) {
                overlayGranted = Settings.canDrawOverlays(this@MainActivity)
                status = if (overlayGranted) "Overlay enabled" else "Overlay permission not enabled"
            }
            LaunchedEffect(Unit) {
                refreshLibrary()
                refreshDiagnostics()
                storedRiderProfile = database.riderHistoryDao().profile()?.let {
                    KarooRiderProfile(it.ftpWatts, it.weightKg, it.maxHeartRateBpm)
                }
                if (locationGranted) {
                    LiveServiceStarter.startIfPermitted(this@MainActivity, "launcher")
                } else {
                    locationPermissionLauncher.launch(
                        arrayOf(
                            Manifest.permission.ACCESS_COARSE_LOCATION,
                            Manifest.permission.ACCESS_FINE_LOCATION,
                        ),
                    )
                }
            }
            val segmentPicker = rememberLauncherForActivityResult(
                ActivityResultContracts.OpenDocument(),
            ) { uri ->
                if (uri != null) lifecycleScope.launch {
                    status = importText(uri) { json ->
                        val packageType = Json.parseToJsonElement(json).jsonObject["packageType"]
                            ?.jsonPrimitive?.content
                        if (packageType == "gritmap-transfer") {
                            val result = transferImporter.importPackage(json)
                            buildString {
                                append("Imported guidance package")
                                result.segmentName?.let { append(" for $it") }
                            }
                        } else {
                            val segment = segmentImporter.importSegment(json)
                            "Imported segment ${segment.name}"
                        }
                    }.fold(
                        onSuccess = { message ->
                            refreshLibrary()
                            message
                        },
                        onFailure = { "JSON import failed: ${it.message}" },
                    )
                }
            }
            val historyPicker = rememberLauncherForActivityResult(
                ActivityResultContracts.OpenDocument(),
            ) { uri ->
                if (uri != null) lifecycleScope.launch {
                    status = importText(uri) { historyImporter.importRiderHistory(it) }.fold(
                        onSuccess = { "Imported rider history (${it.samples.size} samples)" },
                        onFailure = { "History import failed: ${it.message}" },
                    )
                }
            }

            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF2B84DE),
                    onPrimary = Color.White,
                    secondary = Color(0xFF24B66A),
                    background = Color(0xFF0D1014),
                    surface = Color(0xFF171B21),
                    onBackground = Color.White,
                    onSurface = Color.White,
                ),
            ) {
                KarooHomeScreen(
                    segments = segments,
                    status = status,
                    receiveActive = receiveInbox != null,
                    locationGranted = locationGranted,
                    overlayGranted = overlayGranted,
                    demoRunning = demoRunning,
                    versionName = BuildConfig.VERSION_NAME,
                    diagnostics = diagnosticLines,
                    riderProfile = riderProfile,
                    pendingDeleteId = pendingDeleteId,
                    onEnableLocation = {
                        if (LiveServiceStarter.hasLocationPermission(this@MainActivity)) {
                            locationGranted = true
                            LiveServiceStarter.startIfPermitted(this@MainActivity, "launcher-button")
                            status = "Location enabled; live matching service started"
                        } else {
                            locationPermissionLauncher.launch(
                                arrayOf(
                                    Manifest.permission.ACCESS_COARSE_LOCATION,
                                    Manifest.permission.ACCESS_FINE_LOCATION,
                                ),
                            )
                        }
                    },
                    onEnableOverlay = {
                        overlayPermissionLauncher.launch(
                            Intent(
                                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                Uri.parse("package:$packageName"),
                            ),
                        )
                    },
                    onToggleDemo = {
                        if (demoRunning) {
                            LiveDemoController.stop()
                            status = "Data-field demo stopped"
                        } else {
                            LiveDemoController.start()
                            status = "Data-field demo running; open a Karoo ride page"
                        }
                    },
                    onImportSegment = {
                        lifecycleScope.launch {
                            status = "Checking GritMap import inbox…"
                            val inboxResult = runCatching {
                                val results = listOf("packages", "segments").map { folder ->
                                    SegmentInboxProcessor(
                                        StagedFileSegmentInbox(this@MainActivity, folder),
                                        segmentLibrary,
                                        transferImporter,
                                    ).processAll()
                                }
                                refreshLibrary()
                                val imported = results.sumOf { it.imported.size }
                                val duplicates = results.sumOf { it.duplicates.size }
                                val failures = results.flatMap { it.failed.entries }
                                Triple(imported, duplicates, failures)
                            }
                            inboxResult.fold(
                                onSuccess = { (imported, duplicates, failures) ->
                                    if (imported == 0 && duplicates == 0 && failures.isEmpty() &&
                                        hasDocumentPicker()
                                    ) {
                                        status = "Opening file picker…"
                                        segmentPicker.launch(arrayOf("application/json", "text/plain"))
                                    } else {
                                        status = buildString {
                                            append("Inbox: $imported imported, $duplicates duplicates")
                                            if (failures.isNotEmpty()) {
                                                append(", ${failures.size} failed: ")
                                                append(failures.joinToString { "${it.key}: ${it.value}" })
                                            }
                                        }
                                    }
                                },
                                onFailure = { status = "Inbox import failed: ${it.message}" },
                            )
                        }
                    },
                    onReceive = {
                        val activeInbox = receiveInbox
                        if (activeInbox != null) {
                            activeInbox.stop()
                            receiveInbox = null
                            status = "Cancelled"
                        } else {
                            val address = HttpSegmentInbox.localIpAddress()
                            val inbox = HttpSegmentInbox()
                            receiveInbox = inbox
                            status = if (address != null) {
                                "Waiting ${HttpSegmentInbox.DEFAULT_TIMEOUT_MINUTES} min for phone… " +
                                    "send to http://$address:${HttpSegmentInbox.DEFAULT_PORT}/transfer"
                            } else {
                                "Waiting for phone… (connect to WiFi to see this Karoo's address)"
                            }
                            lifecycleScope.launch {
                                val result = runCatching {
                                    val outcome = SegmentInboxProcessor(
                                        inbox,
                                        segmentLibrary,
                                        transferImporter,
                                    ).processAll()
                                    refreshLibrary()
                                    outcome
                                }
                                receiveInbox = null
                                status = result.fold(
                                    onSuccess = { outcome ->
                                        when {
                                            outcome.imported.isNotEmpty() -> "Received ${outcome.imported.joinToString()}"
                                            outcome.duplicates.isNotEmpty() -> "Received duplicate: ${outcome.duplicates.joinToString()}"
                                            outcome.failed.isNotEmpty() ->
                                                "Receive failed: ${outcome.failed.entries.joinToString { "${it.key}: ${it.value}" }}"
                                            else -> "No phone connected in time"
                                        }
                                    },
                                    onFailure = { "Receive failed: ${it.message}" },
                                )
                            }
                        }
                    },
                    onImportHistory = {
                        if (hasDocumentPicker()) {
                            historyPicker.launch(arrayOf("application/json", "text/plain"))
                        } else {
                            lifecycleScope.launch {
                                status = importStagedJson("history") {
                                    historyImporter.importRiderHistory(it)
                                }.fold(
                                    onSuccess = { "Imported rider history (${it.samples.size} samples)" },
                                    onFailure = { "History import failed: ${it.message}" },
                                )
                            }
                        }
                    },
                    onRefreshDiagnostics = { lifecycleScope.launch { refreshDiagnostics() } },
                    onOpenH10Diagnostics = {
                        startActivity(Intent(this@MainActivity, H10DiagnosticActivity::class.java))
                    },
                    onRequestDelete = { pendingDeleteId = it },
                    onConfirmDelete = { segment ->
                        lifecycleScope.launch {
                            segmentLibrary.delete(segment.id)
                            pendingDeleteId = null
                            refreshLibrary()
                            status = "Deleted ${segment.name}"
                        }
                    },
                )
            }
        }
    }

    private fun hasDocumentPicker(): Boolean = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = "application/json"
    }.resolveActivity(packageManager) != null

    private suspend fun <T> importStagedJson(
        folderName: String,
        import: suspend (String) -> T,
    ): Result<T> = runCatching {
        val text = withContext(Dispatchers.IO) {
            val root = getExternalFilesDir(null) ?: throw IOException("External app storage unavailable")
            val folder = File(root, "imports/$folderName")
            check(folder.mkdirs() || folder.isDirectory) { "Unable to create ${folder.absolutePath}" }
            val source = folder.listFiles()
                ?.filter { it.isFile && it.extension.equals("json", ignoreCase = true) }
                ?.maxByOrNull(File::lastModified)
                ?: throw IOException("No JSON found in ${folder.absolutePath}")
            source.readText()
        }
        import(text)
    }

    private suspend fun <T> importText(uri: Uri, import: suspend (String) -> T): Result<T> =
        runCatching {
            val text = withContext(Dispatchers.IO) {
                contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
                    ?: throw IOException("Unable to open selected file")
            }
            import(text)
        }
}

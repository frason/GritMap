package com.gritmap.karoo

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Bundle
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
import com.gritmap.karoo.importing.RiderHistoryImportRepository
import com.gritmap.karoo.importing.SegmentImportRepository
import com.gritmap.karoo.importing.SegmentInboxProcessor
import com.gritmap.karoo.importing.SegmentLibraryRepository
import com.gritmap.karoo.importing.StagedFileSegmentInbox
import com.gritmap.karoo.importing.TransferPackageRepository
import com.gritmap.karoo.service.LiveDiagnostics
import com.gritmap.karoo.service.LiveServiceStarter
import com.gritmap.karoo.ui.state.LiveDemoController
import java.io.IOException
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

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
            var diagnosticLines by remember { mutableStateOf<List<String>>(emptyList()) }
            val demoRunning by LiveDemoController.running.collectAsState()
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
            LaunchedEffect(Unit) {
                refreshLibrary()
                refreshDiagnostics()
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
                    status = importText(uri) { segmentImporter.importSegment(it) }.fold(
                        onSuccess = {
                            refreshLibrary()
                            "Imported segment ${it.name}"
                        },
                        onFailure = { "Segment import failed: ${it.message}" },
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

            MaterialTheme {
                Column(
                    modifier = Modifier.fillMaxSize().background(Color(0xFF121417))
                        .verticalScroll(rememberScrollState()).padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text("GritMap Karoo", color = Color.White, style = MaterialTheme.typography.headlineMedium)
                    Text("Version ${BuildConfig.VERSION_NAME}", color = Color.Gray)
                    Text(status, color = Color.White)
                    Button(onClick = {
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
                    }) {
                        Text(if (locationGranted) "Location enabled" else "Enable location")
                    }
                    Button(onClick = {
                        if (demoRunning) {
                            LiveDemoController.stop()
                            status = "Data-field demo stopped"
                        } else {
                            LiveDemoController.start()
                            status = "Data-field demo running; open a Karoo ride page"
                        }
                    }) {
                        Text(if (demoRunning) "Stop data-field demo" else "Start data-field demo")
                    }
                    Text(
                        "Demo mode loops through a compressed planned segment without writing to the database. " +
                            "A real detected segment automatically takes control.",
                        color = Color.LightGray,
                        style = MaterialTheme.typography.bodySmall,
                    )
                    Button(onClick = {
                        if (hasDocumentPicker()) {
                            segmentPicker.launch(arrayOf("application/json", "text/plain"))
                        } else {
                            lifecycleScope.launch {
                                status = runCatching {
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
                                    buildString {
                                        append("Inbox: $imported imported, $duplicates duplicates")
                                        if (failures.isNotEmpty()) {
                                            append(", ${failures.size} failed: ")
                                            append(failures.joinToString { "${it.key}: ${it.value}" })
                                        }
                                    }
                                }.getOrElse { "Inbox import failed: ${it.message}" }
                            }
                        }
                    }) {
                        Text("Import segment JSON")
                    }
                    Button(onClick = {
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
                    }) {
                        Text("Import rider history JSON")
                    }
                    Text(
                        "Tracking activates only while Karoo reports a recorded ride. " +
                            "Add GritMap Pacing Profile or Target Power to a ride page for live guidance.",
                        color = Color.LightGray,
                    )
                    Text(
                        "Installed segments (${segments.size})",
                        color = Color.White,
                        style = MaterialTheme.typography.titleMedium,
                    )
                    segments.forEach { segment ->
                        Column(Modifier.fillMaxWidth()) {
                                Text(segment.name, color = Color.White)
                                Text(
                                    "${segment.lengthMeters.toInt()} m · ${segment.pointCount} points · " +
                                        if (segment.hasBaselinePlan) "baseline plan" else "no baseline plan",
                                    color = Color.LightGray,
                                )
                                Text(
                                    "forward · ${segment.corridorMeters} m corridor · " +
                                        segment.fingerprint.take(12),
                                    color = Color.Gray,
                                )
                                if (pendingDeleteId == segment.id) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Button(onClick = {
                                            lifecycleScope.launch {
                                                segmentLibrary.delete(segment.id)
                                                pendingDeleteId = null
                                                refreshLibrary()
                                                status = "Deleted ${segment.name}"
                                            }
                                        }) { Text("Confirm delete") }
                                        Button(onClick = { pendingDeleteId = null }) { Text("Cancel") }
                                    }
                                } else {
                                    Button(onClick = { pendingDeleteId = segment.id }) { Text("Delete") }
                                }
                        }
                    }
                    Text(
                        "Live diagnostics",
                        color = Color.White,
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Button(onClick = {
                        lifecycleScope.launch { refreshDiagnostics() }
                    }) { Text("Refresh diagnostics") }
                    Text(
                        diagnosticLines.takeLast(8).joinToString("\n").ifBlank { "No live events recorded" },
                        color = Color.LightGray,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
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

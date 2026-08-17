package com.gritmap.karoo

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
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import com.gritmap.karoo.data.DatabaseProvider
import com.gritmap.karoo.importing.RiderHistoryImportRepository
import com.gritmap.karoo.importing.SegmentImportRepository
import com.gritmap.karoo.service.LiveSegmentService
import java.io.IOException
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startService(Intent(this, LiveSegmentService::class.java))

        val database = DatabaseProvider.get(this)
        val segmentImporter = SegmentImportRepository(database)
        val historyImporter = RiderHistoryImportRepository(database)

        setContent {
            var status by remember { mutableStateOf("Ready") }
            val segmentPicker = rememberLauncherForActivityResult(
                ActivityResultContracts.OpenDocument(),
            ) { uri ->
                if (uri != null) lifecycleScope.launch {
                    status = importText(uri) { segmentImporter.importSegment(it) }.fold(
                        onSuccess = { "Imported segment ${it.name}" },
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
                    modifier = Modifier.fillMaxSize().background(Color(0xFF121417)).padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text("GritMap Karoo", color = Color.White, style = MaterialTheme.typography.headlineMedium)
                    Text(status, color = Color.White)
                    Button(onClick = {
                        if (hasDocumentPicker()) {
                            segmentPicker.launch(arrayOf("application/json", "text/plain"))
                        } else {
                            lifecycleScope.launch {
                                status = importStagedJson("segments") {
                                    segmentImporter.importSegment(it)
                                }.fold(
                                    onSuccess = { "Imported segment ${it.name}" },
                                    onFailure = { "Segment import failed: ${it.message}" },
                                )
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
                    Button(onClick = ::requestOverlayPermission) {
                        Text(if (Settings.canDrawOverlays(this@MainActivity)) "Overlay enabled" else "Enable overlay")
                    }
                    Text(
                        "Tracking activates only while Karoo reports a recorded ride. " +
                            "The official graphical data field works without overlay permission.",
                        color = Color.LightGray,
                    )
                }
            }
        }
    }

    private fun requestOverlayPermission() {
        if (Settings.canDrawOverlays(this)) return
        startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
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

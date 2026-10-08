package com.gritmap.karoo.physiology

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import java.util.Locale

class H10DiagnosticActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        H10ServiceCommands.ensureService(this)
        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF2B84DE),
                    secondary = Color(0xFF24B66A),
                    background = Color(0xFF0D1014),
                    surface = Color(0xFF171B21),
                    onBackground = Color.White,
                    onSurface = Color.White,
                ),
            ) {
                H10DiagnosticScreen()
            }
        }
    }

    @Composable
    private fun H10DiagnosticScreen() {
        val bleState by H10ServiceState.bleState.collectAsState()
        val captureState by H10ServiceState.captureState.collectAsState()
        var permissionsGranted by remember { mutableStateOf(hasBluetoothPermissions()) }
        val permissionLauncher = rememberLauncherForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions(),
        ) {
            permissionsGranted = hasBluetoothPermissions()
            if (permissionsGranted) H10ServiceCommands.scan(this@H10DiagnosticActivity)
        }

        Column(
            Modifier.fillMaxSize().background(Color(0xFF0D1014)).verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("H10 Enhanced Diagnostics", style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold)
            Text(bleState.status, color = Color(0xFFB9C0CA))

            if (!permissionsGranted) {
                Button(
                    onClick = {
                        permissionLauncher.launch(
                            arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT),
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Allow Bluetooth") }
            } else {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = { H10ServiceCommands.scan(this@H10DiagnosticActivity) },
                        modifier = Modifier.weight(1f),
                    ) {
                        Text("Scan")
                    }
                    OutlinedButton(
                        onClick = { H10ServiceCommands.disconnect(this@H10DiagnosticActivity) },
                        modifier = Modifier.weight(1f),
                    ) {
                        Text("Disconnect")
                    }
                }
                bleState.devices.forEach { device ->
                    OutlinedButton(
                        onClick = {
                            H10ServiceCommands.connect(this@H10DiagnosticActivity, device.address)
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("${device.name}  ${device.rssi} dBm")
                    }
                }
            }

            DiagnosticValue("Connection", bleState.connectionState.name)
            DiagnosticValue("BPM", captureState.currentBpm?.toString() ?: "--")
            DiagnosticValue("Latest RR", captureState.latestRrMs?.let { "$it ms" } ?: "--")
            DiagnosticValue("Valid RR", "${captureState.validRrPct}%")
            DiagnosticValue("RR samples", captureState.totalRrCount.toString())
            if (bleState.malformedPacketCount > 0) {
                DiagnosticValue("Skipped packets", bleState.malformedPacketCount.toString())
            }
            DiagnosticValue(
                "HR from RR",
                captureState.rrHeartRateBpm?.let { String.format(Locale.US, "%.1f bpm", it) } ?: "--",
            )
            DiagnosticValue(
                "RMSSD (diagnostic)",
                captureState.rmssdMs?.let { String.format(Locale.US, "%.1f ms", it) } ?: "--",
            )
            DiagnosticValue(
                "SDNN (diagnostic)",
                captureState.sdnnMs?.let { String.format(Locale.US, "%.1f ms", it) } ?: "--",
            )
            DiagnosticValue(
                "Enhanced metrics",
                if (captureState.enhancedMetricsAllowed) "READY" else "ESTABLISHING",
            )
            DiagnosticValue(
                "Contact",
                when (captureState.contactDetected) {
                    true -> "DETECTED"
                    false -> "NOT DETECTED"
                    null -> "NOT REPORTED"
                },
            )
            Text(captureState.status, color = Color(0xFF24B66A))
            if (captureState.recoverablePartialCount > 0) {
                Text(
                    "${captureState.recoverablePartialCount} recoverable incomplete capture(s) retained",
                    color = Color(0xFFF5B335),
                )
            }

            if (captureState.capturing) {
                Button(
                    onClick = { H10ServiceCommands.stopCapture(this@H10DiagnosticActivity) },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Stop and Save RR") }
            } else {
                Button(
                    onClick = { H10ServiceCommands.startCapture(this@H10DiagnosticActivity) },
                    enabled = bleState.connectionState == H10ConnectionState.CONNECTED,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Start RR Capture") }
            }

            captureState.finalizedArtifact?.let { artifact ->
                Text("Saved ${artifact.sampleCount} samples", fontWeight = FontWeight.Bold)
                Text(artifact.path.toString(), color = Color(0xFFB9C0CA))
                Text("SHA-256 ${artifact.sha256}", color = Color(0xFFB9C0CA))
            }
        }
    }

    @Composable
    private fun DiagnosticValue(label: String, value: String) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, color = Color(0xFFB9C0CA))
            Text(value, fontWeight = FontWeight.Bold)
        }
    }

    private fun hasBluetoothPermissions(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) ==
            PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) ==
            PackageManager.PERMISSION_GRANTED
}

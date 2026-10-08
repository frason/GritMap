package com.gritmap.karoo.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.gritmap.karoo.data.SegmentLibraryRow
import com.gritmap.karoo.service.KarooRiderProfile
import java.text.DateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

private val Background = Color(0xFF0D1014)
private val CardBackground = Color(0xFF171B21)
private val PrimaryBlue = Color(0xFF2B84DE)
private val ReadyGreen = Color(0xFF24B66A)
private val AttentionAmber = Color(0xFFF5B335)
private val SecondaryText = Color(0xFFB9C0CA)

enum class HomeDestination(val label: String, val glyph: String) {
    SEGMENTS("Segments", "▤"),
    INBOX("Inbox", "↓"),
    SETTINGS("Settings", "⚙"),
}

@Composable
fun KarooHomeScreen(
    segments: List<SegmentLibraryRow>,
    status: String,
    receiveActive: Boolean,
    locationGranted: Boolean,
    overlayGranted: Boolean,
    demoRunning: Boolean,
    versionName: String,
    diagnostics: List<String>,
    riderProfile: KarooRiderProfile?,
    pendingDeleteId: String?,
    onReceive: () -> Unit,
    onImportSegment: () -> Unit,
    onImportHistory: () -> Unit,
    onEnableLocation: () -> Unit,
    onEnableOverlay: () -> Unit,
    onToggleDemo: () -> Unit,
    onRefreshDiagnostics: () -> Unit,
    onOpenH10Diagnostics: () -> Unit,
    onRequestDelete: (String?) -> Unit,
    onConfirmDelete: (SegmentLibraryRow) -> Unit,
) {
    var destination by remember { mutableStateOf(HomeDestination.SEGMENTS) }
    var selectedSegmentId by remember { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxSize().background(Background)) {
        Box(Modifier.weight(1f)) {
            when (destination) {
                HomeDestination.SEGMENTS -> {
                    val selected = segments.firstOrNull { it.id == selectedSegmentId }
                    if (selected != null) {
                        key("segment-detail-${selected.id}") {
                            SegmentDetailScreen(
                            segment = selected,
                                riderFtpWatts = riderProfile?.ftpWatts,
                                pendingDelete = pendingDeleteId == selected.id,
                                onBack = {
                                    selectedSegmentId = null
                                    onRequestDelete(null)
                                },
                                onRequestDelete = { onRequestDelete(selected.id) },
                                onCancelDelete = { onRequestDelete(null) },
                                onConfirmDelete = {
                                    selectedSegmentId = null
                                    onConfirmDelete(selected)
                                },
                                onOpenInbox = {
                                    selectedSegmentId = null
                                    destination = HomeDestination.INBOX
                                },
                            )
                        }
                    } else {
                        key("segment-library") {
                            SegmentsScreen(
                            segments = segments,
                            riderFtpWatts = riderProfile?.ftpWatts,
                                versionName = versionName,
                                onOpenInbox = { destination = HomeDestination.INBOX },
                                onOpenSegment = { selectedSegmentId = it.id },
                            )
                        }
                    }
                }
                HomeDestination.INBOX -> InboxScreen(
                    status = status,
                    receiveActive = receiveActive,
                    onReceive = onReceive,
                    onImportSegment = onImportSegment,
                    onImportHistory = onImportHistory,
                )
                HomeDestination.SETTINGS -> SettingsScreen(
                    locationGranted = locationGranted,
                    overlayGranted = overlayGranted,
                    demoRunning = demoRunning,
                    versionName = versionName,
                    diagnostics = diagnostics,
                    riderProfile = riderProfile,
                    onEnableLocation = onEnableLocation,
                    onEnableOverlay = onEnableOverlay,
                    onToggleDemo = onToggleDemo,
                    onRefreshDiagnostics = onRefreshDiagnostics,
                    onOpenH10Diagnostics = onOpenH10Diagnostics,
                )
            }
        }
        NavigationBar(containerColor = CardBackground) {
            HomeDestination.entries.forEach { item ->
                NavigationBarItem(
                    selected = destination == item,
                    onClick = { destination = item },
                    icon = { Text(item.glyph, style = MaterialTheme.typography.titleLarge) },
                    label = { Text(item.label) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color.White,
                        selectedTextColor = Color.White,
                        indicatorColor = PrimaryBlue.copy(alpha = 0.32f),
                        unselectedIconColor = SecondaryText,
                        unselectedTextColor = SecondaryText,
                    ),
                )
            }
        }
    }
}

@Composable
private fun ScreenHeader(title: String, trailing: String? = null) {
    Row(
        Modifier.fillMaxWidth().padding(bottom = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(title, color = Color.White, style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold)
        trailing?.let { Text(it, color = SecondaryText, style = MaterialTheme.typography.labelLarge) }
    }
}

@Composable
private fun SegmentsScreen(
    segments: List<SegmentLibraryRow>,
    riderFtpWatts: Int?,
    versionName: String,
    onOpenInbox: () -> Unit,
    onOpenSegment: (SegmentLibraryRow) -> Unit,
) {
    val ready = segments.count { it.planStatus(riderFtpWatts) == SegmentPlanStatus.PLANNED }
    val needsAttention = segments.size - ready
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        ScreenHeader("Segments", "v$versionName")
        Card(colors = CardDefaults.cardColors(containerColor = CardBackground)) {
            Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text("READY FOR YOUR RIDE", color = SecondaryText,
                    style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                Text("${segments.size} installed · $ready ready", color = Color.White,
                    style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                if (needsAttention > 0) {
                    Text("$needsAttention ${if (needsAttention == 1) "segment needs" else "segments need"} attention",
                        color = AttentionAmber, style = MaterialTheme.typography.bodyMedium)
                } else if (segments.isNotEmpty()) {
                    Text("Every installed segment has a pacing plan", color = ReadyGreen)
                }
                Button(onClick = onOpenInbox, modifier = Modifier.fillMaxWidth(),
                    contentPadding = ButtonDefaults.ContentPadding) {
                    Text("Receive from Phone")
                }
            }
        }

        if (segments.isEmpty()) {
            EmptyLibrary(onOpenInbox)
        } else {
            if (needsAttention > 0) {
                SectionLabel("NEEDS ATTENTION")
                segments.filter { it.planStatus(riderFtpWatts) != SegmentPlanStatus.PLANNED }.forEach { segment ->
                    SegmentCard(segment, riderFtpWatts) { onOpenSegment(segment) }
                }
            }
            if (ready > 0) {
                SectionLabel("READY TO RIDE")
                segments.filter { it.planStatus(riderFtpWatts) == SegmentPlanStatus.PLANNED }.forEach { segment ->
                    SegmentCard(segment, riderFtpWatts) { onOpenSegment(segment) }
                }
            }
        }
        Spacer(Modifier.height(4.dp))
    }
}

@Composable
private fun EmptyLibrary(onOpenInbox: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = CardBackground)) {
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("No segments installed", color = Color.White,
                style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text("Send a segment and pacing plan from your phone, or import a JSON file.",
                color = SecondaryText)
            OutlinedButton(onClick = onOpenInbox, modifier = Modifier.fillMaxWidth()) {
                Text("Open Inbox")
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(text, color = SecondaryText, style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 6.dp))
}

@Composable
private fun SegmentCard(
    segment: SegmentLibraryRow,
    riderFtpWatts: Int?,
    onClick: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = CardBackground),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top) {
                Text(segment.name, color = Color.White, style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f).padding(end = 8.dp))
                val planStatus = segment.planStatus(riderFtpWatts)
                StatusBadge(planStatus.label, planStatus.color)
            }
            Text(segment.distanceLabel(), color = SecondaryText, style = MaterialTheme.typography.bodyLarge)
            if (segment.hasBaselinePlan) {
                segment.targetFinishTimeSeconds?.let {
                    Text("Goal ${formatDuration(it)}", color = Color.White,
                        style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                }
                val details = buildList {
                    segment.planSource?.let { add(it.sourceLabel()) }
                    if (segment.pacingZoneCount > 0) add("${segment.pacingZoneCount} pacing zones")
                    segment.planFtpWatts?.let { add("Built at $it W FTP") }
                }
                if (details.isNotEmpty()) Text(details.joinToString(" · "), color = SecondaryText)
                segment.planCreatedAtMs?.let {
                    Text("Updated ${DateFormat.getDateInstance(DateFormat.MEDIUM).format(Date(it))}",
                        color = Color.Gray, style = MaterialTheme.typography.bodySmall)
                }
                if (segment.planStatus(riderFtpWatts) == SegmentPlanStatus.OUTDATED) {
                    Text("Current Karoo FTP is $riderFtpWatts W · update recommended",
                        color = AttentionAmber, fontWeight = FontWeight.Bold)
                }
            } else {
                Text("Matching is ready; send a pacing plan from your phone.", color = AttentionAmber)
            }
            Text("View details  ›", color = PrimaryBlue, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun SegmentDetailScreen(
    segment: SegmentLibraryRow,
    riderFtpWatts: Int?,
    pendingDelete: Boolean,
    onBack: () -> Unit,
    onRequestDelete: () -> Unit,
    onCancelDelete: () -> Unit,
    onConfirmDelete: () -> Unit,
    onOpenInbox: () -> Unit,
) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        OutlinedButton(
            onClick = onBack,
            colors = ButtonDefaults.outlinedButtonColors(contentColor = SecondaryText),
        ) { Text("‹  Segments") }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top) {
            Text(segment.name, color = Color.White, style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f).padding(end = 8.dp))
            val planStatus = segment.planStatus(riderFtpWatts)
            StatusBadge(planStatus.label, planStatus.color)
        }
        Text(segment.distanceLabel(), color = SecondaryText, style = MaterialTheme.typography.titleMedium)

        DetailCard("PACING PLAN") {
            if (segment.hasBaselinePlan) {
                DetailValue("Goal", segment.targetFinishTimeSeconds?.let(::formatDuration) ?: "Fastest sustainable")
                DetailValue("Source", segment.planSource?.sourceLabel() ?: "Local")
                DetailValue("Zones", segment.pacingZoneCount.toString())
                DetailValue("Current FTP", riderFtpWatts?.let { "$it W · Karoo" } ?: "Waiting for Karoo")
                DetailValue("Generated at", segment.planFtpWatts?.let { "$it W FTP" } ?: "Not provided")
                if (segment.planStatus(riderFtpWatts) == SegmentPlanStatus.OUTDATED) {
                    Text("FTP changed since this plan was generated. Update recommended.",
                        color = AttentionAmber, fontWeight = FontWeight.Bold)
                }
                segment.planCreatedAtMs?.let {
                    DetailValue("Updated", DateFormat.getDateInstance(DateFormat.MEDIUM).format(Date(it)))
                }
                OutlinedButton(onClick = onOpenInbox, modifier = Modifier.fillMaxWidth()) {
                    Text("Replace from Phone")
                }
            } else {
                Text("This segment can be matched, but it has no power targets or finish-time goal.",
                    color = SecondaryText)
                Button(onClick = onOpenInbox, modifier = Modifier.fillMaxWidth()) {
                    Text("Receive Pacing Plan")
                }
            }
        }

        DetailCard("MATCHING") {
            DetailValue("Direction", "Forward")
            DetailValue("Start corridor", "${segment.corridorMeters} m")
            DetailValue("Required coverage", "${(segment.requiredCoveragePct * 100).roundToInt()}%")
            DetailValue("Reference points", segment.pointCount.toString())
            DetailValue("Fingerprint", segment.fingerprint.take(12))
        }

        DetailCard("MANAGE") {
            if (pendingDelete) {
                Text("Delete this segment, its pacing plan, and recorded attempts?",
                    color = Color.White, fontWeight = FontWeight.Bold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = onConfirmDelete,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD94747)),
                    ) { Text("Confirm Delete") }
                    OutlinedButton(onClick = onCancelDelete) { Text("Cancel") }
                }
            } else {
                OutlinedButton(
                    onClick = onRequestDelete,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFFF7777)),
                ) { Text("Delete Segment") }
            }
        }
        Spacer(Modifier.height(4.dp))
    }
}

@Composable
private fun DetailCard(label: String, content: @Composable () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = CardBackground)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Text(label, color = SecondaryText, style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold)
            content()
        }
    }
}

@Composable
private fun DetailValue(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = SecondaryText)
        Text(value, color = Color.White, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun StatusBadge(label: String, color: Color) {
    Surface(color = color.copy(alpha = 0.18f), shape = RoundedCornerShape(8.dp)) {
        Text(label, color = color, fontWeight = FontWeight.Bold,
            style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp))
    }
}

@Composable
private fun InboxScreen(
    status: String,
    receiveActive: Boolean,
    onReceive: () -> Unit,
    onImportSegment: () -> Unit,
    onImportHistory: () -> Unit,
) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        ScreenHeader("Inbox")
        Card(colors = CardDefaults.cardColors(containerColor = CardBackground)) {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(if (receiveActive) "WAITING FOR PHONE" else "PHONE TRANSFER",
                    color = if (receiveActive) ReadyGreen else SecondaryText,
                    style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                Text(if (receiveActive) "Receiver is open" else "Send segments and pacing plans over Wi-Fi",
                    color = Color.White, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Button(onClick = onReceive, modifier = Modifier.fillMaxWidth()) {
                    Text(if (receiveActive) "Cancel Receiving" else "Receive from Phone")
                }
                Text(status, color = SecondaryText, style = MaterialTheme.typography.bodyMedium)
            }
        }
        SectionLabel("FILE IMPORTS")
        OutlinedButton(onClick = onImportSegment, modifier = Modifier.fillMaxWidth()) {
            Text("Import Segment or Guidance JSON")
        }
        OutlinedButton(onClick = onImportHistory, modifier = Modifier.fillMaxWidth()) {
            Text("Import Rider History JSON")
        }
        Text("Keep this screen open while transferring. The receiver closes after 10 minutes.",
            color = SecondaryText, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun SettingsScreen(
    locationGranted: Boolean,
    overlayGranted: Boolean,
    demoRunning: Boolean,
    versionName: String,
    diagnostics: List<String>,
    riderProfile: KarooRiderProfile?,
    onEnableLocation: () -> Unit,
    onEnableOverlay: () -> Unit,
    onToggleDemo: () -> Unit,
    onRefreshDiagnostics: () -> Unit,
    onOpenH10Diagnostics: () -> Unit,
) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        ScreenHeader("Settings")
        Card(colors = CardDefaults.cardColors(containerColor = CardBackground)) {
            Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("RIDER PROFILE", color = SecondaryText, fontWeight = FontWeight.Bold)
                Text(
                    riderProfile?.let { "FTP ${it.ftpWatts} W" } ?: "Waiting for Karoo profile",
                    color = Color.White,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )
                riderProfile?.let {
                    Text("${String.format(Locale.US, "%.1f", it.weightKg)} kg" +
                        (it.maxHeartRateBpm?.let { hr -> " · Max HR $hr" } ?: ""), color = SecondaryText)
                }
                Text("Synced automatically from Karoo settings", color = ReadyGreen)
            }
        }
        SettingsCard("LOCATION", if (locationGranted) "Enabled" else "Required",
            "Used for local segment matching during a recorded ride.", locationGranted, onEnableLocation)
        SettingsCard("OVERLAY", if (overlayGranted) "Enabled" else "Optional",
            "Shows guidance over Karoo screens. Official data fields work without it.", overlayGranted, onEnableOverlay)
        Card(colors = CardDefaults.cardColors(containerColor = CardBackground)) {
            Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("DATA-FIELD PREVIEW", color = SecondaryText, fontWeight = FontWeight.Bold)
                Text(if (demoRunning) "Demo running" else "Demo stopped", color = Color.White,
                    style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("Loops representative data without writing to the ride database.", color = SecondaryText)
                OutlinedButton(onClick = onToggleDemo) {
                    Text(if (demoRunning) "Stop Demo" else "Start Demo")
                }
            }
        }
        Card(colors = CardDefaults.cardColors(containerColor = CardBackground)) {
            Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("POLAR H10", color = SecondaryText, fontWeight = FontWeight.Bold)
                Text("Enhanced RR diagnostics", color = Color.White,
                    style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("Connect over Bluetooth, inspect RR quality, and save a local diagnostic artifact.",
                    color = SecondaryText)
                OutlinedButton(onClick = onOpenH10Diagnostics) { Text("Open H10 Diagnostics") }
            }
        }
        SectionLabel("DIAGNOSTICS")
        OutlinedButton(onClick = onRefreshDiagnostics) { Text("Refresh Diagnostics") }
        Text(diagnostics.takeLast(8).joinToString("\n").ifBlank { "No live events recorded" },
            color = SecondaryText, style = MaterialTheme.typography.bodySmall)
        Text("GritMap Karoo $versionName", color = Color.Gray, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun SettingsCard(
    label: String,
    value: String,
    description: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Card(colors = CardDefaults.cardColors(containerColor = CardBackground)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(label, color = SecondaryText, fontWeight = FontWeight.Bold)
                StatusBadge(value.uppercase(Locale.US), if (enabled) ReadyGreen else AttentionAmber)
            }
            Text(description, color = SecondaryText)
            if (!enabled) OutlinedButton(onClick = onClick) { Text("Enable") }
        }
    }
}

private fun SegmentLibraryRow.distanceLabel(): String {
    val miles = lengthMeters / 1609.344
    return if (miles >= 0.1) String.format(Locale.US, "%.1f mi · %,d points", miles, pointCount)
    else "${lengthMeters.roundToInt()} m · $pointCount points"
}

private fun formatDuration(totalSeconds: Int): String =
    "%d:%02d".format(Locale.US, totalSeconds / 60, totalSeconds % 60)

private fun String.sourceLabel(): String = lowercase().replace('_', ' ')
    .replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.US) else it.toString() }

private enum class SegmentPlanStatus(val label: String, val color: Color) {
    PLANNED("PLANNED", ReadyGreen),
    OUTDATED("PLAN OUTDATED", AttentionAmber),
    MISSING("NO PLAN", AttentionAmber),
}

private fun SegmentLibraryRow.planStatus(currentFtpWatts: Int?): SegmentPlanStatus = when {
    !hasBaselinePlan -> SegmentPlanStatus.MISSING
    currentFtpWatts != null && planFtpWatts != null && currentFtpWatts != planFtpWatts ->
        SegmentPlanStatus.OUTDATED
    else -> SegmentPlanStatus.PLANNED
}

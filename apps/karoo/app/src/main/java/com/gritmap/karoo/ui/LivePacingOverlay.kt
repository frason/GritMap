package com.gritmap.karoo.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import com.gritmap.karoo.ui.state.Effort
import com.gritmap.karoo.ui.state.LiveUiState
import kotlin.math.max

@Composable
fun LivePacingOverlay(state: LiveUiState, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.background(Color(0xDD121417)).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            text = state.segmentName.ifBlank { "GritMap" },
            color = Color.White,
            fontFamily = FontFamily.SansSerif,
            fontWeight = FontWeight.Bold,
            fontSize = 19.sp,
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = state.recommendation?.instruction ?: "Waiting for segment",
                color = Color.White,
                fontSize = 15.sp,
            )
            Text(
                text = state.recommendation?.targetPowerWatts?.let { "$it W" } ?: "-- W",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 22.sp,
            )
        }
        state.sensorStatus.warning?.let { warning ->
            Text(text = warning, color = Color(0xFFFFC857), fontSize = 12.sp)
        }
        ElevationProfile(state, Modifier.fillMaxWidth().height(96.dp))
    }
}

@Composable
private fun ElevationProfile(state: LiveUiState, modifier: Modifier) {
    Box(modifier) {
        Canvas(Modifier.fillMaxSize()) {
            val total = state.totalDistanceMeters
            if (total <= 0.0 || state.elevationProfile.size < 2) return@Canvas
            state.pacingZones.forEach { zone ->
                val color = when (zone.effort) {
                    Effort.RECOVER -> Color(0xFF1D7DDC)
                    Effort.HOLD -> Color(0xFF20AA5B)
                    Effort.PUSH -> Color(0xFFE75B40)
                }
                val left = (zone.startDistanceMeters / total * size.width).toFloat()
                val right = (zone.endDistanceMeters / total * size.width).toFloat()
                drawRect(color.copy(alpha = 0.4f), Offset(left, 0f), androidx.compose.ui.geometry.Size(max(0f, right - left), size.height))
            }
            val min = state.elevationProfile.minOf { it.elevationMeters }
            val span = max(state.elevationProfile.maxOf { it.elevationMeters } - min, 1.0)
            val path = Path()
            state.elevationProfile.forEachIndexed { index, point ->
                val x = (point.distanceMeters / total * size.width).toFloat()
                val y = size.height - ((point.elevationMeters - min) / span * size.height).toFloat()
                if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }
            drawPath(path, Color.White, style = Stroke(width = 3f))
            val x = state.progressFraction * size.width
            drawLine(Color.White, Offset(x, 0f), Offset(x, size.height), strokeWidth = 3f)
        }
    }
}

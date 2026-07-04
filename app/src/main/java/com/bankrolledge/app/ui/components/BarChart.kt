package com.bankrolledge.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.bankrolledge.app.ui.theme.LossRed
import com.bankrolledge.app.ui.theme.NeutralGrey
import com.bankrolledge.app.ui.theme.ProfitGreen
import kotlin.math.abs
import kotlin.math.max

/** One bar: value sets height and direction (below-zero draws downward);
 *  [color] overrides the default green/red-by-sign. */
data class BarEntry(
    val label: String,
    val value: Double,
    val color: Color? = null,
)

/**
 * General-purpose profit bar chart drawn on a Canvas. The zero baseline is
 * positioned proportionally to the positive/negative extents, so an all-positive
 * chart (e.g. a histogram) uses the full height while a mixed chart splits it.
 * At most ~4 x-axis labels are shown, always including the first and last.
 */
@Composable
fun BarChart(
    entries: List<BarEntry>,
    modifier: Modifier = Modifier,
    height: Dp = 160.dp,
    topLabel: String? = null,
    emptyMessage: String = "No data yet.",
) {
    if (entries.isEmpty() || entries.all { it.value == 0.0 }) {
        Text(
            emptyMessage,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = modifier.padding(vertical = 8.dp),
        )
        return
    }

    val maxPos = max(entries.maxOf { it.value }, 0.0)
    val maxNeg = max(-entries.minOf { it.value }, 0.0)
    val span = (maxPos + maxNeg).takeIf { it > 0.0 } ?: 1.0
    val zeroLine = NeutralGrey.copy(alpha = 0.5f)

    Column(modifier.fillMaxWidth()) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(height),
        ) {
            Canvas(Modifier.fillMaxWidth().height(height)) {
                val w = size.width
                val h = size.height
                val pad = 6f
                val usable = h - 2 * pad
                val zeroY = pad + (maxPos / span * usable).toFloat()
                val slot = w / entries.size
                val barWidth = (slot * 0.62f).coerceAtMost(64f)

                drawLine(zeroLine, Offset(0f, zeroY), Offset(w, zeroY), strokeWidth = 2f)

                entries.forEachIndexed { i, e ->
                    if (e.value == 0.0) return@forEachIndexed
                    val magnitude = (abs(e.value) / span * usable).toFloat()
                    val left = slot * i + (slot - barWidth) / 2f
                    val rect = if (e.value >= 0.0) {
                        Rect(left, zeroY - magnitude, left + barWidth, zeroY)
                    } else {
                        Rect(left, zeroY, left + barWidth, zeroY + magnitude)
                    }
                    val path = Path().apply { addRoundRect(RoundRect(rect, CornerRadius(6f, 6f))) }
                    drawPath(path, color = e.color ?: if (e.value >= 0.0) ProfitGreen else LossRed)
                }
            }
            if (topLabel != null) {
                Text(
                    text = topLabel,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.align(Alignment.TopStart),
                )
            }
        }
        val labelStep = ((entries.size + 3) / 4).coerceAtLeast(1)
        Row(Modifier.fillMaxWidth().padding(top = 4.dp)) {
            entries.forEachIndexed { i, e ->
                val show = i % labelStep == 0 || i == entries.lastIndex
                Text(
                    text = if (show) e.label else "",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    softWrap = false,
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

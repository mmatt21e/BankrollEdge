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
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.bankrolledge.app.domain.MonthlyProfit
import com.bankrolledge.app.ui.theme.LossRed
import com.bankrolledge.app.ui.theme.NeutralGrey
import com.bankrolledge.app.ui.theme.ProfitGreen
import com.bankrolledge.app.util.Formatters
import kotlin.math.abs

private const val MAX_BARS = 12

/** Profit per calendar month as green/red bars around a zero baseline (last 12 months). */
@Composable
fun MonthlyBarChart(
    months: List<MonthlyProfit>,
    currency: String,
    modifier: Modifier = Modifier,
) {
    if (months.isEmpty()) {
        Text(
            "No data yet.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = modifier.padding(vertical = 8.dp),
        )
        return
    }
    val shown = months.takeLast(MAX_BARS)
    val maxAbs = shown.maxOf { abs(it.profit) }.takeIf { it > 0.0 } ?: 1.0
    val zeroLine = NeutralGrey.copy(alpha = 0.5f)

    Column(modifier.fillMaxWidth()) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(160.dp),
        ) {
            Canvas(Modifier.fillMaxWidth().height(160.dp)) {
                val w = size.width
                val h = size.height
                val zeroY = h / 2f
                val slot = w / shown.size
                val barWidth = (slot * 0.62f).coerceAtMost(64f)

                drawLine(zeroLine, Offset(0f, zeroY), Offset(w, zeroY), strokeWidth = 2f)

                shown.forEachIndexed { i, m ->
                    val magnitude = ((abs(m.profit) / maxAbs) * (h / 2f - 6f)).toFloat()
                    val left = slot * i + (slot - barWidth) / 2f
                    val rect = if (m.profit >= 0.0) {
                        Rect(left, zeroY - magnitude, left + barWidth, zeroY)
                    } else {
                        Rect(left, zeroY, left + barWidth, zeroY + magnitude)
                    }
                    val path = Path().apply {
                        addRoundRect(RoundRect(rect, CornerRadius(6f, 6f)))
                    }
                    drawPath(path, color = if (m.profit >= 0.0) ProfitGreen else LossRed)
                }
            }
            Text(
                text = Formatters.compactMoney(maxAbs, currency),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.align(Alignment.TopStart),
            )
        }
        // With many bars the labels won't all fit — show at most ~4, always including
        // the first and last month.
        val labelStep = ((shown.size + 3) / 4).coerceAtLeast(1)
        Row(Modifier.fillMaxWidth().padding(top = 4.dp)) {
            shown.forEachIndexed { i, m ->
                val show = i % labelStep == 0 || i == shown.lastIndex
                Text(
                    text = if (show) m.label else "",
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

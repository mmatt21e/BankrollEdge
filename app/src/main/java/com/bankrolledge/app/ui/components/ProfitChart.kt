package com.bankrolledge.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.bankrolledge.app.domain.ProfitPoint
import com.bankrolledge.app.ui.theme.LossRed
import com.bankrolledge.app.ui.theme.NeutralGrey
import com.bankrolledge.app.ui.theme.ProfitGreen
import com.bankrolledge.app.util.Formatters

/**
 * Cumulative profit line chart drawn on a Canvas — no third-party chart library.
 * Points are evenly spaced along X (session index); Y is scaled to the min/max of
 * the running total, with the zero line highlighted. Colored green/red by result.
 */
@Composable
fun CumulativeProfitChart(
    points: List<ProfitPoint>,
    currency: String,
    modifier: Modifier = Modifier,
) {
    if (points.size < 2) {
        Box(
            modifier
                .fillMaxWidth()
                .height(180.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Log at least two sessions to see your profit graph.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        return
    }

    val values = points.map { it.cumulative }
    val maxV = values.max()
    val minV = values.min()
    val last = values.last()
    val lineColor = if (last >= 0) ProfitGreen else LossRed
    val gridColor = NeutralGrey.copy(alpha = 0.25f)
    val zeroColor = NeutralGrey.copy(alpha = 0.5f)

    Box(modifier.fillMaxWidth()) {
        Canvas(
            Modifier
                .fillMaxWidth()
                .height(200.dp)
                .padding(top = 8.dp, bottom = 8.dp),
        ) {
            val w = size.width
            val h = size.height
            val range = (maxV - minV).takeIf { it > 0.0 } ?: 1.0

            fun x(i: Int): Float = w * i / (points.size - 1)
            fun y(v: Double): Float = (h * (1.0 - (v - minV) / range)).toFloat()

            // Zero baseline (only if it falls within the visible range).
            if (minV <= 0.0 && maxV >= 0.0) {
                val zeroY = y(0.0)
                drawLine(
                    color = zeroColor,
                    start = Offset(0f, zeroY),
                    end = Offset(w, zeroY),
                    strokeWidth = 2f,
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 10f)),
                )
            } else {
                // Otherwise draw a faint mid gridline for reference.
                drawLine(gridColor, Offset(0f, h / 2), Offset(w, h / 2), strokeWidth = 1f)
            }

            // Filled area under the line.
            val fill = Path().apply {
                moveTo(0f, y(values[0]))
                values.forEachIndexed { i, v -> lineTo(x(i), y(v)) }
                lineTo(w, h)
                lineTo(0f, h)
                close()
            }
            drawPath(
                path = fill,
                brush = Brush.verticalGradient(
                    colors = listOf(lineColor.copy(alpha = 0.30f), lineColor.copy(alpha = 0.02f)),
                ),
            )

            // The line itself.
            val line = Path().apply {
                moveTo(0f, y(values[0]))
                values.forEachIndexed { i, v -> lineTo(x(i), y(v)) }
            }
            drawPath(path = line, color = lineColor, style = Stroke(width = 5f))

            // Endpoint marker.
            drawCircle(color = lineColor, radius = 7f, center = Offset(w, y(last)))
        }

        // Peak / trough labels.
        Text(
            text = Formatters.compactMoney(maxV, currency),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.align(Alignment.TopStart),
        )
        Text(
            text = Formatters.compactMoney(minV, currency),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.align(Alignment.BottomStart),
        )
    }
}

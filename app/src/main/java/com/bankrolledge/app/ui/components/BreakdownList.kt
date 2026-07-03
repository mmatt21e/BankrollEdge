package com.bankrolledge.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.bankrolledge.app.domain.GroupStat
import com.bankrolledge.app.ui.theme.LossRed
import com.bankrolledge.app.ui.theme.ProfitGreen
import com.bankrolledge.app.ui.theme.profitColor
import com.bankrolledge.app.util.Formatters
import kotlin.math.abs

/** A ranked list of groups (game type, venue, stakes) with a proportional profit bar. */
@Composable
fun BreakdownList(
    groups: List<GroupStat>,
    currency: String,
    modifier: Modifier = Modifier,
    emptyMessage: String = "No data yet.",
) {
    if (groups.isEmpty()) {
        Text(
            text = emptyMessage,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = modifier.padding(vertical = 8.dp),
        )
        return
    }
    val maxAbs = groups.maxOf { abs(it.profit) }.takeIf { it > 0.0 } ?: 1.0
    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        groups.forEach { g ->
            BreakdownRow(g, currency, maxAbs)
        }
    }
}

@Composable
private fun BreakdownRow(group: GroupStat, currency: String, maxAbs: Double) {
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = group.key,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = Formatters.signedMoney(group.profit, currency),
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold,
                color = profitColor(group.profit),
            )
        }
        Row(
            Modifier
                .fillMaxWidth()
                .padding(top = 2.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = "${group.sessionCount} sessions • ${Formatters.perHour(group.hourlyRate, currency)}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        // Proportional bar.
        val fraction = (abs(group.profit) / maxAbs).toFloat().coerceIn(0.02f, 1f)
        Box(
            Modifier
                .fillMaxWidth()
                .padding(top = 6.dp)
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant),
        ) {
            Box(
                Modifier
                    .fillMaxWidth(fraction)
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(if (group.profit >= 0) ProfitGreen else LossRed),
            )
        }
    }
}

package com.bankrolledge.app.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.bankrolledge.app.data.local.entity.SessionEntity
import com.bankrolledge.app.data.model.SessionType
import com.bankrolledge.app.ui.theme.profitColor
import com.bankrolledge.app.util.DateTimeUtils
import com.bankrolledge.app.util.Formatters

/** One row in the sessions list. Tapping it opens the editor. */
@Composable
fun SessionRow(
    session: SessionEntity,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
        ),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    text = titleFor(session),
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = subtitleFor(session),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = Formatters.signedMoney(session.profit, session.currency),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = profitColor(session.profit),
                )
                if (session.durationMinutes > 0) {
                    Text(
                        text = Formatters.duration(session.durationMinutes),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

private fun titleFor(session: SessionEntity): String {
    val stakes = session.stakesLabel
    val gameLabel = session.game.label
    return when (session.type) {
        SessionType.CASH -> if (stakes.isNotEmpty()) "$stakes $gameLabel" else gameLabel
        SessionType.TOURNAMENT -> "$gameLabel Tournament"
    }
}

private fun subtitleFor(session: SessionEntity): String {
    val date = DateTimeUtils.formatDate(session.startTime)
    val place = session.location.ifBlank { "—" }
    return "$date • $place"
}

package com.bankrolledge.app.ui.dashboard

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.collectAsState
import com.bankrolledge.app.ui.BankrollViewModel
import com.bankrolledge.app.ui.components.CumulativeProfitChart
import com.bankrolledge.app.ui.components.SessionRow
import com.bankrolledge.app.ui.components.StatTileData
import com.bankrolledge.app.ui.components.StatTileGrid
import com.bankrolledge.app.ui.theme.Gold500
import com.bankrolledge.app.ui.theme.profitColor
import com.bankrolledge.app.util.Formatters

@Composable
fun DashboardScreen(
    viewModel: BankrollViewModel,
    contentPadding: PaddingValues,
    onSessionClick: (Long) -> Unit,
    onSeeAll: () -> Unit,
) {
    val state by viewModel.uiState.collectAsState()
    val stats = state.allStats
    val currency = state.settings.currency
    val bankroll = stats.bankroll(state.settings.startingBankroll)

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = 16.dp,
            end = 16.dp,
            top = contentPadding.calculateTopPadding() + 12.dp,
            bottom = contentPadding.calculateBottomPadding() + 96.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item { BankrollHeader(bankroll, stats.totalProfit, currency) }

        item {
            Card(
                Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant,
                ),
            ) {
                Column(Modifier.padding(16.dp)) {
                    Text(
                        text = "CUMULATIVE PROFIT",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    CumulativeProfitChart(points = stats.cumulative, currency = currency)
                }
            }
        }

        item {
            StatTileGrid(
                tiles = listOf(
                    StatTileData("Profit", Formatters.signedMoney(stats.totalProfit, currency), profitColor(stats.totalProfit)),
                    StatTileData("Per Hour", Formatters.perHour(stats.hourlyRate, currency), profitColor(stats.hourlyRate)),
                    StatTileData("Sessions", stats.sessionCount.toString(), MaterialTheme.colorScheme.onSurface),
                    StatTileData("Hours", String.format("%.1f", stats.totalHours), MaterialTheme.colorScheme.onSurface),
                    StatTileData("Win Rate", Formatters.percent(stats.winRate), MaterialTheme.colorScheme.onSurface),
                    StatTileData("ROI", Formatters.percent(stats.roi), profitColor(stats.roi)),
                ),
            )
        }

        if (state.allSessions.isNotEmpty()) {
            item {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "Recent sessions",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                    )
                    TextButton(onClick = onSeeAll) { Text("See all") }
                }
            }
            items(state.allSessions.take(5), key = { it.id }) { session ->
                SessionRow(session = session, onClick = { onSessionClick(session.id) })
            }
        } else {
            item { EmptyDashboard() }
        }
    }
}

@Composable
private fun BankrollHeader(bankroll: Double, totalProfit: Double, currency: String) {
    Column {
        Text(
            text = "CURRENT BANKROLL",
            style = MaterialTheme.typography.labelMedium,
            color = Gold500,
        )
        Text(
            text = Formatters.money(bankroll, currency),
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground,
        )
        Text(
            text = "${Formatters.signedMoney(totalProfit, currency)} all-time",
            style = MaterialTheme.typography.bodyMedium,
            color = profitColor(totalProfit),
        )
    }
}

@Composable
private fun EmptyDashboard() {
    Card(
        Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
        ),
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = "No sessions yet",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = "Tap the + button to log your first poker session and start tracking your bankroll.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

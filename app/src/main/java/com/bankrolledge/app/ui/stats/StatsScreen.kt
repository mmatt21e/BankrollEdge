package com.bankrolledge.app.ui.stats

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.bankrolledge.app.ui.BankrollViewModel
import com.bankrolledge.app.ui.DateRange
import com.bankrolledge.app.ui.components.BreakdownList
import com.bankrolledge.app.ui.components.StatTileData
import com.bankrolledge.app.ui.components.StatTileGrid
import com.bankrolledge.app.ui.theme.profitColor
import com.bankrolledge.app.util.Formatters

@Composable
fun StatsScreen(
    viewModel: BankrollViewModel,
    contentPadding: PaddingValues,
) {
    val state by viewModel.uiState.collectAsState()
    val stats = state.filteredStats
    val currency = state.settings.currency

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = 16.dp,
            end = 16.dp,
            top = contentPadding.calculateTopPadding() + 12.dp,
            bottom = contentPadding.calculateBottomPadding() + 32.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Text(
                text = "Statistics",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
            )
        }

        item {
            Row(
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                DateRange.entries.forEach { range ->
                    FilterChip(
                        selected = state.filter.range == range,
                        onClick = { viewModel.setFilter(state.filter.copy(range = range)) },
                        label = { Text(range.label) },
                    )
                }
            }
        }

        item {
            StatTileGrid(
                tiles = listOf(
                    StatTileData("Profit", Formatters.signedMoney(stats.totalProfit, currency), profitColor(stats.totalProfit)),
                    StatTileData("Per Hour", Formatters.perHour(stats.hourlyRate, currency), profitColor(stats.hourlyRate)),
                    StatTileData("ROI", Formatters.percent(stats.roi), profitColor(stats.roi)),
                    StatTileData("Win Rate", Formatters.percent(stats.winRate), MaterialTheme.colorScheme.onSurface),
                    StatTileData("Avg / Session", Formatters.signedMoney(stats.avgProfit, currency), profitColor(stats.avgProfit)),
                    StatTileData("Hours", String.format("%.1f", stats.totalHours), MaterialTheme.colorScheme.onSurface),
                    StatTileData("Biggest Win", Formatters.signedMoney(stats.biggestWin, currency), profitColor(stats.biggestWin)),
                    StatTileData("Biggest Loss", Formatters.signedMoney(stats.biggestLoss, currency), profitColor(stats.biggestLoss)),
                ),
            )
        }

        item { CashVsTournamentCard(stats, currency) }

        item { SectionCard(title = "By game type") { BreakdownList(stats.byGameType, currency) } }
        item { SectionCard(title = "By venue") { BreakdownList(stats.byLocation, currency) } }
        item {
            SectionCard(title = "By stakes (cash)") {
                BreakdownList(stats.byStakes, currency, emptyMessage = "No cash sessions with stakes yet.")
            }
        }
    }
}

@Composable
private fun CashVsTournamentCard(
    stats: com.bankrolledge.app.domain.Statistics,
    currency: String,
) {
    Card(
        Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Row(Modifier.padding(16.dp)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("CASH GAMES", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(
                    Formatters.signedMoney(stats.cashProfit, currency),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = profitColor(stats.cashProfit),
                )
                Text("${stats.cashCount} sessions", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("TOURNAMENTS", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(
                    Formatters.signedMoney(stats.tournamentProfit, currency),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = profitColor(stats.tournamentProfit),
                )
                Text(
                    "${stats.tournamentCount} played • ${Formatters.percent(stats.itmRate)} ITM",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun SectionCard(title: String, content: @Composable () -> Unit) {
    Card(
        Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(bottom = 12.dp),
            )
            content()
        }
    }
}

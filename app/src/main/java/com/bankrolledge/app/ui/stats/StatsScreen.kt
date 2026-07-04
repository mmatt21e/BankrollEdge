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
import com.bankrolledge.app.data.local.entity.SessionEntity
import com.bankrolledge.app.data.model.SessionType
import com.bankrolledge.app.ui.BankrollViewModel
import com.bankrolledge.app.ui.DateRange
import com.bankrolledge.app.ui.components.BarChart
import com.bankrolledge.app.ui.components.BarEntry
import com.bankrolledge.app.ui.components.BreakdownList
import com.bankrolledge.app.ui.components.StatTileData
import com.bankrolledge.app.ui.components.StatTileGrid
import com.bankrolledge.app.ui.theme.LossRed
import com.bankrolledge.app.ui.theme.ProfitGreen
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
                    StatTileData("Streak", streakLabel(stats.currentStreak), profitColor(stats.currentStreak.toDouble())),
                    StatTileData("Best Streak", "${stats.bestWinStreak} wins", MaterialTheme.colorScheme.onSurface),
                ),
            )
        }

        item { BankrollHealthCard(state.bankroll, state.allSessions, currency) }

        item {
            SectionCard(title = "Profit by month") {
                BarChart(
                    entries = stats.byMonth.takeLast(12).map { BarEntry(it.label, it.profit) },
                    topLabel = stats.byMonth.takeLast(12)
                        .maxOfOrNull { kotlin.math.abs(it.profit) }
                        ?.let { Formatters.compactMoney(it, currency) },
                )
            }
        }

        item {
            SectionCard(title = "Profit by hour of day") {
                Text(
                    "When your sessions start vs. how they end up.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 8.dp),
                )
                BarChart(
                    entries = stats.hourlyProfit.mapIndexed { hour, profit ->
                        BarEntry(hourLabel(hour), profit)
                    },
                    height = 140.dp,
                    emptyMessage = "Log sessions to see your best playing hours.",
                )
            }
        }

        item { VarianceCard(stats, currency) }

        item { CashVsTournamentCard(stats, currency) }

        item {
            SectionCard(title = "By day of week") {
                BreakdownList(stats.byWeekday, currency, emptyMessage = "No data yet.")
            }
        }

        item { SectionCard(title = "By game type") { BreakdownList(stats.byGameType, currency) } }
        item { SectionCard(title = "By venue") { BreakdownList(stats.byLocation, currency) } }
        item {
            SectionCard(title = "By stakes (cash)") {
                BreakdownList(stats.byStakes, currency, emptyMessage = "No cash sessions with stakes yet.")
            }
        }
    }
}

/** 0 -> "12a", 6 -> "6a", 12 -> "12p", 18 -> "6p". */
private fun hourLabel(hour: Int): String = when {
    hour == 0 -> "12a"
    hour < 12 -> "${hour}a"
    hour == 12 -> "12p"
    else -> "${hour - 12}p"
}

/**
 * Variance at a glance: swinginess tiles plus a histogram of session results,
 * so a player can see whether their winrate rests on a few big scores.
 */
@Composable
private fun VarianceCard(stats: com.bankrolledge.app.domain.Statistics, currency: String) {
    SectionCard(title = "Variance") {
        StatTileGrid(
            tiles = listOf(
                StatTileData(
                    "Std Dev / Session",
                    Formatters.money(stats.stdDevPerSession, currency),
                    MaterialTheme.colorScheme.onSurface,
                ),
                StatTileData(
                    "Max Downswing",
                    if (stats.maxDrawdown > 0.0) "-${Formatters.money(stats.maxDrawdown, currency)}" else "—",
                    if (stats.maxDrawdown > 0.0) profitColor(-1.0) else MaterialTheme.colorScheme.onSurface,
                ),
                StatTileData("Worst Skid", if (stats.worstLossStreak > 0) "${stats.worstLossStreak} losses" else "—", MaterialTheme.colorScheme.onSurface),
                StatTileData("Best Run", if (stats.bestWinStreak > 0) "${stats.bestWinStreak} wins" else "—", MaterialTheme.colorScheme.onSurface),
            ),
        )
        if (stats.profitBuckets.isNotEmpty()) {
            Text(
                "Session results distribution",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 16.dp, bottom = 4.dp),
            )
            BarChart(
                entries = stats.profitBuckets.map { b ->
                    BarEntry(
                        label = Formatters.compactMoney(if (b.isLossSide) b.lo else b.hi, currency),
                        value = b.count.toDouble(),
                        color = if (b.isLossSide) LossRed else ProfitGreen,
                    )
                },
                height = 110.dp,
                emptyMessage = "",
            )
            Text(
                "Bar height = number of sessions ending in that range.",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

private fun streakLabel(streak: Int): String = when {
    streak > 0 -> "$streak wins"
    streak < 0 -> "${-streak} losses"
    else -> "—"
}

/**
 * Bankroll-management guidance based on the player's most-played cash stakes.
 * Rule of thumb: a 100-big-blind buy-in, comfortable at 40+ buy-ins, adequate
 * at 20–40, at risk below 20.
 */
@Composable
private fun BankrollHealthCard(
    bankroll: Double,
    sessions: List<SessionEntity>,
    currency: String,
) {
    val cashWithStakes = sessions.filter { it.type == SessionType.CASH && it.bigBlind > 0.0 }
    if (cashWithStakes.isEmpty() || bankroll <= 0.0) return

    val topStakes = cashWithStakes
        .groupBy { it.bigBlind }
        .maxBy { it.value.size }
    val bigBlind = topStakes.key
    val stakesLabel = topStakes.value.first().stakesLabel
    val buyIn = bigBlind * 100
    val buyIns = bankroll / buyIn

    val (verdict, advice) = when {
        buyIns >= 40 -> "Healthy" to "You're comfortably rolled — you could consider taking shots at higher stakes."
        buyIns >= 20 -> "Adequate" to "A standard roll for these stakes. Keep logging sessions."
        else -> "At risk" to "Under 20 buy-ins is thin for these stakes — consider moving down until the roll rebuilds."
    }

    Card(
        Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                "BANKROLL HEALTH — $stakesLabel",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                "${String.format("%.0f", buyIns)} buy-ins • $verdict",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = when {
                    buyIns >= 40 -> profitColor(1.0)
                    buyIns >= 20 -> MaterialTheme.colorScheme.onSurface
                    else -> profitColor(-1.0)
                },
            )
            Text(
                "$advice (Assumes a ${Formatters.money(buyIn, currency)} / 100bb buy-in at your most-played stakes.)",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
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

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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.collectAsState
import com.bankrolledge.app.ui.BankrollViewModel
import com.bankrolledge.app.util.DateTimeUtils
import kotlinx.coroutines.delay
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
    onLogTimedSession: (startMillis: Long, durationMinutes: Int) -> Unit,
) {
    val state by viewModel.uiState.collectAsState()
    val timerStart by viewModel.activeTimerStart.collectAsState()
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
            LiveTimerCard(
                timerStart = timerStart,
                onStart = viewModel::startTimer,
                onDiscard = viewModel::clearTimer,
                onStopAndLog = { start ->
                    val now = System.currentTimeMillis()
                    val minutes = ((now - start) / 60_000L).toInt().coerceAtLeast(0)
                    viewModel.clearTimer()
                    onLogTimedSession(start, minutes)
                },
            )
        }

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
private fun LiveTimerCard(
    timerStart: Long,
    onStart: () -> Unit,
    onDiscard: () -> Unit,
    onStopAndLog: (startMillis: Long) -> Unit,
) {
    val running = timerStart > 0L
    Card(
        Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (running) {
                MaterialTheme.colorScheme.primaryContainer
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            },
        ),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (!running) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            "Live session",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            "Start a timer now; we'll fill in the duration when you log it.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Button(onClick = onStart) {
                        Icon(Icons.Filled.PlayArrow, contentDescription = null)
                        Text("  Start")
                    }
                }
            } else {
                // Tick every second while the timer is running.
                val elapsed by produceState(initialValue = elapsedMillis(timerStart), timerStart) {
                    while (true) {
                        value = elapsedMillis(timerStart)
                        delay(1_000)
                    }
                }
                Text(
                    "LIVE SESSION",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
                Text(
                    text = elapsedClock(elapsed),
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
                Text(
                    "Started ${DateTimeUtils.formatDateTime(timerStart)}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(onClick = onDiscard, modifier = Modifier.weight(1f)) {
                        Text("Discard")
                    }
                    Button(onClick = { onStopAndLog(timerStart) }, modifier = Modifier.weight(1f)) {
                        Icon(Icons.Filled.Stop, contentDescription = null)
                        Text("  Stop & log")
                    }
                }
            }
        }
    }
}

private fun elapsedMillis(start: Long): Long =
    (System.currentTimeMillis() - start).coerceAtLeast(0L)

private fun elapsedClock(millis: Long): String {
    val totalSeconds = millis / 1000
    val h = totalSeconds / 3600
    val m = (totalSeconds % 3600) / 60
    val s = totalSeconds % 60
    return String.format("%02d:%02d:%02d", h, m, s)
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

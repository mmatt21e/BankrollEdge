package com.bankrolledge.app.ui.sessions

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Place
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.bankrolledge.app.data.model.GameType
import com.bankrolledge.app.data.model.SessionType
import com.bankrolledge.app.ui.BankrollViewModel
import com.bankrolledge.app.ui.DateRange
import com.bankrolledge.app.ui.components.SessionRow
import com.bankrolledge.app.ui.theme.profitColor
import com.bankrolledge.app.util.Formatters

@Composable
fun SessionsScreen(
    viewModel: BankrollViewModel,
    contentPadding: PaddingValues,
    onSessionClick: (Long) -> Unit,
) {
    val state by viewModel.uiState.collectAsState()
    val currency = state.settings.currency
    val stats = state.filteredStats

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            top = contentPadding.calculateTopPadding() + 12.dp,
            bottom = contentPadding.calculateBottomPadding() + 96.dp,
        ),
    ) {
        item {
            Column(Modifier.padding(horizontal = 16.dp)) {
                Text(
                    text = "Sessions",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                )
                Row(
                    Modifier.padding(top = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        text = "${stats.sessionCount} sessions",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = Formatters.signedMoney(stats.totalProfit, currency),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = profitColor(stats.totalProfit),
                    )
                    Text(
                        text = Formatters.perHour(stats.hourlyRate, currency),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        item {
            FilterBar(
                state = state.filter,
                availableLocations = state.availableLocations,
                onChange = viewModel::setFilter,
            )
        }

        if (state.filteredSessions.isEmpty()) {
            item {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = if (state.allSessions.isEmpty()) {
                            "No sessions yet. Tap + to add one."
                        } else {
                            "No sessions match these filters."
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        } else {
            items(state.filteredSessions, key = { it.id }) { session ->
                SessionRow(
                    session = session,
                    onClick = { onSessionClick(session.id) },
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 5.dp),
                )
            }
        }
    }
}

@Composable
private fun FilterBar(
    state: com.bankrolledge.app.ui.SessionFilter,
    availableLocations: List<String>,
    onChange: (com.bankrolledge.app.ui.SessionFilter) -> Unit,
) {
    Column(Modifier.padding(vertical = 8.dp)) {
        // Session type.
        Row(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            FilterChip(
                selected = state.type == null,
                onClick = { onChange(state.copy(type = null)) },
                label = { Text("All types") },
            )
            SessionType.entries.forEach { type ->
                FilterChip(
                    selected = state.type == type,
                    onClick = { onChange(state.copy(type = if (state.type == type) null else type)) },
                    label = { Text(type.label) },
                )
            }
        }

        // Date range.
        Row(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            DateRange.entries.forEach { range ->
                FilterChip(
                    selected = state.range == range,
                    onClick = { onChange(state.copy(range = range)) },
                    label = { Text(range.label) },
                )
            }
        }

        // Game type + location dropdowns.
        Row(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            GameFilterChip(selected = state.game, onSelect = { onChange(state.copy(game = it)) })
            LocationFilterChip(
                selected = state.location,
                locations = availableLocations,
                onSelect = { onChange(state.copy(location = it)) },
            )
        }
    }
}

@Composable
private fun GameFilterChip(selected: GameType?, onSelect: (GameType?) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        AssistChip(
            onClick = { expanded = true },
            label = { Text(selected?.label ?: "Any game") },
            trailingIcon = { Icon(Icons.Filled.ArrowDropDown, contentDescription = null) },
            colors = if (selected != null) {
                AssistChipDefaults.assistChipColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                )
            } else {
                AssistChipDefaults.assistChipColors()
            },
        )
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(text = { Text("Any game") }, onClick = { onSelect(null); expanded = false })
            GameType.entries.forEach { g ->
                DropdownMenuItem(text = { Text(g.label) }, onClick = { onSelect(g); expanded = false })
            }
        }
    }
}

@Composable
private fun LocationFilterChip(
    selected: String?,
    locations: List<String>,
    onSelect: (String?) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        AssistChip(
            onClick = { expanded = true },
            label = { Text(selected ?: "Any venue") },
            leadingIcon = { Icon(Icons.Filled.Place, contentDescription = null) },
            colors = if (selected != null) {
                AssistChipDefaults.assistChipColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                )
            } else {
                AssistChipDefaults.assistChipColors()
            },
        )
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(text = { Text("Any venue") }, onClick = { onSelect(null); expanded = false })
            locations.forEach { loc ->
                DropdownMenuItem(text = { Text(loc) }, onClick = { onSelect(loc); expanded = false })
            }
        }
    }
}

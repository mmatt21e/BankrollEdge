package com.bankrolledge.app.ui.editor

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.bankrolledge.app.data.AppContainer
import com.bankrolledge.app.data.model.GameType
import com.bankrolledge.app.data.model.SessionType
import com.bankrolledge.app.ui.EditorViewModelFactory
import com.bankrolledge.app.ui.theme.profitColor
import com.bankrolledge.app.util.DateTimeUtils
import com.bankrolledge.app.util.Formatters
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditorScreen(
    container: AppContainer,
    sessionId: Long,
    onDone: () -> Unit,
    startMillis: Long = 0L,
    durationMinutes: Int = 0,
) {
    val viewModel: EditorViewModel = viewModel(
        factory = EditorViewModelFactory(container, sessionId, startMillis, durationMinutes),
    )
    val form by viewModel.state.collectAsState()
    val isTournament = form.sessionType == SessionType.TOURNAMENT
    val profit = viewModel.previewProfit()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (viewModel.isEditing) "Edit session" else "New session") },
                navigationIcon = {
                    IconButton(onClick = onDone) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (viewModel.isEditing) {
                        IconButton(onClick = { viewModel.delete(onDone) }) {
                            Icon(Icons.Filled.Delete, contentDescription = "Delete")
                        }
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // Session type toggle.
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                SessionType.entries.forEachIndexed { index, type ->
                    SegmentedButton(
                        selected = form.sessionType == type,
                        onClick = { viewModel.update { it.copy(sessionType = type) } },
                        shape = SegmentedButtonDefaults.itemShape(index, SessionType.entries.size),
                    ) { Text(type.label) }
                }
            }

            GameDropdown(form.gameType) { viewModel.update { s -> s.copy(gameType = it) } }

            OutlinedTextField(
                value = form.location,
                onValueChange = { viewModel.update { s -> s.copy(location = it) } },
                label = { Text("Venue / location") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            DateTimeRow(
                date = form.date,
                hour = form.startHour,
                minute = form.startMinute,
                onDate = { d -> viewModel.update { it.copy(date = d) } },
                onTime = { h, m -> viewModel.update { it.copy(startHour = h, startMinute = m) } },
            )

            // Duration.
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = form.durationHours,
                    onValueChange = { viewModel.update { s -> s.copy(durationHours = it.filterDigits()) } },
                    label = { Text("Hours") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                )
                OutlinedTextField(
                    value = form.durationMinutesText,
                    onValueChange = { viewModel.update { s -> s.copy(durationMinutesText = it.filterDigits()) } },
                    label = { Text("Minutes") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                )
            }

            // Cash-only blinds.
            if (!isTournament) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    MoneyField("Small blind", form.smallBlind, Modifier.weight(1f)) {
                        viewModel.update { s -> s.copy(smallBlind = it) }
                    }
                    MoneyField("Big blind", form.bigBlind, Modifier.weight(1f)) {
                        viewModel.update { s -> s.copy(bigBlind = it) }
                    }
                }
            }

            // Money in / out.
            MoneyField(
                label = if (isTournament) "Buy-in (entry + fee)" else "Buy-in (total)",
                value = form.buyIn,
            ) { viewModel.update { s -> s.copy(buyIn = it) } }

            MoneyField(
                label = if (isTournament) "Rebuys / add-ons / re-entries" else "Additional buy-ins",
                value = form.rebuysAddons,
            ) { viewModel.update { s -> s.copy(rebuysAddons = it) } }

            MoneyField(
                label = if (isTournament) "Prize won" else "Cash out",
                value = form.cashOut,
            ) { viewModel.update { s -> s.copy(cashOut = it) } }

            MoneyField("Dealer tips", form.tips) { viewModel.update { s -> s.copy(tips = it) } }

            // Tournament placement.
            if (isTournament) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedTextField(
                        value = form.position,
                        onValueChange = { viewModel.update { s -> s.copy(position = it.filterDigits()) } },
                        label = { Text("Finish position") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                    )
                    OutlinedTextField(
                        value = form.fieldSize,
                        onValueChange = { viewModel.update { s -> s.copy(fieldSize = it.filterDigits()) } },
                        label = { Text("Field size") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            OutlinedTextField(
                value = form.notes,
                onValueChange = { viewModel.update { s -> s.copy(notes = it) } },
                label = { Text("Notes") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2,
            )

            // Live profit preview.
            Card(
                Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            ) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Net result", style = MaterialTheme.typography.titleLarge)
                    Text(
                        text = Formatters.signedMoney(profit, form.currency),
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color = profitColor(profit),
                    )
                }
            }

            Button(
                onClick = { viewModel.save(onDone) },
                modifier = Modifier.fillMaxWidth(),
            ) { Text(if (viewModel.isEditing) "Save changes" else "Add session") }
        }
    }
}

@Composable
private fun MoneyField(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    onValueChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = { onValueChange(it.filterDecimal()) },
        label = { Text(label) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        modifier = modifier.fillMaxWidth(),
    )
}

@Composable
private fun GameDropdown(selected: GameType, onSelect: (GameType) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxWidth()) {
        OutlinedButton(
            onClick = { expanded = true },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(selected.label, modifier = Modifier.weight(1f))
            Icon(Icons.Filled.ArrowDropDown, contentDescription = null)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            GameType.entries.forEach { g ->
                DropdownMenuItem(text = { Text(g.label) }, onClick = { onSelect(g); expanded = false })
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DateTimeRow(
    date: LocalDate,
    hour: Int,
    minute: Int,
    onDate: (LocalDate) -> Unit,
    onTime: (Int, Int) -> Unit,
) {
    var showDate by remember { mutableStateOf(false) }
    var showTime by remember { mutableStateOf(false) }

    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedButton(onClick = { showDate = true }, modifier = Modifier.weight(1f)) {
            Text(date.format(java.time.format.DateTimeFormatter.ofPattern("MMM d, yyyy")))
        }
        OutlinedButton(onClick = { showTime = true }, modifier = Modifier.weight(1f)) {
            Text(String.format("%02d:%02d", hour, minute))
        }
    }

    if (showDate) {
        val startMillis = date.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val pickerState = rememberDatePickerState(initialSelectedDateMillis = startMillis)
        DatePickerDialog(
            onDismissRequest = { showDate = false },
            confirmButton = {
                TextButton(onClick = {
                    pickerState.selectedDateMillis?.let { millis ->
                        val picked = Instant.ofEpochMilli(millis).atZone(ZoneId.of("UTC")).toLocalDate()
                        onDate(picked)
                    }
                    showDate = false
                }) { Text("OK") }
            },
            dismissButton = { TextButton(onClick = { showDate = false }) { Text("Cancel") } },
        ) {
            DatePicker(state = pickerState)
        }
    }

    if (showTime) {
        val timeState = rememberTimePickerState(initialHour = hour, initialMinute = minute, is24Hour = false)
        AlertDialog(
            onDismissRequest = { showTime = false },
            confirmButton = {
                TextButton(onClick = { onTime(timeState.hour, timeState.minute); showTime = false }) {
                    Text("OK")
                }
            },
            dismissButton = { TextButton(onClick = { showTime = false }) { Text("Cancel") } },
            text = {
                Box(Modifier.fillMaxWidth().padding(top = 8.dp), contentAlignment = Alignment.Center) {
                    TimePicker(state = timeState)
                }
            },
        )
    }
}

private fun String.filterDigits(): String = filter { it.isDigit() }.take(9)

private fun String.filterDecimal(): String {
    val cleaned = filterIndexed { _, c -> c.isDigit() || c == '.' }
    val firstDot = cleaned.indexOf('.')
    if (firstDot == -1) return cleaned.take(12)
    // Keep only the first dot.
    val head = cleaned.substring(0, firstDot + 1)
    val tail = cleaned.substring(firstDot + 1).replace(".", "")
    return (head + tail).take(12)
}

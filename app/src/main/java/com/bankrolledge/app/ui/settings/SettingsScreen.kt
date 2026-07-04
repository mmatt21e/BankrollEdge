package com.bankrolledge.app.ui.settings

import android.content.Intent
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import com.bankrolledge.app.data.model.SessionType
import com.bankrolledge.app.data.repository.SettingsRepository
import androidx.compose.material3.TextButton
import com.bankrolledge.app.ui.BankrollViewModel
import com.bankrolledge.app.util.BackupManager
import com.bankrolledge.app.util.CsvExporter

private val CURRENCIES = listOf("USD", "EUR", "GBP", "CAD", "AUD", "CHF", "SEK", "BRL", "MXN", "JPY")

@Composable
fun SettingsScreen(
    viewModel: BankrollViewModel,
    contentPadding: PaddingValues,
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(
                start = 16.dp,
                end = 16.dp,
                top = contentPadding.calculateTopPadding() + 12.dp,
                bottom = contentPadding.calculateBottomPadding() + 32.dp,
            ),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = "Settings",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
        )

        // Starting bankroll.
        SettingsCard(title = "Starting bankroll") {
            var text by rememberSaveable(state.settings.startingBankroll) {
                mutableStateOf(
                    if (state.settings.startingBankroll == 0.0) "" else state.settings.startingBankroll.toString(),
                )
            }
            Text(
                "Added to your session profits to show your current bankroll.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(
                Modifier.fillMaxWidth().padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = text,
                    onValueChange = { text = it },
                    label = { Text("Amount (${state.settings.currency})") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.weight(1f),
                )
                Button(
                    onClick = { viewModel.setStartingBankroll(text.toDoubleOrNull() ?: 0.0) },
                ) { Text("Save") }
            }
        }

        // Currency.
        SettingsCard(title = "Default currency") {
            var expanded by remember { mutableStateOf(false) }
            Box {
                OutlinedButton(onClick = { expanded = true }) {
                    Text(state.settings.currency)
                    Icon(Icons.Filled.ArrowDropDown, contentDescription = null)
                }
                DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    CURRENCIES.forEach { code ->
                        DropdownMenuItem(
                            text = { Text(code) },
                            onClick = { viewModel.setCurrency(code); expanded = false },
                        )
                    }
                }
            }
            Text(
                "Applied to new sessions. Existing sessions keep their own currency.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp),
            )
        }

        // Default view mode.
        SettingsCard(title = "Default view") {
            Text(
                "Focus the app on the games you play. Applied to session lists, stats and new sessions.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            SingleChoiceSegmentedButtonRow(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
            ) {
                val options = listOf(
                    SettingsRepository.DEFAULT_TYPE_ALL to "All games",
                    SessionType.CASH.name to "Cash",
                    SessionType.TOURNAMENT.name to "Tourneys",
                )
                options.forEachIndexed { index, (value, label) ->
                    SegmentedButton(
                        selected = state.settings.defaultSessionType == value,
                        onClick = { viewModel.setDefaultSessionType(value) },
                        shape = SegmentedButtonDefaults.itemShape(index, options.size),
                    ) { Text(label) }
                }
            }
        }

        // CSV export & import.
        SettingsCard(title = "CSV export & import") {
            var pendingCsv by remember { mutableStateOf<String?>(null) }
            val pickCsv = rememberLauncherForActivityResult(
                ActivityResultContracts.GetContent(),
            ) { uri ->
                if (uri != null) {
                    val text = runCatching {
                        context.contentResolver.openInputStream(uri)?.use {
                            it.readBytes().toString(Charsets.UTF_8)
                        }
                    }.getOrNull()
                    if (text.isNullOrBlank()) {
                        Toast.makeText(context, "Couldn't read that file.", Toast.LENGTH_LONG).show()
                    } else {
                        pendingCsv = text
                    }
                }
            }

            pendingCsv?.let { csv ->
                AlertDialog(
                    onDismissRequest = { pendingCsv = null },
                    title = { Text("Import sessions?") },
                    text = {
                        Text(
                            "Sessions from this CSV are ADDED to your existing data " +
                                "(nothing is deleted). Rows that can't be read are skipped.",
                        )
                    },
                    confirmButton = {
                        TextButton(onClick = {
                            pendingCsv = null
                            viewModel.importCsv(csv) { message ->
                                Toast.makeText(context, message, Toast.LENGTH_LONG).show()
                            }
                        }) { Text("Import") }
                    },
                    dismissButton = {
                        TextButton(onClick = { pendingCsv = null }) { Text("Cancel") }
                    },
                )
            }

            Text(
                "Export all ${state.allSessions.size} sessions to a spreadsheet-friendly CSV, " +
                    "or import sessions from a previous export.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(
                Modifier.padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                OutlinedButton(
                    onClick = {
                        if (state.allSessions.isEmpty()) return@OutlinedButton
                        val uri = CsvExporter.writeToCache(context, state.allSessions)
                        val share = Intent(Intent.ACTION_SEND).apply {
                            type = "text/csv"
                            putExtra(Intent.EXTRA_STREAM, uri)
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }
                        context.startActivity(Intent.createChooser(share, "Export sessions"))
                    },
                    enabled = state.allSessions.isNotEmpty(),
                ) {
                    Icon(Icons.Filled.Share, contentDescription = null)
                    Text("  Export")
                }
                OutlinedButton(onClick = { pickCsv.launch("*/*") }) { Text("Import CSV") }
            }
        }

        // Backup & restore.
        SettingsCard(title = "Backup & restore") {
            var pendingRestore by remember { mutableStateOf<String?>(null) }
            val pickBackup = rememberLauncherForActivityResult(
                ActivityResultContracts.GetContent(),
            ) { uri ->
                if (uri != null) {
                    val text = runCatching {
                        context.contentResolver.openInputStream(uri)?.use {
                            it.readBytes().toString(Charsets.UTF_8)
                        }
                    }.getOrNull()
                    if (text.isNullOrBlank()) {
                        Toast.makeText(context, "Couldn't read that file.", Toast.LENGTH_LONG).show()
                    } else {
                        pendingRestore = text
                    }
                }
            }

            pendingRestore?.let { json ->
                AlertDialog(
                    onDismissRequest = { pendingRestore = null },
                    title = { Text("Restore backup?") },
                    text = {
                        Text(
                            "This replaces ALL current sessions, transactions and settings " +
                                "with the backup's contents. This can't be undone.",
                        )
                    },
                    confirmButton = {
                        TextButton(onClick = {
                            pendingRestore = null
                            viewModel.restoreBackup(json) { message ->
                                Toast.makeText(context, message, Toast.LENGTH_LONG).show()
                            }
                        }) { Text("Restore", color = MaterialTheme.colorScheme.error) }
                    },
                    dismissButton = {
                        TextButton(onClick = { pendingRestore = null }) { Text("Cancel") }
                    },
                )
            }

            Text(
                "Save everything (sessions, bankroll transactions and settings) to a JSON file, " +
                    "or restore from a previous backup.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(
                Modifier.padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                OutlinedButton(onClick = {
                    val uri = BackupManager.writeToCache(
                        context,
                        BackupManager.Backup(
                            settings = state.settings,
                            sessions = state.allSessions,
                            transactions = state.transactions,
                        ),
                    )
                    val share = Intent(Intent.ACTION_SEND).apply {
                        type = "application/json"
                        putExtra(Intent.EXTRA_STREAM, uri)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    context.startActivity(Intent.createChooser(share, "Save backup"))
                }) { Text("Export backup") }
                OutlinedButton(onClick = { pickBackup.launch("*/*") }) { Text("Restore") }
            }
        }

        SettingsCard(title = "About") {
            Text("BankrollEdge", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
            Text(
                "A poker bankroll tracker for cash games and tournaments. Version 1.0.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun SettingsCard(title: String, content: @Composable () -> Unit) {
    Card(
        Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(bottom = 8.dp),
            )
            content()
        }
    }
}

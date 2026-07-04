package com.bankrolledge.app.ui.bankroll

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.bankrolledge.app.data.local.entity.TransactionEntity
import com.bankrolledge.app.ui.BankrollViewModel
import com.bankrolledge.app.ui.theme.profitColor
import com.bankrolledge.app.util.DateTimeUtils
import com.bankrolledge.app.util.Formatters

/** Manage the bankroll itself: see the balance breakdown, deposit or withdraw
 *  money, and review/delete past transactions. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BankrollScreen(
    viewModel: BankrollViewModel,
    onBack: () -> Unit,
) {
    val state by viewModel.uiState.collectAsState()
    val currency = state.settings.currency

    var amountText by rememberSaveable { mutableStateOf("") }
    var noteText by rememberSaveable { mutableStateOf("") }

    fun submit(isDeposit: Boolean) {
        val amount = amountText.trim().toDoubleOrNull() ?: return
        viewModel.addTransaction(isDeposit, amount, noteText)
        amountText = ""
        noteText = ""
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Bankroll") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                start = 16.dp,
                end = 16.dp,
                top = padding.calculateTopPadding() + 8.dp,
                bottom = padding.calculateBottomPadding() + 32.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item {
                Card(
                    Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                ) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            "CURRENT BANKROLL",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            Formatters.money(state.bankroll, currency),
                            style = MaterialTheme.typography.headlineLarge,
                            fontWeight = FontWeight.Bold,
                        )
                        BreakdownLine("Starting balance", state.settings.startingBankroll, currency)
                        BreakdownLine("Session profit", state.allStats.totalProfit, currency, signed = true)
                        BreakdownLine("Deposits − withdrawals", state.transactionsNet, currency, signed = true)
                    }
                }
            }

            item {
                Card(
                    Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                ) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(
                            "Add money in or out",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.SemiBold,
                        )
                        OutlinedTextField(
                            value = amountText,
                            onValueChange = { new ->
                                amountText = new.filter { it.isDigit() || it == '.' }.take(12)
                            },
                            label = { Text("Amount ($currency)") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.fillMaxWidth(),
                        )
                        OutlinedTextField(
                            value = noteText,
                            onValueChange = { noteText = it },
                            label = { Text("Note (optional)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Button(
                                onClick = { submit(isDeposit = true) },
                                enabled = amountText.toDoubleOrNull()?.let { it > 0 } == true,
                                modifier = Modifier.weight(1f),
                            ) { Text("Deposit") }
                            OutlinedButton(
                                onClick = { submit(isDeposit = false) },
                                enabled = amountText.toDoubleOrNull()?.let { it > 0 } == true,
                                modifier = Modifier.weight(1f),
                            ) { Text("Withdraw") }
                        }
                    }
                }
            }

            if (state.transactions.isNotEmpty()) {
                item {
                    Text(
                        "History",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                    )
                }
                items(state.transactions, key = { it.id }) { tx ->
                    TransactionRow(
                        tx = tx,
                        currency = currency,
                        onDelete = { viewModel.deleteTransaction(tx) },
                    )
                }
            } else {
                item {
                    Text(
                        "No deposits or withdrawals yet. Money you add here is combined with your session results to compute the bankroll.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun BreakdownLine(label: String, amount: Double, currency: String, signed: Boolean = false) {
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            if (signed) Formatters.signedMoney(amount, currency) else Formatters.money(amount, currency),
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
            color = if (signed) profitColor(amount) else MaterialTheme.colorScheme.onSurface,
        )
    }
}

@Composable
private fun TransactionRow(
    tx: TransactionEntity,
    currency: String,
    onDelete: () -> Unit,
) {
    Card(
        Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(start = 16.dp, top = 8.dp, bottom = 8.dp, end = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    if (tx.isDeposit) "Deposit" else "Withdrawal",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    listOf(DateTimeUtils.formatDate(tx.time), tx.note)
                        .filter { it.isNotBlank() }
                        .joinToString(" • "),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                Formatters.signedMoney(tx.signedAmount, currency),
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Bold,
                color = profitColor(tx.signedAmount),
            )
            IconButton(onClick = onDelete) {
                Icon(
                    Icons.Filled.Delete,
                    contentDescription = "Delete transaction",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

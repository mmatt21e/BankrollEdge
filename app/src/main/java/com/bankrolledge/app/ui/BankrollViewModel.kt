package com.bankrolledge.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bankrolledge.app.data.local.entity.SessionEntity
import com.bankrolledge.app.data.local.entity.TransactionEntity
import com.bankrolledge.app.data.model.SessionType
import com.bankrolledge.app.data.repository.AppSettings
import com.bankrolledge.app.data.repository.SessionRepository
import com.bankrolledge.app.data.repository.SettingsRepository
import com.bankrolledge.app.data.repository.TransactionRepository
import com.bankrolledge.app.domain.Statistics
import com.bankrolledge.app.domain.StatsCalculator
import com.bankrolledge.app.util.BackupManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Shared, activity-scoped state for the Dashboard, Sessions and Stats screens:
 * the full session list, the active filter, and the derived statistics.
 */
class BankrollViewModel(
    private val sessionRepository: SessionRepository,
    private val transactionRepository: TransactionRepository,
    private val settingsRepository: SettingsRepository,
) : ViewModel() {

    private val filter = MutableStateFlow(
        SessionFilter(
            type = SessionType.entries.firstOrNull {
                it.name == settingsRepository.settings.value.defaultSessionType
            },
        ),
    )

    val uiState: StateFlow<BankrollUiState> = combine(
        sessionRepository.sessions,
        transactionRepository.transactions,
        settingsRepository.settings,
        filter,
    ) { sessions, transactions, settings, activeFilter ->
        val now = System.currentTimeMillis()
        val filtered = activeFilter.apply(sessions, now)
        BankrollUiState(
            loading = false,
            allSessions = sessions,
            filteredSessions = filtered,
            allStats = StatsCalculator.compute(sessions),
            filteredStats = StatsCalculator.compute(filtered),
            transactions = transactions,
            transactionsNet = transactions.sumOf { it.signedAmount },
            settings = settings,
            filter = activeFilter,
            availableLocations = sessions.map { it.location }
                .filter { it.isNotBlank() }.distinct().sorted(),
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = BankrollUiState(loading = true),
    )

    /** Epoch millis the live-session timer started; 0 = not running. */
    val activeTimerStart: StateFlow<Long> = settingsRepository.activeTimerStart

    fun startTimer() = settingsRepository.startTimer(System.currentTimeMillis())

    fun clearTimer() = settingsRepository.clearTimer()

    fun setFilter(newFilter: SessionFilter) {
        filter.value = newFilter
    }

    fun clearFilter() {
        filter.value = SessionFilter()
    }

    fun deleteSession(session: SessionEntity) {
        viewModelScope.launch { sessionRepository.delete(session) }
    }

    fun addTransaction(isDeposit: Boolean, amount: Double, note: String) {
        if (amount <= 0.0) return
        viewModelScope.launch {
            transactionRepository.add(
                TransactionEntity(
                    type = if (isDeposit) TransactionEntity.TYPE_DEPOSIT else TransactionEntity.TYPE_WITHDRAWAL,
                    amount = amount,
                    time = System.currentTimeMillis(),
                    note = note.trim(),
                ),
            )
        }
    }

    fun deleteTransaction(transaction: TransactionEntity) {
        viewModelScope.launch { transactionRepository.delete(transaction) }
    }

    /** Replaces ALL data with the backup's contents. Caller confirms with the user first. */
    fun restoreBackup(json: String, onResult: (String) -> Unit) {
        viewModelScope.launch {
            try {
                val backup = withContext(Dispatchers.Default) { BackupManager.fromJson(json) }
                sessionRepository.deleteAll()
                transactionRepository.deleteAll()
                backup.sessions.forEach { sessionRepository.upsert(it) }
                backup.transactions.forEach { transactionRepository.add(it) }
                settingsRepository.setStartingBankroll(backup.settings.startingBankroll)
                settingsRepository.setCurrency(backup.settings.currency)
                settingsRepository.setDefaultSessionType(backup.settings.defaultSessionType)
                onResult(
                    "Restored ${backup.sessions.size} sessions and ${backup.transactions.size} transactions.",
                )
            } catch (e: Exception) {
                onResult("Restore failed: ${e.message ?: "not a valid backup file"}")
            }
        }
    }

    fun setStartingBankroll(value: Double) = settingsRepository.setStartingBankroll(value)

    fun setCurrency(code: String) = settingsRepository.setCurrency(code)

    /** Sets the default view mode and applies it to the current filter immediately. */
    fun setDefaultSessionType(value: String) {
        settingsRepository.setDefaultSessionType(value)
        filter.value = filter.value.copy(
            type = SessionType.entries.firstOrNull { it.name == value },
        )
    }
}

data class BankrollUiState(
    val loading: Boolean = false,
    val allSessions: List<SessionEntity> = emptyList(),
    val filteredSessions: List<SessionEntity> = emptyList(),
    val allStats: Statistics = Statistics(),
    val filteredStats: Statistics = Statistics(),
    val transactions: List<TransactionEntity> = emptyList(),
    /** Net deposits minus withdrawals. */
    val transactionsNet: Double = 0.0,
    val settings: AppSettings = AppSettings(),
    val filter: SessionFilter = SessionFilter(),
    val availableLocations: List<String> = emptyList(),
) {
    val bankroll: Double
        get() = allStats.bankroll(settings.startingBankroll, transactionsNet)
}

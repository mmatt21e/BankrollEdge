package com.bankrolledge.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bankrolledge.app.data.local.entity.SessionEntity
import com.bankrolledge.app.data.repository.AppSettings
import com.bankrolledge.app.data.repository.SessionRepository
import com.bankrolledge.app.data.repository.SettingsRepository
import com.bankrolledge.app.domain.Statistics
import com.bankrolledge.app.domain.StatsCalculator
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * Shared, activity-scoped state for the Dashboard, Sessions and Stats screens:
 * the full session list, the active filter, and the derived statistics.
 */
class BankrollViewModel(
    private val sessionRepository: SessionRepository,
    private val settingsRepository: SettingsRepository,
) : ViewModel() {

    private val filter = MutableStateFlow(SessionFilter())

    val uiState: StateFlow<BankrollUiState> = combine(
        sessionRepository.sessions,
        settingsRepository.settings,
        filter,
    ) { sessions, settings, activeFilter ->
        val now = System.currentTimeMillis()
        val filtered = activeFilter.apply(sessions, now)
        BankrollUiState(
            loading = false,
            allSessions = sessions,
            filteredSessions = filtered,
            allStats = StatsCalculator.compute(sessions),
            filteredStats = StatsCalculator.compute(filtered),
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

    fun setStartingBankroll(value: Double) = settingsRepository.setStartingBankroll(value)

    fun setCurrency(code: String) = settingsRepository.setCurrency(code)
}

data class BankrollUiState(
    val loading: Boolean = false,
    val allSessions: List<SessionEntity> = emptyList(),
    val filteredSessions: List<SessionEntity> = emptyList(),
    val allStats: Statistics = Statistics(),
    val filteredStats: Statistics = Statistics(),
    val settings: AppSettings = AppSettings(),
    val filter: SessionFilter = SessionFilter(),
    val availableLocations: List<String> = emptyList(),
)

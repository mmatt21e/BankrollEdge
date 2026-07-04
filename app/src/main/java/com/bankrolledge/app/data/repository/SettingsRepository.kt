package com.bankrolledge.app.data.repository

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** User preferences: starting bankroll and default currency, backed by SharedPreferences. */
class SettingsRepository(context: Context) {

    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val _settings = MutableStateFlow(read())
    val settings: StateFlow<AppSettings> = _settings.asStateFlow()

    /** Epoch millis when the current live session started; 0 = no timer running. */
    private val _activeTimerStart = MutableStateFlow(prefs.getLong(KEY_TIMER_START, 0L))
    val activeTimerStart: StateFlow<Long> = _activeTimerStart.asStateFlow()

    fun startTimer(nowMillis: Long) {
        prefs.edit().putLong(KEY_TIMER_START, nowMillis).apply()
        _activeTimerStart.value = nowMillis
    }

    fun clearTimer() {
        prefs.edit().remove(KEY_TIMER_START).apply()
        _activeTimerStart.value = 0L
    }

    private fun read(): AppSettings = AppSettings(
        startingBankroll = prefs.getFloat(KEY_STARTING_BANKROLL, 0f).toDouble(),
        currency = prefs.getString(KEY_CURRENCY, "USD") ?: "USD",
    )

    fun setStartingBankroll(value: Double) {
        prefs.edit().putFloat(KEY_STARTING_BANKROLL, value.toFloat()).apply()
        _settings.value = read()
    }

    fun setCurrency(code: String) {
        prefs.edit().putString(KEY_CURRENCY, code).apply()
        _settings.value = read()
    }

    companion object {
        const val PREFS_NAME = "bankrolledge_settings"
        private const val KEY_STARTING_BANKROLL = "starting_bankroll"
        private const val KEY_CURRENCY = "currency"
        private const val KEY_TIMER_START = "active_timer_start"
    }
}

data class AppSettings(
    val startingBankroll: Double = 0.0,
    val currency: String = "USD",
)

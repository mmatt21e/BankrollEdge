package com.bankrolledge.app.ui.editor

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bankrolledge.app.data.local.entity.SessionEntity
import com.bankrolledge.app.data.model.GameType
import com.bankrolledge.app.data.model.SessionType
import com.bankrolledge.app.data.repository.SessionRepository
import com.bankrolledge.app.data.repository.SettingsRepository
import com.bankrolledge.app.util.DateTimeUtils
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate

/** Backs the add/edit session form. Numeric fields are held as raw text and
 *  parsed on save so partial input never crashes. */
class EditorViewModel(
    private val sessionId: Long,
    private val sessionRepository: SessionRepository,
    private val settingsRepository: SettingsRepository,
    /** For a new session started from the live timer: when it began (0 = none). */
    private val prefillStartMillis: Long = 0L,
    /** For a new session started from the live timer: elapsed minutes (0 = none). */
    private val prefillDurationMinutes: Int = 0,
) : ViewModel() {

    private val _state = MutableStateFlow(EditorFormState())
    val state: StateFlow<EditorFormState> = _state.asStateFlow()

    val isEditing: Boolean get() = sessionId > 0L

    init {
        viewModelScope.launch {
            val currency = settingsRepository.settings.value.currency
            if (isEditing) {
                sessionRepository.getById(sessionId)?.let { s -> _state.value = s.toFormState() }
            } else {
                val start = if (prefillStartMillis > 0L) prefillStartMillis else System.currentTimeMillis()
                val defaultType = SessionType.entries.firstOrNull {
                    it.name == settingsRepository.settings.value.defaultSessionType
                } ?: SessionType.CASH
                _state.update {
                    it.copy(
                        sessionType = defaultType,
                        currency = currency,
                        date = DateTimeUtils.localDate(start),
                        startHour = DateTimeUtils.hourOf(start),
                        startMinute = DateTimeUtils.minuteOf(start),
                        durationHours = if (prefillDurationMinutes > 0) (prefillDurationMinutes / 60).toString() else "",
                        durationMinutesText = if (prefillDurationMinutes > 0) (prefillDurationMinutes % 60).toString() else "",
                    )
                }
            }
        }
    }

    fun update(transform: (EditorFormState) -> EditorFormState) = _state.update(transform)

    /** Parses the form into a [SessionEntity]. Returns null if it can't be saved. */
    private fun buildEntity(): SessionEntity? {
        val s = _state.value
        val durationMinutes = s.durationHours.toIntOrZero() * 60 + s.durationMinutesText.toIntOrZero()
        val startTime = DateTimeUtils.toEpochMillis(s.date, s.startHour, s.startMinute)
        return SessionEntity(
            id = sessionId,
            sessionType = s.sessionType.name,
            gameType = s.gameType.name,
            location = s.location.trim(),
            startTime = startTime,
            durationMinutes = durationMinutes,
            smallBlind = s.smallBlind.toDoubleOrZero(),
            bigBlind = s.bigBlind.toDoubleOrZero(),
            buyIn = s.buyIn.toDoubleOrZero(),
            rebuysAddons = s.rebuysAddons.toDoubleOrZero(),
            cashOut = s.cashOut.toDoubleOrZero(),
            tips = s.tips.toDoubleOrZero(),
            position = s.position.toIntOrZero(),
            fieldSize = s.fieldSize.toIntOrZero(),
            currency = s.currency,
            notes = s.notes.trim(),
        )
    }

    /** Live profit preview shown on the form. */
    fun previewProfit(): Double = buildEntity()?.profit ?: 0.0

    fun save(onSaved: () -> Unit) {
        val entity = buildEntity() ?: return
        viewModelScope.launch {
            sessionRepository.upsert(entity)
            onSaved()
        }
    }

    fun delete(onDeleted: () -> Unit) {
        if (!isEditing) return
        viewModelScope.launch {
            sessionRepository.getById(sessionId)?.let { sessionRepository.delete(it) }
            onDeleted()
        }
    }

    private fun String.toDoubleOrZero(): Double = trim().toDoubleOrNull() ?: 0.0
    private fun String.toIntOrZero(): Int = trim().toIntOrNull() ?: 0
}

data class EditorFormState(
    val sessionType: SessionType = SessionType.CASH,
    val gameType: GameType = GameType.NLH,
    val location: String = "",
    val date: LocalDate = LocalDate.of(2024, 1, 1),
    val startHour: Int = 18,
    val startMinute: Int = 0,
    val durationHours: String = "",
    val durationMinutesText: String = "",
    val smallBlind: String = "",
    val bigBlind: String = "",
    val buyIn: String = "",
    val rebuysAddons: String = "",
    val cashOut: String = "",
    val tips: String = "",
    val position: String = "",
    val fieldSize: String = "",
    val currency: String = "USD",
    val notes: String = "",
)

private fun SessionEntity.toFormState(): EditorFormState = EditorFormState(
    sessionType = type,
    gameType = game,
    location = location,
    date = DateTimeUtils.localDate(startTime),
    startHour = DateTimeUtils.hourOf(startTime),
    startMinute = DateTimeUtils.minuteOf(startTime),
    durationHours = (durationMinutes / 60).toString(),
    durationMinutesText = (durationMinutes % 60).toString(),
    smallBlind = smallBlind.trimZero(),
    bigBlind = bigBlind.trimZero(),
    buyIn = buyIn.trimZero(),
    rebuysAddons = rebuysAddons.trimZero(),
    cashOut = cashOut.trimZero(),
    tips = tips.trimZero(),
    position = if (position > 0) position.toString() else "",
    fieldSize = if (fieldSize > 0) fieldSize.toString() else "",
    currency = currency,
    notes = notes,
)

private fun Double.trimZero(): String =
    when {
        this == 0.0 -> ""
        this == toLong().toDouble() -> toLong().toString()
        else -> toString()
    }

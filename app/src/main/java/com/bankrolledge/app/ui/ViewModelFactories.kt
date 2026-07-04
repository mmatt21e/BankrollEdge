package com.bankrolledge.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.bankrolledge.app.data.AppContainer
import com.bankrolledge.app.ui.editor.EditorViewModel

/** Builds the shared [BankrollViewModel] from the app container. */
class BankrollViewModelFactory(private val container: AppContainer) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        BankrollViewModel(container.sessionRepository, container.settingsRepository) as T
}

/** Builds an [EditorViewModel] for a given session id (0 = new session).
 *  [startMillis]/[durationMinutes] pre-fill a new session logged from the live timer. */
class EditorViewModelFactory(
    private val container: AppContainer,
    private val sessionId: Long,
    private val startMillis: Long = 0L,
    private val durationMinutes: Int = 0,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        EditorViewModel(
            sessionId,
            container.sessionRepository,
            container.settingsRepository,
            startMillis,
            durationMinutes,
        ) as T
}

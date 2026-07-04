package com.bankrolledge.app.data

import android.content.Context
import com.bankrolledge.app.data.local.AppDatabase
import com.bankrolledge.app.data.repository.SessionRepository
import com.bankrolledge.app.data.repository.SettingsRepository
import com.bankrolledge.app.data.repository.TransactionRepository

/**
 * Simple manual dependency container created once by the Application and read by
 * the ViewModel factory. Avoids pulling in a DI framework for a small app.
 */
class AppContainer(context: Context) {
    private val database: AppDatabase = AppDatabase.getInstance(context)

    val sessionRepository: SessionRepository = SessionRepository(database.sessionDao())
    val transactionRepository: TransactionRepository = TransactionRepository(database.transactionDao())
    val settingsRepository: SettingsRepository = SettingsRepository(context)
}

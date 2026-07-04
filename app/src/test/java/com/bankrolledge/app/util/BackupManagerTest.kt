package com.bankrolledge.app.util

import com.bankrolledge.app.data.local.entity.SessionEntity
import com.bankrolledge.app.data.local.entity.TransactionEntity
import com.bankrolledge.app.data.model.SessionType
import com.bankrolledge.app.data.repository.AppSettings
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class BackupManagerTest {

    @Test
    fun `backup round-trips sessions transactions and settings`() {
        val backup = BackupManager.Backup(
            settings = AppSettings(startingBankroll = 1500.0, currency = "EUR", defaultSessionType = "CASH"),
            sessions = listOf(
                SessionEntity(
                    id = 42,
                    sessionType = SessionType.TOURNAMENT.name,
                    location = "Vegas, NV",
                    notes = "line1\nline2 \"quoted\"",
                    buyIn = 150.0,
                    cashOut = 900.0,
                    position = 3,
                    fieldSize = 220,
                    startTime = 1_700_000_123_456,
                    durationMinutes = 340,
                ),
            ),
            transactions = listOf(
                TransactionEntity(
                    id = 7,
                    type = TransactionEntity.TYPE_WITHDRAWAL,
                    amount = 250.0,
                    time = 1_700_000_999_999,
                    note = "rent",
                ),
            ),
        )

        val restored = BackupManager.fromJson(BackupManager.toJson(backup, exportedAt = 1L))

        assertEquals(backup.settings, restored.settings)
        assertEquals(1, restored.sessions.size)
        val s = restored.sessions.single()
        assertEquals(0L, s.id) // ids are re-assigned on restore
        assertEquals("Vegas, NV", s.location)
        assertEquals("line1\nline2 \"quoted\"", s.notes)
        assertEquals(750.0, s.profit, 1e-9)
        assertEquals(3, s.position)
        assertEquals(340, s.durationMinutes)

        val t = restored.transactions.single()
        assertEquals(-250.0, t.signedAmount, 1e-9)
        assertEquals("rent", t.note)
    }

    @Test
    fun `foreign json is rejected`() {
        assertThrows(IllegalArgumentException::class.java) {
            BackupManager.fromJson("""{"app":"SomethingElse","sessions":[]}""")
        }
    }
}

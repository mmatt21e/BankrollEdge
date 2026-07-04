package com.bankrolledge.app.ui

import com.bankrolledge.app.data.local.entity.SessionEntity
import com.bankrolledge.app.data.model.GameType
import com.bankrolledge.app.data.model.SessionType
import org.junit.Assert.assertEquals
import org.junit.Test

class SessionFilterTest {

    private val now = 1_700_000_000_000

    private val sessions = listOf(
        SessionEntity(
            id = 1,
            sessionType = SessionType.CASH.name,
            gameType = GameType.NLH.name,
            location = "Bellagio",
            notes = "great table",
            startTime = now - 1_000_000,
        ),
        SessionEntity(
            id = 2,
            sessionType = SessionType.TOURNAMENT.name,
            gameType = GameType.PLO.name,
            location = "Home game",
            startTime = now - 90L * 24 * 3_600_000, // ~90 days ago
        ),
    )

    @Test
    fun `no criteria passes everything`() {
        assertEquals(2, SessionFilter().apply(sessions, now).size)
    }

    @Test
    fun `filters by session type`() {
        val result = SessionFilter(type = SessionType.CASH).apply(sessions, now)
        assertEquals(listOf(1L), result.map { it.id })
    }

    @Test
    fun `filters by date range`() {
        val result = SessionFilter(range = DateRange.LAST_30).apply(sessions, now)
        assertEquals(listOf(1L), result.map { it.id })
    }

    @Test
    fun `query matches venue and notes case-insensitively`() {
        assertEquals(1L, SessionFilter(query = "bellagio").apply(sessions, now).single().id)
        assertEquals(1L, SessionFilter(query = "GREAT").apply(sessions, now).single().id)
        assertEquals(2L, SessionFilter(query = "omaha").apply(sessions, now).single().id)
        assertEquals(0, SessionFilter(query = "xyzzy").apply(sessions, now).size)
    }

    @Test
    fun `combined criteria all apply`() {
        val result = SessionFilter(type = SessionType.TOURNAMENT, query = "home").apply(sessions, now)
        assertEquals(listOf(2L), result.map { it.id })
    }
}

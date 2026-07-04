package com.bankrolledge.app.util

import com.bankrolledge.app.data.local.entity.SessionEntity
import com.bankrolledge.app.data.model.GameType
import com.bankrolledge.app.data.model.SessionType
import org.junit.Assert.assertEquals
import org.junit.Test

class CsvImporterTest {

    @Test
    fun `import round-trips our own export`() {
        val original = listOf(
            SessionEntity(
                sessionType = SessionType.CASH.name,
                gameType = GameType.PLO.name,
                location = "Vegas, NV",
                notes = "said \"nice hand\"\nsecond line",
                startTime = 1_700_000_000_000,
                durationMinutes = 185,
                smallBlind = 2.0,
                bigBlind = 5.0,
                buyIn = 500.0,
                rebuysAddons = 200.0,
                cashOut = 950.0,
                tips = 25.0,
                currency = "USD",
            ),
            SessionEntity(
                sessionType = SessionType.TOURNAMENT.name,
                gameType = GameType.NLH.name,
                location = "Home",
                startTime = 1_700_100_000_000,
                durationMinutes = 300,
                buyIn = 100.0,
                cashOut = 0.0,
                position = 15,
                fieldSize = 90,
                currency = "USD",
            ),
        )

        val result = CsvImporter.parse(CsvExporter.buildCsv(original))

        assertEquals(0, result.skippedRows)
        assertEquals(2, result.sessions.size)
        val cash = result.sessions.first { it.type == SessionType.CASH }
        assertEquals("Vegas, NV", cash.location)
        assertEquals("said \"nice hand\"\nsecond line", cash.notes)
        assertEquals(185, cash.durationMinutes)
        assertEquals(2.0, cash.smallBlind, 1e-9)
        assertEquals(5.0, cash.bigBlind, 1e-9)
        assertEquals(225.0, cash.profit, 1e-9) // 950 - 700 - 25
        assertEquals(GameType.PLO, cash.game)

        val mtt = result.sessions.first { it.type == SessionType.TOURNAMENT }
        assertEquals(15, mtt.position)
        assertEquals(90, mtt.fieldSize)
        // Start times survive to the minute (export format drops seconds).
        assertEquals(1_700_100_000_000 / 60_000, mtt.startTime / 60_000)
    }

    @Test
    fun `unparseable rows are skipped not fatal`() {
        val csv = """
            Date,Type,Game,Location,Stakes,DurationMinutes,BuyIn,RebuysAddons,CashOut,Tips,Profit,Position,FieldSize,Currency,Notes
            2026-01-15 19:30,Cash Game,No-Limit Hold'em,Casino,1/2,120,200,0,350,5,145,0,0,USD,ok
            not-a-date,Cash Game,No-Limit Hold'em,Casino,1/2,120,200,0,350,5,145,0,0,USD,bad
        """.trimIndent()
        val result = CsvImporter.parse(csv)
        assertEquals(1, result.sessions.size)
        assertEquals(1, result.skippedRows)
    }

    @Test
    fun `columns can be reordered`() {
        val csv = """
            BuyIn,CashOut,Date,Type
            100,400,2026-02-01 12:00,Tournament
        """.trimIndent()
        val result = CsvImporter.parse(csv)
        val s = result.sessions.single()
        assertEquals(SessionType.TOURNAMENT, s.type)
        assertEquals(300.0, s.profit, 1e-9)
    }

    @Test
    fun `missing date column is rejected`() {
        var failed = false
        try {
            CsvImporter.parse("Foo,Bar\n1,2")
        } catch (_: IllegalArgumentException) {
            failed = true
        }
        assertEquals(true, failed)
    }
}

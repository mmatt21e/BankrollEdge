package com.bankrolledge.app.domain

import com.bankrolledge.app.data.local.entity.SessionEntity
import com.bankrolledge.app.data.model.SessionType
import org.junit.Assert.assertEquals
import org.junit.Test

class StatsCalculatorTest {

    private fun cash(
        buyIn: Double,
        cashOut: Double,
        minutes: Int = 60,
        tips: Double = 0.0,
        start: Long = 1_700_000_000_000,
        bigBlind: Double = 2.0,
    ) = SessionEntity(
        sessionType = SessionType.CASH.name,
        buyIn = buyIn,
        cashOut = cashOut,
        durationMinutes = minutes,
        tips = tips,
        startTime = start,
        smallBlind = bigBlind / 2,
        bigBlind = bigBlind,
    )

    private fun tournament(
        buyIn: Double,
        prize: Double,
        start: Long = 1_700_000_000_000,
    ) = SessionEntity(
        sessionType = SessionType.TOURNAMENT.name,
        buyIn = buyIn,
        cashOut = prize,
        durationMinutes = 120,
        startTime = start,
    )

    @Test
    fun `profit sums cashouts minus investments and tips`() {
        val stats = StatsCalculator.compute(
            listOf(
                cash(buyIn = 100.0, cashOut = 250.0, tips = 10.0), // +140
                cash(buyIn = 200.0, cashOut = 50.0),               // -150
            ),
        )
        assertEquals(-10.0, stats.totalProfit, 1e-9)
        assertEquals(300.0, stats.totalInvested, 1e-9)
        assertEquals(1, stats.winningSessions)
        assertEquals(140.0, stats.biggestWin, 1e-9)
        assertEquals(-150.0, stats.biggestLoss, 1e-9)
    }

    @Test
    fun `hourly rate ignores profit from untimed sessions`() {
        // The classic complaint about other trackers: a big win with no hours
        // logged should NOT inflate $/hr.
        val stats = StatsCalculator.compute(
            listOf(
                cash(buyIn = 100.0, cashOut = 200.0, minutes = 120), // +100 in 2h
                cash(buyIn = 100.0, cashOut = 1100.0, minutes = 0),  // +1000, untimed
            ),
        )
        assertEquals(2.0, stats.totalHours, 1e-9)
        assertEquals(50.0, stats.hourlyRate, 1e-9) // 100 / 2h, not 1100 / 2h
        assertEquals(1100.0, stats.totalProfit, 1e-9) // profit still counts everything
    }

    @Test
    fun `roi and win rate`() {
        val stats = StatsCalculator.compute(
            listOf(
                tournament(buyIn = 100.0, prize = 300.0), // +200
                tournament(buyIn = 100.0, prize = 0.0),   // -100
            ),
        )
        assertEquals(0.5, stats.roi, 1e-9) // +100 on 200 invested
        assertEquals(0.5, stats.winRate, 1e-9)
        assertEquals(0.5, stats.itmRate, 1e-9)
        assertEquals(2, stats.tournamentCount)
        assertEquals(1, stats.tournamentsCashed)
    }

    @Test
    fun `streaks track consecutive results in chronological order`() {
        val t0 = 1_700_000_000_000
        val hour = 3_600_000L
        val stats = StatsCalculator.compute(
            listOf(
                cash(100.0, 200.0, start = t0),            // W
                cash(100.0, 300.0, start = t0 + hour),     // W
                cash(100.0, 400.0, start = t0 + 2 * hour), // W
                cash(100.0, 0.0, start = t0 + 3 * hour),   // L
                cash(100.0, 0.0, start = t0 + 4 * hour),   // L
            ),
        )
        assertEquals(3, stats.bestWinStreak)
        assertEquals(-2, stats.currentStreak)
    }

    @Test
    fun `cumulative series is chronological even when input is not`() {
        val t0 = 1_700_000_000_000
        val later = t0 + 86_400_000L
        val stats = StatsCalculator.compute(
            listOf(
                cash(100.0, 0.0, start = later), // -100 (second)
                cash(100.0, 400.0, start = t0),  // +300 (first)
            ),
        )
        assertEquals(2, stats.cumulative.size)
        assertEquals(300.0, stats.cumulative[0].cumulative, 1e-9)
        assertEquals(200.0, stats.cumulative[1].cumulative, 1e-9)
    }

    @Test
    fun `bankroll adds starting balance and transactions`() {
        val stats = StatsCalculator.compute(listOf(cash(100.0, 250.0))) // +150
        assertEquals(1650.0, stats.bankroll(1000.0, 500.0), 1e-9)
    }

    @Test
    fun `empty input yields zeroed stats`() {
        val stats = StatsCalculator.compute(emptyList())
        assertEquals(0, stats.sessionCount)
        assertEquals(0.0, stats.hourlyRate, 1e-9)
        assertEquals(0.0, stats.roi, 1e-9)
        assertEquals(0, stats.byMonth.size)
    }
}

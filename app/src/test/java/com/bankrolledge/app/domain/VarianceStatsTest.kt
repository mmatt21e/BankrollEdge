package com.bankrolledge.app.domain

import com.bankrolledge.app.data.local.entity.SessionEntity
import com.bankrolledge.app.data.model.SessionType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneId
import java.time.ZonedDateTime

class VarianceStatsTest {

    private fun cashAt(profit: Double, start: Long) = SessionEntity(
        sessionType = SessionType.CASH.name,
        buyIn = 100.0,
        cashOut = 100.0 + profit,
        durationMinutes = 60,
        startTime = start,
    )

    private val t0 = 1_700_000_000_000
    private val hour = 3_600_000L

    @Test
    fun `std dev of symmetric results`() {
        // Profits +100 and -100: mean 0, population std dev 100.
        val stats = StatsCalculator.compute(
            listOf(cashAt(100.0, t0), cashAt(-100.0, t0 + hour)),
        )
        assertEquals(100.0, stats.stdDevPerSession, 1e-9)
    }

    @Test
    fun `max drawdown is deepest peak-to-trough fall`() {
        // Cumulative: 100 -> 300 -> 50 -> 150. Deepest fall: 300 -> 50 = 250.
        val stats = StatsCalculator.compute(
            listOf(
                cashAt(100.0, t0),
                cashAt(200.0, t0 + hour),
                cashAt(-250.0, t0 + 2 * hour),
                cashAt(100.0, t0 + 3 * hour),
            ),
        )
        assertEquals(250.0, stats.maxDrawdown, 1e-9)
    }

    @Test
    fun `drawdown from losing straight away counts from zero`() {
        val stats = StatsCalculator.compute(listOf(cashAt(-80.0, t0)))
        assertEquals(80.0, stats.maxDrawdown, 1e-9)
    }

    @Test
    fun `worst loss streak tracked separately from current`() {
        // L L L W L → worst skid 3, current -1.
        val stats = StatsCalculator.compute(
            listOf(
                cashAt(-10.0, t0),
                cashAt(-10.0, t0 + hour),
                cashAt(-10.0, t0 + 2 * hour),
                cashAt(50.0, t0 + 3 * hour),
                cashAt(-10.0, t0 + 4 * hour),
            ),
        )
        assertEquals(3, stats.worstLossStreak)
        assertEquals(-1, stats.currentStreak)
    }

    @Test
    fun `hourly profit lands in the start hour bucket`() {
        val eightPm = ZonedDateTime.of(2026, 3, 10, 20, 15, 0, 0, ZoneId.systemDefault())
            .toInstant().toEpochMilli()
        val stats = StatsCalculator.compute(listOf(cashAt(75.0, eightPm)))
        assertEquals(75.0, stats.hourlyProfit[20], 1e-9)
        assertEquals(0.0, stats.hourlyProfit[19], 1e-9)
    }

    @Test
    fun `profit buckets cover wins and losses with outliers clamped`() {
        val stats = StatsCalculator.compute(
            listOf(
                cashAt(10_000.0, t0),          // extreme win → clamps to top bucket
                cashAt(50.0, t0 + hour),
                cashAt(-40.0, t0 + 2 * hour),
            ),
        )
        assertEquals(6, stats.profitBuckets.size)
        assertEquals(3, stats.profitBuckets.sumOf { it.count })
        assertTrue(stats.profitBuckets.last().count >= 1) // the outlier
        assertTrue(stats.profitBuckets.first { it.isLossSide && it.count > 0 }.count == 1)
    }
}

package com.bankrolledge.app.domain

import com.bankrolledge.app.data.local.entity.SessionEntity
import com.bankrolledge.app.data.model.SessionType
import java.time.DayOfWeek
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/** A single point on the cumulative-profit graph. */
data class ProfitPoint(
    val time: Long,
    val cumulative: Double,
)

/** Profit summed over one calendar month; [sortKey] is year*100+month for ordering. */
data class MonthlyProfit(
    val label: String,
    val profit: Double,
    val sessionCount: Int,
    val sortKey: Int,
)

/** Aggregate stats for an arbitrary group of sessions (a game type, a venue, ...). */
data class GroupStat(
    val key: String,
    val sessionCount: Int,
    val profit: Double,
    val hours: Double,
) {
    val hourlyRate: Double get() = if (hours > 0.0) profit / hours else 0.0
}

/** Everything the dashboard and stats screens need, computed from a session list. */
data class Statistics(
    val sessionCount: Int = 0,
    val totalProfit: Double = 0.0,
    val totalInvested: Double = 0.0,
    val totalHours: Double = 0.0,
    val winningSessions: Int = 0,
    val biggestWin: Double = 0.0,
    val biggestLoss: Double = 0.0,
    val cashCount: Int = 0,
    val cashProfit: Double = 0.0,
    val tournamentCount: Int = 0,
    val tournamentProfit: Double = 0.0,
    val tournamentsCashed: Int = 0,
    /** Profit from sessions that have a logged duration — used for the hourly rate
     *  so untimed sessions can't inflate it (a common complaint with other trackers). */
    val timedProfit: Double = 0.0,
    /** Consecutive winning (positive) or losing (negative) sessions ending at the latest one. */
    val currentStreak: Int = 0,
    val bestWinStreak: Int = 0,
    val cumulative: List<ProfitPoint> = emptyList(),
    val byGameType: List<GroupStat> = emptyList(),
    val byLocation: List<GroupStat> = emptyList(),
    val byStakes: List<GroupStat> = emptyList(),
    val byMonth: List<MonthlyProfit> = emptyList(),
    val byWeekday: List<GroupStat> = emptyList(),
) {
    val hourlyRate: Double get() = if (totalHours > 0.0) timedProfit / totalHours else 0.0
    val avgProfit: Double get() = if (sessionCount > 0) totalProfit / sessionCount else 0.0
    val roi: Double get() = if (totalInvested > 0.0) totalProfit / totalInvested else 0.0
    val winRate: Double get() = if (sessionCount > 0) winningSessions.toDouble() / sessionCount else 0.0
    val itmRate: Double get() = if (tournamentCount > 0) tournamentsCashed.toDouble() / tournamentCount else 0.0

    /** Bankroll = starting balance + session profits + net deposits/withdrawals. */
    fun bankroll(startingBankroll: Double, transactionsNet: Double = 0.0): Double =
        startingBankroll + totalProfit + transactionsNet
}

object StatsCalculator {

    /**
     * Computes [Statistics] for the given sessions. The cumulative series is built
     * in chronological order regardless of the input ordering.
     */
    fun compute(sessions: List<SessionEntity>): Statistics {
        if (sessions.isEmpty()) return Statistics()

        var totalProfit = 0.0
        var totalInvested = 0.0
        var totalMinutes = 0
        var timedProfit = 0.0
        var winning = 0
        var biggestWin = Double.NEGATIVE_INFINITY
        var biggestLoss = Double.POSITIVE_INFINITY
        var cashCount = 0
        var cashProfit = 0.0
        var tournamentCount = 0
        var tournamentProfit = 0.0
        var tournamentsCashed = 0

        for (s in sessions) {
            val p = s.profit
            totalProfit += p
            totalInvested += s.totalInvested
            totalMinutes += s.durationMinutes
            if (s.durationMinutes > 0) timedProfit += p
            if (p > 0.0) winning++
            if (p > biggestWin) biggestWin = p
            if (p < biggestLoss) biggestLoss = p
            when (s.type) {
                SessionType.CASH -> {
                    cashCount++
                    cashProfit += p
                }
                SessionType.TOURNAMENT -> {
                    tournamentCount++
                    tournamentProfit += p
                    if (s.cashed) tournamentsCashed++
                }
            }
        }

        val chronological = sessions.sortedBy { it.startTime }
        var running = 0.0
        val cumulative = chronological.map { s ->
            running += s.profit
            ProfitPoint(time = s.startTime, cumulative = running)
        }

        // Win/loss streaks over chronological results (break-even ends a streak).
        var bestWinStreak = 0
        var runStreak = 0
        for (s in chronological) {
            runStreak = when {
                s.profit > 0.0 -> if (runStreak > 0) runStreak + 1 else 1
                s.profit < 0.0 -> if (runStreak < 0) runStreak - 1 else -1
                else -> 0
            }
            if (runStreak > bestWinStreak) bestWinStreak = runStreak
        }

        return Statistics(
            sessionCount = sessions.size,
            totalProfit = totalProfit,
            totalInvested = totalInvested,
            totalHours = totalMinutes / 60.0,
            winningSessions = winning,
            biggestWin = if (biggestWin == Double.NEGATIVE_INFINITY) 0.0 else biggestWin,
            biggestLoss = if (biggestLoss == Double.POSITIVE_INFINITY) 0.0 else biggestLoss,
            cashCount = cashCount,
            cashProfit = cashProfit,
            tournamentCount = tournamentCount,
            tournamentProfit = tournamentProfit,
            tournamentsCashed = tournamentsCashed,
            timedProfit = timedProfit,
            currentStreak = runStreak,
            bestWinStreak = bestWinStreak,
            cumulative = cumulative,
            byGameType = groupBy(sessions) { it.game.label },
            byLocation = groupBy(sessions) { it.location.ifBlank { "Unspecified" } },
            byStakes = groupBy(sessions.filter { it.type == SessionType.CASH }) {
                it.stakesLabel.ifBlank { "Other" }
            },
            byMonth = monthlyProfits(chronological),
            byWeekday = weekdayProfits(sessions),
        )
    }

    private fun monthlyProfits(chronological: List<SessionEntity>): List<MonthlyProfit> =
        chronological
            .groupBy { s ->
                val d = Instant.ofEpochMilli(s.startTime).atZone(ZoneId.systemDefault())
                d.year * 100 + d.monthValue
            }
            .map { (sortKey, list) ->
                val d = Instant.ofEpochMilli(list.first().startTime).atZone(ZoneId.systemDefault())
                MonthlyProfit(
                    label = d.format(MONTH_FMT),
                    profit = list.sumOf { it.profit },
                    sessionCount = list.size,
                    sortKey = sortKey,
                )
            }
            .sortedBy { it.sortKey }

    private fun weekdayProfits(sessions: List<SessionEntity>): List<GroupStat> {
        val byDay = sessions.groupBy {
            Instant.ofEpochMilli(it.startTime).atZone(ZoneId.systemDefault()).dayOfWeek
        }
        return DayOfWeek.entries.mapNotNull { day ->
            val list = byDay[day] ?: return@mapNotNull null
            GroupStat(
                key = day.getDisplayName(TextStyle.FULL, Locale.getDefault()),
                sessionCount = list.size,
                profit = list.sumOf { it.profit },
                hours = list.sumOf { it.durationMinutes } / 60.0,
            )
        }
    }

    private val MONTH_FMT = DateTimeFormatter.ofPattern("MMM ''yy")

    private inline fun groupBy(
        sessions: List<SessionEntity>,
        keySelector: (SessionEntity) -> String,
    ): List<GroupStat> =
        sessions.groupBy(keySelector).map { (key, list) ->
            GroupStat(
                key = key,
                sessionCount = list.size,
                profit = list.sumOf { it.profit },
                hours = list.sumOf { it.durationMinutes } / 60.0,
            )
        }.sortedByDescending { it.profit }
}

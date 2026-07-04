package com.bankrolledge.app.ui

import com.bankrolledge.app.data.local.entity.SessionEntity
import com.bankrolledge.app.data.model.GameType
import com.bankrolledge.app.data.model.SessionType
import com.bankrolledge.app.util.DateTimeUtils
import java.time.ZoneId

enum class DateRange(val label: String) {
    ALL("All time"),
    THIS_MONTH("This month"),
    LAST_30("Last 30 days"),
    THIS_YEAR("This year"),
}

/** Criteria applied to the session list on the Sessions and Stats screens. */
data class SessionFilter(
    val type: SessionType? = null,
    val game: GameType? = null,
    val location: String? = null,
    val range: DateRange = DateRange.ALL,
    /** Free-text search over venue, notes and game name. */
    val query: String = "",
) {
    val isActive: Boolean
        get() = type != null || game != null || location != null ||
            range != DateRange.ALL || query.isNotBlank()

    fun apply(sessions: List<SessionEntity>, now: Long): List<SessionEntity> {
        val from = rangeStart(now)
        val q = query.trim()
        return sessions.filter { s ->
            (type == null || s.type == type) &&
                (game == null || s.game == game) &&
                (location == null || s.location == location) &&
                (from == null || s.startTime >= from) &&
                (q.isEmpty() || s.matches(q))
        }
    }

    private fun SessionEntity.matches(q: String): Boolean =
        location.contains(q, ignoreCase = true) ||
            notes.contains(q, ignoreCase = true) ||
            game.label.contains(q, ignoreCase = true) ||
            stakesLabel.contains(q, ignoreCase = true)

    private fun rangeStart(now: Long): Long? {
        val today = DateTimeUtils.localDate(now)
        val zone = ZoneId.systemDefault()
        return when (range) {
            DateRange.ALL -> null
            DateRange.LAST_30 -> now - 30L * 24 * 60 * 60 * 1000
            DateRange.THIS_MONTH ->
                today.withDayOfMonth(1).atStartOfDay(zone).toInstant().toEpochMilli()
            DateRange.THIS_YEAR ->
                today.withDayOfYear(1).atStartOfDay(zone).toInstant().toEpochMilli()
        }
    }
}

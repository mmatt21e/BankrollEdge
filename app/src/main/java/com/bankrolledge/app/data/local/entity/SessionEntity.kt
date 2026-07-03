package com.bankrolledge.app.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.bankrolledge.app.data.model.GameType
import com.bankrolledge.app.data.model.SessionType

/**
 * A single logged poker session. Covers both cash games and tournaments; the
 * relevant fields are populated depending on [sessionType]. Money values are
 * stored as plain Doubles in the session's [currency].
 */
@Entity(tableName = "sessions")
data class SessionEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "session_type")
    val sessionType: String = SessionType.CASH.name,

    @ColumnInfo(name = "game_type")
    val gameType: String = GameType.NLH.name,

    val location: String = "",

    /** Session start, epoch millis. Used for ordering and the profit graph. */
    @ColumnInfo(name = "start_time")
    val startTime: Long = 0L,

    /** Duration in minutes (entered directly or derived from a live timer). */
    @ColumnInfo(name = "duration_minutes")
    val durationMinutes: Int = 0,

    // --- Cash game stakes (blinds). Ignored for tournaments. ---
    @ColumnInfo(name = "small_blind")
    val smallBlind: Double = 0.0,
    @ColumnInfo(name = "big_blind")
    val bigBlind: Double = 0.0,

    // --- Money in / out. Meaning depends on session type. ---
    /** Cash: total bought in. Tournament: entry buy-in + fee for the first bullet. */
    @ColumnInfo(name = "buy_in")
    val buyIn: Double = 0.0,
    /** Extra money in: tournament rebuys/re-entries/add-ons, or cash top-ups. */
    @ColumnInfo(name = "rebuys_addons")
    val rebuysAddons: Double = 0.0,
    /** Cash: amount cashed out. Tournament: prize won (0 if no cash). */
    @ColumnInfo(name = "cash_out")
    val cashOut: Double = 0.0,
    /** Dealer tips / tokes paid, deducted from profit. */
    val tips: Double = 0.0,

    // --- Tournament-specific ---
    /** Finishing position (0 = not set / didn't cash). */
    val position: Int = 0,
    /** Number of entrants in the tournament (0 = unknown). */
    @ColumnInfo(name = "field_size")
    val fieldSize: Int = 0,

    val currency: String = "USD",
    val notes: String = "",
) {
    val type: SessionType get() = SessionType.fromName(sessionType)
    val game: GameType get() = GameType.fromName(gameType)

    /** Total money invested in the session. */
    val totalInvested: Double get() = buyIn + rebuysAddons

    /** Net result: what came back minus what went in and tips. */
    val profit: Double get() = cashOut - totalInvested - tips

    val durationHours: Double get() = durationMinutes / 60.0

    val isWin: Boolean get() = profit > 0.0

    /** Tournament: did this session finish in the money? */
    val cashed: Boolean get() = cashOut > 0.0

    /** "1/2", "2/5" style label for cash games; empty otherwise. */
    val stakesLabel: String
        get() = if (type == SessionType.CASH && bigBlind > 0.0) {
            "${trimAmount(smallBlind)}/${trimAmount(bigBlind)}"
        } else {
            ""
        }

    private fun trimAmount(value: Double): String =
        if (value == value.toLong().toDouble()) value.toLong().toString() else value.toString()
}

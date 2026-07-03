package com.bankrolledge.app.data.model

/** Whether a session is a ring/cash game or a tournament. */
enum class SessionType(val label: String) {
    CASH("Cash Game"),
    TOURNAMENT("Tournament");

    companion object {
        fun fromName(name: String?): SessionType =
            entries.firstOrNull { it.name == name } ?: CASH
    }
}

/** Poker variant played during a session. */
enum class GameType(val label: String) {
    NLH("No-Limit Hold'em"),
    PLO("Pot-Limit Omaha"),
    PLO5("5-Card PLO"),
    LHE("Limit Hold'em"),
    MIXED("Mixed Games"),
    STUD("Seven-Card Stud"),
    OTHER("Other");

    companion object {
        fun fromName(name: String?): GameType =
            entries.firstOrNull { it.name == name } ?: NLH
    }
}

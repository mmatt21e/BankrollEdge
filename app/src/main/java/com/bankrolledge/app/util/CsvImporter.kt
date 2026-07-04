package com.bankrolledge.app.util

import com.bankrolledge.app.data.local.entity.SessionEntity
import com.bankrolledge.app.data.model.GameType
import com.bankrolledge.app.data.model.SessionType
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Imports sessions from CSV in the same format [CsvExporter] produces.
 * Column matching is by header name (case-insensitive), so re-ordered or
 * partially-edited spreadsheets still import; unknown columns are ignored.
 * Rows that can't be parsed are counted, not fatal.
 */
object CsvImporter {

    data class Result(
        val sessions: List<SessionEntity>,
        val skippedRows: Int,
    )

    private val DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")

    /** @throws IllegalArgumentException if the header has no Date column. */
    fun parse(csv: String): Result {
        val records = tokenize(csv)
        if (records.isEmpty()) return Result(emptyList(), 0)

        val header = records.first().map { it.trim().lowercase() }
        val col = header.withIndex().associate { (i, name) -> name to i }
        require("date" in col) { "No 'Date' column found — is this a BankrollEdge CSV export?" }

        fun record(row: List<String>, name: String): String =
            col[name]?.let { row.getOrNull(it) }?.trim() ?: ""

        val sessions = mutableListOf<SessionEntity>()
        var skipped = 0
        for (row in records.drop(1)) {
            if (row.all { it.isBlank() }) continue
            val startTime = parseDate(record(row, "date"))
            if (startTime == null) {
                skipped++
                continue
            }
            val stakes = parseStakes(record(row, "stakes"))
            sessions += SessionEntity(
                sessionType = parseType(record(row, "type")).name,
                gameType = parseGame(record(row, "game")).name,
                location = record(row, "location"),
                startTime = startTime,
                durationMinutes = record(row, "durationminutes").toIntOrNull() ?: 0,
                smallBlind = stakes?.first ?: 0.0,
                bigBlind = stakes?.second ?: 0.0,
                buyIn = record(row, "buyin").toDoubleOrNull() ?: 0.0,
                rebuysAddons = record(row, "rebuysaddons").toDoubleOrNull() ?: 0.0,
                cashOut = record(row, "cashout").toDoubleOrNull() ?: 0.0,
                tips = record(row, "tips").toDoubleOrNull() ?: 0.0,
                position = record(row, "position").toIntOrNull() ?: 0,
                fieldSize = record(row, "fieldsize").toIntOrNull() ?: 0,
                currency = record(row, "currency").ifBlank { "USD" },
                notes = record(row, "notes"),
            )
        }
        return Result(sessions, skipped)
    }

    private fun parseDate(value: String): Long? = try {
        LocalDateTime.parse(value, DATE_FMT)
            .atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
    } catch (_: Exception) {
        null
    }

    private fun parseType(value: String): SessionType =
        SessionType.entries.firstOrNull {
            it.name.equals(value, ignoreCase = true) || it.label.equals(value, ignoreCase = true)
        } ?: if (value.contains("tourn", ignoreCase = true)) SessionType.TOURNAMENT else SessionType.CASH

    private fun parseGame(value: String): GameType =
        GameType.entries.firstOrNull {
            it.name.equals(value, ignoreCase = true) || it.label.equals(value, ignoreCase = true)
        } ?: GameType.OTHER

    /** "1/2" or "0.5/1" → small/big blind. */
    private fun parseStakes(value: String): Pair<Double, Double>? {
        val parts = value.split('/')
        if (parts.size != 2) return null
        val sb = parts[0].trim().toDoubleOrNull() ?: return null
        val bb = parts[1].trim().toDoubleOrNull() ?: return null
        return sb to bb
    }

    /**
     * RFC-4180-style tokenizer: quoted fields may contain commas, escaped
     * quotes ("") and newlines. Returns one list of fields per record.
     */
    private fun tokenize(csv: String): List<List<String>> {
        val records = mutableListOf<List<String>>()
        var fields = mutableListOf<String>()
        val field = StringBuilder()
        var inQuotes = false
        var i = 0

        fun endField() {
            fields.add(field.toString())
            field.setLength(0)
        }

        fun endRecord() {
            endField()
            // Skip records that are entirely empty (e.g. trailing newline).
            if (fields.size > 1 || fields[0].isNotEmpty()) records.add(fields)
            fields = mutableListOf()
        }

        while (i < csv.length) {
            val c = csv[i]
            when {
                inQuotes -> when {
                    c == '"' && i + 1 < csv.length && csv[i + 1] == '"' -> {
                        field.append('"'); i++
                    }
                    c == '"' -> inQuotes = false
                    else -> field.append(c)
                }
                c == '"' -> inQuotes = true
                c == ',' -> endField()
                c == '\r' -> { /* swallow; \n ends the record */ }
                c == '\n' -> endRecord()
                else -> field.append(c)
            }
            i++
        }
        if (field.isNotEmpty() || fields.isNotEmpty()) endRecord()
        return records
    }
}

package com.bankrolledge.app.util

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** Small wrappers around java.time so screens don't repeat zone/formatter boilerplate. */
object DateTimeUtils {

    private val dateFmt: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d, yyyy")
    private val dateTimeFmt: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d, yyyy • h:mm a")
    private val isoFmt: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")

    private fun dateTime(epochMillis: Long): LocalDateTime =
        Instant.ofEpochMilli(epochMillis).atZone(ZoneId.systemDefault()).toLocalDateTime()

    fun formatDate(epochMillis: Long): String = dateTime(epochMillis).format(dateFmt)

    fun formatDateTime(epochMillis: Long): String = dateTime(epochMillis).format(dateTimeFmt)

    fun formatIso(epochMillis: Long): String = dateTime(epochMillis).format(isoFmt)

    fun toEpochMillis(date: LocalDate, hour: Int, minute: Int): Long =
        date.atTime(hour, minute).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()

    fun localDate(epochMillis: Long): LocalDate =
        Instant.ofEpochMilli(epochMillis).atZone(ZoneId.systemDefault()).toLocalDate()

    fun hourOf(epochMillis: Long): Int = dateTime(epochMillis).hour

    fun minuteOf(epochMillis: Long): Int = dateTime(epochMillis).minute
}

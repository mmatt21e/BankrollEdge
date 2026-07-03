package com.bankrolledge.app.util

import java.text.NumberFormat
import java.util.Currency
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToLong

/** Formatting helpers for money, percentages, durations and dates. */
object Formatters {

    private fun currencyFormat(code: String): NumberFormat =
        NumberFormat.getCurrencyInstance(Locale.getDefault()).apply {
            try {
                currency = Currency.getInstance(code)
            } catch (_: IllegalArgumentException) {
                // Leave the locale default currency if the code is unknown.
            }
            maximumFractionDigits = 2
            minimumFractionDigits = 2
        }

    /** e.g. "$1,250.00" — no explicit sign. */
    fun money(amount: Double, code: String): String = currencyFormat(code).format(amount)

    /** e.g. "+$1,250.00" / "-$40.00" — always shows the sign, good for profit/loss. */
    fun signedMoney(amount: Double, code: String): String {
        val formatted = currencyFormat(code).format(abs(amount))
        val sign = if (amount < 0) "-" else "+"
        return "$sign$formatted"
    }

    /** Compact money for chart axes: $1.2k, -$3.4k, $850. */
    fun compactMoney(amount: Double, code: String): String {
        val symbol = try {
            Currency.getInstance(code).symbol
        } catch (_: IllegalArgumentException) {
            "$"
        }
        val sign = if (amount < 0) "-" else ""
        val v = abs(amount)
        val body = when {
            v >= 1_000_000 -> String.format(Locale.US, "%.1fM", v / 1_000_000)
            v >= 1_000 -> String.format(Locale.US, "%.1fk", v / 1_000)
            else -> v.roundToLong().toString()
        }
        return "$sign$symbol$body"
    }

    /** 0.234 -> "23.4%". */
    fun percent(fraction: Double): String = String.format(Locale.US, "%.1f%%", fraction * 100)

    /** Minutes -> "3h 20m" / "45m". */
    fun duration(minutes: Int): String {
        val h = minutes / 60
        val m = minutes % 60
        return when {
            h > 0 && m > 0 -> "${h}h ${m}m"
            h > 0 -> "${h}h"
            else -> "${m}m"
        }
    }

    /** Hourly rate label, e.g. "$18.50/hr". */
    fun perHour(amount: Double, code: String): String = "${signedMoney(amount, code)}/hr"
}

package com.bankrolledge.app.util

import android.content.Context
import android.net.Uri
import androidx.core.content.FileProvider
import com.bankrolledge.app.data.local.entity.SessionEntity
import java.io.File

/** Serializes sessions to CSV and exposes a shareable content:// Uri. */
object CsvExporter {

    private const val HEADER =
        "Date,Type,Game,Location,Stakes,DurationMinutes,BuyIn,RebuysAddons,CashOut,Tips,Profit,Position,FieldSize,Currency,Notes"

    fun buildCsv(sessions: List<SessionEntity>): String {
        val sb = StringBuilder()
        sb.appendLine(HEADER)
        for (s in sessions.sortedBy { it.startTime }) {
            sb.append(DateTimeUtils.formatIso(s.startTime)).append(',')
            sb.append(s.type.label).append(',')
            sb.append(s.game.label).append(',')
            sb.append(escape(s.location)).append(',')
            sb.append(escape(s.stakesLabel)).append(',')
            sb.append(s.durationMinutes).append(',')
            sb.append(s.buyIn).append(',')
            sb.append(s.rebuysAddons).append(',')
            sb.append(s.cashOut).append(',')
            sb.append(s.tips).append(',')
            sb.append(s.profit).append(',')
            sb.append(s.position).append(',')
            sb.append(s.fieldSize).append(',')
            sb.append(s.currency).append(',')
            sb.append(escape(s.notes))
            sb.append('\n')
        }
        return sb.toString()
    }

    /** Writes the CSV to cacheDir/exports and returns a FileProvider Uri for sharing. */
    fun writeToCache(context: Context, sessions: List<SessionEntity>): Uri {
        val dir = File(context.cacheDir, "exports").apply { mkdirs() }
        val file = File(dir, "bankrolledge_export.csv")
        file.writeText(buildCsv(sessions))
        return FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file,
        )
    }

    private fun escape(value: String): String {
        if (value.isEmpty()) return ""
        val needsQuoting = value.contains(',') || value.contains('"') || value.contains('\n')
        val escaped = value.replace("\"", "\"\"")
        return if (needsQuoting) "\"$escaped\"" else escaped
    }
}

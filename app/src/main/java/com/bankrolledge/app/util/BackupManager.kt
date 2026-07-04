package com.bankrolledge.app.util

import android.content.Context
import android.net.Uri
import androidx.core.content.FileProvider
import com.bankrolledge.app.data.local.entity.SessionEntity
import com.bankrolledge.app.data.local.entity.TransactionEntity
import com.bankrolledge.app.data.repository.AppSettings
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Full-app backup as a single JSON document: settings + sessions + transactions.
 * Restore replaces all existing data (the caller confirms with the user first).
 */
object BackupManager {

    const val FORMAT_VERSION = 1

    data class Backup(
        val settings: AppSettings,
        val sessions: List<SessionEntity>,
        val transactions: List<TransactionEntity>,
    )

    fun toJson(backup: Backup, exportedAt: Long): String {
        val root = JSONObject()
        root.put("app", "BankrollEdge")
        root.put("version", FORMAT_VERSION)
        root.put("exportedAt", exportedAt)
        root.put(
            "settings",
            JSONObject()
                .put("startingBankroll", backup.settings.startingBankroll)
                .put("currency", backup.settings.currency)
                .put("defaultSessionType", backup.settings.defaultSessionType),
        )
        root.put("sessions", JSONArray().apply { backup.sessions.forEach { put(it.toJson()) } })
        root.put("transactions", JSONArray().apply { backup.transactions.forEach { put(it.toJson()) } })
        return root.toString(2)
    }

    /** @throws org.json.JSONException / IllegalArgumentException on malformed input. */
    fun fromJson(json: String): Backup {
        val root = JSONObject(json)
        require(root.optString("app") == "BankrollEdge") { "Not a BankrollEdge backup file." }
        val settingsObj = root.getJSONObject("settings")
        val settings = AppSettings(
            startingBankroll = settingsObj.optDouble("startingBankroll", 0.0),
            currency = settingsObj.optString("currency", "USD"),
            defaultSessionType = settingsObj.optString("defaultSessionType", "ALL"),
        )
        val sessions = root.getJSONArray("sessions").let { arr ->
            (0 until arr.length()).map { sessionFromJson(arr.getJSONObject(it)) }
        }
        val transactions = root.getJSONArray("transactions").let { arr ->
            (0 until arr.length()).map { transactionFromJson(arr.getJSONObject(it)) }
        }
        return Backup(settings, sessions, transactions)
    }

    /** Writes the backup JSON to cacheDir/exports and returns a shareable Uri. */
    fun writeToCache(context: Context, backup: Backup): Uri {
        val dir = File(context.cacheDir, "exports").apply { mkdirs() }
        val file = File(dir, "bankrolledge_backup.json")
        file.writeText(toJson(backup, System.currentTimeMillis()))
        return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    }

    private fun SessionEntity.toJson(): JSONObject = JSONObject()
        .put("sessionType", sessionType)
        .put("gameType", gameType)
        .put("location", location)
        .put("startTime", startTime)
        .put("durationMinutes", durationMinutes)
        .put("smallBlind", smallBlind)
        .put("bigBlind", bigBlind)
        .put("buyIn", buyIn)
        .put("rebuysAddons", rebuysAddons)
        .put("cashOut", cashOut)
        .put("tips", tips)
        .put("position", position)
        .put("fieldSize", fieldSize)
        .put("currency", currency)
        .put("notes", notes)

    private fun sessionFromJson(o: JSONObject): SessionEntity = SessionEntity(
        id = 0, // fresh ids on restore
        sessionType = o.optString("sessionType", "CASH"),
        gameType = o.optString("gameType", "NLH"),
        location = o.optString("location", ""),
        startTime = o.optLong("startTime", 0L),
        durationMinutes = o.optInt("durationMinutes", 0),
        smallBlind = o.optDouble("smallBlind", 0.0),
        bigBlind = o.optDouble("bigBlind", 0.0),
        buyIn = o.optDouble("buyIn", 0.0),
        rebuysAddons = o.optDouble("rebuysAddons", 0.0),
        cashOut = o.optDouble("cashOut", 0.0),
        tips = o.optDouble("tips", 0.0),
        position = o.optInt("position", 0),
        fieldSize = o.optInt("fieldSize", 0),
        currency = o.optString("currency", "USD"),
        notes = o.optString("notes", ""),
    )

    private fun TransactionEntity.toJson(): JSONObject = JSONObject()
        .put("type", type)
        .put("amount", amount)
        .put("time", time)
        .put("note", note)

    private fun transactionFromJson(o: JSONObject): TransactionEntity = TransactionEntity(
        id = 0,
        type = o.optString("type", TransactionEntity.TYPE_DEPOSIT),
        amount = o.optDouble("amount", 0.0),
        time = o.optLong("time", 0L),
        note = o.optString("note", ""),
    )
}

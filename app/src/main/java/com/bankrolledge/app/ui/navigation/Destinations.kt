package com.bankrolledge.app.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ListAlt
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Settings
import androidx.compose.ui.graphics.vector.ImageVector

object Routes {
    const val DASHBOARD = "dashboard"
    const val SESSIONS = "sessions"
    const val STATS = "stats"
    const val SETTINGS = "settings"
    const val EDITOR = "editor"
    const val EDITOR_ARG_ID = "sessionId"
    const val EDITOR_ARG_START = "startMillis"
    const val EDITOR_ARG_DURATION = "durationMinutes"
    const val EDITOR_ROUTE =
        "$EDITOR/{$EDITOR_ARG_ID}?$EDITOR_ARG_START={$EDITOR_ARG_START}&$EDITOR_ARG_DURATION={$EDITOR_ARG_DURATION}"

    fun editor(sessionId: Long, startMillis: Long = 0L, durationMinutes: Int = 0): String =
        "$EDITOR/$sessionId?$EDITOR_ARG_START=$startMillis&$EDITOR_ARG_DURATION=$durationMinutes"
}

/** The four bottom-navigation destinations. */
enum class TopDestination(
    val route: String,
    val label: String,
    val icon: ImageVector,
) {
    DASHBOARD(Routes.DASHBOARD, "Overview", Icons.Filled.Dashboard),
    SESSIONS(Routes.SESSIONS, "Sessions", Icons.AutoMirrored.Filled.ListAlt),
    STATS(Routes.STATS, "Stats", Icons.Filled.BarChart),
    SETTINGS(Routes.SETTINGS, "Settings", Icons.Filled.Settings),
}

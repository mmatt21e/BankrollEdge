package com.bankrolledge.app.ui.navigation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.bankrolledge.app.data.AppContainer
import com.bankrolledge.app.ui.BankrollViewModel
import com.bankrolledge.app.ui.BankrollViewModelFactory
import com.bankrolledge.app.ui.bankroll.BankrollScreen
import com.bankrolledge.app.ui.dashboard.DashboardScreen
import com.bankrolledge.app.ui.editor.EditorScreen
import com.bankrolledge.app.ui.sessions.SessionsScreen
import com.bankrolledge.app.ui.settings.SettingsScreen
import com.bankrolledge.app.ui.stats.StatsScreen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BankrollEdgeApp(container: AppContainer) {
    val navController = rememberNavController()
    val bankrollViewModel: BankrollViewModel = viewModel(
        factory = BankrollViewModelFactory(container),
    )

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val onTopDestination = TopDestination.entries.any { it.route == currentRoute }

    Scaffold(
        bottomBar = {
            AnimatedVisibility(
                visible = onTopDestination,
                enter = fadeIn() + slideInVertically { it },
                exit = fadeOut() + slideOutVertically { it },
            ) {
                NavigationBar {
                    TopDestination.entries.forEach { dest ->
                        NavigationBarItem(
                            selected = currentRoute == dest.route,
                            onClick = {
                                if (currentRoute != dest.route) {
                                    navController.navigate(dest.route) {
                                        popUpTo(Routes.DASHBOARD) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                            },
                            icon = { Icon(dest.icon, contentDescription = dest.label) },
                            label = { Text(dest.label) },
                        )
                    }
                }
            }
        },
        floatingActionButton = {
            AnimatedVisibility(
                visible = currentRoute == Routes.DASHBOARD || currentRoute == Routes.SESSIONS,
                enter = fadeIn(),
                exit = fadeOut(),
            ) {
                FloatingActionButton(onClick = { navController.navigate(Routes.editor(0)) }) {
                    Icon(Icons.Filled.Add, contentDescription = "Add session")
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Routes.DASHBOARD,
            modifier = Modifier,
        ) {
            composable(Routes.DASHBOARD) {
                DashboardScreen(
                    viewModel = bankrollViewModel,
                    contentPadding = padding,
                    onSessionClick = { id -> navController.navigate(Routes.editor(id)) },
                    onSeeAll = { navController.navigate(Routes.SESSIONS) },
                    onLogTimedSession = { startMillis, durationMinutes ->
                        navController.navigate(Routes.editor(0, startMillis, durationMinutes))
                    },
                    onBankrollClick = { navController.navigate(Routes.BANKROLL) },
                )
            }
            composable(Routes.BANKROLL) {
                BankrollScreen(
                    viewModel = bankrollViewModel,
                    onBack = { navController.popBackStack() },
                )
            }
            composable(Routes.SESSIONS) {
                SessionsScreen(
                    viewModel = bankrollViewModel,
                    contentPadding = padding,
                    onSessionClick = { id -> navController.navigate(Routes.editor(id)) },
                )
            }
            composable(Routes.STATS) {
                StatsScreen(viewModel = bankrollViewModel, contentPadding = padding)
            }
            composable(Routes.SETTINGS) {
                SettingsScreen(viewModel = bankrollViewModel, contentPadding = padding)
            }
            composable(
                route = Routes.EDITOR_ROUTE,
                arguments = listOf(
                    navArgument(Routes.EDITOR_ARG_ID) {
                        type = NavType.LongType
                        defaultValue = 0L
                    },
                    navArgument(Routes.EDITOR_ARG_START) {
                        type = NavType.LongType
                        defaultValue = 0L
                    },
                    navArgument(Routes.EDITOR_ARG_DURATION) {
                        type = NavType.IntType
                        defaultValue = 0
                    },
                ),
            ) { entry ->
                val sessionId = entry.arguments?.getLong(Routes.EDITOR_ARG_ID) ?: 0L
                val startMillis = entry.arguments?.getLong(Routes.EDITOR_ARG_START) ?: 0L
                val durationMinutes = entry.arguments?.getInt(Routes.EDITOR_ARG_DURATION) ?: 0
                EditorScreen(
                    container = container,
                    sessionId = sessionId,
                    startMillis = startMillis,
                    durationMinutes = durationMinutes,
                    onDone = { navController.popBackStack() },
                )
            }
        }
    }
}

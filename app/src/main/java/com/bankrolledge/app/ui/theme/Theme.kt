package com.bankrolledge.app.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColors = darkColorScheme(
    primary = Gold500,
    onPrimary = Felt900,
    primaryContainer = Felt700,
    onPrimaryContainer = Cream,
    secondary = Felt600,
    onSecondary = Cream,
    background = Felt900,
    onBackground = Cream,
    surface = SurfaceDark,
    onSurface = Cream,
    surfaceVariant = SurfaceVariantDark,
    onSurfaceVariant = NeutralGrey,
    error = LossRed,
)

private val LightColors = lightColorScheme(
    primary = Felt700,
    onPrimary = Cream,
    primaryContainer = Felt600,
    onPrimaryContainer = Cream,
    secondary = Gold500,
    onSecondary = Felt900,
    background = SurfaceLight,
    onBackground = Felt900,
    surface = Color.White,
    onSurface = Felt900,
    surfaceVariant = SurfaceVariantLight,
    onSurfaceVariant = Color(0xFF4A5750),
    error = LossRedDark,
)

/** Profit is green when positive, red when negative, muted grey at zero. */
@Composable
fun profitColor(amount: Double): Color {
    val dark = isSystemInDarkTheme()
    return when {
        amount > 0.0 -> if (dark) ProfitGreen else ProfitGreenDark
        amount < 0.0 -> if (dark) LossRed else LossRedDark
        else -> NeutralGrey
    }
}

@Composable
fun BankrollEdgeTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) DarkColors else LightColors
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            WindowCompat.setDecorFitsSystemWindows(window, false)
            val insetsController = WindowCompat.getInsetsController(window, view)
            insetsController.isAppearanceLightStatusBars = colorScheme.background.luminance() > 0.5f
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = AppTypography,
        content = content,
    )
}

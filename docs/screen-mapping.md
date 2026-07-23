# Android → PWA Screen Mapping

> _Historical document from the Android → PWA migration era (2026-07). The
> web app has moved on considerably since — see [web/README.md](../web/README.md)
> for the current state._


| Android Source | PWA Route | PWA Component | Status | Notes |
|---|---|---|---|---|
| `ui/dashboard/DashboardScreen.kt` | `/` | `pages/DashboardPage.tsx` | Done | Bankroll header (tap → `/bankroll`), live timer card (persists across restarts), cumulative SVG chart, 6 stat tiles, recent 5 sessions, empty state |
| `ui/sessions/SessionsScreen.kt` | `/sessions` | `pages/SessionsPage.tsx` | Done | Search input, session-type + date-range chips, game/venue selects, totals header, filtered list |
| `ui/stats/StatsScreen.kt` | `/stats` | `pages/StatsPage.tsx` | Done | Range chips, 10 stat tiles, bankroll health card, monthly + hourly bar charts, variance card with histogram, cash-vs-tournament, 4 breakdown lists |
| `ui/settings/SettingsScreen.kt` | `/settings` | `pages/SettingsPage.tsx` | Done | Starting bankroll, currency select, default-view segmented control, CSV export/import, JSON backup/restore, about; share sheet → Web Share API / file download; picker → `<input type=file>` |
| `ui/editor/EditorScreen.kt` + `EditorViewModel.kt` | `/session/new`, `/session/:id` | `pages/EditorPage.tsx` | Done | Segmented type toggle, game select, native date/time inputs (replace Material pickers), duration, money fields with decimal keypad, tournament position/field, notes, live net-result preview, delete confirmation |
| `ui/bankroll/BankrollScreen.kt` | `/bankroll` | `pages/BankrollPage.tsx` | Done | Balance breakdown (starting + session profit + net transactions), deposit/withdraw form, history with delete |
| `ui/navigation/BankrollEdgeApp.kt` (Scaffold/NavHost/FAB) | — | `App.tsx`, `components/common.tsx` (NavBar), `routes/routes.tsx` | Done | Bottom nav on top-level routes only; FAB on Overview + Sessions (matches Android); offline banner added (web-only) |
| `ui/components/ProfitChart.kt`, `BarChart.kt` | — | `components/charts.tsx` | Done | Canvas → SVG; same zero-baseline & color semantics |
| `ui/components/StatTiles.kt`, `SessionRow.kt`, `BreakdownList.kt` | — | `components/common.tsx` | Done | 1:1 ports |
| `ui/BankrollViewModel.kt` | — | `hooks/useAppState.tsx` | Done | Context + typed actions; same derived state (filtered stats, bankroll, locations) |
| `domain/Statistics.kt` | — | `src/domain/stats.ts` | Done | Math identical; verified by ported tests |
| `ui/SessionFilter.kt` | — | `src/domain/filter.ts` | Done | Identical semantics |
| `util/CsvExporter.kt` / `CsvImporter.kt` | — | `src/domain/csv.ts` | Done | Byte-compatible format — CSVs interchange with Android |
| `util/BackupManager.kt` | — | `src/domain/backup.ts` | Done | JSON-compatible — backups interchange with Android |
| `util/Formatters.kt` / `DateTimeUtils.kt` | — | `src/domain/format.ts` | Done | `Intl`-based |
| Room `AppDatabase` / DAOs / repositories | — | `src/storage/db.ts` | Done | IndexedDB, 2 object stores, versioned upgrades |
| `SettingsRepository.kt` (SharedPreferences) | — | `src/storage/settings.ts` | Done | localStorage (non-sensitive) |

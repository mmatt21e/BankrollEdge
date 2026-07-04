# BankrollEdge

A poker **bankroll tracker** for Android — log your cash-game and tournament
sessions, watch your bankroll graph climb, and dig into the stats that tell you
whether you're actually winning. Inspired by apps like Poker Bankroll Tracker,
Pokerbase and Poker Mania, built from scratch with a modern Android stack.

> Status: v1.1. Everything below works today; the roadmap lists what's
> planned next.

## Features

- **Session logging** for both cash games and tournaments in one flow:
  - Cash: stakes (blinds), buy-in, additional buy-ins, cash-out, tips, duration.
  - Tournaments: buy-in (entry + fee), rebuys/add-ons/re-entries, prize won,
    finish position, field size, tips, duration.
  - Game variant (NLH, PLO, 5-card PLO, Limit Hold'em, Stud, Mixed, Other),
    venue, date & time, and free-form notes.
  - Live **net-result preview** as you type.
- **Live session timer** on the dashboard: start a timer when you sit down,
  and when you stop it the new-session form opens with the start time and
  duration already filled in (survives app restarts).
- **Dashboard** with your current bankroll (starting balance + all-time profit),
  a cumulative-profit line chart, headline stats, and recent sessions.
- **Bankroll management**: tap the bankroll to deposit or withdraw money —
  the balance combines your starting roll, session results and transactions,
  with a full editable history.
- **Statistics** screen: profit, hourly rate, ROI, win rate, average per
  session, biggest win/loss, hours played, win/loss streaks,
  cash-vs-tournament split with in-the-money %, a **monthly profit bar
  chart**, plus profit breakdowns **by game type, venue, stakes and day of
  week**. The hourly rate only counts sessions with logged hours, so untimed
  sessions can't inflate it.
- **Bankroll health**: a buy-in count at your most-played stakes with
  bankroll-management guidance (move up / hold / move down).
- **Filtering & search** on the Sessions and Stats screens by session type,
  game, venue, date range and free text (venue, notes, game).
- **CSV export** of all sessions via the Android share sheet.
- **JSON backup & restore** of everything — sessions, transactions and
  settings.
- **Starting bankroll**, **default currency** (10 currencies) and a
  **default view mode** (all games / cash only / tournaments only).
- Delete confirmations for destructive actions.
- Material 3 UI with a poker-felt theme, light & dark mode, edge-to-edge.
- 100% offline, local-only data (Room / SQLite). No account, no network.

## Tech stack

| Layer      | Choice                                             |
|------------|----------------------------------------------------|
| Language   | Kotlin                                             |
| UI         | Jetpack Compose + Material 3                       |
| Charts     | Custom Compose `Canvas` (no third-party chart lib) |
| Data       | Room (SQLite), SharedPreferences for settings      |
| Async      | Coroutines + `Flow` / `StateFlow`                  |
| Arch       | MVVM, unidirectional state, manual DI container    |
| Navigation | Navigation-Compose (bottom bar + detail screen)    |
| Min / Target SDK | 26 / 35                                      |

## Project structure

```
app/src/main/java/com/bankrolledge/app/
├── BankrollEdgeApplication.kt    # builds the AppContainer (manual DI)
├── MainActivity.kt               # sets the Compose content
├── data/
│   ├── AppContainer.kt           # wires DB + repositories
│   ├── local/                    # Room database, DAO, SessionEntity
│   ├── model/                    # SessionType / GameType enums
│   └── repository/               # SessionRepository, SettingsRepository
├── domain/
│   └── Statistics.kt             # StatsCalculator: all derived metrics
├── ui/
│   ├── BankrollViewModel.kt      # shared state for dashboard/sessions/stats
│   ├── SessionFilter.kt          # filter model + apply logic
│   ├── components/               # charts, stat tiles, session row, breakdowns
│   ├── dashboard/ sessions/ stats/ settings/ editor/   # screens + editor VM
│   ├── navigation/               # routes + Scaffold with bottom nav
│   └── theme/                    # colors, type, Material 3 theme
└── util/                         # Formatters, DateTimeUtils, CsvExporter
```

## Building

Open the project in **Android Studio** (Ladybug or newer) and press Run, or from
the command line:

```bash
# Point the build at your Android SDK (or add sdk.dir to local.properties)
export ANDROID_HOME=/path/to/Android/sdk

./gradlew assembleDebug        # builds app/build/outputs/apk/debug/app-debug.apk
./gradlew installDebug         # install onto a connected device/emulator
./gradlew test                 # run the JVM unit tests
```

Requirements: JDK 17+, Android SDK Platform 35 and Build-Tools 35.

### Release APK (installable on a phone)

Release builds are signed if a `keystore.properties` file exists at the repo
root (git-ignored, along with the keystore itself). Create your own key once:

```bash
keytool -genkeypair -v -keystore bankrolledge-release.jks \
  -alias bankrolledge -keyalg RSA -keysize 2048 -validity 10000

cat > keystore.properties <<'PROPS'
storeFile=bankrolledge-release.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=bankrolledge
keyPassword=YOUR_KEY_PASSWORD
PROPS

./gradlew assembleRelease   # -> app/build/outputs/apk/release/app-release.apk
```

Copy that APK to your phone and tap it to install (enable "install from
unknown sources" for your browser/Files app). If `keystore.properties` is
absent, the release build falls back to the debug signing key so it still
compiles.

## Data model

A single `SessionEntity` row covers both session types; unused fields stay at
zero. Profit is always `cashOut - (buyIn + rebuysAddons) - tips`, so cash and
tournament results roll up into the same bankroll and graph. Your **current
bankroll** is `startingBankroll + sum(profit)`.

## Roadmap

Natural next steps:

- Multiple bankrolls / accounts and casino balances.
- Multi-currency normalization with exchange rates.
- CSV import and cloud backup.
- More charts (profit by hour of day, variance, bankroll simulations).
- Poker tools: ICM/deal calculator, odds calculator.
- Home-screen widget with the current bankroll.

## License

Personal project — no license specified yet.

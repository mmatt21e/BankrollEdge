# BankrollEdge

**BankrollEdge is a free, fully offline bankroll tracker for poker, casino
table games and sports betting — plus a toolbox for running home games.**
The live product is the Progressive Web App in [`web/`](web/) (currently
v1.39.x), deployed to **[bankrolledge.com](https://bankrolledge.com)**. It
runs in any modern browser, installs to the home screen on Android and iOS,
and keeps all data on your device — no account, no server, no tracking.

> Track every session. Run every home game. Know where you win.

## What it does

- **Sessions** — cash games, tournaments, Sit & Gos, home games and casino
  table games, with live-vs-online, rake, tips, expenses, add-ons, bounties,
  tags, hands played and optional session-quality tracking.
- **Live session timer** — capture the setup when you sit down, add rebuys
  and bounties as you play, and log the session when you stand up.
- **Sports bets** — singles and parlays, American or decimal odds, free
  bets, cash-outs, closing-line value, one-tap (confirmed) settling, and an
  optional separate sports bankroll.
- **Analytics** — bankroll graph, hourly rate, ROI, win rate, streaks,
  variance and downswings, daily heatmap, plain-English insight cards, and
  breakdowns by game, stakes, venue, weekday, tag and more.
- **Tools** — tournament blind clock (with wake lock and full-screen table
  display), home-game ledger with settlement and suggested payments, payout
  and ICM deal/chop calculators, stack value, chip planner, poker calendar
  with .ics reminders, and hand notes with a review queue.
- **Your data, portable** — CSV export/import (with guided column mapping
  from any app's export) and full JSON backup/restore, with a choice to
  replace or merge on restore. Optional PIN lock and hide-balances blur.

See [`web/README.md`](web/README.md) for the web app's commands,
development setup and deployment notes.

## Repository layout

| Path | What it is |
|---|---|
| `web/` | **The product** — React 18 + TypeScript + Vite PWA, deployed to bankrolledge.com by `.github/workflows/deploy-pages.yml` |
| `app/` | **Legacy** — the original Android app (Kotlin, Jetpack Compose, Room), frozen at v1.2 |
| `docs/` | Historical documents from the Android → PWA migration |

## Legacy Android app (`app/`, v1.2)

BankrollEdge started as a native Android app. It was ported screen-by-screen
to the PWA in 2026 and has been **frozen at v1.2** since — all development
happens in `web/`. It is kept in the repository because it still builds, its
CSV and JSON backup formats interoperate with the web app (backups move both
directions), and it documents the reference implementation the web port was
verified against.

<details>
<summary>Building the Android app</summary>

Open the project in Android Studio (Ladybug or newer) and press Run, or:

```bash
export ANDROID_HOME=/path/to/Android/sdk
./gradlew assembleDebug   # app/build/outputs/apk/debug/app-debug.apk
./gradlew installDebug    # install onto a connected device/emulator
./gradlew test            # run the 27 JVM unit tests
```

Requirements: JDK 17+, Android SDK Platform 35 and Build-Tools 35. Release
builds are signed if a git-ignored `keystore.properties` exists at the repo
root (see the file history for the one-time key setup); without it the
release build falls back to the debug key.

</details>

## Data model

A single session record covers every session type; unused fields stay at
zero. Session profit is
`cashOut + bounties − (buyIn + rebuys + addOns) − tips − expenses`, bet
profit follows the bet's status and odds, and your **current bankroll** is
`starting bankroll + session profit + settled bet profit + deposits − withdrawals`
(with an optional separate sports roll). CSVs and JSON backups are
interchangeable between the web and Android apps.

## License

Personal project — no license specified yet.

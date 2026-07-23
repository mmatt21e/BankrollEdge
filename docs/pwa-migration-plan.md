# BankrollEdge — Android → PWA Migration Plan

> _Historical document from the Android → PWA migration era (2026-07). The
> web app has moved on considerably since — see [web/README.md](../web/README.md)
> for the current state._


## 1. Summary of the existing Android app

BankrollEdge is a **fully offline, single-user poker bankroll tracker** (Kotlin,
Jetpack Compose + Material 3, MVVM). v1.2, 38 Kotlin files.

**Repository analysis**

| Area | Finding |
|---|---|
| Build | Gradle (Kotlin DSL), single `:app` module, minSdk 26 / target 35 |
| UI | 100% Jetpack Compose — no XML layouts, no Fragments; 1 Activity (`MainActivity`) hosting a Navigation-Compose graph |
| Screens | Dashboard, Sessions, Stats, Settings (bottom nav) + Editor and Bankroll (detail routes) |
| ViewModels | `BankrollViewModel` (shared app state: sessions, transactions, settings, filter, derived stats), `EditorViewModel` (add/edit form) |
| Services / BroadcastReceivers / WorkManager | **None** |
| Local database | Room v2: `sessions` (16 cols), `transactions` (5 cols); migration 1→2 |
| SharedPreferences | `bankrolledge_settings`: starting bankroll, currency, default view mode, live-timer start |
| Network / API | **None** — the app makes zero network calls |
| Authentication | **None** (single-user, local data) |
| Push notifications | None |
| Permissions | **None requested** |
| Device features | Share sheet (CSV/JSON export via `FileProvider`), system file picker (`GetContent`) for CSV/JSON import |
| Background tasks | None (live timer is just a persisted start timestamp) |
| Business logic | `StatsCalculator` (profit/ROI/hourly-rate/streaks/std-dev/drawdown/monthly/hourly/histogram), `SessionFilter` (type/game/venue/range/query), `CsvExporter`/`CsvImporter` (RFC-4180), `BackupManager` (JSON backup/restore), `Formatters`, `DateTimeUtils` |
| Tests | 27 JVM unit tests over the business logic |

**Main user workflows**
1. Log a session (cash or tournament) → editor form with live net-result preview → saved to Room → dashboard/stats update.
2. Start a **live session timer** → ticking card on dashboard (survives restarts) → "Stop & log" pre-fills the editor.
3. Review results → cumulative profit chart, stat tiles, filters/search, monthly & hourly charts, variance view, breakdowns.
4. Manage the bankroll → deposits/withdrawals with history; bankroll = starting + session profit + net transactions.
5. Data portability → CSV export/import (append), JSON backup/restore (replace), delete confirmations.

## 2. Proposed PWA architecture

Because the app has **no server, no auth and no network**, the PWA is a
**local-first single-page app**: all data lives in the browser (IndexedDB +
localStorage), and the service worker precaches the entire app shell, so the
app is **100% functional offline** after first load — matching the Android app.

- **Stack**: React 18 + TypeScript + Vite, `vite-plugin-pwa` (Workbox
  `generateSW`), `react-router-dom`, plain mobile-first CSS with design tokens,
  Vitest for unit tests. No state library — one React context over a typed
  data service.
- **Location**: new `web/` directory; **no Android files are modified or
  deleted**.
- **Data compatibility**: the PWA reads/writes the **same JSON backup and CSV
  formats** as the Android app, so users can move data between the two apps
  with a backup file.

```
web/
  public/           manifest.webmanifest, offline.html, icons/
  src/
    models/         Session, Transaction, Settings types + helpers
    domain/         stats.ts, filter.ts, csv.ts, backup.ts  (ports of Kotlin)
    storage/        db.ts (IndexedDB), settings.ts (localStorage)
    services/       dataService.ts (typed CRUD + import/export/restore)
    hooks/          useAppState (context), useNow (timer tick)
    components/     NavBar, charts (SVG), tiles, rows, dialogs, filter bar
    pages/          Dashboard, Sessions, Stats, Settings, Editor, Bankroll
    routes/         router definition
    styles/         global.css (tokens, dark/light, safe areas)
```

**Deviation from the template**: no `src/api/` — there is no remote API to
migrate. The typed `services/` + `storage/` layers fill that role. If a backend
is ever added, `services/dataService.ts` is the single seam to swap.

## 3. Screen-by-screen migration table

| Android source (Compose) | PWA route | PWA component | Parity notes |
|---|---|---|---|
| `DashboardScreen.kt` | `/` | `pages/DashboardPage` | Bankroll header (tap → `/bankroll`), live timer card, cumulative SVG chart, stat tiles, recent sessions, empty state |
| `SessionsScreen.kt` | `/sessions` | `pages/SessionsPage` | Search field, type/date-range chips, game & venue dropdowns, session rows, totals header |
| `StatsScreen.kt` | `/stats` | `pages/StatsPage` | Range chips, 10 stat tiles, bankroll health, monthly bars, hourly bars, variance card + histogram, cash-vs-tournament, breakdowns |
| `SettingsScreen.kt` | `/settings` | `pages/SettingsPage` | Starting bankroll, currency, default view, CSV export/import, JSON backup/restore, about |
| `EditorScreen.kt` | `/session/new`, `/session/:id` | `pages/EditorPage` | Segmented type toggle, game select, date/time/duration, money fields, tournament fields, notes, live net preview, delete confirm |
| `BankrollScreen.kt` | `/bankroll` | `pages/BankrollPage` | Balance breakdown, deposit/withdraw form, history with delete |
| `BankrollEdgeApp.kt` (Scaffold + NavHost) | `App.tsx` + router | `components/NavBar` | Bottom navigation + FAB equivalent ("+" button), standalone-friendly |

## 4. Native Android feature replacement table

| Android feature | PWA replacement | Status |
|---|---|---|
| Activity + Navigation-Compose | React Router routes | Full parity |
| Compose UI / Material 3 | React components + CSS (same theme tokens) | Full parity |
| ViewModels + StateFlow | React context + typed data service | Full parity |
| Room (`sessions`, `transactions`) | IndexedDB (two object stores, autoincrement keys) | Full parity |
| SharedPreferences | `localStorage` (settings + timer start; non-sensitive) | Full parity |
| Canvas charts | Inline SVG charts | Full parity |
| Share sheet export (`FileProvider`) | File download (Blob + anchor) + Web Share API where available | Full parity (download everywhere; share-sheet on Android/iOS browsers that support `navigator.share`) |
| System file picker (`GetContent`) | `<input type="file">` | Full parity |
| Live timer across restarts | Persisted start timestamp in `localStorage` + 1 s tick | Full parity |
| Delete confirmations (AlertDialog) | Accessible `<dialog>`-style modal component | Full parity |
| Room migrations | IndexedDB `onupgradeneeded` versioning | Full parity |
| Retrofit / OkHttp / WorkManager / push / camera / GPS / Bluetooth / NFC / biometrics / contacts | **Not used by the app** | Nothing to replace |

## 5. Known limitations (documented, mostly iOS)

1. **Storage eviction (iOS Safari)**: iOS may evict IndexedDB/localStorage for
   rarely-used sites ("7-day ITP" applies mainly to browser tabs; installed
   Home-Screen apps are more durable but not guaranteed). *Mitigation*: call
   `navigator.storage.persist()`, and surface the JSON backup feature
   prominently so users keep their own backups.
2. **No true share-sheet on some browsers**: `navigator.share` with files is
   supported on Android Chrome and iOS Safari 15+, but not all desktop
   browsers. *Mitigation*: always offer plain file download as the default.
3. **Install UX differs on iOS**: no install prompt; users must use
   Share → "Add to Home Screen". Documented in the README; `apple-touch-icon`
   and standalone meta tags provided.
4. **No background execution**: irrelevant here (the Android app has none —
   the timer is timestamp-based and works identically).
5. **Data is per-browser-profile**: unlike Android, clearing site data deletes
   the database. Same mitigation as (1) — backups.

Security: no auth, no tokens, no PII beyond user-entered notes; all data
stays on-device. Details in `docs/pwa-security-notes.md`.

## 6. Implementation sequence

1. Scaffold `web/` (Vite + React + TS), manifest, offline page, icons.
2. Port models + domain logic (stats, filter, CSV, backup) — pure TS.
3. Storage layer: IndexedDB wrapper + settings.
4. App state context + data service.
5. Routing + app shell (bottom nav, safe areas).
6. Pages in order: Editor → Dashboard → Sessions → Stats → Bankroll → Settings.
7. PWA layer: service worker (precache app shell, offline-first), installability.
8. Tests (port the 27 Android unit tests to Vitest).
9. Build, type-check, preview smoke test.
10. Docs: screen mapping, security notes, README.

## 7. Testing strategy

- **Unit (Vitest)**: port all 27 Android JVM tests — stats math (incl. the
  hourly-rate regression), filtering/search, CSV round-trip/escaping/skipping,
  backup round-trip/rejection. These cover the business logic that must not
  drift from the Android app.
- **Type safety**: `tsc --noEmit` in the build; zero TS errors required.
- **Build verification**: `vite build` + `vite preview` smoke test (index,
  manifest, service worker, offline page reachable).
- **Manual device checklist** (documented in README): install on Android
  Chrome, Add-to-Home-Screen on iOS Safari, standalone launch, airplane-mode
  reload, CSV/backup round-trip against the Android app.

# Software Improvement Plan

**Repository:** BankrollEdge · **Assessment date:** 2026-07-23 · **Assessed at:** commit `55ea476` (branch `claude/document-instructions-4dqlpk`, identical tree to `bankroll-tracker`)

This document is self-contained: a future coding agent can open this repository, read this plan and the referenced files, and implement the approved tasks without access to the conversation that produced it. No source files were changed during the assessment; this file is the only addition.

---

## 1. Executive Summary

**Overall project condition — good, with a small number of serious data-integrity bugs.**
The repository contains two implementations of the same product:

- **`web/` — the live product.** A local-first PWA (React 18 + TypeScript strict + Vite 6), v1.34.0, deployed to GitHub Pages (custom domain bankrolledge.com) by `.github/workflows/deploy-pages.yml`. All 30+ commits since 2026-07-04 are web-only. 150 unit tests pass; `tsc --noEmit` + production build pass cleanly.
- **`app/` — legacy.** The original Android app (Kotlin/Compose/Room), frozen at v1.2, ~32 feature releases behind the web app. Decent quality, minor nits only. Nothing in the repo says it is legacy — the root README still presents it as the product.

**UI and usability condition — solid foundation, inconsistent finishing.** The web app has a genuinely coherent design-token system (`web/src/styles/global.css`) and a real shared-component library (`web/src/components/common.tsx`). The systemic gaps: destructive actions are inconsistently confirmed (a running live session can be discarded with one tap), there is **no loading or error state anywhere** (a slow or failed IndexedDB load renders as "you have no data"), the two main editors allow duplicate submits, dialogs lack focus management, and ad-hoc inline font sizes/colors bypass the token system on most pages.

**Code quality and reliability condition — domain layer healthy; persistence boundary is the weak spot.** The pure domain modules (stats, bets, ICM/deal, payouts, settlement, CSV, import mapping) are well-commented, well-tested (150 Vitest cases) and correct on inspection. The confirmed defects cluster where data enters and leaves the app:

1. **BUG-001 (High, confirmed):** JSON backup **restore silently zeroes bounty winnings** (`bountyPerBounty`/`bountyCount` missing from `backupFromJson`'s field list), changing historical profit, bankroll and stats. Export writes the fields; restore drops them.
2. **BUG-002 (Medium, confirmed):** CSV export/import round-trip loses the same bounty data.
3. **REL-001 (High):** backup restore clears all nine IndexedDB stores **before** writing new data — a mid-restore failure destroys the old data with no rollback.
4. **REL-002 (Medium):** IndexedDB writes resolve on `request.onsuccess`, before the transaction commits — "saved" records can vanish under storage pressure.
5. **BUG-003 (High, confirmed):** Home-game ledger money inputs cannot accept decimal amounts at all (parse-on-keystroke controlled input).

**Are improvements required?** Yes — the Priority 0 items (BUG-001/002/003, REL-001/002/003) are required; they are silent money-data corruption/loss paths in a bankroll app. Priority 1 items are strongly recommended. Everything else is optional polish.

**Expected benefits:** trustworthy backups and imports (the app's only safety net), no accidental data loss from mistaps, honest loading/error states, a visibly consistent UI driven from one token file, and documentation that tells the truth about which app is the product.

**Not evaluated:** the Android app could not be built or its 27 JVM tests run (no Android SDK in the assessment environment); runtime UI was not exercised on a physical device (no browser-driven session was run — findings are from full source reading plus build/test validation); real-device PWA behavior (iOS storage eviction, install flows) is documented but untested here.

---

## 2. Improvement Objectives

- Create a clean and professional interface.
- Make all screens visually consistent (one token-driven system, no ad-hoc styles).
- Make normal workflows self-explanatory (no instructions needed).
- Reduce unnecessary user steps.
- Prevent common user mistakes (confirmations, duplicate-submit guards, undo).
- Correct confirmed errors (bounty round-trip, decimal inputs, date parsing).
- Improve error handling and diagnostics (no silent failures, honest empty/loading/error states).
- Make code readable and manageable (extract meaningful duplication only).
- Simplify unnecessarily complex code (none found requiring rewrites — keep it that way).
- Preserve existing working behavior (all 150 tests keep passing; data formats stay Android-interoperable except where extended additively).
- Avoid unnecessary dependencies and abstractions (zero new runtime libraries planned; ESLint is the only proposed dev-dependency, and it is optional).

---

## 3. Project Overview

**Purpose:** a fully offline, single-user gambling bankroll tracker and poker toolkit. Tracks poker sessions (cash/tournament/SNG/home game), table-game sessions, and sports bets; computes bankroll, profit, hourly rate, ROI, variance, streaks and breakdowns; provides tools (tournament blind clock, home-game ledger with settlement, payout calculator, ICM deal/chop calculator, stack value, chip planner, poker calendar with .ics export, hand notes). No accounts, no server, no network calls — all data in IndexedDB/localStorage.

**Intended users:** individual poker players / table-game players / sports bettors tracking their own results on a phone (installed PWA) or desktop browser.

**Primary user workflows:**
1. Log a session or bet (FAB → editor → save) and watch dashboard/stats update.
2. Run a live session (start timer on dashboard → rebuys/bounties while playing → "Stop & log" pre-fills the editor).
3. Review results (dashboard chart/tiles/insights, Sessions/Table/Sports lists with filters and search, breakdowns, variance).
4. Manage bankroll (deposits/withdrawals with history; optional separate sports bankroll).
5. Data portability (CSV export/import with guided column mapping; JSON backup/restore; formats interoperable with the Android app).
6. Run a home game / tournament (blind clock, payouts, deals, settlement).

**Technology stack (live product, `web/`):** React 18.3, TypeScript 5.6 (`strict: true`), Vite 6, vite-plugin-pwa 0.21 (Workbox `generateSW`, `registerType: 'autoUpdate'`), react-router-dom 6.28, plain mobile-first CSS with custom-property tokens, IndexedDB (hand-rolled wrapper) + localStorage, Vitest 2. No state library — one React context (`useAppState`). Legacy `app/`: Kotlin 2.0.21, Jetpack Compose (BOM 2024.12.01), Room 2.6.1, AGP 8.7.3, min SDK 26 / target 35.

**Target runtime:** evergreen mobile browsers (Android Chrome, iOS Safari) as an installed standalone PWA; desktop browsers secondary.

**Major components:**
- `web/src/models/types.ts` — all entity types, defaults, normalizers, money math (`profit`, `bountyWon`, `totalInvested`).
- `web/src/domain/` — pure logic: `stats.ts`, `bets.ts`, `filter.ts`, `csv.ts`, `backup.ts`, `importMap.ts`, `betImportMap.ts`, `importHarvest.ts`, `insights.ts`, `clock.ts`, `deal.ts`, `payout.ts`, `stackValue.ts`, `settlement.ts`, `chips.ts`, `ics.ts`, `format.ts`.
- `web/src/storage/db.ts` — IndexedDB (`bankrolledge` DB, version 4, nine object stores); `web/src/storage/settings.ts` — localStorage (settings, active session, PIN, hide-balances).
- `web/src/hooks/useAppState.tsx` — the single app-state context: loads stores, exposes CRUD + derived stats + import/restore/clear.
- `web/src/components/` — `common.tsx` (NavBar, TopBar, SectionCard, StatTileGrid, SessionRow, BreakdownList, ConfirmDialog, MoneyInput, FilterPanel, month grouping), `charts.tsx` (SVG charts), `pickers.tsx`, `LiveSessionCard.tsx`, `GameListEditor.tsx`, `PinLock.tsx`.
- `web/src/pages/` — 23 pages (inventory in §4). `web/src/routes/routes.tsx` — route table. `web/src/App.tsx` — shell (offline banner, FAB, NavBar, PIN gate, theme). `web/src/main.tsx` — bootstrap, service-worker registration, landing-page gate.

**Important entry points:** `web/index.html` → `web/src/main.tsx` → `App` (`web/src/App.tsx`) → `routes` (`web/src/routes/routes.tsx`). Dashboard is `StatsPage` at `/`.

**Build and test commands** (run from `web/`): `npm install` · `npm test` (Vitest, 150 tests) · `npm run build` (`tsc --noEmit && vite build`) · `npm run dev` (port 5173) · `npm run preview` (port 4173) · `npm run icons`.

**Deployment:** push to branch `bankroll-tracker` touching `web/**` triggers `.github/workflows/deploy-pages.yml`: `npm ci` → `npm test` → `npm run build` (base `/`, CNAME bankrolledge.com, SPA `404.html` fallback) → GitHub Pages.

**Repository-specific conventions:** no CLAUDE.md/AGENTS.md/CONTRIBUTING/EditorConfig exist. Observed conventions to follow: domain logic is pure, side-effect-free and unit-tested; every mutation persists first, then updates React state; numeric form inputs hold **raw strings** and sanitize with regex, parsing only on save (`EditorPage.tsx` header comment states this rule); destructive actions use `ConfirmDialog`; comments explain *why*, not *what*; commit subjects follow `web v1.x.y: <imperative summary>` with a version bump in `web/package.json`.

---

## 4. Existing UI Inventory

All components under `web/src/`. "Reach" = how a user gets there. All routes are defined in `routes/routes.tsx`; the shell (offline banner, FAB, bottom nav) is `App.tsx`.

| UI ID | Screen / component | Purpose | Primary users | Current style | Main concerns |
|---|---|---|---|---|---|
| UI-001 | `pages/StatsPage.tsx` — Dashboard (`/`) | Bankroll hero, live-session card, open bets, filters, profit chart, tiles, heatmap, insights, Trends/Breakdowns/Variance tabs, recent activity | Everyone, daily | Token-based cards; several inline font sizes | Hero button kills focus ring (A11Y-003); gold overline fails contrast in light theme (A11Y-004); no loading gate (UX-002) |
| UI-002 | `pages/SessionsPage.tsx` (`/sessions`, poker scope) | Poker session list: search, chips, FilterPanel, month groups | Poker players | Consistent list pattern | Broken hidden label (A11Y-002); "no data" flash (UX-002) |
| UI-003 | `pages/SessionsPage.tsx` (`/tables`, table scope) | Table-game session list | Table players | Same as UI-002 | Same as UI-002 |
| UI-004 | `pages/BetsPage.tsx` (`/bets`) | Sports bets: open bets w/ one-tap settle, history, stats view | Bettors | Consistent | Settle has no undo (UX-004); unlabeled search (A11Y-002); duplicated stats cards vs UI-001 (CODE-001) |
| UI-005 | `pages/EditorPage.tsx` (`/session/new`, `/session/:id`) | Add/edit session; live hand-off | Everyone | Good raw-string input pattern | Double-submit duplicates records (REL-007); back discards dirty form silently (UX-003); cross-field validation gaps (UX-010) |
| UI-006 | `pages/BetEditorPage.tsx` (`/bet/new`, `/bet/:id`) | Add/edit bet, parlay legs, settle chips | Bettors | Consistent with UI-005 | Same double-submit (REL-007); index keys on legs (CODE-002) |
| UI-007 | `pages/BankrollPage.tsx` (`/bankroll`) | Balance breakdown, deposit/withdraw, history | Everyone | Consistent | Transaction delete unconfirmed (UX-001); empty state uses `.muted` not `.empty` (STYLE-002) |
| UI-008 | `pages/ToolsPage.tsx` (`/tools`) | Hub of 8 poker tools | Poker players | Hub-row pattern | Hub row duplicated with UI-009 (CODE-001) |
| UI-009 | `pages/SettingsPage.tsx` (`/settings`) | Settings hub + Manage bankroll link | Everyone | Hub-row pattern | — |
| UI-010 | `pages/GeneralSettingsPage.tsx` | Bankroll amounts, currency, venues, CSV/JSON data, clear data, privacy (PIN, blur), about | Everyone | Consistent | Silent saves (UX-005); venue delete unconfirmed (UX-001, low) |
| UI-011 | `pages/DisplaySettingsPage.tsx` | Theme, feature/tab/card toggles | Everyone | Consistent | — |
| UI-012 | `pages/PokerSettingsPage.tsx` | Default type, poker game list, stakes presets | Poker players | Consistent | Preset delete unconfirmed (UX-001, low) |
| UI-013 | `pages/TableGamesSettingsPage.tsx` | Table game list, unit display, table stakes | Table players | Consistent | Same as UI-012 |
| UI-014 | `pages/SportsSettingsPage.tsx` | Unit size, odds format | Bettors | Consistent | Silent save (UX-005) |
| UI-015 | `pages/ImportPage.tsx` (`/settings/import`) | Guided CSV import with column mapping + preview | Migrating users | Good busy-guard example | Placeholder shows literal `&#10;` (BUG-004); no try/catch around import (REL-003) |
| UI-016 | `pages/ClockPage.tsx` (`/tools/clock`) | Blind structure editor + full-screen running clock | Home-game hosts | Own overlay styles | One-tap Exit ends running clock (UX-001); sub-view invisible to back button (UX-003); no wake lock (UX-007); nameless templates savable (UX-010) |
| UI-017 | `pages/HomeGamesPage.tsx` (`/tools/home-games`) | Home-game ledger, settlement, seat draw | Home-game hosts | Consistent | **Decimal amounts impossible** (BUG-003); detail view is local state, back exits page (UX-003) |
| UI-018 | `pages/PayoutPage.tsx` (`/tools/payout`) | Tournament payout calculator | Hosts | Consistent | Duplicated helpers (CODE-001) |
| UI-019 | `pages/DealPage.tsx` (`/tools/deal`) | ICM / chip-chop / even deal | Players | Good inline-alert pattern | Duplicated ladder editor with UI-020 (CODE-001) |
| UI-020 | `pages/StackValuePage.tsx` (`/tools/stack-value`) | Single-stack ICM value | Players | Consistent | Same as UI-019 |
| UI-021 | `pages/ChipsPage.tsx` (`/tools/chips`) | Chip distribution planner | Hosts | Consistent | Index keys (CODE-002) |
| UI-022 | `pages/CalendarPage.tsx` (`/tools/calendar`) | Event list + .ics export | Players | Consistent | Event delete unconfirmed (UX-001); `ics.ts` untested (TEST-002) |
| UI-023 | `pages/HandNotesPage.tsx` (`/tools/hands`) | Hand notes, review queue, share | Students of the game | Consistent | Note delete unconfirmed (UX-001); silent clipboard copy (UX-005) |
| UI-024 | `pages/LandingPage.tsx` (pre-router, browser visitors at `/`) | Install promo page | New visitors | Own `.landing*` styles | — |
| UI-025 | `components/PinLock.tsx` (pre-router when PIN set) | Launch PIN gate | Privacy users | Own `.pin-screen` styles | Weak hash noted (SEC-001, accepted for a nuisance lock) |
| UI-026 | `components/LiveSessionCard.tsx` + StartSessionDialog + RebuyDialog (on UI-001) | Live-session timer, rebuy/bounty capture | Live players | Consistent | Unconfirmed Discard (UX-001); dialog focus/Escape broken (A11Y-001); stale dialog state (UX-008) |
| UI-027 | `components/common.tsx` ConfirmDialog | Shared destructive-action dialog | — | Consistent | No focus trap/restore (A11Y-001) |
| UI-028 | Shell: offline banner, FAB, NavBar (`App.tsx`, `common.tsx`) | Global chrome | Everyone | Consistent | FilterPanel `aria-pressed` misuse (A11Y-006); chips under 44px (A11Y-005) |

Navigation notes: bottom nav shows up to 6 tabs (Dashboard, Poker, Table, Sports, Tools, Settings) gated by feature toggles. `/bankroll` is reachable only via the dashboard hero and Settings hub. `/tools/*` routes are not gated in the router even when the Tools tab is hidden (harmless — direct URLs work).

---

## 5. Proposed UI Design Standards

The existing token system in `web/src/styles/global.css:4-107` is the design system. The standard is: **complete it and enforce it** — no new framework, no redesign.

**Typography** (add as tokens/utilities; values match today's de-facto usage):
- Body 16px/1.45 system stack (unchanged). H1 1.6rem/700; TopBar h1 1.25rem; h2 1.15rem/600.
- New utility classes replacing inline styles: `.money-xl` (2.4rem/700 — dashboard hero), `.money-lg` (1.5rem/700 — editor net preview, bet stake summary), `.stat-value` (1.15rem/700 — tile/card values), `.icon-lg` (1.6rem — hub-row icons). Keep existing `.overline` (0.72rem), `.muted` (0.9rem), `.small` (0.8rem).

**Color palette** (existing tokens, unchanged values): brand `--felt-900` #0f1e17, `--gold-500` #e0b646, `--cream` #f5f1e6; semantic `--bg/--surface/--surface-variant/--on-bg/--on-surface-variant/--primary/--on-primary/--primary-container/--outline`; money `--profit/--loss/--neutral`; heatmap ramps. **Additions:** `--accent` (theme-flipping accent: dark theme = `--gold-500`, light theme ≈ #8a6d1c or `--primary`, chosen to pass 4.5:1 on `--bg`) for overline/accent text; `--warning-bg` for the clock warning surface (replaces literal `#3d1414`). Rule: no hex literals in components or below the token block; `#ff6b6b` in `global.css:541` becomes `var(--loss)`; `#fff` in `.btn-danger` becomes a token.

**Spacing:** keep `--space` 16px; add `--space-xs` 4px and `--space-sm` 8px and use them instead of ad-hoc `gap: 2|4|6|8|14` inline styles where touched (no blanket sweep).

**Control sizes:** `--touch` 44px minimum hit target for all interactive controls. `.chip` gains a ≥44px hit area (transparent padding or pseudo-element; visual pill stays the current size). Buttons and inputs keep current heights.

**Button hierarchy:** `.btn` (primary, filled), `.btn-outline` (secondary), `.btn-danger` (destructive, always paired with ConfirmDialog for irreversible money/data actions), `.btn-plain` (new: unstyled button that preserves the `:focus-visible` outline — replaces `all: unset`). Destructive action rule: anything that deletes a money-affecting record or ends a running activity confirms first.

**Input layouts:** the `.field` label-above pattern with raw-string sanitized inputs (the `EditorPage`/`MoneyInput` pattern) is the single blessed pattern; a shared `NumberInput` in `common.tsx` becomes the one way to take numbers (fixes BUG-003's class of bug permanently).

**Dialog standards:** one dialog pattern (extend `ConfirmDialog`/backdrop in `common.tsx`): on open, focus the first control (autoFocus); Escape closes from anywhere in the dialog; focus returns to the trigger on close; Tab stays inside (simple sentinel loop or native `<dialog>.showModal()` — either is acceptable; pick one and use it for ConfirmDialog, StartSessionDialog, RebuyDialog).

**Data-grid / list standards:** `.session-row` + `.month-header` grouped-list pattern for all record lists (already consistent); `.preview-table` for tabular previews.

**Status & error presentation:** the gold-bordered `role="status"` banner (today duplicated in GeneralSettings/ImportPage) becomes a shared `<MessageBanner>`; inline field errors use the `.neg small` pattern from `DealPage.tsx:220-234`. Every save gives feedback: navigation away, a banner, or a disabled-while-saving button.

**Loading & empty states:** every data list gates on `app.ready` / `useStoreList.loaded` — render nothing (or a skeleton) until loaded, `.empty` copy ("No sessions yet. Tap + to add one.") only after. A load failure surfaces a visible error banner — never an empty dataset.

**Navigation behavior:** bottom nav for the 6 top-level tabs; TopBar back goes to an explicit fallback parent when there is no in-app history (deep link), never out of the app; full-screen sub-views (running clock, home-game detail) participate in browser history via a search param so the system back gesture closes them.

**Resizing & DPI:** current responsive CSS (max-width content column, safe-area insets, `--nav-height`) is adequate; `theme-color` meta gains a light-scheme variant.

**Accessibility expectations:** WCAG AA contrast in both themes; visible `:focus-visible` outline on every control; every input labeled (add a real `.visually-hidden` utility); `aria-expanded` (not `aria-pressed`) on disclosures; dialogs per the standard above.

**Reusable controls/helpers to add (all in existing files/patterns, no new deps):** `NumberInput`, `MessageBanner`, `HubRow` (exists in ToolsPage — export it), `SportsBreakdowns`/`ClvCard` (dedupe StatsPage/BetsPage), `PayoutLadderEditor` (dedupe Deal/StackValue), shared `ordinal()`/date-input helpers in `domain/format.ts`.

---

## 6. Current Validation Results

Environment: Linux container, Node 20+/npm 10.9.7, no Android SDK. Commands run 2026-07-23 at `55ea476`.

| Validation | Exact command | Result | Relevant details |
|---|---|---|---|
| Web dependency install | `cd web && npm install` | ✅ Pass | Modified `web/package-lock.json` (lockfile churn only); reverted with `git checkout -- web/package-lock.json` to keep the tree clean |
| Web unit tests | `cd web && npm test` | ✅ Pass | Vitest 2.1.9 — **18 files, 150 tests, all passing**, 2.2s |
| Type-check + production build | `cd web && npm run build` | ✅ Pass | `tsc --noEmit` clean; Vite build 87 modules; bundle 378.6 kB (113.8 kB gzip); PWA precache 17 entries generated |
| Lint | — | ⚠️ Not possible | **No ESLint/Prettier config exists in the repo** (no `.eslintrc*`, no `eslint.config.*`). TypeScript `strict` is the only static gate |
| Android build | not attempted (`./gradlew assembleDebug`) | ⚠️ Environment | No Android SDK in the assessment container; failure would be environmental, not a project signal |
| Android unit tests | not attempted (`./gradlew test`) | ⚠️ Environment | Same as above; 27 `@Test` methods exist in `app/src/test/` |
| TODO/FIXME/HACK scan | `grep -rn 'TODO\|FIXME\|HACK\|XXX'` (excl. node_modules/.git/dist) | ✅ Clean | Zero matches repo-wide |
| Git state | `git status` | ✅ Clean | Working tree clean after lockfile revert; branch `claude/document-instructions-4dqlpk` at `55ea476` |

Nothing was repaired during validation. No secrets exist in the repo (no network, no tokens); none appear in this document.

---

## 7. Findings Summary

Categories: Confirmed defect (BUG), Reliability risk (REL), UI inconsistency (STYLE), Usability (UX), Accessibility (A11Y), Maintainability (CODE), Security (SEC), Testing gap (TEST), Documentation gap (DOC), Legacy Android (AND), Repo infrastructure (INFRA). Severity: Critical/High/Medium/Low/Informational. Confidence: Confirmed/High/Medium/Speculative.

| ID | Finding | Category | Evidence | Severity | Confidence | Recommendation |
|---|---|---|---|---|---|---|
| BUG-001 | Backup restore silently zeroes bounty winnings | Confirmed defect | `domain/backup.ts:105-151` field list omits `bountyPerBounty`/`bountyCount`; `types.ts:509-514` includes them in `profit()` | **High** | Confirmed | Required — add fields + round-trip test |
| BUG-002 | CSV round-trip loses bounty data; Profit column inconsistent with reimport | Confirmed defect | `domain/csv.ts:26-29` header, `:53-90` writer, `:123-163` parser | Medium | Confirmed | Required — additive columns |
| BUG-003 | Home-game money inputs cannot accept decimals | Confirmed defect | `pages/HomeGamesPage.tsx:134-151` parse-on-keystroke controlled input | **High** | Confirmed | Required — raw-string input pattern |
| BUG-004 | Import placeholder renders literal `&#10;` | Confirmed defect | `pages/ImportPage.tsx:227-228` HTML entity in JS string | Low | Confirmed | Fix with `\n` |
| BUG-005 | Date parsers accept invalid calendar dates via rollover (Feb 31 → Mar 3) | Confirmed defect | `domain/csv.ts:39-44`; `domain/importMap.ts:203` | Low | Confirmed | Validate round-trip of Y/M/D |
| BUG-006 | 2-digit years in YMD import become 19xx | Confirmed defect | `domain/importMap.ts:190-201` century fix-up skipped in YMD branch | Low | Confirmed | Hoist `year += 2000` |
| BUG-007 | AUTO odds parsing misreads decimal-comma odds ("1,91" → +191) | Confirmed defect | `domain/betImportMap.ts:72-82`; also `importMap.ts:144-156` for `1.234,56` | Low | Confirmed | Detect decimal comma before stripping |
| BUG-008 | `avgStake` counts free-bet stakes that `totalStaked` excludes | Confirmed defect | `domain/bets.ts:217` vs `:301` | Low | Confirmed | Align definitions |
| BUG-009 | Imports accept negative durations/amounts (accounting-style `"(2)"` parses to −2, skewing hours/ROI) | Confirmed defect | `domain/importMap.ts:144-156,286-296`; consumed at `stats.ts:173-174` | Low | Confirmed | Clamp to ≥0 in `applyMapping`/`applyBetMapping` |
| REL-001 | Backup restore clears all stores before writing; no atomicity/rollback | Reliability risk | `hooks/useAppState.tsx:317-374`; per-record tx in `storage/db.ts:53-67` | **High** | Confirmed (as risk) | Required — write-then-swap or multi-store tx |
| REL-002 | IndexedDB writes resolve before transaction commit | Reliability risk | `storage/db.ts:60-65` resolves on `request.onsuccess` | Medium | Confirmed | Resolve on `transaction.oncomplete` |
| REL-003 | DB load / import errors silently swallowed; app renders as empty | Reliability risk | `hooks/useAppState.tsx:168,507` `.catch(() => undefined)`; `pages/ImportPage.tsx:175-183` no try/catch | Medium | Confirmed | Surface a load-error banner; try/finally import |
| REL-004 | `openDb` lacks `onblocked`/`onversionchange`; failed open memoized forever | Reliability risk | `storage/db.ts:36-51` | Medium | Confirmed | Add handlers; reset `dbPromise` on failure |
| REL-005 | Unguarded `localStorage` writes can throw inside React state updaters (white screen) | Reliability risk | `storage/settings.ts:20-21,51-54,70-72`; called in updaters `useAppState.tsx:178-188,254-260,353-370` | Medium | Confirmed | try/catch the three writers |
| REL-006 | CSV import writes one record per transaction; partial failure desyncs UI and duplicates on retry | Reliability risk | `useAppState.tsx:227-235,303-314` | Medium | Confirmed | Batch `saveAll` in one tx |
| REL-007 | Session/bet editors allow duplicate submits (each inserts a new record) | Reliability risk | `pages/EditorPage.tsx:302-308,659`; `pages/BetEditorPage.tsx:201-205,504`; insert path `useAppState.tsx:191-197` | Medium | High | `saving` state + disabled button |
| REL-008 | Backup restore lacks validation: tool collections copied unchecked, enum casts unvalidated, epoch-0 sessions accepted | Reliability risk | `domain/backup.ts:169-173` (`collection<T>`), `:145-148` (casts), `:109,118` (startTime 0) | Low–Med | Confirmed | Validate shapes/enums; skip timestamp-less sessions |
| UX-001 | Destructive one-tap actions without confirmation: discard live session, delete transaction/event/hand note/blind template, exit running clock | Usability | `LiveSessionCard.tsx:119-121`; `BankrollPage.tsx:141`; `CalendarPage.tsx:138-143`; `HandNotesPage.tsx:204`; `ClockPage.tsx:150-158,276` | **High** | Confirmed | Reuse `ConfirmDialog` |
| UX-002 | No loading state anywhere; `ready`/`loaded` flags computed but never consumed → false "no data" flash | Usability | `useAppState.tsx:131,169,502`; e.g. `SessionsPage.tsx:237-244`, `BetsPage.tsx:206-211` | Medium | Confirmed | Gate empty states on ready |
| UX-003 | Back-navigation model: `navigate(-1)` breaks on deep links, silently discards dirty forms; state-based sub-views (clock, home-game detail) invisible to system back | Usability | `EditorPage.tsx:383`, all sub-pages; `HomeGamesPage.tsx:34-59`; `ClockPage.tsx:48-56` | Medium | High | History-aware back fallback; search-param sub-views |
| UX-004 | One-tap bet settle (Won/Lost/Push adjacent) with no undo or feedback | Usability | `BetsPage.tsx:272-290` | Low | Confirmed | Tap-again-to-confirm or undo snackbar |
| UX-005 | Silent saves: bankroll amounts, unit size, clipboard share give no feedback | Usability | `GeneralSettingsPage.tsx:94-104,130-142`; `SportsSettingsPage.tsx:27-36`; `HandNotesPage.tsx:196-203` | Low | Confirmed | Use existing message banner |
| UX-006 | Multi-currency records summed as one number labeled with default currency | Usability | per-record `currency` in types; sums at `SessionsPage.tsx:81-87`, StatsPage tiles, BankrollPage | Low | High | Show caveat when mixed currencies present |
| UX-007 | Tournament clock: no screen wake lock — device sleeps mid-tournament | Usability | `ClockPage.tsx` RunningClock; no `wakeLock` reference in `src/` | Medium | Confirmed | `navigator.wakeLock` progressive enhancement |
| UX-008 | Rebuy/StartSession dialog state persists across opens; stale defaults | Usability | `LiveSessionCard.tsx:151,208-223` | Low | Confirmed | Reset on close |
| UX-009 | Date-range filter uses stale `now` across midnight | Usability | `useAppState.tsx:411-412` | Low | Confirmed | Accept & document, or coarse refresh |
| UX-010 | Cross-field validation gaps: minutes >59, SB>BB, position>field, nameless clock templates | Usability | `EditorPage.tsx:349-359,502-506,538-541`; `ClockPage.tsx:164-170` | Low | Confirmed | Inline `.neg small` hints on save |
| A11Y-001 | Dialogs: no focus trap/restore; Escape dead until focus enters backdrop subtree | Accessibility | `common.tsx:148-157`; `LiveSessionCard.tsx:155-160,254-259` | Medium | Confirmed | autoFocus + Escape at dialog + restore |
| A11Y-002 | Search inputs unlabeled; `.visually-hidden` class referenced but does not exist (and `display:none` anyway) | Accessibility | `SessionsPage.tsx:92`; `BetsPage.tsx:141-148`; absent from `global.css` | Medium | Confirmed | Add real utility; label both |
| A11Y-003 | Dashboard bankroll hero uses `all: unset` — no visible focus | Accessibility | `StatsPage.tsx:90-95`; outline defined at `global.css:133` | Medium | Confirmed | `.btn-plain` class |
| A11Y-004 | Gold overline text ≈1.8:1 contrast in light theme | Accessibility | `StatsPage.tsx:96-98,110` `--gold-500` on `--bg` #f7f9f7 | Medium | High | Theme-flipping `--accent` token |
| A11Y-005 | Chips (primary filter/settle controls) 30–36px tall vs `--touch` 44px | Accessibility | `global.css:231,243` vs `:34` | Low | Confirmed | Enlarge hit area |
| A11Y-006 | `aria-pressed` misuse on FilterPanel disclosure (means "filters active", not pressed) | Accessibility | `common.tsx:414-421` | Low | Confirmed | Keep `aria-expanded`; class for style |
| A11Y-007 | Heatmap values only in SVG `<title>` — untouchable/unreadable | Accessibility | `charts.tsx:196-204,229` | Low | Confirmed | Optional focusable cells |
| STYLE-001 | Ad-hoc inline styles bypass tokens: ≥10 distinct inline font sizes across 11 files; literal colors `#3d1414`, `#ff6b6b`, `#fff` | UI inconsistency | e.g. `StatsPage.tsx:99,197,446`; `EditorPage.tsx:648`; `BankrollPage.tsx:33`; `LiveSessionCard.tsx:72`; `global.css:193,534,541` | Medium | Confirmed | Utility classes + token sweep |
| STYLE-002 | Inconsistent page-header/empty-state patterns: `paddingTop: 0` inline hack copy-pasted in 14 pages; `.empty` vs `.muted` empties | UI inconsistency | `EditorPage.tsx:397`, `BankrollPage.tsx:30,96-100`, etc. | Low | Confirmed | `.page--with-topbar`; standardize `.empty` |
| STYLE-003 | Theme/manifest polish: dark-only `theme-color`; poker-only manifest copy despite sports/tables; portrait-locked orientation vs table-display clock; `offline.html` root-absolute retry link | UI inconsistency | `index.html:10-11`; `public/manifest.webmanifest:2-4,9`; `public/offline.html:44` | Low | Confirmed | Small metadata fixes |
| STYLE-004 | Three hand-duplicated theme blocks in global.css (root, media-dark, data-theme overrides) — palette edits must be made 2–3× | Maintainability | `global.css:4-107` | Low | Confirmed | Accept (document), or restructure once during STYLE-001 work |
| CODE-001 | Meaningful duplication: sports stat cards byte-identical across StatsPage/BetsPage; `ordinal()` ×3; date-input helpers ×2; number-input factory ×6; payout ladder editor ×2; hub row ×2; message banner ×2; `round2` ×4; month/weekday grouping ×2; chip-chop floor logic ×2 | Maintainability | `StatsPage.tsx:457-538` vs `BetsPage.tsx:381-427`; `PayoutPage.tsx:148-156`/`DealPage.tsx:286-294`/`StackValuePage.tsx:279-287`; `deal.ts:45`/`payout.ts:37`/`settlement.ts:34`/`stackValue.ts:50`; `stats.ts:147-352` vs `bets.ts:142-283` | Medium | Confirmed | Extract shared components/helpers |
| CODE-002 | Index keys on add/remove row lists (focus/IME lands on wrong row) | Maintainability | `BetEditorPage.tsx:317`; `DealPage.tsx:106,154`; `StackValuePage.tsx:172`; `ChipsPage.tsx:74`; `ClockPage.tsx:190` | Low | Confirmed | Monotonic row ids (HomeGames precedent) |
| CODE-003 | Fixed SVG gradient `id="fill"` — collides if two profit charts ever co-render | Maintainability | `charts.tsx:50` | Low | Confirmed | `useId()` |
| CODE-004 | `MapField.key: string` defeats `MapFieldKey` typing; `as ColumnMapping` papers over it | Maintainability | `domain/importMap.ts:44,47,138` | Low | Confirmed | Type the key union |
| CODE-005 | Hard-coded domain constants (ICS 4h event length, insight thresholds, payout ratio 0.6, chip share weights) | Maintainability | `ics.ts:41`; `insights.ts:20-21,52-54`; `payout.ts:69`; `chips.ts:66,72` | Informational | Confirmed | Name them; only ICS duration is a candidate setting |
| CODE-006 | No linter/formatter in the toolchain (an `eslint-disable` comment exists with no ESLint) | Maintainability | no `.eslintrc*`/`eslint.config.*` in `web/`; `useAppState.tsx:509` | Medium | Confirmed | Optional: minimal ESLint flat config |
| SEC-001 | PIN stored as single-round SHA-256 with constant salt; file header claims "Nothing here is sensitive" | Security | `storage/settings.ts:2,58-66` | Low | Confirmed | Accepted as nuisance lock; per-device random salt + honest comment |
| TEST-001 | No bounty round-trip test in backup/CSV suites (why BUG-001/002 survived) | Testing gap | `domain/backup.test.ts`, `domain/csv.test.ts` — zero `bounty` matches | High | Confirmed | Required — add with the fixes |
| TEST-002 | Untested modules: `ics.ts` (none), `format.ts` (3/17 fns), `storage/*` (none), `files.ts` error mapping | Testing gap | test-to-source map in `web/src` | Medium | Confirmed | Add targeted tests |
| DOC-001 | Root README presents frozen Android app as the product; calls PWA "a port of this exact app"; roadmap lists features the web app already shipped | Documentation gap | `README.md:3-8,15-16,141-150` | High | Confirmed | Rewrite framing: web = product, Android = legacy |
| DOC-002 | web/README stale: claims 27 tests (actual 150), feature list ends at V2 | Documentation gap | `web/README.md:34,61,11-28` | Medium | Confirmed | Unpin the number; refresh features |
| DOC-003 | docs/* are accurate historical records that read as current; security notes predate the PIN feature | Documentation gap | `docs/pwa-migration-plan.md:26,136`; `docs/qa-checklist-v2.md:3`; `docs/pwa-security-notes.md:5-6` | Low–Med | Confirmed | Dated "historical" banners + PIN paragraph |
| AND-001 | Android (all legacy, deferred unless app is revived): About says "Version 1.0" (`SettingsScreen.kt:315` vs `versionName "1.2"`); export/import file I/O on main thread (`SettingsScreen.kt:171-175,221,245-249,293`); stats computed on Main dispatcher (`BankrollViewModel.kt:43-68`); restore/import not transactional (`BankrollViewModel.kt:108-140`); starting bankroll stored as Float (`SettingsRepository.kt:33,39`); androidTest deps with no androidTest dir (`app/build.gradle.kts:28,99-101`); `exportSchema = false` (`AppDatabase.kt:15`) | Legacy Android | as cited | Low–Med | Confirmed/High | Defer; document legacy status (DOC-001) |
| INFRA-001 | 11 MB APK tracked in git despite `*.apk` ignore rule; four ~11 MB APK blobs dominate the ~20 MiB pack | Infrastructure | `dist/BankrollEdge-v1.2.apk`; `.gitignore:12` | Medium | Confirmed | `git rm --cached` + GitHub Release; **no history rewrite** |
| INFRA-002 | Duplicate `.gitignore` rules | Infrastructure | `.gitignore:3,6,10,11` | Low | Confirmed | Optional tidy |

No Critical-severity findings. No exploitable security vulnerabilities (no network surface; all data local).

---

## 8. Detailed Findings

Only findings needing implementation detail beyond §7 are expanded. Line numbers are as of commit `55ea476`; always re-locate by symbol name.

### BUG-001 — Backup restore silently zeroes bounty winnings
- **Classification:** Confirmed defect (data loss). **Severity:** High. **Confidence:** Confirmed (verified directly, not only by review).
- **Evidence:** `web/src/domain/backup.ts` — `backupFromJson` builds each restored session from an explicit field list spread over `emptySession()` (lines ~105–151). The list includes every money field **except** `bountyPerBounty` and `bountyCount`. `backupToJson` (line ~59) exports full sessions via rest-spread, so backups *contain* the fields. `grep -n bounty web/src/domain/backup.ts` → zero matches.
- **Symbols:** `backupFromJson`, `backupToJson`, `emptySession`, `normalizeSession`; `Session.bountyPerBounty`/`bountyCount` (`models/types.ts:82-85`); `bountyWon`, `profit` (`types.ts:509-514`).
- **Current behavior:** export → restore resets every session's bounty fields to 0; profit, bankroll, stats and streaks silently change for bounty tournaments.
- **Desired behavior:** restore reproduces exported sessions exactly.
- **Why it matters:** the JSON backup is the app's *only* safety net (per-browser-profile storage, iOS eviction); a lossy backup silently corrupts the user's money history.
- **Correction (simplest):** add `bountyPerBounty: num(o.bountyPerBounty)` and `bountyCount: num(o.bountyCount)` to the mapping. **Tests:** extend `backup.test.ts` round-trip fixture with a bounty tournament asserting both fields and `profit()` survive.
- **Alternatives considered:** schema-driven field mapping (rejected — heavier than the bug warrants). **Risk:** none; additive read of fields already written. **Effort:** Small. **Required.**

### BUG-002 — CSV round-trip loses bounty data
- **Classification:** Confirmed defect. **Severity:** Medium. **Confidence:** Confirmed (verified).
- **Evidence:** `web/src/domain/csv.ts` — `HEADER` (~26–29) has no bounty columns; `buildCsv` (~53–90) writes `profit(s)` (bounty-inclusive) but not the bounty inputs; `parseCsv` (~123–163) recomputes profit from buyIn/cashOut, ignoring the Profit column → reimported profit is lower than the file's own Profit column for bounty sessions.
- **Correction:** append `BountyPerBounty,BountyCount` columns to `HEADER`/`buildCsv` and read them in `parseCsv` (the file's own comment says unknown columns are ignored by older importers, so this is additively compatible with the Android app — verify `app/src/main/java/com/bankrolledge/app/util/CsvImporter.kt` ignores unknown headers before shipping; it matches by header name, so extra columns are skipped). **Tests:** bounty round-trip case in `csv.test.ts`. **Effort:** Small. **Required.**

### BUG-003 — Home-game money inputs cannot accept decimals
- **Classification:** Confirmed defect. **Severity:** High (feature-blocking for cent amounts). **Confidence:** Confirmed (verified).
- **Evidence:** `web/src/pages/HomeGamesPage.tsx` `GameDetail.moneyInput` (~134–151): `value={value === 0 ? '' : String(value)}` + `onChange` → `Number.parseFloat(...) || 0`. Typing `12.` re-renders as `"12"` (decimal point swallowed); `0.5` is impossible (`0` renders `''`). Same parse-on-keystroke round-trip (integer-only, lower impact) in `ClockPage.tsx` `numInput` (~120–134).
- **Correction:** hold raw strings in state, parse on save — the exact pattern `EditorPage.tsx` documents in its header comment and `MoneyInput` (`common.tsx:331`) implements. Preferably implement the shared `NumberInput` (CODE-001 item 4) and use it here. **Behavior preserved:** stored `HomeGamePlayer` amounts remain numbers. **Tests:** none practical without component tests; manual step in §9/UI-017. **Effort:** Small. **Required.**

### REL-001 — Non-atomic backup restore (clear-then-write)
- **Classification:** Reliability risk (data loss). **Severity:** High. **Confidence:** Confirmed as risk.
- **Evidence:** `web/src/hooks/useAppState.tsx` `restoreBackup` (~317–374): awaits `clearSessions/clearTransactions/betStore.clear` + six tool-store clears, then per-record `save` loops — each record its own IndexedDB transaction (`storage/db.ts` `tx`, ~53–67). A quota error, thrown normalization, or tab close mid-restore leaves the DB wiped/partial; React state still shows the old (deleted) data; no rollback exists.
- **Correction (simplest robust):** add one function to `db.ts` that runs a **single `readwrite` transaction across all nine stores**: clear each store and re-put all records inside that transaction, resolving on `transaction.oncomplete`. IndexedDB aborts the whole transaction on any failure, giving atomicity for free. Then `restoreBackup` does: parse/normalize everything first (already done by `backupFromJson`), call the atomic swap, then set React state from the written records. Wrap in try/catch; on failure re-load stores from the DB so UI matches reality and surface the error (REL-003's banner).
- **Method signature:** `replaceAll(data: { [storeName: string]: { id: number; ... }[] }): Promise<void>` in `storage/db.ts`.
- **Autoincrement note:** records are re-put with their (new, sequential) ids assigned client-side before the transaction, or use `put` results within the tx; either is fine — ids are internal.
- **Risks:** medium — touches the restore path; mitigated by backup.test.ts round-trip plus a new failure-injection test (mock a store that throws; assert old data intact). **Effort:** Medium. **Required.**

### REL-002 — IndexedDB writes resolve before commit
- **Evidence:** `storage/db.ts` `tx` (~60–65) resolves on `request.onsuccess`; a later transaction abort (`QuotaExceededError` at commit) loses the write after the UI said "saved".
- **Correction:** capture `request.result` in `onsuccess`, resolve in `transaction.oncomplete`; reject in `transaction.onerror`/`onabort`. One function; every store inherits the fix. **Risk:** low (slightly later resolution; all callers already `await`). **Effort:** Small. **Required.**

### REL-003 / UX-002 — Silent load failures + missing loading gates
- **Evidence:** `useAppState.tsx:168` and `:507` — `.catch(() => undefined)`; `ready`/`loaded` flags set but consumed by no page; `ImportPage.tsx` `doImport` (~175–183) has no try/catch (a throw leaves `busy` stuck and the button dead).
- **Desired:** a `loadError: string | null` on `AppState`; App shell shows a banner ("Couldn't load your data — close other tabs and reload; your data has not been deleted."). List pages return `null` (or skeleton) until `ready`; `.empty` copy only after. `doImport` wrapped in try/catch/finally with the message banner.
- **Why:** an IndexedDB failure currently looks identical to "all my data is gone", and the user's likely reaction (restore a backup over it) is destructive. **Effort:** Small. **Required** (banner + import guard); loading gates **Recommended**.

### REL-004 — `openDb` multi-tab/upgrade hangs
- **Evidence:** `storage/db.ts` `openDb` (~36–51): no `onblocked` (an old-version tab blocks the open forever → app stuck `ready=false` with no message), no `db.onversionchange` (this tab blocks *future* upgrades), and `dbPromise ??=` memoizes a rejected promise permanently.
- **Correction:** `request.onblocked = () => reject(new Error('Close other BankrollEdge tabs and reload.'))`; on success `db.onversionchange = () => db.close()`; on rejection reset `dbPromise = null`. Surfaces through REL-003's banner. **Effort:** Small. **Required.**

### REL-005 — localStorage writes can crash React
- **Evidence:** `storage/settings.ts` `saveSettings` (:20-21), `saveActiveSession` (:51-54), `setPin` (:70-72) have no try/catch; `saveSettings` runs inside `setSettings` updaters (`useAppState.tsx:178-188, 254-260, 353-370`). Safari private mode / quota → throw inside an updater → React unmounts (white screen).
- **Correction:** wrap the three writers in try/catch; return boolean; callers may ignore (degraded persistence beats a crash). **Effort:** Small. **Required.**

### REL-006 — Per-record import transactions
- **Evidence:** `useAppState.tsx` `importSessions` (~303–314), `importBets` (~227–235): `for … await save(…)`; failure at record N persists 1..N-1, `setSessions` never runs, retry duplicates.
- **Correction:** `saveAll(name, records)` batch helper in `db.ts` (one `readwrite` tx, resolve on complete, return assigned ids); use it in both importers and in `restoreBackup` (shares REL-001's plumbing). Also collapses `syncManagedPickLists`' one-at-a-time venue/stake saves. **Effort:** Small–Medium (shares REL-001 code). **Required.**

### REL-007 — Duplicate-submit on editors
- **Evidence:** `EditorPage.tsx` `onSubmit` (~302–308) awaits save then `navigate(-1)`; submit button (~659) never disabled; new sessions save with `id: 0` → every submit inserts (`useAppState.tsx:191-197`). Same in `BetEditorPage.tsx` (~201–205, ~504). `ImportPage.tsx` already implements the correct `busy` pattern (~64, 175–183).
- **Correction:** `const [saving, setSaving] = useState(false)`; guard the handler, `disabled={saving}` on the button; label flips to "Saving…". **Effort:** Small. **Required.**

### UX-001 — Unconfirmed destructive actions
- **Evidence & scope:** Discard live session (`LiveSessionCard.tsx:119-121` → `app.clearSession` — sits next to "Stop & log"; hours of timing lost on a mistap); delete bankroll transaction (`BankrollPage.tsx:141` — changes balance); delete calendar event (`CalendarPage.tsx:138-143`); delete hand note (`HandNotesPage.tsx:204`); delete blind-structure template + one-tap "✕ Exit" on the running clock (`ClockPage.tsx:150-158, 276`). Sessions, bets, backups, home games already confirm via `ConfirmDialog` (`common.tsx:130`) — protection is inconsistent, not absent.
- **Correction:** reuse `ConfirmDialog` for: Discard ("Discard this live session? Its timer and rebuys will be lost."), transaction delete, event delete, note delete, clock Exit-while-running. Venue/stakes-preset deletes (GeneralSettings/Poker/TableGames settings) may stay one-tap — they're recreatable reference data; leave as-is to avoid nagging. **Effort:** Small each. **Required** for Discard + transaction delete + clock exit; Recommended for event/note.

### UX-003 — Back-navigation model
- **Evidence:** every sub-page's TopBar back is `navigate(-1)` (e.g. `EditorPage.tsx:383`); on a cold deep link there is no history → back exits the PWA or no-ops. EditorPage back silently discards a fully-typed form; BetEditor saves to `/bets` but backs to `-1` (asymmetric). Sub-views held in local state — `HomeGamesPage.tsx:34-59` (`openId`), `ClockPage.tsx:48-56` (running clock) — are invisible to the system back gesture: back exits the page, killing a running clock (compounds UX-001).
- **Correction (incremental):** (1) shared `useBack(fallback: string)` helper: `location.key !== 'default' ? navigate(-1) : navigate(fallback)`; adopt per page (Editor→`/sessions` or `/tables` by type, Bankroll→`/settings`, tools→`/tools`, settings→`/settings`). (2) Represent sub-views in the URL: `?game=<id>` on HomeGames, `?running=1` on Clock via `useSearchParams`, so system back closes the sub-view first. (3) Optional dirty-form confirm on Editor back (reuse ConfirmDialog). **Effort:** Medium total. **Recommended.**

### UX-007 — Clock wake lock
- **Correction:** in `RunningClock`, on mount (and on `visibilitychange` back to visible) `navigator.wakeLock?.request('screen')`, release on unmount; ignore rejections. ~10 lines, progressive enhancement. **Effort:** Small. **Recommended.**

### A11Y-001 — Dialog focus management
- **Evidence:** `ConfirmDialog` (`common.tsx:148-157`) autofocuses confirm but has no trap/restore. `RebuyDialog`/`StartSessionDialog` (`LiveSessionCard.tsx:155-160, 254-259`) hang `onKeyDown` Escape on the backdrop div but never move focus into the dialog — Escape is dead until the user clicks inside; Tab walks into the obscured page.
- **Correction (one shared pattern):** on open, `autoFocus` the first control; `keydown` Escape handler on the dialog element; save `document.activeElement` on open and `.focus()` it on close; minimal trap (on Tab from last → first). Native `<dialog>.showModal()` is an acceptable alternative — pick one approach for all three dialogs. **Effort:** Medium. **Recommended.**

### STYLE-001 — Inline style sprawl vs tokens
- **Evidence:** ≥10 distinct inline `fontSize` values across 11 files (2.4/2/1.8/1.6/1.5/1.4/1.3/1.25/1.2/1.15rem — e.g. `StatsPage.tsx:99,197,446`, `EditorPage.tsx:648`, `BetEditorPage.tsx:489`, `BankrollPage.tsx:33`, `LiveSessionCard.tsx:72`, `BetsPage.tsx:391`, `PinLock.tsx:25`, `common.tsx:194`, `ToolsPage.tsx:66`); ad-hoc inline gaps/margins; hard-coded colors `#3d1414` (`global.css:534`), `#ff6b6b` (`:541` — duplicates dark `--loss`, wrong under light theme), `#fff` (`:193`).
- **Correction:** add the §5 utility classes (`.money-xl`, `.money-lg`, `.stat-value`, `.icon-lg`, `.btn-plain`, `.visually-hidden`, `.page--with-topbar`) + `--accent`/`--warning-bg` tokens to `global.css`, then sweep pages replacing inline styles. Mechanical, verifiable by `grep -rn "fontSize" web/src` shrinking to ~0. **Effort:** Medium (spread across batches 3–5). **Recommended.**

### CODE-001 — Meaningful duplication to extract
Extract only these (each is real, drifting duplication — not architecture for its own sake):
1. `SportsBreakdowns` + `ClvCard` components — `StatsPage.tsx:457-538` vs `BetsPage.tsx:381-427` (CLV card byte-identical; three copies of "Profit by month" already drifting in `topLabel`).
2. `ordinal()` → `domain/format.ts` — three identical copies (`PayoutPage.tsx:148-156`, `DealPage.tsx:286-294`, `StackValuePage.tsx:279-287`).
3. Date/time `<input>` helpers (`pad`/`toDateInput`/`toTimeInput`) → shared module — `EditorPage.tsx:82-146` vs `BetEditorPage.tsx:61-74`.
4. `NumberInput` shared control (raw-string sanitized) — replaces six local `field()`/`numInput()` factories and fixes BUG-003's pattern at the root.
5. `PayoutLadderEditor` — `DealPage.tsx:153-182` ≈ `StackValuePage.tsx:171-199` (identical copy text).
6. `HubRow` — export ToolsPage's row for SettingsPage.
7. `MessageBanner` — `GeneralSettingsPage.tsx:78-82` / `ImportPage.tsx:204-208`.
8. Domain: shared `round2` (×4: `deal.ts:45`, `payout.ts:37`, `settlement.ts:34`, `stackValue.ts:50`) and month/weekday `groupBy` helpers (`stats.ts:147-352` vs `bets.ts:142-283`) → small `domain/aggregate.ts`.
**Effort:** Medium total, each Small. **Recommended** (behavior-preserving; tests must stay green).

### DOC-001/002/003 + INFRA-001 — Truthful repo front door
- Rewrite `README.md` top: BankrollEdge is the PWA at bankrolledge.com (v1.34, poker + table games + sports + tools); `app/` is the legacy Android v1.2 origin kept for reference and data-format interop; point build/deploy docs at `web/`. Fix roadmap items already shipped (deal/ICM calculator).
- `web/README.md`: replace both "27" test claims (actual: 150 and growing — say "the Vitest suite"); refresh or link out the feature list.
- `docs/*.md`: one dated italic banner each — "Historical document from the Android→PWA migration (2026-07). The web app has moved on; see web/README.md." Add a short PIN paragraph to `pwa-security-notes.md` (constant-salted SHA-256, nuisance-lock threat model, not encryption).
- `dist/BankrollEdge-v1.2.apk`: `git rm --cached dist/BankrollEdge-v1.2.apk`, add `dist/` to `.gitignore`, attach the APK to a GitHub Release ("legacy Android v1.2"). **No history rewrite** (the four historical blobs stay; acceptable).
**Effort:** Small each. **Recommended** (DOC-001 is High-severity: it misleads every visitor).

---

## 9. Screen-by-Screen UI Plan

Only screens that change. Every entry preserves all existing behavior except the listed problems. "Verify" = manual steps; "Done when" = acceptance criteria. (Text wireframes omitted where the change is behavioral, not layout.)

### UI-001 Dashboard (`StatsPage.tsx`)
- **Problems:** hero focus ring destroyed (`all: unset`); gold overlines fail light-theme contrast; content renders before data (`ready` unused); duplicated sports cards.
- **Changes:** hero button → `className="btn-plain"`; overlines → `var(--accent)`; gate page body on `app.ready` (render nothing/skeleton until ready); replace inline money/stat font sizes with `.money-xl`/`.stat-value`; swap duplicated sports blocks for shared `SportsBreakdowns`/`ClvCard`.
- **Unchanged:** all metrics, filters, tabs, card visibility settings, tap targets and routes.
- **Verify:** keyboard-Tab to hero shows gold outline; light theme overline legible (contrast ≥4.5:1); hard-reload shows no "empty" flash; sports numbers identical before/after extraction.
- **Done when:** no `all: unset` and no inline `fontSize` in file; `grep` confirms; stats visually unchanged.

### UI-002/003 Sessions & Tables lists (`SessionsPage.tsx`)
- **Problems:** false "No sessions yet" flash; broken hidden label.
- **Changes:** `if (!app.ready) return null` before empty-state; search label → `.visually-hidden` real utility (or `aria-label`).
- **Verify:** screen reader announces "Search sessions"; reload shows list without empty-flash.
- **Done when:** `visually-hidden` class exists in `global.css` and is used; ready-gate in place.

### UI-004 Sports (`BetsPage.tsx`)
- **Problems:** unlabeled search; one-tap settle with three adjacent buttons, no undo; duplicated stats cards; ready-flash.
- **Changes:** label search; settle → two-tap confirm (first tap arms the chip: "Won?"; second tap within ~3 s commits — or an Undo snackbar reusing `saveBet`); ready-gate; use shared sports components.
- **Unchanged:** settle semantics (status write via `settleBet`), list grouping, filters.
- **Verify:** single tap does not settle; mistap recoverable; settled bet appears in history with correct status.
- **Done when:** settling requires confirm/undo path; stats identical to pre-refactor.

### UI-005 Session editor (`EditorPage.tsx`)
- **Problems:** double-submit duplicates; back discards dirty form; minutes/SB-BB/position cross-field gaps.
- **Changes:** `saving` guard + disabled submit ("Saving…"); back uses `useBack(scope fallback)` and, when dirty, ConfirmDialog "Discard unsaved changes?"; on-save inline hints (`.neg small`): minutes clamped 0–59, warn SB>BB, warn position>fieldSize (warnings block nothing except invalid minutes).
- **Unchanged:** field set, live net preview, delete confirm, `?live=1` hand-off, raw-string input pattern.
- **Verify:** double-tap Save creates one session; deep-link `/session/new` → back lands on Sessions, not browser exit; entering 75 minutes shows hint.
- **Done when:** duplicate-submit impossible; back never exits app; tests still green.

### UI-006 Bet editor (`BetEditorPage.tsx`)
- **Changes:** same `saving` guard; legs list keyed by monotonic id instead of index; back symmetric with save destination (`/bets`).
- **Verify:** removing middle parlay leg keeps focus/IME on the correct row; double-tap Save creates one bet.

### UI-007 Bankroll (`BankrollPage.tsx`)
- **Problems:** transaction delete unconfirmed; `.muted` empty state; inline 1.8rem balance.
- **Changes:** ConfirmDialog on delete ("Delete this deposit/withdrawal? Your balance will change."); `.empty` class; `.money-lg`/`.money-xl` for the balance.
- **Verify:** delete asks first; cancel leaves record; balance updates after confirm.

### UI-010 General settings (`GeneralSettingsPage.tsx`)
- **Problems:** bankroll saves silent; import path unguarded (via ImportPage).
- **Changes:** on Save success set existing `message` state ("Saved."); disable Save when input equals stored value.
- **Verify:** tapping Save shows banner; no-op Save disabled.

### UI-015 Import (`ImportPage.tsx`)
- **Problems:** literal `&#10;` in placeholder; `doImport` without try/catch.
- **Changes:** `\n` in placeholder strings; try/catch/finally around `doImport` with failure message in the banner; `busy` reset guaranteed.
- **Verify:** placeholder shows two lines; a simulated storage failure shows an error, button re-enabled.

### UI-016 Blind clock (`ClockPage.tsx`)
- **Problems:** one-tap Exit kills running tournament; sub-view invisible to system back; screen sleeps; nameless templates; integer inputs share BUG-003's pattern; literal warning colors.
- **Changes:** Exit-while-running → ConfirmDialog ("End the tournament clock?"); represent running state as `?running=1` (back gesture returns to editor with clock still running in state — or pauses; simplest: back closes overlay, clock keeps state); wake lock on RunningClock mount; require non-empty template name (inline hint); `numInput` → shared `NumberInput`; `#3d1414`/`#ff6b6b` → `--warning-bg`/`var(--loss)`.
- **Unchanged:** structures, alerts, level math (`domain/clock.ts` untouched).
- **Verify:** Android back gesture during running clock does not silently kill it; screen stays awake ≥2 min; Exit asks first.

### UI-017 Home games (`HomeGamesPage.tsx`)
- **Problems:** decimals impossible (BUG-003); detail view invisible to system back.
- **Changes:** `moneyInput` → shared `NumberInput` (raw string, decimal-capable); detail open state → `?game=<id>` search param.
- **Unchanged:** settlement math, seat draw, player add/remove (keep the existing per-player id pattern).
- **Verify:** type `27.50` buy-in — accepted and settles correctly; `0.5` works; system back from detail returns to list, not out of the page.
- **Done when:** decimal entry works end-to-end; settlement totals include cents.

### UI-022/023 Calendar & Hand notes
- **Changes:** ConfirmDialog on event/note delete; clipboard-copy feedback ("Copied.") via MessageBanner or transient inline text.
- **Verify:** deletes ask first; share on a non-Web-Share browser shows "Copied."

### UI-026/027 Live session card + dialogs (`LiveSessionCard.tsx`, `common.tsx`)
- **Problems:** unconfirmed Discard; dialogs' focus/Escape broken; stale rebuy amount across opens.
- **Changes:** Discard → ConfirmDialog; apply the shared dialog pattern (autoFocus first control, Escape on dialog, focus restore, minimal trap) to ConfirmDialog/RebuyDialog/StartSessionDialog; reset RebuyDialog `amount` when closed; StartSessionDialog re-reads `settings.defaultSessionType` on each open (key by open-count or reset in an effect on `open`).
- **Verify:** Escape closes each dialog immediately after opening (no click first); after closing, focus is back on the trigger; Discard asks first; reopening Add-rebuy shows an empty amount.

### UI-028 Shell (`App.tsx`, `common.tsx`, `global.css`, `index.html`, `manifest.webmanifest`, `offline.html`)
- **Changes:** add load-error banner (REL-003) beside the offline banner; FilterPanel drops `aria-pressed` (style active state via class); `.chip` hit area ≥44px (visual size unchanged); second `theme-color` meta for light scheme; manifest name/description mention poker, table games & sports; drop `orientation: "portrait"` (or set `"any"`) for the clock's landscape use; `offline.html` retry link relative (`./`).
- **Verify:** Lighthouse PWA pass unchanged; light-theme status bar matches `--bg`; installed app rotates on the clock screen (after reinstall/update).

---

## 10. Prioritized Recommendations

### Priority 0 — Immediate (data integrity)
BUG-001, BUG-002, TEST-001 (write the failing round-trip tests *first*), BUG-003, REL-001, REL-002, REL-005, REL-003 (error banner + import guard).
*Rationale:* silent money-data corruption/loss in the app's only safety mechanisms.

### Priority 1 — Core quality
REL-004, REL-006, REL-007, UX-001, UX-002, BUG-004, BUG-005, BUG-006, BUG-007, BUG-008, BUG-009, A11Y-001..004, STYLE-001 (tokens/utilities + primary screens), UX-007, DOC-001, INFRA-001.

### Priority 2 — Valuable later
UX-003 (back model), UX-004, UX-005, UX-010, REL-008, STYLE-002, STYLE-003, CODE-001, CODE-002, CODE-006 (ESLint), TEST-002, DOC-002, DOC-003, A11Y-005, A11Y-006.

### Priority 3 — Optional
UX-006 (multi-currency caveat), UX-008, UX-009, A11Y-007, CODE-003, CODE-004, CODE-005, SEC-001, STYLE-004, INFRA-002. Android AND-001 items: deferred entirely unless Android development resumes.

**Dependencies / order:** tests before fixes (Batch 1 → 2); `db.ts` transaction work (REL-002) before the atomic restore/batch import built on it (REL-001/006); design tokens/utilities (Batch 3) before page sweeps (Batches 4–5); shared `NumberInput` (CODE-001.4) is the vehicle for BUG-003, so it lands in Batch 2 with a minimal API and grows later.

---

## 11. Implementation Tasks

Each task is independently implementable and verifiable unless noted. "Validate" always includes: `cd web && npm test && npm run build` green. Rollback for every task: `git revert` of its commit (each batch = one commit; tasks within a batch may be one commit if listed together).

**T-01 · [TEST-001] Bounty round-trip regression tests (write first — must fail)**
Files: `web/src/domain/backup.test.ts`, `web/src/domain/csv.test.ts`.
Do: add a tournament session fixture with `bountyPerBounty: 50, bountyCount: 3` to each round-trip test; assert both fields and `profit()` survive export→import. Run: both new tests FAIL (proving BUG-001/002), pre-fix.
Accept: two failing tests referencing bounty fields. Effort: S. Independent: yes (committed together with T-02/T-03).

**T-02 · [BUG-001] Restore bounty fields in `backupFromJson`**
Files: `web/src/domain/backup.ts` (symbol `backupFromJson`).
Do: add `bountyPerBounty: num(o.bountyPerBounty)` and `bountyCount: num(o.bountyCount)` to the session mapping.
Preserve: every other field mapping; `normalizeSession` call.
Accept: T-01 backup test passes. Effort: S.

**T-03 · [BUG-002] Bounty columns in CSV**
Files: `web/src/domain/csv.ts` (`HEADER`, `buildCsv`, `parseCsv`).
Do: append `BountyPerBounty,BountyCount` as the LAST columns (append-only keeps Android import compatible — its importer matches columns by header name and skips unknowns); write raw numbers; parse with the existing safe-number helper, default 0.
Accept: T-01 CSV test passes; existing csv tests green. Effort: S.

**T-04 · [REL-002] Commit-safe `tx()`**
Files: `web/src/storage/db.ts` (symbol `tx`).
Do: capture `request.result` on `request.onsuccess`; resolve in `transaction.oncomplete`; reject in `transaction.onerror` and `transaction.onabort` (with `transaction.error ?? new Error('IndexedDB transaction failed')`).
Preserve: function signature and all call sites unchanged.
Accept: app behaves identically in manual smoke (save/edit/delete session); tests green. Effort: S. Prerequisite for T-05/T-06.

**T-05 · [REL-001] Atomic `replaceAll` + safe restore**
Files: `web/src/storage/db.ts` (new `replaceAll`), `web/src/hooks/useAppState.tsx` (symbol `restoreBackup`).
Do: implement `replaceAll(data: Record<string, {id:number}[]>): Promise<Record<string, number[]>>` — one `readwrite` transaction over the named stores: `clear()` then `put` each record (strip `id` 0 for autoincrement), collect keys, resolve on `oncomplete`. Rewrite `restoreBackup` to: build all record arrays first → `await replaceAll(...)` → set React state; wrap in try/catch — on error, re-load all stores from the DB into state and rethrow so the caller (GeneralSettingsPage) shows the failure banner.
Preserve: which settings roam vs stay device-local (`useAppState.tsx:353-370` merge list); sort orders.
Tests: add `backup.test.ts`-adjacent unit test only if a fake IDB is already feasible; otherwise cover via manual verify (restore a backup; kill the tab mid-restore is not scriptable — the atomic tx covers it by construction).
Accept: restore works; a thrown error mid-build leaves existing data intact (verifiable by passing a malformed record in a dev test). Effort: M. Depends: T-04.

**T-06 · [REL-006] Batch imports via `saveAll`**
Files: `web/src/storage/db.ts` (new `saveAll(name, records)` — single tx, returns ids), `web/src/hooks/useAppState.tsx` (`importSessions`, `importBets`, `syncManagedPickLists`).
Do: replace per-record loops with one `saveAll` call per store; state update from returned ids.
Accept: CSV import of 1k rows completes; all-or-nothing on failure. Effort: S–M. Depends: T-04.

**T-07 · [REL-005] Guard localStorage writers**
Files: `web/src/storage/settings.ts` (`saveSettings`, `saveActiveSession`, `setPin`).
Do: wrap bodies in try/catch (log via `console.warn`); return `boolean` success (callers may ignore).
Accept: no throw propagates from the three functions. Effort: S.

**T-08 · [REL-003+REL-004] Load-error surfacing + robust `openDb`**
Files: `web/src/storage/db.ts` (`openDb`), `web/src/hooks/useAppState.tsx` (add `loadError: string | null` to `AppState`; set in the initial-load `.catch` and `useStoreList`), `web/src/App.tsx` (banner beside offline banner: `role="alert"`, copy "Couldn't load your data — close other BankrollEdge tabs and reload. Nothing has been deleted."), `web/src/pages/ImportPage.tsx` (`doImport` try/catch/finally → failure into existing `message` banner).
Do: `onblocked` rejects; `onversionchange` closes; reset `dbPromise` on failure.
Accept: simulate failure (temporarily throw in `loadSessions` during dev) → banner appears, app still navigable; import failure re-enables button with message. Effort: S–M.

**T-09 · [BUG-003+CODE-001.4] Shared `NumberInput` + HomeGames/Clock adoption**
Files: `web/src/components/common.tsx` (new `NumberInput`: props `label, value: string, onValue(raw: string), inputMode: 'decimal'|'numeric', placeholder?`; sanitize regex `[^0-9.]` / `[^0-9]`; raw string held by caller), `web/src/pages/HomeGamesPage.tsx` (GameDetail money fields become raw-string local state, parsed on save/blur into the player record), `web/src/pages/ClockPage.tsx` (`numInput` → NumberInput).
Preserve: stored types stay numbers; settlement math untouched.
Accept: `27.50` and `0.5` enterable in home-game buy-in/cash-out; clock level fields still integer-only; §9/UI-017 verify steps pass. Effort: M.

**T-10 · [REL-007] Saving guards on editors**
Files: `web/src/pages/EditorPage.tsx`, `web/src/pages/BetEditorPage.tsx`.
Do: `saving` state; early-return re-entry; `disabled={saving}`; label "Saving…". Accept: double-tap creates one record (manual). Effort: S.

**T-11 · [UX-001] Confirmations sweep**
Files: `web/src/components/LiveSessionCard.tsx` (Discard), `web/src/pages/BankrollPage.tsx` (tx delete), `web/src/pages/ClockPage.tsx` (Exit while running; template delete optional), `web/src/pages/CalendarPage.tsx`, `web/src/pages/HandNotesPage.tsx`.
Do: local `confirming` state + existing `ConfirmDialog`; copy per §9. Venue/stake-preset deletes intentionally left one-tap.
Accept: each listed action shows dialog; cancel is a no-op. Effort: S–M.

**T-12 · [BUG-004..008] Small confirmed-defect fixes**
Files: `web/src/pages/ImportPage.tsx` (`\n` placeholders); `web/src/domain/csv.ts` `parseIso` + `web/src/domain/importMap.ts` `parseFlexibleDate` (post-construct `d.getMonth()/getDate()` round-trip check → null); `importMap.ts` (hoist `year += 2000` for YMD); `web/src/domain/betImportMap.ts` `parseOdds` (`/^\d+,\d+$/` → decimal-comma) and `importMap.ts` `parseMoney` (European format guard); `web/src/domain/bets.ts` (`avgStake` excludes free bets); `web/src/domain/importMap.ts` `applyMapping` + `betImportMap.ts` `applyBetMapping` (`Math.max(0, …)` on duration/buyIn/rebuys/tips/expenses/fieldSize/stake) [BUG-009].
Tests: add cases to `csv.test.ts`, `importMap.test.ts`, `betImportMap.test.ts`, `bets.test.ts` for each.
Accept: new tests pass; `2026-02-31` row counted skipped; `"1,91"` → 1.91 decimal. Effort: M (many small).

**T-13 · [STYLE-001 tokens] Design-system utilities**
Files: `web/src/styles/global.css` only.
Do: add `--accent` (light: #7a5f16 or `--primary` — must pass 4.5:1 on `--bg`; dark: `var(--gold-500)`), `--warning-bg`, `--space-xs`, `--space-sm`; classes `.money-xl`, `.money-lg`, `.stat-value`, `.icon-lg`, `.btn-plain`, `.visually-hidden` (clip-path pattern), `.page--with-topbar { padding-top: 0 }`; replace `#ff6b6b`→`var(--loss)`, `#3d1414`→`var(--warning-bg)`, `.btn-danger` `#fff`→token; `.chip` hit-area ≥44px via padding/pseudo-element without visual growth.
Accept: build green; visual smoke on dashboard/lists unchanged except chip spacing. Effort: S–M. Prerequisite for T-14/T-15.

**T-14 · [A11Y-002/003/004 + UX-002 + STYLE-001] Primary-screen sweep (Dashboard, Sessions, Bets)**
Files: `web/src/pages/StatsPage.tsx`, `SessionsPage.tsx`, `BetsPage.tsx`.
Do: per §9 UI-001/002/003/004 — `btn-plain` hero, `--accent` overlines, ready-gates, real labels, inline font sizes → utilities.
Accept: §9 verify steps for those screens. Effort: M. Depends: T-13.

**T-15 · [STYLE-001/002 remainder] Secondary-page sweep**
Files: remaining pages with inline sizes / `paddingTop: 0` (Editor, BetEditor, Bankroll, LiveSessionCard, PinLock, Tools, Settings pages).
Do: adopt `.page--with-topbar`, utilities; standardize `.empty`.
Accept: `grep -rn "paddingTop: 0" web/src/pages` → 0; `grep -c fontSize` materially reduced (target ≤3 justified cases). Effort: M. Depends: T-13.

**T-16 · [A11Y-001 + UX-008] Dialog behavior**
Files: `web/src/components/common.tsx` (ConfirmDialog), `web/src/components/LiveSessionCard.tsx` (both dialogs).
Do: shared pattern — autoFocus first control, Escape on dialog element, focus-restore to trigger, last→first Tab wrap; reset RebuyDialog amount on close; StartSessionDialog defaults re-read per open.
Accept: §9 UI-026/027 verify steps. Effort: M.

**T-17 · [UX-007] Clock wake lock + [UX-001] exit confirm + [UX-010] template name**
Files: `web/src/pages/ClockPage.tsx`.
Do: wake-lock request/release with `visibilitychange` re-acquire; ConfirmDialog on Exit while running; block saving nameless templates with inline hint.
Accept: §9 UI-016 verify. Effort: S–M.

**T-18 · [UX-003] Back-navigation model**
Files: new `web/src/hooks/useBack.ts` (or export from `common.tsx`), all sub-pages' TopBar `onBack`, `web/src/pages/HomeGamesPage.tsx` (`?game=`), `web/src/pages/ClockPage.tsx` (`?running=1`).
Do: per §8 UX-003. Editor dirty-check: compare a JSON snapshot of form state taken on mount.
Accept: deep-link back lands on the fallback; system back closes sub-views; dirty editor back asks. Effort: M.

**T-19 · [UX-004/005] Feedback: settle confirm/undo + saved banners**
Files: `web/src/pages/BetsPage.tsx` (`OpenBetRow`), `GeneralSettingsPage.tsx`, `SportsSettingsPage.tsx`, `HandNotesPage.tsx`; shared `MessageBanner` in `common.tsx` (CODE-001.7).
Accept: §9 UI-004/UI-010 verify. Effort: S–M.

**T-20 · [CODE-001] Deduplication extractions**
Files: new `web/src/components/SportsBreakdowns.tsx` (+ ClvCard), `web/src/components/PayoutLadderEditor.tsx`; `domain/format.ts` (`ordinal`, `round2` re-export home or `domain/aggregate.ts`), shared date-input helpers; `HubRow` export; adopt across StatsPage/BetsPage/Deal/StackValue/Payout/Tools/Settings/Editors.
Constraint: pure moves — rendered output and computed numbers byte-identical; tests green.
Accept: duplicated blocks gone (`ordinal` defined once); no visual diff on affected screens. Effort: M.

**T-21 · [CODE-002/003, REL-008] Small correctness hygiene**
Files: `BetEditorPage.tsx`/`DealPage.tsx`/`StackValuePage.tsx`/`ChipsPage.tsx`/`ClockPage.tsx` (monotonic row ids); `charts.tsx` (`useId` gradient); `domain/backup.ts` (validate enum literals like `venueType` does; skip sessions with non-positive `startTime` and count them; shape-check tool collections to plain objects with required array fields defaulted).
Tests: backup.test.ts cases: lowercase `gameQuality` falls back to `''`; startTime-less session skipped.
Accept: tests green. Effort: M.

**T-22 · [TEST-002] Coverage for untested modules**
Files: new `web/src/domain/ics.test.ts` (escaping, UTC format, VALARM), extend `format.test.ts` (`money`, `compactMoney`, `duration`, `hourLabel`, `elapsedClock`, `currencySymbol`), `files.test.ts` (error-mapping branches via mocks).
Accept: new tests meaningful and green. Effort: M.

**T-23 · [CODE-006] Optional: minimal ESLint**
Files: `web/eslint.config.js`, `web/package.json` (devDeps: `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`; script `"lint"`).
Do: flat config, recommended + react-hooks rules only; fix or explicitly disable what it flags; do NOT add a formatter pass that reformats the codebase.
Accept: `npm run lint` clean; zero behavioral diffs. Effort: M. **Optional — skip if the user prefers no new dev-deps.**

**T-24 · [DOC-001/002/003] Documentation truth pass**
Files: `README.md`, `web/README.md`, `docs/pwa-migration-plan.md`, `docs/screen-mapping.md`, `docs/pwa-security-notes.md`, `docs/qa-checklist-v2.md`.
Do: per §8 DOC section. Keep the Android build instructions (moved under a "Legacy Android app" heading).
Accept: README states web=product in the first screen-full; no stale test counts; docs bannered. Effort: S–M.

**T-25 · [INFRA-001/002] Untrack APK; tidy .gitignore**
Files: `.gitignore`, `dist/` (untrack).
Do: `git rm --cached dist/BankrollEdge-v1.2.apk`; add `dist/` ignore; dedupe ignore rules; (manual, outside the repo: attach APK to a GitHub Release — note for the user, not automatable here).
Accept: `git ls-files | grep apk` empty; APK still on disk locally. Effort: S.

**T-26 · [STYLE-003] PWA metadata polish**
Files: `web/index.html` (paired `theme-color` metas), `web/public/manifest.webmanifest` (name/description cover table games & sports; `orientation: "any"`), `web/public/offline.html` (relative retry link).
Accept: Lighthouse PWA still passes; §9 UI-028 verify. Effort: S.

Not converted to tasks (accepted as-is): UX-006, UX-009, A11Y-007, CODE-005, SEC-001, STYLE-004, INFRA-002 (beyond dedupe), all AND-xxx — see §15.

---

## 12. Implementation Batches

Each batch: one commit (subject `web v1.x.y: <summary>` with a `web/package.json` version bump for user-visible batches; docs/infra batches use `chore:`/`docs:` subjects, no version bump), leaves the project buildable, ends with `cd web && npm test && npm run build` green plus the listed manual checks.

| Batch | Objective | Tasks | Key files | Validation beyond tests/build | Done when |
|---|---|---|---|---|---|
| **B1 — Regression protection** | Failing tests that pin the data bugs | T-01 | backup.test.ts, csv.test.ts | `npm test` shows exactly the 2 new failures | Bounty round-trip tests exist and fail |
| **B2 — Data integrity** | Fix confirmed data bugs + persistence reliability | T-02..T-08, T-12 | domain/backup.ts, csv.ts, importMap.ts, betImportMap.ts, bets.ts, storage/db.ts, storage/settings.ts, hooks/useAppState.tsx, App.tsx, ImportPage.tsx | Manual: backup export→restore preserves a bounty session's profit; CSV round-trip likewise; save/edit/delete smoke on sessions/bets/transactions | All tests green incl. B1's; restore is atomic; load errors visible |
| **B3 — Design standards** | Token/utility foundation | T-13, T-26 | global.css, index.html, manifest.webmanifest, offline.html | Visual smoke both themes; Lighthouse PWA pass | Utilities exist; no literal colors below token block |
| **B4 — Main workflow & primary screens** | Dashboard/lists/editors correct & consistent | T-09, T-10, T-14 | StatsPage, SessionsPage, BetsPage, EditorPage, BetEditorPage, HomeGamesPage, ClockPage, common.tsx | §9 verify steps for UI-001..006, UI-017 | Decimal home-game amounts; no duplicate submits; no empty-flash; hero focus + contrast fixed |
| **B5 — Dialogs & secondary screens** | Confirmations, dialog behavior, back model, clock | T-11, T-16, T-17, T-18, T-15 | LiveSessionCard, ClockPage, BankrollPage, CalendarPage, HandNotesPage, common.tsx, sub-pages | §9 verify for UI-007, UI-016, UI-022/023, UI-026/027 | All listed destructive actions confirm; Escape/focus correct; system back sane |
| **B6 — Status & feedback states** | Success/undo/error feedback everywhere | T-19 | BetsPage, GeneralSettingsPage, SportsSettingsPage, HandNotesPage, common.tsx | §9 UI-004/UI-010 verify | No silent saves; settle is recoverable |
| **B7 — Readability & maintainability** | Deduplicate; hygiene | T-20, T-21 | new shared components, format.ts/aggregate.ts, charts.tsx, backup.ts, row-list pages | Screens visually unchanged; numbers identical | Single source for each duplicated block |
| **B8 — Tests & tooling** | Close coverage gaps; optional lint | T-22, T-23 (optional) | new/extended test files, eslint config | `npm run lint` (if T-23) | Untested modules covered |
| **B9 — Documentation & repo hygiene** | Truthful docs; slim repo | T-24, T-25 | README.md, web/README.md, docs/*, .gitignore, dist/ | Proofread; `git ls-files | grep apk` empty | Front door says web=product; APK untracked |

Order rationale: B1→B2 is test-first for the data bugs; B3 must precede the page sweeps in B4/B5; B4 before B5 puts the highest-traffic screens first; B7 after behavior fixes so refactors move settled code; docs last so they describe the end state.

---

## 13. Regression Test Checklist

Run after each batch (relevant rows) and fully at the end. Automated: `cd web && npm test && npm run build`. Manual (in `npm run preview` and once as an installed PWA):

- **Startup:** cold load shows data (no empty-flash); PIN gate when set; wrong PIN rejected; offline reload (airplane mode) works with banner.
- **Primary workflows:** add cash session, tournament (with bounties), table session, sports bet (single + parlay); edit each; delete each (confirm dialog); live session start → rebuy → bounty +/- → stop & log prefills editor; repeat-last-setup.
- **Navigation:** all six tabs; FAB target per tab; deep-link `/session/new`, `/tools/clock`, `/settings/general` then back — never exits app; system back closes home-game detail and clock overlay; `/stats` redirects to `/`.
- **Data entry & validation:** decimals in every money field including home games; minutes >59 hinted; garbage characters rejected; double-tap Save yields one record.
- **Database:** bankroll deposit/withdraw with history and confirmed delete; balance = starting + sessions + transactions (+ sports when merged); clear-data per scope removes only that scope.
- **Import/export:** CSV export → guided import round-trip (sessions and bets), including a bounty tournament and a `1,91`-odds row; JSON backup → restore preserves everything (bounties, tags, tool data) and merges only roaming settings; malformed backup rejected with message and no data loss.
- **Error & recovery:** load-error banner path (dev-simulated); import failure re-enables button with message.
- **Loading/progress:** lists gate on ready; clock runs, alerts at level change, survives screen-off attempt (wake lock), Exit confirms.
- **Resizing/DPI:** 320px-wide viewport no horizontal scroll; desktop wide window content column centered; both themes; `prefers-color-scheme` + manual override.
- **Keyboard/touch:** Tab reaches hero/nav/chips with visible outline; dialogs trap and restore focus; Escape closes; chips comfortably tappable.
- **Config compatibility:** existing localStorage settings and IndexedDB v4 data from the deployed app load unchanged (no DB_VERSION bump is planned by any task).
- **Installation/deployment:** `npm run build` output serves under `preview`; service worker updates on reload (autoUpdate); manifest installable; offline.html reachable when SW cold.
- **Upgrade/rollback:** deploy is static — rollback = redeploy previous build; IndexedDB schema untouched, so old builds read new data (new CSV columns are additive; Android importer skips unknown columns).
- **Android interop (spot):** web CSV with bounty columns imports into Android v1.2 without error (columns ignored); Android CSV imports into web unchanged.

---

## 14. Definition of Done

- `cd web && npm test` — all tests (150 existing + new) pass; `npm run build` clean.
- No confirmed Critical/High finding unresolved except those explicitly deferred in §15.
- Primary workflows manually verified per §13.
- Screens follow §5 standards: no `all: unset`, no literal colors outside the token block, inline `fontSize` reduced to justified exceptions, every input labeled.
- Clear success/warning/loading/empty/error states exist per §9; no silent saves; destructive actions per UX-001 confirm.
- Duplicate submits impossible on both editors; one-tap settle recoverable.
- Changes are narrowly scoped; no new runtime dependencies; no framework/architecture changes; existing 150-test behavior unchanged.
- New behavior (bounty round-trip, date validation, odds parsing, atomic restore) has tests.
- This document updated: per-task status, deviations, and date stamps appended to §18 (add a "## 18. Execution Log" section on first implementation).

---

## 15. Deferred and Rejected Ideas

| Idea | Verdict | Reason |
|---|---|---|
| Rewrite/replace UI framework, add component library or state-management library | **Rejected** | Existing React+tokens+context stack is coherent and small; framework churn is pure regression risk (framework limitation not demonstrated) |
| Android app feature catch-up (port v1.3–v1.34 features to Kotlin) | **Deferred** | Enormous scope; the PWA is the product; revisit only if native-only needs arise (widgets, Play Store) |
| Fixing Android AND-001 items now | **Deferred** | Low user value while the app is frozen; fix only if Android development resumes |
| Git history rewrite to purge the four ~11 MB APK blobs | **Rejected** | Destructive to clones/PRs; `git rm --cached` (T-25) stops the bleeding; ~20 MiB pack is tolerable |
| Multi-currency conversion/normalization | **Deferred** | Real product feature (exchange rates, historical rates); out of scope; T-level caveat only (UX-006, P3) |
| Replacing hand-rolled IndexedDB wrapper with `idb`/Dexie | **Rejected** | 120-line wrapper is fine once T-04/T-05 land; dependency cost outweighs benefit |
| Component-level test harness (React Testing Library) | **Deferred** | Would help (BUG-003 class), but adds a test stack; revisit after T-22; not required for this plan |
| Global toast/snackbar system | **Rejected (for now)** | The existing `MessageBanner` pattern + per-row confirm covers current needs; a toast layer is abstraction ahead of need |
| PIN upgrade to PBKDF2/WebAuthn | **Rejected** | Nuisance-lock threat model (device already unlocked); honest documentation (T-24) is the right fix; per-device salt optional |
| Making every hard-coded domain constant a setting (CODE-005) | **Rejected** | Settings sprawl; name constants in code; only ICS event duration is a plausible future setting |
| Virtualized lists / performance work | **Rejected** | No evidence of a problem at personal-scale data volumes (Speculative); revisit with real data |
| Auto-backup reminders/scheduled exports | **Deferred** | Genuine value against iOS eviction, but new product surface; user decision |
| `.gitignore` restructure beyond dedupe; theme-block consolidation (STYLE-004) as its own project | **Rejected** | Churn without user value; STYLE-004 only if trivially absorbed during T-13 |

---

## 16. Assumptions and Open Decisions

| # | Assumption / decision | Recommended default | Alternatives & effects | Safe to proceed without answer? |
|---|---|---|---|---|
| 1 | The web PWA is the product; Android stays frozen legacy | Yes (evidence: commits, deploy pipeline, feature gap) | Reviving Android would reprioritize AND-001 and kill DOC-001's framing | Yes — default assumed |
| 2 | CSV format may gain trailing bounty columns | Yes — additive, Android importer skips unknown headers (`CsvImporter.kt` matches by name) | Freeze format → BUG-002 only documentable, not fixable | Yes |
| 3 | ESLint dev-dependency acceptable (T-23) | Yes, minimal flat config | Skip → CODE-006 stays open; zero runtime impact either way | Yes — T-23 is optional |
| 4 | Deleting venue/stakes presets may stay unconfirmed | Yes (recreatable reference data) | Confirm-everything → more nagging | Yes |
| 5 | Clock back-gesture behavior: overlay closes, clock keeps running (state preserved) vs. pause | Keep running | Pausing surprises a live tournament | Yes |
| 6 | Bet settle protection: two-tap arm-confirm vs. undo snackbar | Two-tap confirm (no new UI surface) | Snackbar is nicer but nudges toward a toast system (rejected §15) | Yes |
| 7 | `orientation` manifest change requires reinstall to take effect on some platforms | Accept, note in commit | Leave portrait → clock landscape blocked in installed app | Yes |
| 8 | No DB_VERSION bump needed by any task | Correct — no schema changes planned | If T-05 design changes stores, bump + `onupgradeneeded` required | Yes |
| 9 | GitHub Release upload for the APK (T-25) is manual, done by the user | Note in PR/commit message | Keep APK tracked → INFRA-001 stays | Yes |
| 10 | Version bumps: one minor bump per user-visible batch | e.g. B2→v1.35.0 … B6→v1.39.0 | Single combined bump at the end | Yes |

Missing information: none blocking. Real-device iOS behavior and the Android toolchain remain unvalidated in this environment (see §6) — nothing in the plan depends on them.

---

## 17. Codex Execution Instructions

For the agent implementing this plan:

1. Read this plan fully, plus `README.md`, `web/README.md`, and the §3 conventions. There is no CLAUDE.md/AGENTS.md.
2. Check `git status`; preserve any existing user changes. Work on the branch the user designates.
3. Revalidate the baseline first: `cd web && npm install && npm test && npm run build` — expect 150 passing tests and a clean build. If the baseline differs from §6, stop and tell the user.
4. Implement only the task IDs the user approves.
5. Follow the batch order in §12 (B1 → B9). One commit per batch minimum; subjects follow the repo convention (`web v1.x.y: …` for user-visible changes, bump `web/package.json`).
6. Keep changes narrowly scoped to the listed files/symbols; line numbers are from commit `55ea476` — re-locate by symbol name if drifted.
7. Preserve existing intended behavior; all pre-existing tests must stay green untouched (only add).
8. Use the §5 design standards for any UI work; add tokens/utilities to `global.css` rather than inline styles.
9. Prefer the simplest implementation in the existing stack; the only permitted new dependency is ESLint tooling under optional T-23.
10. Do not introduce new abstractions beyond the shared components/helpers named in T-09/T-20.
11. After every batch: `cd web && npm test && npm run build`, plus the batch's manual checks in §12/§13.
12. Perform the §9 manual UI verifications where possible (`npm run preview`); note any you cannot perform.
13. Update this document as you go: append an "## 18. Execution Log" section with task status (done/skipped/deviated + why).
14. If repository conditions contradict this plan (moved files, changed behavior, failing baseline), stop and ask the user.
15. Do not commit, push, or open a pull request unless the user has separately requested it.

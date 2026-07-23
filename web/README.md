# BankrollEdge Web (PWA)

The Progressive Web App version of BankrollEdge — a poker **utility** app
(no gameplay, no wagering): session & bankroll tracking, home-game tools and
lightweight study support. It runs in any modern browser, installs to the
home screen on Android and iOS, and works **fully offline** (all data stays
on your device in IndexedDB/localStorage — no server, no account).

> Track every session. Run every home game. Know where you win.

**Highlights** (the V2 era added these beyond the original Android port;
later releases added sports-bet tracking, casino table games, guided CSV
import with column mapping, category tabs, managed venue/stakes/game
pick-lists and a settings hub — see the git history for the full changelog):

- Sessions: Sit & Go / Home Game / Other types, live-vs-online, separate
  add-ons, rake, expenses, tags, hands played, table size, and optional
  session-quality tracking (focus/tilt/discipline, sleep, alcohol, game
  quality, stop-loss/stop-win) — plus "Repeat last session setup".
- Analytics: plain-English insight cards (best hourly spot, tournament ROI,
  after-midnight performance, losing streaks, live-vs-online, focus and game
  quality), new breakdowns and filters (live/online, tags, session type).
- Tools (in the More tab): tournament blind clock (templates, breaks, alerts, full-screen),
  home-game ledger with settlement + suggested payments + seat draw, payout
  calculator (templates + pool-conserving rounding), deal/chop calculator
  (ICM, chip chop or even split of the remaining pool), my stack value (chip
  position + ICM cash equity for a single stack), chip calculator with
  inventory warnings, poker calendar with .ics device-calendar reminders,
  and hand notes with a review-later queue.
- Privacy: optional PIN lock at launch and a hide-balances (blur) mode.
  Everything remains free and local — no accounts, no paywall.

## How it was migrated

The Android app (Kotlin, Jetpack Compose, Room, MVVM) was ported screen-by-
screen to React + TypeScript + Vite. Business logic (stats engine, filters,
CSV, backup) was translated 1:1 — originally covered by the same 27 unit
tests as the Android suite, with the Vitest suite growing alongside every
feature since. **CSV exports and JSON backups are format-compatible with the
Android app**, so you can move your data between the two with a backup file.
See:

- `../docs/pwa-migration-plan.md` — analysis, architecture, limitations
- `../docs/screen-mapping.md` — Android file → PWA route/component table
- `../docs/pwa-security-notes.md` — storage/security decisions

## Stack

React 18 · TypeScript · Vite 6 · vite-plugin-pwa (Workbox) ·
react-router-dom · plain mobile-first CSS · IndexedDB · Vitest.

## Prerequisites

Node.js 20+ and npm.

## Commands

```bash
cd web
npm install        # install dependencies
npm run dev        # dev server at http://localhost:5173
npm run build      # type-check (tsc) + production build into dist/
npm run preview    # serve the production build at http://localhost:4173
npm test           # run the Vitest unit-test suite
npm run icons      # regenerate PNG icons from public/icons/icon.svg
```

## Testing PWA installability

1. `npm run build && npm run preview` (or deploy `dist/` to any HTTPS host).
   Service workers require HTTPS or `localhost`.
2. **Android Chrome**: open the site → ⋮ menu → *Install app* (or the install
   prompt). Launch from the home screen — it opens standalone, full-screen.
3. **iOS Safari**: open the site → Share → *Add to Home Screen*. iOS has no
   install prompt; this is the standard flow.
4. **Offline check**: load the app once, enable airplane mode, relaunch —
   everything (including your data) still works. An "Offline" banner appears,
   purely informational.
5. **Lighthouse**: DevTools → Lighthouse → PWA category should pass
   (manifest, service worker, icons, standalone display).

## Known limitations

- **iOS storage eviction**: Safari may evict site data for rarely-used sites.
  The app requests persistent storage and offers one-tap JSON backups —
  export a backup periodically if your data matters to you.
- **Data is per browser profile** — clearing site data deletes it (use
  backups to move/restore).
- **Web Share API**: file sharing works on Android Chrome and iOS Safari 15+;
  other browsers fall back to a normal file download automatically.
- **No cross-device sync** (same as the Android app — it has none either).

## Deployment notes

The build output (`web/dist/`) is a static site. Any static host works
(GitHub Pages, Netlify, Cloudflare Pages, nginx). Requirements:

- Serve over **HTTPS**.
- SPA fallback: route unknown paths to `/index.html` (the service worker
  handles this after first load; the host should too for cold deep links).
- Recommended headers: `Content-Security-Policy: default-src 'self'`,
  `X-Frame-Options: DENY`.
- If hosting under a sub-path (e.g. GitHub Pages project site), set Vite's
  `base` and the manifest `start_url`/`scope` accordingly.

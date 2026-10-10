# Session entry choice (web v1.54.0)

Every interactive session-add entry point opens the same **Add session** dialog:

- **Start a live session** opens the existing live setup. The timer begins only after the final Start button.
- **Record a previous session** opens the historical entry form. No timer starts; the record is saved only on Add session.

Both paths retain optional total commute minutes. Existing active sessions are retained. If any are running, the chooser and live setup explain that another live session creates a separate timer, and the final button says **Start another live session**.

## Entry-point inventory

| Entry point | Source | Behavior/context |
|---|---|---|
| Dashboard inline Add session / Add another session | `components/LiveSessionCard.tsx` | Opens shared choice; uses dashboard defaults and unambiguous game/venue filters |
| Dashboard floating + | `App.tsx` | Same session choice when poker/table tracking is enabled; sports-only mode still adds a bet |
| Poker floating + | `App.tsx`, `/sessions` | Same choice; preserves selected poker category/game, otherwise configured poker default; does not inherit Table category |
| Table floating + | `App.tsx`, `/tables` | Same choice; always Table, preserving a single table game and venue filter |
| Direct/bookmarked `/session/new` URL, including a trailing slash | `routes/routes.tsx`, `pages/NewSessionPage.tsx` | Shared choice before either form; cold-link Cancel returns to the relevant session list |
| Existing `?type=`, `?start=`, `?duration=` links | Shared route | Type applies to both choices; start/duration apply to historical entry only; live timers use the actual Start click time |
| Same-app custom Quick Link | `pages/MorePage.tsx` | A link to `/session/new` opens the same choice in its new tab |
| More destinations, settings search and pinned bottom navigation | `models/navDestinations.ts`, `components/common.tsx` | Navigate to normal list/dashboard routes; their existing add buttons then use the shared choice |

The audit of `web/src`, `web/public` and the manifest found no additional built-in session-add links or PWA shortcuts. The manifest has no shortcut list.

## Exempt paths

These continue their existing action without a new-session choice:

- `/session/:id` edits an existing record, including session rows and recent-session links.
- `/session/new?live=<startedAt>&duration=...` finishes/resumes an existing draft. The older `?live=1` form remains supported. Invalid, empty or already-finished live handles show a blocked state and cannot become new blank sessions.
- The historical form's Add session button completes the already-chosen flow. Repeat last session setup only fills that form.
- CSV imports and JSON backup restores are explicit bulk historical-data operations, not interactive creation of a new live/past session.
- Sports bets, calendar events, home-game ledgers, hand notes, wallet entries and travel-log entries use different record types.

## Shared implementation and context

`hooks/useSessionEntry.ts` sends all built-in add actions through `/session/new`. `pages/NewSessionPage.tsx` owns the choice; route state records the selected step, source and opener. Direct URLs cannot bypass the choice with `mode` or `step` query parameters. A reload or browser Forward can resume an already-selected step without creating anything.

`domain/sessionEntry.ts` resolves defaults for both paths. A single selected category, game/table game, venue or live/online filter is carried forward. Ambiguous multi-select values are not guessed. List date ranges, search text, stakes filters and result filters do not backdate a timer or invent financial inputs. The configured currency is retained.

Deep links also accept `game`, `tableGame`, `venueType` and `location`; custom game/venue names remain selectable. Invalid types, timestamps and durations fall back safely. These values are only initial form data, never automatic save/start instructions.

`components/StartSessionDialog.tsx` reuses the existing live setup and persistence guard, extracted from the dashboard card. No storage schema, financial calculation, backup format or dependency change is required.

## Navigation and accessibility

- The shared modal is labelled, traps Tab/Shift+Tab focus, and gives each choice a descriptive hint for assistive technology.
- Escape, backdrop and Cancel exit without creating records or timers. Built-in entry points return to their source and restore focus to the original button.
- Live setup has Back to return to the choices and Cancel to exit the entire add flow. Browser Back/Forward and reload work without starting a timer.
- Historical entry retains its existing in-app unsaved-change confirmation. Browser Back still discards unsaved form edits; stored records/drafts are unaffected.
- Repeated add/choice clicks are guarded. Repeated final Start and Save retain their synchronous persistence guards.
- Successful start/save replaces the form's history entry, so Forward does not reopen the submitted form. Starting live shows the dashboard and its running timers; recording history returns to the originating route or relevant list.

## Verification

Verified on 2026-10-10: **289 tests passed in 28 files**, production build and TypeScript checking passed, and **21 synthetic browser scenarios passed** in Chrome 154. Screenshots and overflow checks cover 320, 375 and 1280 pixel widths. No lint script is configured.

From `web`: `npm test -- --maxWorkers=2 --minWorkers=1` and `npm run build` (includes TypeScript checking). No lint script exists. New unit regressions cover scope/default precedence, unique/ambiguous filters, all six session categories, custom context, malformed deep links, and inert creation query parameters. Existing commute, migration, CSV/JSON and calculation tests remain in the suite.

Browser checks use an isolated profile with synthetic records and a loopback-only static server. Cover both choices from all four built-in entry points, cold/user quick links, More navigation, filters, mobile/desktop, keyboard and focus restoration, browser history/reload, multiple active sessions, repeated clicks/submits, failed writes, edit/finish/resume bypasses, commute persistence, sports/import exclusions and failed initial data loading. No live site or user profile is mutated.

Publication requires separate approval. The feature is prepared locally on top of v1.53.0; its version bump does not publish it.

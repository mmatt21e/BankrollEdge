# Manual QA Checklist — Poker Utility V2 (web app)

Automated coverage: 61 unit tests over all calculation logic (profit incl.
add-ons/expenses, ROI, hourly rate, settlement balancing + transfers, payout
templates/rounding conservation, chip distribution + inventory warnings,
clock level math + pause/resume, insights thresholds, CSV/backup round-trips,
v1-data compatibility). The items below are the on-device flows to verify by
hand.

## Session tracking
- [ ] Start a cash session from the dashboard timer in under 15 s (1 tap + editor prefill).
- [ ] "Stop & log" prefills start time and duration; entering cash-out shows net P/L live.
- [ ] "Repeat last session setup" copies game/venue/stakes/buy-in/tags onto a new session.
- [ ] New fields save and re-open correctly: live/online, add-ons, rake, expenses, tags, hands, table size.
- [ ] Quality section (focus/tilt/discipline chips, sleep, alcohol, game quality, stop-loss/win) is optional and collapsed by default.
- [ ] Editing and deleting a past session works; delete asks for confirmation.
- [ ] Sessions logged before V2 still open and show unchanged profit.

## Dashboard & analytics
- [ ] Insight cards appear only when thresholds are met and read sensibly.
- [ ] Filters: session type (incl. Sit & Go / Home Game), live/online, tag chips, venue, game, date range, search.
- [ ] Stats screen shows live-vs-online, by-session-type and quality analytics sections.
- [ ] Hourly rate ignores untimed sessions (regression: log a session with no hours).

## Tools
- [ ] Clock: default structure loads; edit levels; save/load/delete a template.
- [ ] Clock run: countdown, pause/resume, prev/next, break levels, beep + vibration on level change, red final-minute warning, full-screen toggle, late-reg marker.
- [ ] Home game: create game, add/remove players, seat draw, per-player money entry, paid toggles, payment-method notes.
- [ ] Settlement: totals match, unresolved balance flags a mismatch, suggested payments settle winners exactly.
- [ ] Payout: templates (WTA / Top2 / Top3 / 10% / custom), fee, pool override, rounding to 5/10/25 conserves the pool.
- [ ] Chips: standard set hits target stack exactly; shrink inventory → warnings appear.
- [ ] Calendar: add event, "Add to calendar" downloads an .ics that imports (with reminder) into the phone calendar.
- [ ] Hand notes: add, link to session, review-later queue filter, share/copy text summary, jump from session editor.

## Privacy & data
- [ ] Set PIN → app locks on next launch; wrong PIN rejected; remove PIN works.
- [ ] Hide balances blurs every money value; toggling back restores.
- [ ] Backup export includes tool data; restore round-trips it (with confirmation).
- [ ] A v1 backup (or Android-app backup) restores without error.
- [ ] Android-app CSV imports; V2 CSV re-imports including tags/live-online.
- [ ] Airplane mode: every feature above still works offline.

## Accessibility spot-checks
- [ ] All controls reachable by keyboard; visible focus rings.
- [ ] Icon-only buttons have aria-labels (delete, back, seat draw).
- [ ] Touch targets ≥ 44 px on editor chips, nav, list rows.

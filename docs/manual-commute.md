# Manual commute entry (web v1.53.0)

The web app accepts optional **total commute minutes** when starting a live session, finishing it, or editing a saved session. Blank and zero mean no recorded commute. Values must be non-negative whole minutes within JavaScript's safe integer range. The app never doubles a manual value.

The drive start/arrival timer and attachment/round-trip prompts have been removed. Play timers, multiple live sessions, rebuys, bounties, session history and the manual Travel log remain available.

## Stored data and calculations

- Completed sessions retain the existing `travelMinutes` field. Active drafts also use `travelMinutes` for new manual totals; legacy `travelOneWayMinutes` is retained for compatibility.
- Commute is separate from `durationMinutes`. Profit, bankroll, investments and ROI calculations are unchanged. The existing `travelInHourly` preference still determines whether statistics add travel to the time denominator; its default and saved value are unchanged.
- An older active session prefills the recorded outbound minutes without inferring a return journey. The finish form explains this and allows the total to be adjusted.
- CSV export keeps the `TravelMinutes` column. Guided import now maps it (also `CommuteMinutes`) and rejects rows with invalid mapped commute values. Existing CSVs without this column still import as zero commute.
- JSON backups retain session travel and standalone history. Optional recovery markers survive web JSON round trips. No database version bump or dependency upgrade is needed.

## Recovery from the removed drive timer

On first load, a valid old `bankrolledge_pending_drive` is archived into the Travel log. An arrived drive keeps its recorded end time. A still-running drive is frozen at first load of this version; its resulting minutes should be reviewed because the app cannot infer when the trip actually ended. Recovery never attaches it to a session or changes a statistics preference.

The frozen timer is saved before archiving. Its old key is removed only after the history write succeeds. A `legacyDriveStartedAt` marker makes retries idempotent if removing that key fails. If storage is unavailable, the source key remains for a later retry. Even a recorded drive rounding to zero minutes is preserved. Malformed legacy values are left untouched.

Newly finished live sessions carry `sourceLiveStartedAt`. If the database commit succeeds but draft cleanup is interrupted, the next load recognizes the saved session and retires the stale draft instead of offering to log it again. This covers a single browser's interrupted finish, not simultaneous writes from independent tabs.

## Related editor safeguards

The session editor mounts only after stored sessions finish loading. Failed loads, missing IDs and already-finished live links cannot open a blank form against an existing record. A commute-only edit merges changed fields into the original record, preserving unrelated values such as timestamp seconds, notes whitespace, tags and unknown optional fields.

Start and Save use synchronous submission guards. Failed draft or session persistence displays an error and permits retry. The existing in-app Back confirmation remains; browser Back discards unsaved form edits without changing the saved record or the active draft. Browser-history blocking and edit-draft autosave are outside this change.

## Verification

Run `npm ci`, `npm test -- --maxWorkers=2 --minWorkers=1`, and `npm run build` from `web`. The build includes `tsc --noEmit`. There is no lint script.

Regression coverage includes blank/zero/invalid parsing, preservation of unrelated session fields, unchanged play/profit semantics, explicit hourly inclusion, native CSV plus guided import, JSON backups, legacy drive recovery, quota failures and retries, old single-session migration, and active commute reloads.

Browser smoke checklist (use an isolated profile and synthetic data):

1. Start with blank, zero and positive commute; reject negative/fractional/text input; cancel and reopen; double-click Start.
2. Reload an active session; Stop and review its commute independently of play duration; cancel/back and finish again; double-submit Save.
3. Open and reload a saved session URL; edit only commute and compare all other stored fields exactly; check missing IDs and completed live links.
4. Seed an older active draft and pending drive; reload twice; verify one recovered Travel log row and no automatic doubling.
5. Simulate draft/database write failures, retry, then simulate interrupted draft cleanup after a successful save; reload and verify no duplicate session.
6. Download session CSV and JSON through the UI, reimport/restore only into synthetic storage, and compare commute values and travel history.
7. Inspect mobile and desktop screenshots and check for overflow and uncaught errors.

This is a web/PWA change. Native Android screens, real-device installation/share sheets, simultaneous cross-tab writes and the public deployment are not covered by this change's browser verification.

Verified on 2026-10-10: 274 tests in 27 files passed; TypeScript and the production PWA build passed. Thirteen isolated Chrome 154 browser scenarios passed, with mobile (375/390 px) and desktop (1280 px) screenshots inspected. Browser QA blocked external requests, disabled GPU acceleration, and used synthetic records only. The downloadable export path was verified with native sharing disabled in the test context; native share sheets and service-worker installation were not exercised.

# PWA Security Notes — BankrollEdge Web

## Threat model in one paragraph

BankrollEdge is a **local-only, single-user app with no authentication and no
network I/O**. There are no accounts, tokens, passwords, or API calls to
protect. The data at stake is the user's own poker results (sessions,
bankroll transactions, settings, free-text notes), stored entirely on the
user's device.

## Where data lives

| Data | Store | Sensitivity |
|---|---|---|
| Sessions, transactions | IndexedDB (`bankrolledge` DB) | Personal but low-risk; user-entered |
| Settings, live-timer start | `localStorage` | Non-sensitive |
| App shell (HTML/JS/CSS/icons) | Cache Storage (service worker precache) | Public assets only |

**No sensitive API responses are cached** — there are no API responses at all.
The service worker precaches only static build assets.

## Decisions & tradeoffs

1. **No encryption at rest.** IndexedDB/localStorage are plaintext, same as
   the Android app's Room database on a non-rooted device. Anyone with access
   to the unlocked device/browser profile can read the data. Given no
   credentials are stored, this matches the data's sensitivity. If secrecy
   ever matters, add a passphrase-derived key (WebCrypto AES-GCM) around the
   storage layer — the `storage/` module is the single seam.
2. **Backups are plaintext JSON by design** (interchange with the Android
   app). Users choose where to save/share them; the app never transmits them.
3. **Data loss risk > exfiltration risk.** Browsers may evict site data
   (notably iOS). Mitigations: `navigator.storage.persist()` is requested at
   startup, and JSON backup/restore is a first-class feature.
4. **XSS surface**: no `dangerouslySetInnerHTML`, no `eval`, no third-party
   runtime scripts, no CDN dependencies; all user text is rendered through
   React's escaping. CSV import/backup parsing treats input as data only.
5. **Clickjacking/CSP**: static hosting is expected. Recommended headers at
   deploy time: `Content-Security-Policy: default-src 'self'`,
   `X-Frame-Options: DENY` (or `frame-ancestors 'none'`). Not enforceable
   from inside the app bundle.
6. **HTTPS required** for service workers and installability — any static
   host (GitHub Pages, Netlify, Cloudflare Pages) satisfies this.
7. **No analytics/telemetry.** Nothing leaves the device.

## What would change if a backend were added

Authentication tokens must NOT go to `localStorage`; prefer httpOnly
cookies (or in-memory + refresh). Never let Workbox runtime-cache
authenticated API responses without an explicit allowlist. Revisit this
document at that point.

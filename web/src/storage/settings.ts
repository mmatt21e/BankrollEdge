// localStorage persistence for settings + live-timer start — the PWA
// equivalent of Android SharedPreferences. Nothing here is sensitive.
import { ActiveSession, AppSettings, DEFAULT_SETTINGS, PendingDrive } from '../models/types';

const SETTINGS_KEY = 'bankrolledge_settings';
const TIMER_KEY = 'bankrolledge_timer_start';
const ACTIVE_KEY = 'bankrolledge_active_session';

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// The save* writers swallow storage failures (quota, private browsing):
// degraded persistence beats crashing inside a React state updater.
export function saveSettings(settings: AppSettings): boolean {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

/** Epoch millis the live session started; 0 = not running. */
export function loadTimerStart(): number {
  const v = Number(localStorage.getItem(TIMER_KEY) ?? '0');
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function saveTimerStart(startMillis: number): void {
  try {
    if (startMillis > 0) localStorage.setItem(TIMER_KEY, String(startMillis));
    else localStorage.removeItem(TIMER_KEY);
  } catch {
    // best-effort; see saveSettings
  }
}

const ACTIVE_LIST_KEY = 'bankrolledge_active_sessions';

/** Backfills fields added after a draft was persisted. */
function normalizeActive(parsed: ActiveSession): ActiveSession {
  if (typeof parsed.rebuys !== 'number') parsed.rebuys = 0;
  if (typeof parsed.bountyPerBounty !== 'number') parsed.bountyPerBounty = 0;
  if (typeof parsed.bountyCount !== 'number') parsed.bountyCount = 0;
  if (typeof parsed.travelOneWayMinutes !== 'number') parsed.travelOneWayMinutes = 0;
  return parsed;
}

/** All in-progress sessions (several can run at once — e.g. a live game and
 *  an online one). Migrates the legacy single-session key on first load. */
export function loadActiveSessions(): ActiveSession[] {
  try {
    const raw = localStorage.getItem(ACTIVE_LIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ActiveSession[];
      return Array.isArray(parsed) ? parsed.map(normalizeActive) : [];
    }
    // Legacy single-session key → one-element list, then retire the old key.
    const legacy = localStorage.getItem(ACTIVE_KEY);
    if (legacy) {
      const one = normalizeActive(JSON.parse(legacy) as ActiveSession);
      saveActiveSessions([one]);
      localStorage.removeItem(ACTIVE_KEY);
      return [one];
    }
    return [];
  } catch {
    return [];
  }
}

export function saveActiveSessions(sessions: ActiveSession[]): void {
  try {
    if (sessions.length > 0) localStorage.setItem(ACTIVE_LIST_KEY, JSON.stringify(sessions));
    else localStorage.removeItem(ACTIVE_LIST_KEY);
  } catch {
    // best-effort; see saveSettings
  }
}

const DRIVE_KEY = 'bankrolledge_pending_drive';

/** The drive-to-the-venue that's underway (or arrived), if any. Survives app
 *  restarts so closing the app mid-drive doesn't lose the clock. */
export function loadPendingDrive(): PendingDrive | null {
  try {
    const raw = localStorage.getItem(DRIVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingDrive>;
    if (typeof parsed.startedAt !== 'number' || !(parsed.startedAt > 0)) return null;
    return {
      startedAt: parsed.startedAt,
      arrivedAt: typeof parsed.arrivedAt === 'number' && parsed.arrivedAt > 0 ? parsed.arrivedAt : 0,
      location: typeof parsed.location === 'string' ? parsed.location : '',
    };
  } catch {
    return null;
  }
}

export function savePendingDrive(drive: PendingDrive | null): void {
  try {
    if (drive) localStorage.setItem(DRIVE_KEY, JSON.stringify(drive));
    else localStorage.removeItem(DRIVE_KEY);
  } catch {
    // best-effort; see saveSettings
  }
}

// --- Privacy controls (device-local by design; never included in backups) ---

const PIN_KEY = 'bankrolledge_pin';
const HIDE_BALANCES_KEY = 'bankrolledge_hide_balances';
const PIN_SALT = 'bankrolledge-v1';

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${PIN_SALT}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const hasPin = (): boolean => localStorage.getItem(PIN_KEY) !== null;

export async function setPin(pin: string): Promise<boolean> {
  try {
    localStorage.setItem(PIN_KEY, await hashPin(pin));
    return true;
  } catch {
    return false;
  }
}

export function clearPin(): void {
  localStorage.removeItem(PIN_KEY);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(PIN_KEY);
  return stored !== null && stored === (await hashPin(pin));
}

export const loadHideBalances = (): boolean =>
  localStorage.getItem(HIDE_BALANCES_KEY) === '1';

export function saveHideBalances(hide: boolean): void {
  if (hide) localStorage.setItem(HIDE_BALANCES_KEY, '1');
  else localStorage.removeItem(HIDE_BALANCES_KEY);
}

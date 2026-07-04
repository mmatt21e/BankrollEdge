// localStorage persistence for settings + live-timer start — the PWA
// equivalent of Android SharedPreferences. Nothing here is sensitive.
import { AppSettings, DEFAULT_SETTINGS } from '../models/types';

const SETTINGS_KEY = 'bankrolledge_settings';
const TIMER_KEY = 'bankrolledge_timer_start';

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

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/** Epoch millis the live session started; 0 = not running. */
export function loadTimerStart(): number {
  const v = Number(localStorage.getItem(TIMER_KEY) ?? '0');
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function saveTimerStart(startMillis: number): void {
  if (startMillis > 0) localStorage.setItem(TIMER_KEY, String(startMillis));
  else localStorage.removeItem(TIMER_KEY);
}

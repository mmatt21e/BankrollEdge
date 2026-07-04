// Port of Android BackupManager — the JSON shape is identical, so backup files
// are interchangeable between the Android app and the PWA.
import {
  AppSettings,
  DEFAULT_SETTINGS,
  Session,
  Transaction,
  emptySession,
  GAME_TYPES,
  SESSION_TYPES,
} from '../models/types';

export const FORMAT_VERSION = 1;

export interface Backup {
  settings: AppSettings;
  sessions: Session[];
  transactions: Transaction[];
}

export function backupToJson(backup: Backup, exportedAt: number): string {
  return JSON.stringify(
    {
      app: 'BankrollEdge',
      version: FORMAT_VERSION,
      exportedAt,
      settings: {
        startingBankroll: backup.settings.startingBankroll,
        currency: backup.settings.currency,
        defaultSessionType: backup.settings.defaultSessionType,
      },
      sessions: backup.sessions.map(({ id: _id, ...rest }) => rest),
      transactions: backup.transactions.map(({ id: _id, ...rest }) => rest),
    },
    null,
    2,
  );
}

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const str = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v : fallback;

/** @throws Error on malformed input or a foreign JSON file. */
export function backupFromJson(json: string): Backup {
  const root = JSON.parse(json) as Record<string, unknown>;
  if (root.app !== 'BankrollEdge') {
    throw new Error('Not a BankrollEdge backup file.');
  }
  const s = (root.settings ?? {}) as Record<string, unknown>;
  const rawDefault = str(s.defaultSessionType, 'ALL');
  const settings: AppSettings = {
    startingBankroll: num(s.startingBankroll),
    currency: str(s.currency, 'USD'),
    defaultSessionType:
      rawDefault === 'CASH' || rawDefault === 'TOURNAMENT' ? rawDefault : 'ALL',
  };

  const sessions = (Array.isArray(root.sessions) ? root.sessions : []).map((raw) => {
    const o = raw as Record<string, unknown>;
    const st = str(o.sessionType, 'CASH');
    const g = str(o.gameType, 'NLH');
    const base = emptySession(num(o.startTime));
    return {
      ...base,
      sessionType: SESSION_TYPES.includes(st as never) ? (st as Session['sessionType']) : 'CASH',
      gameType: GAME_TYPES.includes(g as never) ? (g as Session['gameType']) : 'NLH',
      location: str(o.location),
      startTime: num(o.startTime),
      durationMinutes: num(o.durationMinutes),
      smallBlind: num(o.smallBlind),
      bigBlind: num(o.bigBlind),
      buyIn: num(o.buyIn),
      rebuysAddons: num(o.rebuysAddons),
      cashOut: num(o.cashOut),
      tips: num(o.tips),
      position: num(o.position),
      fieldSize: num(o.fieldSize),
      currency: str(o.currency, 'USD'),
      notes: str(o.notes),
    };
  });

  const transactions: Transaction[] = (
    Array.isArray(root.transactions) ? root.transactions : []
  ).map((raw) => {
    const o = raw as Record<string, unknown>;
    return {
      id: 0,
      type: str(o.type) === 'WITHDRAWAL' ? 'WITHDRAWAL' : 'DEPOSIT',
      amount: num(o.amount),
      time: num(o.time),
      note: str(o.note),
    };
  });

  return { settings: { ...DEFAULT_SETTINGS, ...settings }, sessions, transactions };
}

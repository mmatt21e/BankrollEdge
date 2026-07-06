// Port of Android BackupManager — the JSON shape is identical, so backup files
// are interchangeable between the Android app and the PWA.
import {
  AppSettings,
  DEFAULT_SETTINGS,
  Session,
  SportsBet,
  Transaction,
  BlindStructure,
  CalendarEvent,
  HandNote,
  HomeGame,
  emptySession,
  normalizeSession,
  normalizeBet,
  GAME_TYPES,
  SESSION_TYPES,
  TABLE_GAMES,
} from '../models/types';

// v2 adds optional session fields plus the tool collections; v3 adds sports
// bets and betting settings. Older readers (including the Android app)
// ignore unknown keys, and this reader treats missing collections as empty —
// both directions stay compatible.
export const FORMAT_VERSION = 3;

export interface Backup {
  settings: AppSettings;
  sessions: Session[];
  transactions: Transaction[];
  bets: SportsBet[];
  handNotes: HandNote[];
  homeGames: HomeGame[];
  structures: BlindStructure[];
  events: CalendarEvent[];
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
        betUnitValue: backup.settings.betUnitValue,
        oddsFormat: backup.settings.oddsFormat,
      },
      sessions: backup.sessions.map(({ id: _id, ...rest }) => rest),
      transactions: backup.transactions.map(({ id: _id, ...rest }) => rest),
      bets: backup.bets.map(({ id: _id, ...rest }) => rest),
      handNotes: backup.handNotes.map(({ id: _id, ...rest }) => rest),
      homeGames: backup.homeGames.map(({ id: _id, ...rest }) => rest),
      structures: backup.structures.map(({ id: _id, ...rest }) => rest),
      events: backup.events.map(({ id: _id, ...rest }) => rest),
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
    betUnitValue: num(s.betUnitValue),
    oddsFormat: str(s.oddsFormat) === 'DECIMAL' ? 'DECIMAL' : 'AMERICAN',
  };

  const sessions = (Array.isArray(root.sessions) ? root.sessions : []).map((raw) => {
    const o = raw as Record<string, unknown>;
    const st = str(o.sessionType, 'CASH');
    const g = str(o.gameType, 'NLH');
    const base = emptySession(num(o.startTime));
    return normalizeSession({
      ...base,
      sessionType: SESSION_TYPES.includes(st as never) ? (st as Session['sessionType']) : 'CASH',
      gameType: GAME_TYPES.includes(g as never) ? (g as Session['gameType']) : 'NLH',
      venueType: str(o.venueType) === 'ONLINE' ? 'ONLINE' : 'LIVE',
      location: str(o.location),
      startTime: num(o.startTime),
      durationMinutes: num(o.durationMinutes),
      smallBlind: num(o.smallBlind),
      bigBlind: num(o.bigBlind),
      buyIn: num(o.buyIn),
      rebuysAddons: num(o.rebuysAddons),
      addOns: num(o.addOns),
      cashOut: num(o.cashOut),
      tips: num(o.tips),
      rake: num(o.rake),
      expenses: num(o.expenses),
      position: num(o.position),
      fieldSize: num(o.fieldSize),
      tableGame: TABLE_GAMES.includes(str(o.tableGame) as never)
        ? (str(o.tableGame) as Session['tableGame'])
        : 'BLACKJACK',
      tableMinBet: num(o.tableMinBet),
      tableMaxBet: num(o.tableMaxBet),
      unitValue: num(o.unitValue),
      unitsMin: num(o.unitsMin),
      unitsMax: num(o.unitsMax),
      handsPlayed: num(o.handsPlayed),
      tableSize: num(o.tableSize),
      tags: Array.isArray(o.tags) ? (o.tags as unknown[]).map((t) => String(t)) : [],
      currency: str(o.currency, 'USD'),
      notes: str(o.notes),
      focus: num(o.focus),
      tilt: num(o.tilt),
      discipline: num(o.discipline),
      sleep: str(o.sleep) as Session['sleep'],
      alcohol: str(o.alcohol) as Session['alcohol'],
      gameQuality: str(o.gameQuality) as Session['gameQuality'],
      leftAtStopLoss: str(o.leftAtStopLoss) as Session['leftAtStopLoss'],
      stopLoss: num(o.stopLoss),
      stopWin: num(o.stopWin),
    });
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

  // Tool collections (absent in v1 backups → empty). Objects are stored
  // whole, so a shape-tolerant copy with id reset is sufficient.
  const collection = <T extends { id: number }>(key: string): T[] =>
    (Array.isArray(root[key]) ? (root[key] as T[]) : []).map((item) => ({
      ...item,
      id: 0,
    }));

  // Bets get full normalization (enum coercion, leg shape) rather than the
  // shape-tolerant copy the tool collections use.
  const bets: SportsBet[] = (Array.isArray(root.bets) ? root.bets : []).map((raw) => ({
    ...normalizeBet(raw as Partial<SportsBet>),
    id: 0,
  }));

  return {
    settings: { ...DEFAULT_SETTINGS, ...settings },
    sessions,
    transactions,
    bets,
    handNotes: collection<HandNote>('handNotes'),
    homeGames: collection<HomeGame>('homeGames'),
    structures: collection<BlindStructure>('structures'),
    events: collection<CalendarEvent>('events'),
  };
}

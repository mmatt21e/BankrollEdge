// Direct ports of the Android data model (SessionEntity, TransactionEntity,
// AppSettings). Field names match the Android JSON backup format exactly so
// backups are interchangeable between the two apps.

export type SessionType = 'CASH' | 'TOURNAMENT';
export type GameType = 'NLH' | 'PLO' | 'PLO5' | 'LHE' | 'MIXED' | 'STUD' | 'OTHER';

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  CASH: 'Cash Game',
  TOURNAMENT: 'Tournament',
};

export const GAME_TYPE_LABELS: Record<GameType, string> = {
  NLH: "No-Limit Hold'em",
  PLO: 'Pot-Limit Omaha',
  PLO5: '5-Card PLO',
  LHE: 'Limit Hold’em'.replace('’', "'"),
  MIXED: 'Mixed Games',
  STUD: 'Seven-Card Stud',
  OTHER: 'Other',
};

export const GAME_TYPES = Object.keys(GAME_TYPE_LABELS) as GameType[];
export const SESSION_TYPES = Object.keys(SESSION_TYPE_LABELS) as SessionType[];

export interface Session {
  id: number; // 0 = unsaved
  sessionType: SessionType;
  gameType: GameType;
  location: string;
  /** Session start, epoch millis. */
  startTime: number;
  durationMinutes: number;
  smallBlind: number;
  bigBlind: number;
  buyIn: number;
  rebuysAddons: number;
  cashOut: number;
  tips: number;
  /** Tournament finish position (0 = not set). */
  position: number;
  /** Tournament field size (0 = unknown). */
  fieldSize: number;
  currency: string;
  notes: string;
}

export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL';

export interface Transaction {
  id: number;
  type: TransactionType;
  /** Always positive; sign comes from type. */
  amount: number;
  time: number;
  note: string;
}

export interface AppSettings {
  startingBankroll: number;
  currency: string;
  /** 'ALL' or a SessionType — the default view/entry mode. */
  defaultSessionType: 'ALL' | SessionType;
}

export const DEFAULT_SETTINGS: AppSettings = {
  startingBankroll: 0,
  currency: 'USD',
  defaultSessionType: 'ALL',
};

export function emptySession(now: number): Session {
  return {
    id: 0,
    sessionType: 'CASH',
    gameType: 'NLH',
    location: '',
    startTime: now,
    durationMinutes: 0,
    smallBlind: 0,
    bigBlind: 0,
    buyIn: 0,
    rebuysAddons: 0,
    cashOut: 0,
    tips: 0,
    position: 0,
    fieldSize: 0,
    currency: 'USD',
    notes: '',
  };
}

// --- Derived helpers (Kotlin computed properties) ---

export const totalInvested = (s: Session): number => s.buyIn + s.rebuysAddons;

/** Net result: what came back minus what went in and tips. */
export const profit = (s: Session): number => s.cashOut - totalInvested(s) - s.tips;

/** Tournament: finished in the money? */
export const cashed = (s: Session): boolean => s.cashOut > 0;

const trimAmount = (v: number): string =>
  Number.isInteger(v) ? String(v) : String(v);

/** "1/2"-style label for cash games; empty otherwise. */
export function stakesLabel(s: Session): string {
  if (s.sessionType !== 'CASH' || s.bigBlind <= 0) return '';
  return `${trimAmount(s.smallBlind)}/${trimAmount(s.bigBlind)}`;
}

export const signedAmount = (t: Transaction): number =>
  t.type === 'DEPOSIT' ? t.amount : -t.amount;

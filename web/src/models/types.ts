// Domain model. Field names match the JSON backup format; new-in-v2 fields
// are optional in old data and normalized to defaults on load, so existing
// user data (and Android-app backups) remain fully compatible.

export type SessionType = 'CASH' | 'TOURNAMENT' | 'SNG' | 'HOME' | 'OTHER';
export type GameType = 'NLH' | 'PLO' | 'PLO5' | 'LHE' | 'MIXED' | 'STUD' | 'OTHER';
export type VenueType = 'LIVE' | 'ONLINE';

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  CASH: 'Cash Game',
  TOURNAMENT: 'Tournament',
  SNG: 'Sit & Go',
  HOME: 'Home Game',
  OTHER: 'Other',
};

export const GAME_TYPE_LABELS: Record<GameType, string> = {
  NLH: "No-Limit Hold'em",
  PLO: 'Pot-Limit Omaha',
  PLO5: '5-Card PLO',
  LHE: "Limit Hold'em",
  MIXED: 'Mixed Games',
  STUD: 'Seven-Card Stud',
  OTHER: 'Other',
};

export const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  LIVE: 'Live',
  ONLINE: 'Online',
};

export const GAME_TYPES = Object.keys(GAME_TYPE_LABELS) as GameType[];
export const SESSION_TYPES = Object.keys(SESSION_TYPE_LABELS) as SessionType[];

// --- Optional session-quality fields (0 / '' = not recorded) ---
export type SleepQuality = '' | 'POOR' | 'OK' | 'GOOD';
export type AlcoholLevel = '' | 'NONE' | 'LIGHT' | 'HEAVY';
export type GameQuality = '' | 'BAD' | 'AVERAGE' | 'GOOD' | 'GREAT';
export type YesNo = '' | 'YES' | 'NO';

export const GAME_QUALITY_LABELS: Record<Exclude<GameQuality, ''>, string> = {
  BAD: 'Bad',
  AVERAGE: 'Average',
  GOOD: 'Good',
  GREAT: 'Great',
};

export interface Session {
  id: number; // 0 = unsaved
  sessionType: SessionType;
  gameType: GameType;
  /** Live at a venue vs online. */
  venueType: VenueType;
  location: string;
  startTime: number; // epoch millis
  durationMinutes: number;
  smallBlind: number;
  bigBlind: number;
  buyIn: number;
  /** Rebuys / re-entries / top-ups. */
  rebuysAddons: number;
  /** Tournament add-ons, tracked separately from rebuys. */
  addOns: number;
  cashOut: number;
  tips: number;
  /** Rake paid — informational only (cash-out already reflects it). */
  rake: number;
  /** Travel / food / other expenses; deducted from net. */
  expenses: number;
  position: number; // tournament finish (0 = unset)
  fieldSize: number; // tournament entrants (0 = unknown)
  handsPlayed: number; // 0 = not recorded
  tableSize: number; // 0 = not recorded
  tags: string[];
  currency: string;
  notes: string;

  // Session quality (all optional).
  focus: number; // 0 = unset, else 1-5
  tilt: number; // 0 = unset, else 1-5
  discipline: number; // 0 = unset, else 1-5
  sleep: SleepQuality;
  alcohol: AlcoholLevel;
  gameQuality: GameQuality;
  leftAtStopLoss: YesNo;
  stopLoss: number; // 0 = not set
  stopWin: number; // 0 = not set
}

export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL';

export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number; // always positive; sign comes from type
  time: number;
  note: string;
}

export interface AppSettings {
  startingBankroll: number;
  currency: string;
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
    venueType: 'LIVE',
    location: '',
    startTime: now,
    durationMinutes: 0,
    smallBlind: 0,
    bigBlind: 0,
    buyIn: 0,
    rebuysAddons: 0,
    addOns: 0,
    cashOut: 0,
    tips: 0,
    rake: 0,
    expenses: 0,
    position: 0,
    fieldSize: 0,
    handsPlayed: 0,
    tableSize: 0,
    tags: [],
    currency: 'USD',
    notes: '',
    focus: 0,
    tilt: 0,
    discipline: 0,
    sleep: '',
    alcohol: '',
    gameQuality: '',
    leftAtStopLoss: '',
    stopLoss: 0,
    stopWin: 0,
  };
}

/** Fills v2 defaults into records stored before the new fields existed. */
export function normalizeSession(raw: Partial<Session> & { startTime?: number }): Session {
  return { ...emptySession(raw.startTime ?? 0), ...raw, tags: raw.tags ?? [] };
}

// --- Derived helpers ---

/** Total money put in play (counts toward ROI denominator). */
export const totalInvested = (s: Session): number => s.buyIn + s.rebuysAddons + s.addOns;

/** Net result: returns minus money in play, tips and expenses.
 *  Rake is informational only — it is already reflected in the cash-out. */
export const profit = (s: Session): number =>
  s.cashOut - totalInvested(s) - s.tips - s.expenses;

/** Tournament-style sessions (ROI / ITM semantics). */
export const isTournamentStyle = (s: Session): boolean =>
  s.sessionType === 'TOURNAMENT' || s.sessionType === 'SNG';

export const cashed = (s: Session): boolean => s.cashOut > 0;

export function stakesLabel(s: Session): string {
  if (isTournamentStyle(s) || s.bigBlind <= 0) return '';
  return `${s.smallBlind}/${s.bigBlind}`;
}

export const signedAmount = (t: Transaction): number =>
  t.type === 'DEPOSIT' ? t.amount : -t.amount;

// --- Tool entities (stored in their own IndexedDB stores) ---

export interface BlindLevel {
  smallBlind: number;
  bigBlind: number;
  ante: number;
  durationMin: number;
  isBreak: boolean;
}

export interface BlindStructure {
  id: number;
  name: string;
  levels: BlindLevel[];
  /** 1-based level after which late registration closes (0 = none). */
  lateRegEndLevel: number;
}

export type PaymentMethod = '' | 'CASH' | 'VENMO' | 'ZELLE' | 'CASHAPP' | 'PAYPAL' | 'OTHER';

export const PAYMENT_METHOD_LABELS: Record<Exclude<PaymentMethod, ''>, string> = {
  CASH: 'Cash',
  VENMO: 'Venmo',
  ZELLE: 'Zelle',
  CASHAPP: 'Cash App',
  PAYPAL: 'PayPal',
  OTHER: 'Other',
};

export interface HomeGamePlayer {
  id: number; // unique within the game
  name: string;
  buyIn: number;
  rebuys: number;
  addOns: number;
  cashOut: number;
  paid: boolean;
  paymentMethod: PaymentMethod;
  seat: number; // 0 = unassigned
  notes: string;
}

export interface HomeGame {
  id: number;
  name: string;
  date: number; // epoch millis
  notes: string;
  players: HomeGamePlayer[];
}

export interface CalendarEvent {
  id: number;
  name: string;
  location: string;
  buyIn: number;
  startTime: number;
  /** Late registration ends (0 = none). */
  lateRegEnd: number;
  notes: string;
  /** Reminder minutes before start (baked into the calendar export; 0 = none). */
  reminderMinutes: number;
}

export interface HandNote {
  id: number;
  sessionId: number; // 0 = not linked
  createdAt: number;
  stakes: string;
  position: string;
  holeCards: string;
  board: string;
  potSize: number;
  actionSummary: string;
  result: string;
  tags: string[];
  notes: string;
  reviewLater: boolean;
}

// Domain model. Field names match the JSON backup format; new-in-v2 fields
// are optional in old data and normalized to defaults on load, so existing
// user data (and Android-app backups) remain fully compatible.

export type SessionType = 'CASH' | 'TOURNAMENT' | 'SNG' | 'HOME' | 'TABLE' | 'OTHER';
export type GameType = 'NLH' | 'PLO' | 'PLO5' | 'LHE' | 'MIXED' | 'STUD' | 'OTHER';
export type VenueType = 'LIVE' | 'ONLINE';

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  CASH: 'Cash Game',
  TOURNAMENT: 'Tournament',
  SNG: 'Sit & Go',
  HOME: 'Home Game',
  TABLE: 'Table Game',
  OTHER: 'Other',
};

/** Casino table/pit games tracked against the same bankroll as poker. */
export type TableGameType =
  | 'BLACKJACK'
  | 'CRAPS'
  | 'ROULETTE'
  | 'BACCARAT'
  | 'PAI_GOW'
  | 'THREE_CARD'
  | 'ULTIMATE_TH'
  | 'LET_IT_RIDE'
  | 'VIDEO_POKER'
  | 'SLOTS'
  | 'OTHER';

export const TABLE_GAME_LABELS: Record<TableGameType, string> = {
  BLACKJACK: 'Blackjack',
  CRAPS: 'Craps',
  ROULETTE: 'Roulette',
  BACCARAT: 'Baccarat',
  PAI_GOW: 'Pai Gow',
  THREE_CARD: 'Three Card Poker',
  ULTIMATE_TH: "Ultimate Texas Hold'em",
  LET_IT_RIDE: 'Let It Ride',
  VIDEO_POKER: 'Video Poker',
  SLOTS: 'Slots',
  OTHER: 'Other',
};

export const TABLE_GAMES = Object.keys(TABLE_GAME_LABELS) as TableGameType[];

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

  // Table-game fields (only meaningful when sessionType === 'TABLE').
  /** Which pit game was played. */
  tableGame: TableGameType;
  /** Posted table minimum bet (0 = not recorded). */
  tableMinBet: number;
  /** Posted table maximum bet (0 = not recorded). */
  tableMaxBet: number;
  /** What one betting unit is worth in money (0 = not using units). */
  unitValue: number;
  /** Player's minimum bet in units (0 = not recorded). */
  unitsMin: number;
  /** Player's maximum bet in units (0 = not recorded). */
  unitsMax: number;

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

// --- Sports betting ---

export type Sport =
  | 'NFL'
  | 'NBA'
  | 'MLB'
  | 'NHL'
  | 'NCAAF'
  | 'NCAAB'
  | 'SOCCER'
  | 'TENNIS'
  | 'GOLF'
  | 'MMA'
  | 'BOXING'
  | 'RACING'
  | 'ESPORTS'
  | 'OTHER';

export const SPORT_LABELS: Record<Sport, string> = {
  NFL: 'NFL',
  NBA: 'NBA',
  MLB: 'MLB',
  NHL: 'NHL',
  NCAAF: 'College Football',
  NCAAB: 'College Basketball',
  SOCCER: 'Soccer',
  TENNIS: 'Tennis',
  GOLF: 'Golf',
  MMA: 'MMA / UFC',
  BOXING: 'Boxing',
  RACING: 'Horse Racing',
  ESPORTS: 'Esports',
  OTHER: 'Other',
};

export const SPORTS = Object.keys(SPORT_LABELS) as Sport[];

export type BetType =
  | 'SPREAD'
  | 'MONEYLINE'
  | 'TOTAL'
  | 'PROP'
  | 'PARLAY'
  | 'TEASER'
  | 'FUTURES'
  | 'LIVE'
  | 'OTHER';

export const BET_TYPE_LABELS: Record<BetType, string> = {
  SPREAD: 'Spread',
  MONEYLINE: 'Moneyline',
  TOTAL: 'Total (Over/Under)',
  PROP: 'Prop',
  PARLAY: 'Parlay',
  TEASER: 'Teaser',
  FUTURES: 'Futures',
  LIVE: 'Live / In-play',
  OTHER: 'Other',
};

export const BET_TYPES = Object.keys(BET_TYPE_LABELS) as BetType[];

export type BetStatus = 'PENDING' | 'WON' | 'LOST' | 'PUSH' | 'VOID' | 'CASHED_OUT';

export const BET_STATUS_LABELS: Record<BetStatus, string> = {
  PENDING: 'Pending',
  WON: 'Won',
  LOST: 'Lost',
  PUSH: 'Push',
  VOID: 'Void',
  CASHED_OUT: 'Cashed out',
};

export const BET_STATUSES = Object.keys(BET_STATUS_LABELS) as BetStatus[];

export type LegResult = '' | 'WON' | 'LOST' | 'PUSH';

/** One leg of a parlay/teaser. Odds are decimal; PUSH legs drop out of the
 *  combined price. */
export interface BetLeg {
  pick: string;
  odds: number;
  result: LegResult;
}

export interface SportsBet {
  id: number; // 0 = unsaved
  /** When the bet was placed. */
  placedAt: number;
  /** When the event starts (0 = not recorded). */
  eventStart: number;
  sport: Sport;
  /** Matchup / event, e.g. "Chiefs @ Bills". */
  event: string;
  /** The selection, e.g. "Chiefs -3.5". */
  pick: string;
  betType: BetType;
  /** Parlay/teaser legs; empty for straight bets. */
  legs: BetLeg[];
  /** Decimal odds (1.91 = -110). For bets with legs this is derived. */
  odds: number;
  stake: number;
  status: BetStatus;
  /** Amount returned by the book when status is CASHED_OUT. */
  cashOutAmount: number;
  /** Free bet / bonus bet: no stake at risk, win pays profit only. */
  freeBet: boolean;
  /** Closing decimal odds for CLV tracking (0 = not recorded). */
  closingOdds: number;
  sportsbook: string;
  tags: string[];
  notes: string;
  currency: string;
}

export function emptyBet(now: number): SportsBet {
  return {
    id: 0,
    placedAt: now,
    eventStart: 0,
    sport: 'NFL',
    event: '',
    pick: '',
    betType: 'SPREAD',
    legs: [],
    odds: 0,
    stake: 0,
    status: 'PENDING',
    cashOutAmount: 0,
    freeBet: false,
    closingOdds: 0,
    sportsbook: '',
    tags: [],
    notes: '',
    currency: 'USD',
  };
}

/** Fills defaults into bets stored before newer fields existed and coerces
 *  enum-ish fields from foreign data. */
export function normalizeBet(raw: Partial<SportsBet> & { placedAt?: number }): SportsBet {
  const base = emptyBet(raw.placedAt ?? 0);
  const bet = { ...base, ...raw };
  if (!SPORTS.includes(bet.sport)) bet.sport = 'OTHER';
  if (!BET_TYPES.includes(bet.betType)) bet.betType = 'OTHER';
  if (!BET_STATUSES.includes(bet.status)) bet.status = 'PENDING';
  bet.tags = Array.isArray(raw.tags) ? raw.tags.map(String) : [];
  bet.legs = Array.isArray(raw.legs)
    ? raw.legs
        .filter((l): l is BetLeg => typeof l === 'object' && l !== null)
        .map((l) => ({
          pick: String(l.pick ?? ''),
          odds: Number.isFinite(l.odds) ? Number(l.odds) : 0,
          result: l.result === 'WON' || l.result === 'LOST' || l.result === 'PUSH' ? l.result : '',
        }))
    : [];
  return bet;
}

export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL';

export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number; // always positive; sign comes from type
  time: number;
  note: string;
}

export type OddsFormat = 'AMERICAN' | 'DECIMAL';

export type ThemeMode = 'SYSTEM' | 'LIGHT' | 'DARK';

export interface AppSettings {
  startingBankroll: number;
  currency: string;
  defaultSessionType: 'ALL' | SessionType;
  /** Money one betting unit represents for sports bets (0 = units off). */
  betUnitValue: number;
  /** How odds are entered and displayed. */
  oddsFormat: OddsFormat;
  /** Light/dark override; SYSTEM follows the device setting. */
  theme: ThemeMode;
  // Feature switches — turning one off hides that discipline everywhere.
  showPoker: boolean;
  showTableGames: boolean;
  showSports: boolean;
  // Bottom-nav tabs that may be hidden (Play and More always show).
  showSessionsTab: boolean;
  showDashboardTab: boolean;
  // Dashboard cards.
  dashChart: boolean;
  dashTiles: boolean;
  dashHeatmap: boolean;
  dashSports: boolean;
  /** true = poker/table and sports are tracked as two separate bankrolls. */
  separateBankrolls: boolean;
  /** Starting bankroll for the sports side when bankrolls are separate. */
  startingSportsBankroll: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  startingBankroll: 0,
  currency: 'USD',
  defaultSessionType: 'ALL',
  betUnitValue: 0,
  oddsFormat: 'AMERICAN',
  theme: 'SYSTEM',
  showPoker: true,
  showTableGames: true,
  showSports: true,
  showSessionsTab: true,
  showDashboardTab: true,
  dashChart: true,
  dashTiles: true,
  dashHeatmap: true,
  dashSports: true,
  separateBankrolls: false,
  startingSportsBankroll: 0,
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
    tableGame: 'BLACKJACK',
    tableMinBet: 0,
    tableMaxBet: 0,
    unitValue: 0,
    unitsMin: 0,
    unitsMax: 0,
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

/** Casino table-game sessions (blackjack, craps, …). */
export const isTableSession = (s: Session): boolean => s.sessionType === 'TABLE';

export const cashed = (s: Session): boolean => s.cashOut > 0;

export function stakesLabel(s: Session): string {
  if (isTournamentStyle(s) || isTableSession(s) || s.bigBlind <= 0) return '';
  return `${s.smallBlind}/${s.bigBlind}`;
}

/** Table bet range, e.g. "10–1000", "10+", "up to 1000" ('' = not recorded). */
export function tableStakesLabel(s: Session): string {
  if (s.tableMinBet > 0 && s.tableMaxBet > 0) return `${s.tableMinBet}–${s.tableMaxBet}`;
  if (s.tableMinBet > 0) return `${s.tableMinBet}+`;
  if (s.tableMaxBet > 0) return `up to ${s.tableMaxBet}`;
  return '';
}

/** Convert a money amount into betting units (0 when units aren't set up). */
export const toUnits = (amount: number, unitValue: number): number =>
  unitValue > 0 ? amount / unitValue : 0;

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

/** A saved venue the user can pick when logging a session. The session still
 *  stores its venue as a plain `location` string, so this list is only a
 *  managed pick-list — existing data and backups stay unchanged. */
export interface Venue {
  id: number;
  name: string;
}

/** A saved stakes preset. `kind` selects which session fields it fills:
 *  POKER → small/big blind; TABLE → table-game min/max bet. As with venues the
 *  session keeps storing the raw numbers, so presets are purely a pick-list. */
export interface StakePreset {
  id: number;
  kind: 'POKER' | 'TABLE';
  smallBlind: number; // POKER
  bigBlind: number; // POKER
  minBet: number; // TABLE
  maxBet: number; // TABLE
}

/** Display label for a stakes preset, matching stakesLabel / tableStakesLabel. */
export function stakePresetLabel(s: StakePreset): string {
  if (s.kind === 'POKER') return `${s.smallBlind}/${s.bigBlind}`;
  if (s.minBet > 0 && s.maxBet > 0) return `${s.minBet}–${s.maxBet}`;
  if (s.minBet > 0) return `${s.minBet}+`;
  if (s.maxBet > 0) return `up to ${s.maxBet}`;
  return '—';
}

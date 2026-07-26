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
  PlayerNote,
  StakePreset,
  Venue,
  Wallet,
  emptySession,
  normalizeSession,
  normalizeBet,
  SESSION_TYPES,
} from '../models/types';

// v2 adds optional session fields plus the tool collections; v3 adds sports
// bets and betting settings; v4 adds the saved venue and stakes pick-lists;
// v5 adds wallets (casino balances) and player notes. Older readers
// (including the Android app) ignore unknown keys, and this reader treats
// missing collections as empty — both directions stay compatible.
export const FORMAT_VERSION = 5;

export interface Backup {
  settings: AppSettings;
  sessions: Session[];
  transactions: Transaction[];
  bets: SportsBet[];
  handNotes: HandNote[];
  homeGames: HomeGame[];
  structures: BlindStructure[];
  events: CalendarEvent[];
  venues: Venue[];
  stakes: StakePreset[];
  wallets: Wallet[];
  playerNotes: PlayerNote[];
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
        separateBankrolls: backup.settings.separateBankrolls,
        startingSportsBankroll: backup.settings.startingSportsBankroll,
        customPokerGames: backup.settings.customPokerGames,
        hiddenPokerGames: backup.settings.hiddenPokerGames,
        customTableGames: backup.settings.customTableGames,
        hiddenTableGames: backup.settings.hiddenTableGames,
        quickLinks: backup.settings.quickLinks,
        notepad: backup.settings.notepad,
        savedRanges: backup.settings.savedRanges,
        travelInHourly: backup.settings.travelInHourly,
      },
      sessions: backup.sessions.map(({ id: _id, ...rest }) => rest),
      transactions: backup.transactions.map(({ id: _id, ...rest }) => rest),
      bets: backup.bets.map(({ id: _id, ...rest }) => rest),
      handNotes: backup.handNotes.map(({ id: _id, ...rest }) => rest),
      homeGames: backup.homeGames.map(({ id: _id, ...rest }) => rest),
      structures: backup.structures.map(({ id: _id, ...rest }) => rest),
      events: backup.events.map(({ id: _id, ...rest }) => rest),
      venues: backup.venues.map(({ id: _id, ...rest }) => rest),
      stakes: backup.stakes.map(({ id: _id, ...rest }) => rest),
      wallets: backup.wallets.map(({ id: _id, ...rest }) => rest),
      playerNotes: backup.playerNotes.map(({ id: _id, ...rest }) => rest),
    },
    null,
    2,
  );
}

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const str = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v : fallback;
const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
/** The value if it's one of the allowed literals, else ''. */
const oneOf = (v: string, allowed: string[]): string => (allowed.includes(v) ? v : '');

/** @throws Error on malformed input or a foreign JSON file. */
export function backupFromJson(json: string): Backup {
  const root = JSON.parse(json) as Record<string, unknown>;
  if (root.app !== 'BankrollEdge') {
    throw new Error('Not a BankrollEdge backup file.');
  }
  const s = (root.settings ?? {}) as Record<string, unknown>;
  const rawDefault = str(s.defaultSessionType, 'ALL');
  // Display/feature preferences are device-local and stay out of backups.
  const settings: Partial<AppSettings> = {
    startingBankroll: num(s.startingBankroll),
    currency: str(s.currency, 'USD'),
    defaultSessionType:
      rawDefault === 'CASH' || rawDefault === 'TOURNAMENT' ? rawDefault : 'ALL',
    betUnitValue: num(s.betUnitValue),
    oddsFormat: str(s.oddsFormat) === 'DECIMAL' ? 'DECIMAL' : 'AMERICAN',
    separateBankrolls: s.separateBankrolls === true,
    startingSportsBankroll: num(s.startingSportsBankroll),
    customPokerGames: strArray(s.customPokerGames),
    hiddenPokerGames: strArray(s.hiddenPokerGames),
    customTableGames: strArray(s.customTableGames),
    hiddenTableGames: strArray(s.hiddenTableGames),
    travelInHourly: s.travelInHourly === true,
    // Quick links are user-created content, so they roam with backups
    // (unlike display/nav preferences, which stay device-local).
    quickLinks: (Array.isArray(s.quickLinks) ? s.quickLinks : [])
      .filter((l): l is Record<string, unknown> => typeof l === 'object' && l !== null)
      .map((l, i) => ({
        id: i + 1,
        name: str(l.name),
        url: str(l.url),
        emoji: str(l.emoji, '🔗'),
      }))
      .filter((l) => l.url !== ''),
    notepad: str(s.notepad),
    savedRanges: (Array.isArray(s.savedRanges) ? s.savedRanges : [])
      .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
      .map((r, i) => ({ id: i + 1, name: str(r.name), cells: strArray(r.cells) }))
      .filter((r) => r.name !== '' && r.cells.length > 0),
  };

  const sessions = (Array.isArray(root.sessions) ? root.sessions : []).map((raw) => {
    const o = raw as Record<string, unknown>;
    const st = str(o.sessionType, 'CASH');
    const g = str(o.gameType, 'NLH');
    const base = emptySession(num(o.startTime));
    return normalizeSession({
      ...base,
      sessionType: SESSION_TYPES.includes(st as never) ? (st as Session['sessionType']) : 'CASH',
      // Custom (user-added) game names are stored verbatim, so any non-empty
      // string is valid here.
      gameType: g.trim() !== '' ? g : 'NLH',
      venueType: str(o.venueType) === 'ONLINE' ? 'ONLINE' : 'LIVE',
      location: str(o.location),
      startTime: num(o.startTime),
      durationMinutes: num(o.durationMinutes),
      travelMinutes: num(o.travelMinutes),
      smallBlind: num(o.smallBlind),
      bigBlind: num(o.bigBlind),
      // Missing/foreign values fall back to 'NONE' (no straddling).
      straddle: (oneOf(str(o.straddle), ['OPTIONAL', 'MANDATORY']) || 'NONE') as Session['straddle'],
      straddleMin: num(o.straddleMin),
      straddleMax: num(o.straddleMax),
      buyIn: num(o.buyIn),
      rebuysAddons: num(o.rebuysAddons),
      addOns: num(o.addOns),
      bountyPerBounty: num(o.bountyPerBounty),
      bountyCount: num(o.bountyCount),
      reentries: num(o.reentries),
      cashOut: num(o.cashOut),
      tips: num(o.tips),
      rake: num(o.rake),
      expenses: num(o.expenses),
      position: num(o.position),
      fieldSize: num(o.fieldSize),
      tableGame: str(o.tableGame).trim() !== '' ? str(o.tableGame) : 'BLACKJACK',
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
      // Quality enums are validated like sessionType above — a foreign or
      // hand-edited value falls back to '' (unset) instead of leaking an
      // unknown literal into the stats grouping.
      sleep: oneOf(str(o.sleep), ['POOR', 'OK', 'GOOD']) as Session['sleep'],
      alcohol: oneOf(str(o.alcohol), ['NONE', 'LIGHT', 'HEAVY']) as Session['alcohol'],
      gameQuality: oneOf(str(o.gameQuality), ['BAD', 'AVERAGE', 'GOOD', 'GREAT']) as Session['gameQuality'],
      leftAtStopLoss: oneOf(str(o.leftAtStopLoss), ['YES', 'NO']) as Session['leftAtStopLoss'],
      stopLoss: num(o.stopLoss),
      stopWin: num(o.stopWin),
    });
    // A session without a real timestamp would pollute every date-based chart
    // as a 1970 entry — drop it rather than restore garbage.
  }).filter((s) => s.startTime > 0);

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
  // whole, so a shape-tolerant copy with id reset is sufficient — but only
  // plain objects are accepted, and any array fields the tools iterate over
  // (home-game players, blind levels) are defaulted so a hand-edited backup
  // can't crash those screens.
  const collection = <T extends { id: number }>(key: string, arrayFields: string[] = []): T[] =>
    (Array.isArray(root[key]) ? (root[key] as unknown[]) : [])
      .filter((item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null && !Array.isArray(item),
      )
      .map((item) => {
        const out: Record<string, unknown> = { ...item, id: 0 };
        for (const field of arrayFields) {
          if (!Array.isArray(out[field])) out[field] = [];
        }
        return out as unknown as T;
      });

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
    handNotes: collection<HandNote>('handNotes', ['tags']),
    homeGames: collection<HomeGame>('homeGames', ['players']),
    structures: collection<BlindStructure>('structures', ['levels']),
    wallets: collection<Wallet>('wallets'),
    playerNotes: collection<PlayerNote>('playerNotes'),
    events: collection<CalendarEvent>('events'),
    venues: collection<Venue>('venues'),
    stakes: collection<StakePreset>('stakes'),
  };
}

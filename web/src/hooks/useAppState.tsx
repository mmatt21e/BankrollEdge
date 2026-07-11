// App-wide state — the PWA equivalent of Android's BankrollViewModel.
// One context holds sessions, transactions, settings, the active filter and
// the live-timer start; every mutation persists first, then updates state.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import {
  ActiveSession,
  AppSettings,
  BetStatus,
  Session,
  SportsBet,
  Transaction,
  TransactionType,
  normalizeBet,
  normalizeSession,
  signedAmount,
} from '../models/types';
import { EMPTY_FILTER, SessionFilter, applyFilter } from '../domain/filter';
import { Statistics, computeStats, bankrollOf } from '../domain/stats';
import { BetStats, computeBetStats } from '../domain/bets';
import { Backup } from '../domain/backup';
import {
  betStore,
  db,
  eventStore,
  handNoteStore,
  homeGameStore,
  requestPersistence,
  stakeStore,
  structureStore,
  venueStore,
} from '../storage/db';
import {
  loadSettings,
  saveSettings,
  loadTimerStart,
  loadActiveSession,
  saveActiveSession,
} from '../storage/settings';

export interface AppState {
  ready: boolean;
  sessions: Session[]; // newest first
  filteredSessions: Session[];
  transactions: Transaction[]; // newest first
  transactionsNet: number;
  bets: SportsBet[]; // newest first
  betStats: BetStats;
  availableSportsbooks: string[];
  settings: AppSettings;
  filter: SessionFilter;
  allStats: Statistics;
  filteredStats: Statistics;
  bankroll: number;
  /** The sports-side roll when bankrolls are kept separate. */
  sportsBankroll: number;
  availableLocations: string[];
  availableTags: string[];
  /** Poker game types present in the data (recorded or imported), distinct. */
  recordedPokerGames: string[];
  /** Table game types present in the data (recorded or imported), distinct. */
  recordedTableGames: string[];
  timerStart: number; // 0 = not running (derived from activeSession)
  /** The in-progress session's captured setup, or null when idle. */
  activeSession: ActiveSession | null;

  saveSession(session: Session): Promise<void>;
  deleteSession(id: number): Promise<void>;
  getSession(id: number): Session | undefined;
  saveBet(bet: SportsBet): Promise<void>;
  deleteBet(id: number): Promise<void>;
  getBet(id: number): SportsBet | undefined;
  /** One-tap settle from the open-bets list. */
  settleBet(id: number, status: BetStatus): Promise<void>;
  importBets(bets: SportsBet[]): Promise<number>;
  addTransaction(type: TransactionType, amount: number, note: string): Promise<void>;
  deleteTransaction(id: number): Promise<void>;
  updateSettings(patch: Partial<AppSettings>): void;
  setFilter(filter: SessionFilter): void;
  startSession(setup: Omit<ActiveSession, 'startedAt'>): void;
  clearSession(): void;
  importSessions(sessions: Session[]): Promise<number>;
  restoreBackup(backup: Backup): Promise<void>;
  /** Permanently deletes logged data for a category (or everything). Returns
   *  the number of records removed. */
  clearData(scope: ClearScope): Promise<number>;
}

/** Which logged data to wipe. 'all' also removes bankroll transactions. */
export type ClearScope = 'poker' | 'table' | 'sports' | 'all';

const AppStateContext = createContext<AppState | null>(null);

/** Builds a minimal draft from a legacy timestamp-only running timer, using
 *  settings for the currency so the editor prefills sensibly. */
function bareActiveSession(startedAt: number, settings: AppSettings): ActiveSession {
  return {
    startedAt,
    sessionType: 'CASH',
    gameType: 'NLH',
    tableGame: 'BLACKJACK',
    venueType: 'LIVE',
    location: '',
    smallBlind: 0,
    bigBlind: 0,
    buyIn: 0,
    currency: settings.currency,
  };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bets, setBets] = useState<SportsBet[]>([]);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(() => {
    const saved = loadActiveSession();
    if (saved) return saved;
    // Migrate a legacy timestamp-only running timer into a bare draft.
    const legacy = loadTimerStart();
    return legacy > 0 ? bareActiveSession(legacy, loadSettings()) : null;
  });
  const [filter, setFilter] = useState<SessionFilter>(() => {
    const def = loadSettings().defaultSessionType;
    return { ...EMPTY_FILTER, type: def === 'ALL' ? null : def };
  });

  useEffect(() => {
    requestPersistence();
    Promise.all([db.loadSessions(), db.loadTransactions(), betStore.list()])
      .then(([s, t, b]) => {
        // normalizeSession/normalizeBet fill newer-version defaults into old records.
        setSessions(s.map(normalizeSession).sort((a, b) => b.startTime - a.startTime));
        setTransactions(t.sort((a, b) => b.time - a.time));
        setBets(b.map(normalizeBet).sort((a, z) => z.placedAt - a.placedAt));
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const saveSession = useCallback(async (session: Session) => {
    const id = await db.saveSession(session);
    const saved = { ...session, id };
    setSessions((prev) =>
      [...prev.filter((s) => s.id !== id), saved].sort((a, b) => b.startTime - a.startTime),
    );
  }, []);

  const deleteSession = useCallback(async (id: number) => {
    await db.deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const saveBet = useCallback(async (bet: SportsBet) => {
    const id = await betStore.save(bet);
    const saved = { ...bet, id };
    setBets((prev) =>
      [...prev.filter((b) => b.id !== id), saved].sort((a, z) => z.placedAt - a.placedAt),
    );
  }, []);

  const deleteBet = useCallback(async (id: number) => {
    await betStore.remove(id);
    setBets((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const settleBet = useCallback(
    async (id: number, status: BetStatus) => {
      const bet = bets.find((b) => b.id === id);
      if (!bet) return;
      await saveBet({ ...bet, status });
    },
    [bets, saveBet],
  );

  /** CSV import: APPENDS to existing bets. Returns the number imported. */
  const importBets = useCallback(async (toImport: SportsBet[]) => {
    const saved: SportsBet[] = [];
    for (const b of toImport) {
      const id = await betStore.save({ ...b, id: 0 });
      saved.push({ ...b, id });
    }
    setBets((prev) => [...prev, ...saved].sort((a, z) => z.placedAt - a.placedAt));
    return saved.length;
  }, []);

  const addTransaction = useCallback(
    async (type: TransactionType, amount: number, note: string) => {
      if (amount <= 0) return;
      const t: Transaction = { id: 0, type, amount, time: Date.now(), note: note.trim() };
      const id = await db.saveTransaction(t);
      setTransactions((prev) =>
        [...prev, { ...t, id }].sort((a, b) => b.time - a.time),
      );
    },
    [],
  );

  const deleteTransaction = useCallback(async (id: number) => {
    await db.deleteTransaction(id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
    if (patch.defaultSessionType !== undefined) {
      const t = patch.defaultSessionType;
      setFilter((prev) => ({ ...prev, type: t === 'ALL' ? null : t }));
    }
  }, []);

  /** Begin a live session, capturing its setup now. Persisted so it survives
   *  app restarts and can prefill the editor when the session ends. */
  const startSession = useCallback((setup: Omit<ActiveSession, 'startedAt'>) => {
    const session: ActiveSession = { ...setup, startedAt: Date.now() };
    saveActiveSession(session);
    setActiveSession(session);
  }, []);

  const clearSession = useCallback(() => {
    saveActiveSession(null);
    setActiveSession(null);
  }, []);

  /** CSV import: APPENDS to existing data. Returns the number imported. */
  const importSessions = useCallback(async (toImport: Session[]) => {
    const saved: Session[] = [];
    for (const s of toImport) {
      const id = await db.saveSession({ ...s, id: 0 });
      saved.push({ ...s, id });
    }
    setSessions((prev) => [...prev, ...saved].sort((a, b) => b.startTime - a.startTime));
    return saved.length;
  }, []);

  /** Backup restore: REPLACES all data (caller confirms with the user first). */
  const restoreBackup = useCallback(async (backup: Backup) => {
    await db.clearSessions();
    await db.clearTransactions();
    await betStore.clear();
    // Tool collections live in their own stores; pages re-read them on mount.
    await Promise.all([
      handNoteStore.clear(),
      homeGameStore.clear(),
      structureStore.clear(),
      eventStore.clear(),
      venueStore.clear(),
      stakeStore.clear(),
    ]);
    for (const n of backup.handNotes) await handNoteStore.save(n);
    for (const g of backup.homeGames) await homeGameStore.save(g);
    for (const st of backup.structures) await structureStore.save(st);
    for (const ev of backup.events) await eventStore.save(ev);
    for (const v of backup.venues) await venueStore.save(v);
    for (const st of backup.stakes) await stakeStore.save(st);
    const restoredSessions: Session[] = [];
    for (const s of backup.sessions) {
      const id = await db.saveSession({ ...s, id: 0 });
      restoredSessions.push({ ...s, id });
    }
    const restoredTx: Transaction[] = [];
    for (const t of backup.transactions) {
      const id = await db.saveTransaction({ ...t, id: 0 });
      restoredTx.push({ ...t, id });
    }
    const restoredBets: SportsBet[] = [];
    for (const b of backup.bets) {
      const id = await betStore.save({ ...b, id: 0 });
      restoredBets.push({ ...b, id });
    }
    // Only data-related settings roam in backups; display/feature preferences
    // (theme, tabs, dashboard cards) stay as this device has them.
    setSettings((prev) => {
      const merged: AppSettings = {
        ...prev,
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
      };
      saveSettings(merged);
      return merged;
    });
    setSessions(restoredSessions.sort((a, b) => b.startTime - a.startTime));
    setTransactions(restoredTx.sort((a, b) => b.time - a.time));
    setBets(restoredBets.sort((a, z) => z.placedAt - a.placedAt));
  }, []);

  /** Clears logged data by category. Poker = non-table sessions, Table =
   *  table-game sessions, Sports = bets. 'all' also removes bankroll
   *  transactions. Tool data (venues, blind structures, hand notes, …) is
   *  never touched here. */
  const clearData = useCallback(
    async (scope: ClearScope): Promise<number> => {
      let removed = 0;

      if (scope === 'sports' || scope === 'all') {
        removed += bets.length;
        await betStore.clear();
        setBets([]);
      }

      if (scope === 'all') {
        removed += sessions.length + transactions.length;
        await db.clearSessions();
        await db.clearTransactions();
        setSessions([]);
        setTransactions([]);
      } else if (scope === 'poker' || scope === 'table') {
        const inScope = (s: Session) =>
          scope === 'table' ? s.sessionType === 'TABLE' : s.sessionType !== 'TABLE';
        const doomed = sessions.filter(inScope);
        for (const s of doomed) await db.deleteSession(s.id);
        removed += doomed.length;
        setSessions((prev) => prev.filter((s) => !inScope(s)));
      }

      return removed;
    },
    [sessions, transactions, bets],
  );

  const value = useMemo<AppState>(() => {
    const now = Date.now();
    const filteredSessions = applyFilter(filter, sessions, now);
    const allStats = computeStats(sessions);
    const transactionsNet = transactions.reduce((a, t) => a + signedAmount(t), 0);
    const betStats = computeBetStats(bets);
    return {
      ready,
      sessions,
      filteredSessions,
      transactions,
      transactionsNet,
      bets,
      betStats,
      availableSportsbooks: [...new Set(bets.map((b) => b.sportsbook.trim()).filter(Boolean))].sort(),
      settings,
      filter,
      allStats,
      filteredStats: computeStats(filteredSessions),
      // Settled bets roll into the same bankroll unless the user keeps
      // separate rolls (or has the sports feature hidden entirely).
      bankroll:
        bankrollOf(allStats, settings.startingBankroll, transactionsNet) +
        (settings.showSports && !settings.separateBankrolls ? betStats.netProfit : 0),
      sportsBankroll: settings.startingSportsBankroll + betStats.netProfit,
      availableLocations: [...new Set(sessions.map((s) => s.location).filter(Boolean))].sort(),
      availableTags: [...new Set(sessions.flatMap((s) => s.tags))].sort(),
      recordedPokerGames: [
        ...new Set(sessions.filter((s) => s.sessionType !== 'TABLE').map((s) => s.gameType).filter(Boolean)),
      ].sort(),
      recordedTableGames: [
        ...new Set(sessions.filter((s) => s.sessionType === 'TABLE').map((s) => s.tableGame).filter(Boolean)),
      ].sort(),
      timerStart: activeSession?.startedAt ?? 0,
      activeSession,
      saveSession,
      deleteSession,
      getSession: (id: number) => sessions.find((s) => s.id === id),
      saveBet,
      deleteBet,
      getBet: (id: number) => bets.find((b) => b.id === id),
      settleBet,
      importBets,
      addTransaction,
      deleteTransaction,
      updateSettings,
      setFilter,
      startSession,
      clearSession,
      importSessions,
      restoreBackup,
      clearData,
    };
  }, [
    ready, sessions, transactions, bets, settings, filter, activeSession,
    saveSession, deleteSession, saveBet, deleteBet, settleBet, importBets,
    addTransaction, deleteTransaction,
    updateSettings, startSession, clearSession, importSessions, restoreBackup, clearData,
  ]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}

/** Re-renders every `intervalMs` — used by the live timer card. */
export function useNow(enabled: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);
  return now;
}

/** Load + CRUD one tool store (blind structures, home games, …) as local state. */
export function useStoreList<T extends { id: number }>(store: {
  list(): Promise<T[]>;
  save(value: T): Promise<number>;
  remove(id: number): Promise<void>;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    store
      .list()
      .then(setItems)
      .catch(() => undefined)
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const save = useCallback(
    async (value: T): Promise<T> => {
      const id = await store.save(value);
      const saved = { ...value, id };
      setItems((prev) => [...prev.filter((x) => x.id !== id), saved]);
      return saved;
    },
    [store],
  );
  const remove = useCallback(
    async (id: number) => {
      await store.remove(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
    },
    [store],
  );
  return { items, loaded, save, remove };
}

/** Online/offline indicator for the offline banner. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

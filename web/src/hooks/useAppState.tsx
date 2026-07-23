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
  StakePreset,
} from '../models/types';
import { harvestCustomGames, harvestStakes, harvestVenues } from '../domain/importHarvest';
import { EMPTY_FILTER, SessionFilter, applyFilter } from '../domain/filter';
import { Statistics, computeStats, bankrollOf } from '../domain/stats';
import { BetStats, computeBetStats } from '../domain/bets';
import { Backup } from '../domain/backup';
import {
  betStore,
  db,
  replaceAll,
  requestPersistence,
  saveAll,
  stakeStore,
  venueStore,
} from '../storage/db';
import {
  loadSettings,
  saveSettings,
  loadTimerStart,
  saveTimerStart,
  loadActiveSession,
  saveActiveSession,
} from '../storage/settings';

export interface AppState {
  ready: boolean;
  /** Non-null when the initial database load failed — the data shown may be
   *  incomplete, and the shell surfaces a warning banner. */
  loadError: string | null;
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
  /** Stakes presets present in the data (recorded or imported), distinct. */
  recordedStakes: StakePreset[];
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
  /** Adds a rebuy amount to the running session's draft. */
  addRebuy(amount: number): void;
  /** Changes the running session's bounty count by delta (clamped at 0). */
  adjustBounty(delta: number): void;
  clearSession(): void;
  importSessions(sessions: Session[]): Promise<number>;
  /** 'replace' wipes current data first (atomically); 'merge' appends the
   *  backup's records to what's already here, keeping this device's settings. */
  restoreBackup(backup: Backup, mode: RestoreMode): Promise<void>;
  /** Permanently deletes logged data for a category (or everything). Returns
   *  the number of records removed. */
  clearData(scope: ClearScope): Promise<number>;
}

/** Which logged data to wipe. 'all' also removes bankroll transactions. */
export type ClearScope = 'poker' | 'table' | 'sports' | 'all';

/** How a backup is applied: replace everything, or add to current data. */
export type RestoreMode = 'replace' | 'merge';

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
    rebuys: 0,
    bountyPerBounty: 0,
    bountyCount: 0,
    currency: settings.currency,
  };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bets, setBets] = useState<SportsBet[]>([]);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(() => {
    const saved = loadActiveSession();
    if (saved) return saved;
    // Migrate a legacy timestamp-only running timer into a bare draft, then
    // retire the legacy key so a cleared session can't resurrect on refresh.
    const legacy = loadTimerStart();
    if (legacy > 0) {
      const migrated = bareActiveSession(legacy, loadSettings());
      saveActiveSession(migrated);
      saveTimerStart(0);
      return migrated;
    }
    return null;
  });
  // The dashboard and session lists always open showing all games; the
  // default-session-type setting only seeds the type for a NEW session.
  const [filter, setFilter] = useState<SessionFilter>(() => ({ ...EMPTY_FILTER }));

  useEffect(() => {
    requestPersistence();
    Promise.all([db.loadSessions(), db.loadTransactions(), betStore.list()])
      .then(async ([s, t, b]) => {
        // normalizeSession/normalizeBet fill newer-version defaults into old records.
        const normalized = s.map(normalizeSession).sort((a, b) => b.startTime - a.startTime);
        setSessions(normalized);
        setTransactions(t.sort((a, b) => b.time - a.time));
        setBets(b.map(normalizeBet).sort((a, z) => z.placedAt - a.placedAt));
        // Backfill the managed pick-lists from ALL existing sessions, so venues,
        // stakes and game types from data imported/restored before the harvest
        // existed become first-class managed entries (visible in Settings too).
        await syncManagedPickLists(normalized);
      })
      // Never present a failed load as "you have no data" — the shell shows a
      // banner so the user doesn't try to "fix" it by re-importing.
      .catch((err: unknown) => setLoadError((err as Error)?.message ?? 'Database error'))
      .finally(() => setReady(true));
  }, []);

  /** Persists any venues, stakes and custom game types found in `list` that
   *  aren't already saved — the shared backfill used on load and after import. */
  const syncManagedPickLists = useCallback(async (list: Session[]) => {
    const [venues, stakes] = await Promise.all([venueStore.list(), stakeStore.list()]);
    await saveAll('venues', harvestVenues(list, venues));
    await saveAll('stakes', harvestStakes(list, stakes));
    setSettings((prev) => {
      const { poker, table } = harvestCustomGames(list, prev.customPokerGames, prev.customTableGames);
      if (!poker.length && !table.length) return prev;
      const next: AppSettings = {
        ...prev,
        customPokerGames: [...prev.customPokerGames, ...poker],
        customTableGames: [...prev.customTableGames, ...table],
      };
      saveSettings(next);
      return next;
    });
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

  /** CSV import: APPENDS to existing bets. Returns the number imported.
   *  One transaction — all rows import or none do. */
  const importBets = useCallback(async (toImport: SportsBet[]) => {
    const saved = await saveAll('bets', toImport.map((b) => ({ ...b, id: 0 })));
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
  }, []);

  /** Begin a live session, capturing its setup now. Persisted so it survives
   *  app restarts and can prefill the editor when the session ends. */
  const startSession = useCallback((setup: Omit<ActiveSession, 'startedAt'>) => {
    const session: ActiveSession = { ...setup, startedAt: Date.now() };
    saveActiveSession(session);
    saveTimerStart(0); // never leave a stale legacy timer behind
    setActiveSession(session);
  }, []);

  /** Add a rebuy / re-entry to the in-progress session, accumulating its
   *  amount so it prefills the editor when the session is logged. */
  const addRebuy = useCallback((amount: number) => {
    if (!(amount > 0)) return;
    setActiveSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, rebuys: prev.rebuys + amount };
      saveActiveSession(next);
      return next;
    });
  }, []);

  /** Change the running session's bounty count by delta (clamped at 0),
   *  for tournaments where you collect knockouts as you go. */
  const adjustBounty = useCallback((delta: number) => {
    setActiveSession((prev) => {
      if (!prev) return prev;
      const count = Math.max(0, prev.bountyCount + delta);
      if (count === prev.bountyCount) return prev;
      const next = { ...prev, bountyCount: count };
      saveActiveSession(next);
      return next;
    });
  }, []);

  const clearSession = useCallback(() => {
    saveActiveSession(null);
    saveTimerStart(0); // clear the legacy key too, so it can't resurrect
    setActiveSession(null);
  }, []);

  /** CSV import: APPENDS to existing data. Returns the number imported.
   *  One transaction — all rows import or none do. */
  const importSessions = useCallback(async (toImport: Session[]) => {
    const saved = await saveAll('sessions', toImport.map((s) => ({ ...s, id: 0 })));
    setSessions((prev) => [...prev, ...saved].sort((a, b) => b.startTime - a.startTime));
    // Treat imported venues, stakes and game types as first-class managed
    // entries so they show everywhere, including the Settings screens.
    await syncManagedPickLists(saved);
    return saved.length;
  }, [syncManagedPickLists]);

  /** Reloads the record stores from the database into React state, so the UI
   *  matches reality after a failed restore/import. */
  const reloadFromDb = useCallback(async () => {
    const [s, t, b] = await Promise.all([
      db.loadSessions(),
      db.loadTransactions(),
      betStore.list(),
    ]);
    setSessions(s.map(normalizeSession).sort((a, b2) => b2.startTime - a.startTime));
    setTransactions(t.sort((a, b2) => b2.time - a.time));
    setBets(b.map(normalizeBet).sort((a, z) => z.placedAt - a.placedAt));
  }, []);

  /** Backup restore (caller confirms with the user first).
   *  'replace' swaps ALL data for the backup's contents in one atomic
   *  IndexedDB transaction — a failure leaves existing data untouched.
   *  'merge' appends the backup's records to current data (venues and stakes
   *  are deduplicated) and keeps this device's settings. */
  const restoreBackup = useCallback(
    async (backup: Backup, mode: RestoreMode) => {
      try {
        if (mode === 'replace') {
          const zeroed = <T extends { id: number }>(list: T[]) =>
            list.map((r) => ({ ...r, id: 0 }));
          const out = await replaceAll({
            sessions: zeroed(backup.sessions),
            transactions: zeroed(backup.transactions),
            bets: zeroed(backup.bets),
            handNotes: zeroed(backup.handNotes),
            homeGames: zeroed(backup.homeGames),
            structures: zeroed(backup.structures),
            events: zeroed(backup.events),
            venues: zeroed(backup.venues),
            stakes: zeroed(backup.stakes),
          });
          // Only data-related settings roam in backups; display/feature
          // preferences (theme, tabs, dashboard cards) stay as this device
          // has them.
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
          setSessions((out.sessions as Session[]).sort((a, b) => b.startTime - a.startTime));
          setTransactions((out.transactions as Transaction[]).sort((a, b) => b.time - a.time));
          setBets((out.bets as SportsBet[]).sort((a, z) => z.placedAt - a.placedAt));
          return;
        }

        // Merge: append records; settings stay as this device has them.
        const [existingVenues, existingStakes] = await Promise.all([
          venueStore.list(),
          stakeStore.list(),
        ]);
        const knownVenues = new Set(existingVenues.map((v) => v.name.trim().toLowerCase()));
        const newVenues = backup.venues.filter(
          (v) => !knownVenues.has(v.name.trim().toLowerCase()),
        );
        const stakeKey = (p: (typeof existingStakes)[number]) =>
          `${p.kind}|${p.smallBlind}|${p.bigBlind}|${p.minBet}|${p.maxBet}`;
        const knownStakes = new Set(existingStakes.map(stakeKey));
        const newStakes = backup.stakes.filter((p) => !knownStakes.has(stakeKey(p)));

        const zero = <T extends { id: number }>(list: T[]) =>
          list.map((r) => ({ ...r, id: 0 }));
        const [mergedSessions, mergedTx, mergedBets] = await Promise.all([
          saveAll('sessions', zero(backup.sessions)),
          saveAll('transactions', zero(backup.transactions)),
          saveAll('bets', zero(backup.bets)),
        ]);
        await Promise.all([
          saveAll('handNotes', zero(backup.handNotes)),
          saveAll('homeGames', zero(backup.homeGames)),
          saveAll('structures', zero(backup.structures)),
          saveAll('events', zero(backup.events)),
          saveAll('venues', zero(newVenues)),
          saveAll('stakes', zero(newStakes)),
        ]);
        setSessions((prev) =>
          [...prev, ...mergedSessions].sort((a, b) => b.startTime - a.startTime),
        );
        setTransactions((prev) => [...prev, ...mergedTx].sort((a, b) => b.time - a.time));
        setBets((prev) => [...prev, ...mergedBets].sort((a, z) => z.placedAt - a.placedAt));
        // Harvest venues/stakes/custom games out of the merged sessions too,
        // exactly like a CSV import would.
        await syncManagedPickLists(mergedSessions);
      } catch (err) {
        // Resync state with whatever actually got written before rethrowing,
        // so the UI never shows deleted (or missing) data as present.
        await reloadFromDb().catch(() => undefined);
        throw err;
      }
    },
    [reloadFromDb, syncManagedPickLists],
  );

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
      loadError,
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
      // Distinct stakes present in the data — reuses the same harvest logic as
      // import, so recorded/imported stakes are pickable like venues and games.
      recordedStakes: harvestStakes(sessions, []),
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
      addRebuy,
      adjustBounty,
      clearSession,
      importSessions,
      restoreBackup,
      clearData,
    };
  }, [
    ready, loadError, sessions, transactions, bets, settings, filter, activeSession,
    saveSession, deleteSession, saveBet, deleteBet, settleBet, importBets,
    addTransaction, deleteTransaction,
    updateSettings, startSession, addRebuy, adjustBounty, clearSession, importSessions, restoreBackup, clearData,
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
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    store
      .list()
      .then(setItems)
      .catch((err: unknown) => setError((err as Error)?.message ?? 'Database error'))
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
  return { items, loaded, error, save, remove };
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

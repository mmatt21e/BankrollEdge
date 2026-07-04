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
  AppSettings,
  Session,
  Transaction,
  TransactionType,
  normalizeSession,
  signedAmount,
} from '../models/types';
import { EMPTY_FILTER, SessionFilter, applyFilter } from '../domain/filter';
import { Statistics, computeStats, bankrollOf } from '../domain/stats';
import { Backup } from '../domain/backup';
import {
  db,
  eventStore,
  handNoteStore,
  homeGameStore,
  requestPersistence,
  structureStore,
} from '../storage/db';
import {
  loadSettings,
  saveSettings,
  loadTimerStart,
  saveTimerStart,
} from '../storage/settings';

export interface AppState {
  ready: boolean;
  sessions: Session[]; // newest first
  filteredSessions: Session[];
  transactions: Transaction[]; // newest first
  transactionsNet: number;
  settings: AppSettings;
  filter: SessionFilter;
  allStats: Statistics;
  filteredStats: Statistics;
  bankroll: number;
  availableLocations: string[];
  availableTags: string[];
  timerStart: number; // 0 = not running

  saveSession(session: Session): Promise<void>;
  deleteSession(id: number): Promise<void>;
  getSession(id: number): Session | undefined;
  addTransaction(type: TransactionType, amount: number, note: string): Promise<void>;
  deleteTransaction(id: number): Promise<void>;
  updateSettings(patch: Partial<AppSettings>): void;
  setFilter(filter: SessionFilter): void;
  startTimer(): void;
  clearTimer(): void;
  importSessions(sessions: Session[]): Promise<number>;
  restoreBackup(backup: Backup): Promise<void>;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [timerStart, setTimerStart] = useState<number>(loadTimerStart);
  const [filter, setFilter] = useState<SessionFilter>(() => {
    const def = loadSettings().defaultSessionType;
    return { ...EMPTY_FILTER, type: def === 'ALL' ? null : def };
  });

  useEffect(() => {
    requestPersistence();
    Promise.all([db.loadSessions(), db.loadTransactions()])
      .then(([s, t]) => {
        // normalizeSession fills v2 defaults into records saved by v1.
        setSessions(s.map(normalizeSession).sort((a, b) => b.startTime - a.startTime));
        setTransactions(t.sort((a, b) => b.time - a.time));
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

  const startTimer = useCallback(() => {
    const now = Date.now();
    saveTimerStart(now);
    setTimerStart(now);
  }, []);

  const clearTimer = useCallback(() => {
    saveTimerStart(0);
    setTimerStart(0);
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
    // Tool collections live in their own stores; pages re-read them on mount.
    await Promise.all([
      handNoteStore.clear(),
      homeGameStore.clear(),
      structureStore.clear(),
      eventStore.clear(),
    ]);
    for (const n of backup.handNotes) await handNoteStore.save(n);
    for (const g of backup.homeGames) await homeGameStore.save(g);
    for (const st of backup.structures) await structureStore.save(st);
    for (const ev of backup.events) await eventStore.save(ev);
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
    saveSettings(backup.settings);
    setSettings(backup.settings);
    setSessions(restoredSessions.sort((a, b) => b.startTime - a.startTime));
    setTransactions(restoredTx.sort((a, b) => b.time - a.time));
  }, []);

  const value = useMemo<AppState>(() => {
    const now = Date.now();
    const filteredSessions = applyFilter(filter, sessions, now);
    const allStats = computeStats(sessions);
    const transactionsNet = transactions.reduce((a, t) => a + signedAmount(t), 0);
    return {
      ready,
      sessions,
      filteredSessions,
      transactions,
      transactionsNet,
      settings,
      filter,
      allStats,
      filteredStats: computeStats(filteredSessions),
      bankroll: bankrollOf(allStats, settings.startingBankroll, transactionsNet),
      availableLocations: [...new Set(sessions.map((s) => s.location).filter(Boolean))].sort(),
      availableTags: [...new Set(sessions.flatMap((s) => s.tags))].sort(),
      timerStart,
      saveSession,
      deleteSession,
      getSession: (id: number) => sessions.find((s) => s.id === id),
      addTransaction,
      deleteTransaction,
      updateSettings,
      setFilter,
      startTimer,
      clearTimer,
      importSessions,
      restoreBackup,
    };
  }, [
    ready, sessions, transactions, settings, filter, timerStart,
    saveSession, deleteSession, addTransaction, deleteTransaction,
    updateSettings, startTimer, clearTimer, importSessions, restoreBackup,
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

// IndexedDB persistence — the PWA equivalent of the Android Room database.
// Schema changes bump DB_VERSION and are applied in onupgradeneeded (the
// analogue of Room migrations). v2 adds the tool stores; v3 adds sports
// bets; existing data is untouched by the upgrades.
import {
  BlindStructure,
  CalendarEvent,
  HandNote,
  HomeGame,
  Session,
  SportsBet,
  StakePreset,
  Transaction,
  Venue,
} from '../models/types';

const DB_NAME = 'bankrolledge';
// v4 adds the saved-venue and stakes-preset pick-lists; existing stores are
// left untouched by the upgrade.
const DB_VERSION = 4;

const ALL_STORES = [
  'sessions',
  'transactions',
  'handNotes',
  'homeGames',
  'structures',
  'events',
  'bets',
  'venues',
  'stakes',
] as const;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const store of ALL_STORES) {
        if (!database.objectStoreNames.contains(store)) {
          database.createObjectStore(store, { keyPath: 'id', autoIncrement: true });
        }
      }
    };
    // Another tab still holds an older schema version open — without this the
    // open request would hang forever with no error.
    request.onblocked = () =>
      reject(new Error('Another BankrollEdge tab is blocking a database upgrade — close other tabs and reload.'));
    request.onsuccess = () => {
      // Let a future upgrade in another tab proceed instead of being blocked
      // by this one.
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
  // A failed open must not be memoized forever — allow a later retry.
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(storeName, mode);
        const request = work(transaction.objectStore(storeName));
        let result: T;
        request.onsuccess = () => {
          result = request.result;
        };
        // Resolve only once the transaction commits — request.onsuccess fires
        // before commit, and a commit-time abort (e.g. quota) would silently
        // lose a write the caller was already told succeeded.
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () =>
          reject(transaction.error ?? new Error('IndexedDB error'));
        transaction.onabort = () =>
          reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
      }),
  );
}

/** Puts all `records` into `storeName` in ONE transaction (all-or-nothing).
 *  id 0 → autoincrement. Resolves with the stored records (ids assigned). */
export function saveAll<T extends { id: number }>(
  storeName: string,
  records: T[],
): Promise<T[]> {
  if (records.length === 0) return Promise.resolve([]);
  return openDb().then(
    (database) =>
      new Promise<T[]>((resolve, reject) => {
        const transaction = database.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const saved: T[] = records.map((r) => ({ ...r }));
        saved.forEach((value, i) => {
          const record: Record<string, unknown> = { ...value };
          if (value.id === 0) delete record.id;
          const request = store.put(record);
          request.onsuccess = () => {
            saved[i].id = request.result as number;
          };
        });
        transaction.oncomplete = () => resolve(saved);
        transaction.onerror = () =>
          reject(transaction.error ?? new Error('IndexedDB error'));
        transaction.onabort = () =>
          reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
      }),
  );
}

/** Atomically replaces the contents of every store in `data` in ONE
 *  transaction: each named store is cleared and refilled. If anything fails,
 *  IndexedDB aborts the whole transaction and existing data is untouched.
 *  Resolves with the stored records (ids assigned). */
export function replaceAll(
  data: Partial<Record<(typeof ALL_STORES)[number], { id: number }[]>>,
): Promise<Record<string, { id: number }[]>> {
  const names = Object.keys(data) as (typeof ALL_STORES)[number][];
  if (names.length === 0) return Promise.resolve({});
  return openDb().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(names, 'readwrite');
        const out: Record<string, { id: number }[]> = {};
        for (const name of names) {
          const store = transaction.objectStore(name);
          store.clear();
          const saved = (data[name] ?? []).map((r) => ({ ...r }));
          out[name] = saved;
          saved.forEach((value, i) => {
            const record: Record<string, unknown> = { ...value };
            if (value.id === 0) delete record.id;
            const request = store.put(record);
            request.onsuccess = () => {
              saved[i].id = request.result as number;
            };
          });
        }
        transaction.oncomplete = () => resolve(out);
        transaction.onerror = () =>
          reject(transaction.error ?? new Error('IndexedDB error'));
        transaction.onabort = () =>
          reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
      }),
  );
}

/** Typed CRUD for one object store (id 0 = unsaved → autoincrement key). */
export interface Store<T extends { id: number }> {
  list(): Promise<T[]>;
  save(value: T): Promise<number>;
  remove(id: number): Promise<void>;
  clear(): Promise<void>;
}

function makeStore<T extends { id: number }>(name: string): Store<T> {
  return {
    list: () => tx<T[]>(name, 'readonly', (s) => s.getAll() as IDBRequest<T[]>),
    save: async (value: T) => {
      const record: Record<string, unknown> = { ...value };
      if (value.id === 0) delete record.id;
      const key = await tx<IDBValidKey>(name, 'readwrite', (s) => s.put(record));
      return key as number;
    },
    remove: (id: number) =>
      tx(name, 'readwrite', (s) => s.delete(id) as IDBRequest<undefined>).then(() => undefined),
    clear: () =>
      tx(name, 'readwrite', (s) => s.clear() as IDBRequest<undefined>).then(() => undefined),
  };
}

export const sessionStore = makeStore<Session>('sessions');
export const transactionStore = makeStore<Transaction>('transactions');
export const handNoteStore = makeStore<HandNote>('handNotes');
export const homeGameStore = makeStore<HomeGame>('homeGames');
export const structureStore = makeStore<BlindStructure>('structures');
export const eventStore = makeStore<CalendarEvent>('events');
export const betStore = makeStore<SportsBet>('bets');
export const venueStore = makeStore<Venue>('venues');
export const stakeStore = makeStore<StakePreset>('stakes');

// Back-compat facade used by useAppState.
export const db = {
  loadSessions: sessionStore.list,
  saveSession: sessionStore.save,
  deleteSession: sessionStore.remove,
  clearSessions: sessionStore.clear,
  loadTransactions: transactionStore.list,
  saveTransaction: transactionStore.save,
  deleteTransaction: transactionStore.remove,
  clearTransactions: transactionStore.clear,
};

/** Ask the browser not to evict our data under storage pressure. */
export function requestPersistence(): void {
  if (navigator.storage?.persist) {
    navigator.storage.persist().catch(() => undefined);
  }
}

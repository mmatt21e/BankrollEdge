// IndexedDB persistence — the PWA equivalent of the Android Room database.
// Schema changes bump DB_VERSION and are applied in onupgradeneeded (the
// analogue of Room migrations). v2 adds the tool stores; existing data is
// untouched by the upgrade.
import {
  BlindStructure,
  CalendarEvent,
  HandNote,
  HomeGame,
  Session,
  Transaction,
} from '../models/types';

const DB_NAME = 'bankrolledge';
const DB_VERSION = 2;

const ALL_STORES = [
  'sessions',
  'transactions',
  'handNotes',
  'homeGames',
  'structures',
  'events',
] as const;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const store of ALL_STORES) {
        if (!database.objectStoreNames.contains(store)) {
          database.createObjectStore(store, { keyPath: 'id', autoIncrement: true });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
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
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB error'));
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

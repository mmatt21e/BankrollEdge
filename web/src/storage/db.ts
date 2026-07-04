// IndexedDB persistence — the PWA equivalent of the Android Room database.
// Two object stores mirror the Room tables; schema changes bump DB_VERSION and
// are applied in onupgradeneeded (the analogue of Room migrations).
import { Session, Transaction } from '../models/types';

const DB_NAME = 'bankrolledge';
const DB_VERSION = 1;
const SESSIONS = 'sessions';
const TRANSACTIONS = 'transactions';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSIONS)) {
        db.createObjectStore(SESSIONS, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(TRANSACTIONS)) {
        db.createObjectStore(TRANSACTIONS, { keyPath: 'id', autoIncrement: true });
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
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const request = work(transaction.objectStore(storeName));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB error'));
      }),
  );
}

async function getAll<T>(store: string): Promise<T[]> {
  return tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
}

async function put<T extends { id: number }>(store: string, value: T): Promise<number> {
  // id 0 = unsaved → let IndexedDB assign an autoincrement key.
  const record: Record<string, unknown> = { ...value };
  if (value.id === 0) delete record.id;
  const key = await tx<IDBValidKey>(store, 'readwrite', (s) => s.put(record));
  return key as number;
}

const remove = (store: string, id: number): Promise<void> =>
  tx(store, 'readwrite', (s) => s.delete(id) as IDBRequest<undefined>).then(() => undefined);

const clear = (store: string): Promise<void> =>
  tx(store, 'readwrite', (s) => s.clear() as IDBRequest<undefined>).then(() => undefined);

export const db = {
  loadSessions: (): Promise<Session[]> => getAll<Session>(SESSIONS),
  saveSession: (s: Session): Promise<number> => put(SESSIONS, s),
  deleteSession: (id: number): Promise<void> => remove(SESSIONS, id),
  clearSessions: (): Promise<void> => clear(SESSIONS),

  loadTransactions: (): Promise<Transaction[]> => getAll<Transaction>(TRANSACTIONS),
  saveTransaction: (t: Transaction): Promise<number> => put(TRANSACTIONS, t),
  deleteTransaction: (id: number): Promise<void> => remove(TRANSACTIONS, id),
  clearTransactions: (): Promise<void> => clear(TRANSACTIONS),
};

/** Ask the browser not to evict our data under storage pressure (best-effort;
 *  matters most on iOS). */
export function requestPersistence(): void {
  if (navigator.storage?.persist) {
    navigator.storage.persist().catch(() => undefined);
  }
}

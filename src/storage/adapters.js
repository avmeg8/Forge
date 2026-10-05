/**
 * Storage adapters.
 *
 * Every adapter implements the same tiny async key-value-per-collection interface:
 *
 *   get(store, key)        → record | undefined
 *   getAll(store)          → record[]
 *   put(store, record)     → record            (records carry their own `id`)
 *   delete(store, key)
 *   clear(store)
 *
 * The app only ever talks to the Repository (repository.js), which talks to an
 * adapter. To add cloud sync later, write e.g. a `SyncAdapter` that wraps the
 * IndexedDB adapter and pushes/pulls changed records (every record carries
 * `id` + `updatedAt` for exactly this purpose). No screen code needs to change.
 */

export const STORES = ['meta', 'templates', 'sessions', 'measures', 'outbox'];
const DB_NAME = 'forge';
const DB_VERSION = 2;

export class IndexedDBAdapter {
  constructor(name = DB_NAME) {
    this.name = name;
    this.dbPromise = null;
  }

  static isSupported() {
    return typeof indexedDB !== 'undefined';
  }

  open() {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(this.name, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
    return this.dbPromise;
  }

  async tx(store, mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const os = t.objectStore(store);
      let result;
      const req = fn(os);
      if (req) req.onsuccess = () => { result = req.result; };
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  get(store, key) { return this.tx(store, 'readonly', (os) => os.get(key)); }
  getAll(store) { return this.tx(store, 'readonly', (os) => os.getAll()).then((r) => r || []); }
  async put(store, record) { await this.tx(store, 'readwrite', (os) => os.put(record)); return record; }
  delete(store, key) { return this.tx(store, 'readwrite', (os) => os.delete(key)); }
  clear(store) { return this.tx(store, 'readwrite', (os) => os.clear()); }
}

/** In-memory adapter: used in tests and as a fallback when IndexedDB is unavailable. */
export class MemoryAdapter {
  constructor() {
    this.data = Object.fromEntries(STORES.map((s) => [s, new Map()]));
  }
  clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }
  async get(store, key) { return this.clone(this.data[store].get(key)); }
  async getAll(store) { return [...this.data[store].values()].map((v) => this.clone(v)); }
  async put(store, record) { this.data[store].set(record.id, this.clone(record)); return record; }
  async delete(store, key) { this.data[store].delete(key); }
  async clear(store) { this.data[store].clear(); }
}

export async function createAdapter() {
  if (IndexedDBAdapter.isSupported()) {
    const a = new IndexedDBAdapter();
    try {
      await a.open();
      return a;
    } catch (e) {
      console.warn('[FORGE] IndexedDB unavailable, falling back to memory storage', e);
    }
  }
  return new MemoryAdapter();
}

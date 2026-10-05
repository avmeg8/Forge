/**
 * Cloud backup — keeps a copy of your FORGE data in the cloud (Supabase) and syncs it
 * between devices.
 *
 * No account needed: turning backup on creates a random BACKUP KEY (125 bits, shown as
 * XXXXX-XXXXX-XXXXX-XXXXX-XXXXX). The key is the only thing that identifies your backup —
 * enter it on another phone to restore. The server only ever stores a hash of the key and
 * exposes a single function (`forge_sync`) — nobody can list or read backups without a key.
 *
 * Protocol (one RPC does push + pull):
 *   forge_sync(key, since, records[]) → { records[], seq, more }
 *   • records we send are kept only if newer (updatedAt) than the cloud copy
 *   • the server returns every record changed after `since` (a server sequence number,
 *     so device clocks never matter for "what's new")
 * Local writes are queued in the IndexedDB `outbox` by the Repository, so nothing is lost
 * while offline; the queue is flushed on the next successful sync.
 */
export const CLOUD = {
  url: 'https://msmewyfqxpskqfdrdtiy.supabase.co/rest/v1/rpc/forge_sync',
  apiKey: 'sb_publishable_uv9P3hYfTOiZkpnba35PDw_2Du7L3WV',
};

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32 — no I, L, O, U

export function newKey() {
  const bytes = new Uint8Array(25);
  crypto.getRandomValues(bytes);
  const chars = [...bytes].map((b) => ALPHABET[b % 32]).join('');
  return chars.match(/.{5}/g).join('-');
}

/** Accept a key typed with spaces, lowercase, missing dashes or look-alike letters. */
export function normalizeKey(input) {
  const raw = String(input || '').toUpperCase().replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
  if (raw.length !== 25 || [...raw].some((c) => !ALPHABET.includes(c))) return null;
  return raw.match(/.{5}/g).join('-');
}

const BATCH = 150;

export class Sync {
  /**
   * @param repo      Repository
   * @param onPulled  called after remote changes were applied locally
   * @param fetchImpl injectable for tests
   */
  constructor(repo, { onPulled = () => {}, onStatus = () => {}, fetchImpl } = {}) {
    this.repo = repo;
    this.onPulled = onPulled;
    this.onStatus = onStatus;
    this.fetch = fetchImpl || ((...a) => fetch(...a));
    this.cfg = null;
    this.running = null;
    this.timer = null;
    this.status = { state: 'off' };
  }

  async load() {
    this.cfg = await this.repo.syncConfig();
    this.setStatus(this.cfg ? { state: 'idle', lastSyncAt: this.cfg.lastSyncAt } : { state: 'off' });
    return this.cfg;
  }

  get enabled() { return !!this.cfg?.key; }
  get key() { return this.cfg?.key || null; }

  setStatus(s) { this.status = { ...s, lastSyncAt: s.lastSyncAt ?? this.cfg?.lastSyncAt ?? null }; this.onStatus(this.status); }

  async rpc(since, records) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const to = ctl ? setTimeout(() => ctl.abort(), 20000) : null;
    try {
      const res = await this.fetch(CLOUD.url, {
        method: 'POST',
        headers: { apikey: CLOUD.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_key: this.cfg.key, p_since: since, p_records: records }),
        signal: ctl?.signal,
      });
      if (!res.ok) {
        let msg = `Server error ${res.status}`;
        try { const j = await res.json(); if (j?.message) msg = j.message; } catch { /* not json */ }
        throw new Error(msg);
      }
      return await res.json();
    } finally {
      if (to) clearTimeout(to);
    }
  }

  /** Turn backup on with a brand-new key and upload everything. */
  async enable() {
    this.cfg = { key: newKey(), since: 0, lastSyncAt: null, createdAt: Date.now() };
    await this.repo.saveSyncConfig(this.cfg);
    await this.repo.queueAll();
    this.now(); // upload in the background
    return this.cfg.key;
  }

  /** Connect this device to an existing backup. preferRemote: the cloud copy wins everything. */
  async connect(key, { preferRemote = true } = {}) {
    const k = normalizeKey(key);
    if (!k) throw new Error('That doesn’t look like a FORGE backup key.');
    const prev = this.cfg;
    this.cfg = { key: k, since: 0, lastSyncAt: null, createdAt: Date.now() };
    try {
      // pull first (cloud wins), then upload whatever this device has that the cloud doesn't
      const pulled = await this.pullAll({ preferRemote });
      if (!pulled.total) throw new Error('No backup found for that key.');
      await this.repo.saveSyncConfig(this.cfg);
      await this.repo.queueAll();
      await this.now();
      return pulled;
    } catch (e) {
      this.cfg = prev;
      throw e;
    }
  }

  async disable() {
    clearTimeout(this.timer);
    this.cfg = null;
    await this.repo.saveSyncConfig(null);
    this.setStatus({ state: 'off', lastSyncAt: null });
  }

  /** Debounced sync after local changes. */
  schedule(ms = 3000) {
    if (!this.enabled) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.now().catch(() => {}), ms);
  }

  async pullAll({ preferRemote = false } = {}) {
    let total = 0, changed = 0, more = true;
    while (more) {
      const res = await this.rpc(this.cfg.since || 0, []);
      total += res.records.length;
      changed += await this.repo.applyRemote(res.records, { preferRemote });
      this.cfg.since = res.seq;
      more = res.more;
    }
    return { total, changed };
  }

  /** Push the outbox, then pull everything new. Safe to call any time. */
  now() {
    if (!this.enabled) return Promise.resolve(null);
    if (this.running) { this.again = true; return this.running; }
    this.running = (async () => {
      this.setStatus({ state: 'syncing' });
      let changed = 0;
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) throw Object.assign(new Error('Offline'), { offline: true });
        const queue = await this.repo.outbox();
        for (let i = 0; i < queue.length; i += BATCH) {
          const slice = queue.slice(i, i + BATCH);
          const records = await Promise.all(slice.map((e) => this.repo.recordFor(e)));
          const res = await this.rpc(this.cfg.since || 0, records);
          // clear the queue first, so the echo of our own records isn't seen as "pending"
          for (const e of slice) await this.repo.clearOutboxEntry(e);
          changed += await this.repo.applyRemote(res.records);
          this.cfg.since = res.seq;
        }
        changed += (await this.pullAll()).changed;
        this.cfg.lastSyncAt = Date.now();
        await this.repo.saveSyncConfig(this.cfg);
        this.setStatus({ state: 'ok' });
      } catch (e) {
        const offline = e.offline || e.name === 'AbortError' || e instanceof TypeError;
        this.setStatus({ state: offline ? 'offline' : 'error', error: offline ? 'Waiting for a connection' : e.message });
      } finally {
        this.running = null;
      }
      if (changed) await this.onPulled(changed);
      if (this.again) { this.again = false; this.schedule(500); }
      return changed;
    })();
    return this.running;
  }
}

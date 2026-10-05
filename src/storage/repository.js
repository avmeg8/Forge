/**
 * Repository — the only module that knows how FORGE data is laid out in storage.
 *
 * Collections
 *   meta       { id: 'settings', ... }  user settings + equipment profiles
 *              { id: 'active', session } the workout currently in progress (survives reloads)
 *   templates  workouts the user built
 *   sessions   completed workouts (the source of truth for all progression — muscle
 *              XP, levels, PRs and streaks are *derived* by replaying sessions, so they
 *              can never drift out of sync with the logged sets)
 */
import { defaultProfile } from '../data/equipment.js';

export const SCHEMA_VERSION = 1;

export function defaultSettings() {
  return {
    id: 'settings',
    schema: SCHEMA_VERSION,
    onboarded: false,
    experience: 'beginner', // beginner | intermediate | advanced
    frequency: '4', // '2-3' | '4' | '5'
    restMode: 'exercise', // 'exercise' or seconds as number
    targetMinutes: 45,
    weekStart: 1,
    sound: true,
    vibrate: true,
    activeProfileId: 'home',
    profiles: [defaultProfile()],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Collections that are backed up to the cloud. `meta` only syncs the settings record. */
export const SYNCED = ['meta', 'templates', 'sessions', 'measures'];
const syncable = (store, id) => SYNCED.includes(store) && (store !== 'meta' || id === 'settings');

export class Repository {
  constructor(adapter) {
    this.a = adapter;
  }

  async loadAll() {
    const [settings, active, templates, sessions, measures] = await Promise.all([
      this.a.get('meta', 'settings'),
      this.a.get('meta', 'active'),
      this.a.getAll('templates'),
      this.a.getAll('sessions'),
      this.a.getAll('measures'),
    ]);
    return {
      settings: settings ? { ...defaultSettings(), ...settings } : defaultSettings(),
      active: active?.session || null,
      templates: templates.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt),
      sessions: sessions.sort((a, b) => a.startedAt - b.startedAt),
      measures: measures.sort((a, b) => a.t - b.t),
    };
  }

  /* ── writes go through here so every change is queued for cloud backup ── */
  async put(store, record) {
    const rec = { ...record, updatedAt: Date.now() };
    await this.a.put(store, rec);
    if (syncable(store, rec.id)) await this.a.put('outbox', { id: `${store}|${rec.id}`, store, rid: rec.id, deleted: false, updatedAt: rec.updatedAt });
    return rec;
  }

  async remove(store, id) {
    await this.a.delete(store, id);
    if (syncable(store, id)) await this.a.put('outbox', { id: `${store}|${id}`, store, rid: id, deleted: true, updatedAt: Date.now() });
  }

  saveSettings(s) { return this.put('meta', { ...s, id: 'settings' }); }

  saveTemplate(t) { return this.put('templates', t); }
  deleteTemplate(id) { return this.remove('templates', id); }

  saveSession(s) { return this.put('sessions', s); }
  deleteSession(id) { return this.remove('sessions', id); }

  saveMeasure(m) { return this.put('measures', m); }
  deleteMeasure(id) { return this.remove('measures', id); }

  saveActive(session) {
    return session ? this.a.put('meta', { id: 'active', session, updatedAt: Date.now() }) : this.a.delete('meta', 'active');
  }

  /* ── cloud backup plumbing (used by storage/sync.js) ── */
  async syncConfig() { return (await this.a.get('meta', 'sync')) || null; }
  saveSyncConfig(cfg) { return cfg ? this.a.put('meta', { ...cfg, id: 'sync' }) : this.a.delete('meta', 'sync'); }
  outbox() { return this.a.getAll('outbox'); }
  async clearOutboxEntry(entry) {
    const cur = await this.a.get('outbox', entry.id);
    if (cur && cur.updatedAt === entry.updatedAt) await this.a.delete('outbox', entry.id);
  }
  /** Queue every local record for upload (first backup / after a restore). */
  async queueAll() {
    const now = Date.now();
    for (const store of SYNCED) {
      for (const rec of await this.a.getAll(store)) {
        if (!syncable(store, rec.id)) continue;
        await this.a.put('outbox', { id: `${store}|${rec.id}`, store, rid: rec.id, deleted: false, updatedAt: rec.updatedAt || now });
      }
    }
  }
  async recordFor(entry) {
    if (entry.deleted) return { store: entry.store, id: entry.rid, data: null, updatedAt: entry.updatedAt, deleted: true };
    const data = await this.a.get(entry.store, entry.rid);
    if (!data) return { store: entry.store, id: entry.rid, data: null, updatedAt: entry.updatedAt, deleted: true };
    return { store: entry.store, id: entry.rid, data, updatedAt: data.updatedAt || entry.updatedAt, deleted: false };
  }
  /**
   * Apply records pulled from the cloud. Newest `updatedAt` wins; with preferRemote
   * (restoring onto a fresh device) the cloud copy always wins.
   * @returns number of local records changed
   */
  async applyRemote(rows, { preferRemote = false } = {}) {
    let changed = 0;
    for (const row of rows) {
      if (!syncable(row.store, row.id)) continue;
      const local = await this.a.get(row.store, row.id);
      const pending = await this.a.get('outbox', `${row.store}|${row.id}`);
      const localT = Math.max(local?.updatedAt || 0, pending?.updatedAt || 0);
      if (!preferRemote && localT >= row.updatedAt) continue;
      if (row.deleted) {
        if (local) { await this.a.delete(row.store, row.id); changed++; }
      } else if (row.data) {
        await this.a.put(row.store, { ...row.data, id: row.id, updatedAt: row.updatedAt });
        changed++;
      }
      if (pending) await this.a.delete('outbox', pending.id);
    }
    return changed;
  }

  /** Full JSON backup (Settings → Export). */
  async exportAll() {
    const data = await this.loadAll();
    return { app: 'forge', schema: SCHEMA_VERSION, exportedAt: new Date().toISOString(), ...data };
  }

  async importAll(data) {
    if (!data || data.app !== 'forge') throw new Error('Not a FORGE backup file.');
    const sync = await this.syncConfig();
    for (const s of ['templates', 'sessions', 'measures', 'outbox', 'meta']) await this.a.clear(s);
    if (sync) await this.saveSyncConfig(sync);
    await this.saveSettings({ ...defaultSettings(), ...data.settings, onboarded: true });
    for (const t of data.templates || []) await this.put('templates', t);
    for (const s of data.sessions || []) await this.put('sessions', s);
    for (const m of data.measures || []) await this.put('measures', m);
  }

  async reset() {
    for (const s of ['meta', 'templates', 'sessions', 'measures', 'outbox']) await this.a.clear(s);
  }
}

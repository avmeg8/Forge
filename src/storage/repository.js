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

export class Repository {
  constructor(adapter) {
    this.a = adapter;
  }

  async loadAll() {
    const [settings, active, templates, sessions] = await Promise.all([
      this.a.get('meta', 'settings'),
      this.a.get('meta', 'active'),
      this.a.getAll('templates'),
      this.a.getAll('sessions'),
    ]);
    return {
      settings: settings ? { ...defaultSettings(), ...settings } : defaultSettings(),
      active: active?.session || null,
      templates: templates.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt),
      sessions: sessions.sort((a, b) => a.startedAt - b.startedAt),
    };
  }

  saveSettings(s) { return this.a.put('meta', { ...s, id: 'settings', updatedAt: Date.now() }); }

  saveTemplate(t) { return this.a.put('templates', { ...t, updatedAt: Date.now() }); }
  deleteTemplate(id) { return this.a.delete('templates', id); }

  saveSession(s) { return this.a.put('sessions', { ...s, updatedAt: Date.now() }); }
  deleteSession(id) { return this.a.delete('sessions', id); }

  saveActive(session) {
    return session ? this.a.put('meta', { id: 'active', session, updatedAt: Date.now() }) : this.a.delete('meta', 'active');
  }

  /** Full JSON backup (Settings → Export). */
  async exportAll() {
    const data = await this.loadAll();
    return { app: 'forge', schema: SCHEMA_VERSION, exportedAt: new Date().toISOString(), ...data };
  }

  async importAll(data) {
    if (!data || data.app !== 'forge') throw new Error('Not a FORGE backup file.');
    for (const s of ['templates', 'sessions']) await this.a.clear(s);
    await this.a.clear('meta');
    await this.saveSettings({ ...defaultSettings(), ...data.settings, onboarded: true });
    for (const t of data.templates || []) await this.a.put('templates', t);
    for (const s of data.sessions || []) await this.a.put('sessions', s);
  }

  async reset() {
    for (const s of ['meta', 'templates', 'sessions']) await this.a.clear(s);
  }
}

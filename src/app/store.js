/**
 * App store — single source of state + persistence + memoized derived data.
 * Screens read `store.state` and derived getters; they change data only
 * through the action methods below, which persist first and then notify.
 */
import { Repository, defaultSettings } from '../storage/repository.js';
import { createAdapter } from '../storage/adapters.js';
import { computeProgress, previousPerformance } from '../engine/xp.js';
import { computeStreak } from '../engine/streak.js';
import { activeProfile, capabilities, loadConfig } from '../engine/equipment.js';
import { recommend } from '../engine/progression.js';
import { rateWorkout } from '../engine/rating.js';
import { EXERCISE_BY_ID } from '../data/exercises.js';
import { uid } from '../utils/id.js';

export class Store {
  constructor() {
    this.listeners = new Set();
    this.version = 0;
    this.memo = {};
    this.state = { settings: defaultSettings(), templates: [], sessions: [], active: null };
  }

  async init(adapter) {
    this.repo = new Repository(adapter || (await createAdapter()));
    this.state = await this.repo.loadAll();
    this.bump();
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  bump() { this.version++; this.memo = {}; }
  emit() { this.bump(); this.listeners.forEach((fn) => fn()); }

  memoize(key, fn) {
    if (!(key in this.memo)) this.memo[key] = fn();
    return this.memo[key];
  }

  /* ───────────── derived ───────────── */
  get settings() { return this.state.settings; }
  get profile() { return this.memoize('profile', () => activeProfile(this.state.settings)); }
  get caps() { return this.memoize('caps', () => capabilities(this.profile)); }
  get done() { return this.state.sessions.filter((s) => s.status === 'done'); }
  /** Progress from completed sessions only. */
  get progress() { return this.memoize('progress', () => computeProgress(this.done, this.settings, Date.now())); }
  /** Progress including the workout in progress (live XP / PRs while training). */
  get liveProgress() {
    if (!this.state.active) return this.progress;
    return this.memoize('live', () => computeProgress([...this.done, this.state.active], this.settings, Date.now()));
  }
  get streak() {
    return this.memoize('streak', () => computeStreak(this.done.map((s) => s.startedAt), this.settings.frequency, Date.now(), this.settings.weekStart));
  }
  cfgFor(exerciseId) {
    const ex = EXERCISE_BY_ID[exerciseId];
    return ex ? loadConfig(this.profile, ex.load) : null;
  }
  rate(items, targetMinutes) {
    return rateWorkout(items, { settings: this.settings, profile: this.profile, caps: this.caps, progress: this.progress, targetMinutes });
  }
  /** "NEXT TIME" recommendation based on the latest session containing the exercise. */
  recommendationFor(exerciseId, target, excludeSessionId) {
    const prev = previousPerformance(this.progress, exerciseId, excludeSessionId);
    return recommend(exerciseId, prev?.sets || [], target, this.cfgFor(exerciseId));
  }

  /* ───────────── settings ───────────── */
  async saveSettings(patch) {
    this.state.settings = { ...this.state.settings, ...patch };
    await this.repo.saveSettings(this.state.settings);
    this.emit();
  }

  async updateProfile(fn) {
    const settings = structuredClone(this.state.settings);
    const p = settings.profiles.find((x) => x.id === settings.activeProfileId) || settings.profiles[0];
    fn(p, settings);
    await this.saveSettings(settings);
  }

  /* ───────────── templates ───────────── */
  template(id) { return this.state.templates.find((t) => t.id === id); }

  newTemplate(name = 'New Workout', items = []) {
    return {
      id: uid('t'), name, items, targetMinutes: this.settings.targetMinutes || 45,
      createdAt: Date.now(), updatedAt: Date.now(), order: this.state.templates.length,
    };
  }

  async saveTemplate(t, { silent = false } = {}) {
    const i = this.state.templates.findIndex((x) => x.id === t.id);
    if (i >= 0) this.state.templates[i] = t; else this.state.templates.push(t);
    await this.repo.saveTemplate(t);
    if (silent) this.bump(); else this.emit();
  }

  async deleteTemplate(id) {
    this.state.templates = this.state.templates.filter((t) => t.id !== id);
    await this.repo.deleteTemplate(id);
    this.emit();
  }

  makeItem(exerciseId, overrides = {}) {
    const ex = EXERCISE_BY_ID[exerciseId];
    return { uid: uid('i'), exerciseId, sets: ex.sets, repMin: ex.reps[0], repMax: ex.reps[1], weight: null, ...overrides };
  }

  /* ───────────── sessions ───────────── */
  async startSession(template) {
    const items = template.items.map((it) => ({ ...it }));
    const session = {
      id: uid('s'), templateId: template.id || null, name: template.name || 'Workout',
      startedAt: Date.now(), status: 'active', items, sets: [], current: 0, drafts: {}, rest: null,
      targetMinutes: template.targetMinutes,
      ratingAtStart: (() => { const r = this.rate(items, template.targetMinutes); return { score: r.score, grade: r.grade, label: r.label, coverage: r.coverage }; })(),
    };
    this.state.active = session;
    await this.repo.saveActive(session);
    this.emit();
    return session;
  }

  /** Mutate the active session in place and persist. */
  async updateActive(fn, { silent = false } = {}) {
    if (!this.state.active) return;
    fn(this.state.active);
    await this.repo.saveActive(this.state.active);
    if (silent) this.bump(); else this.emit();
  }

  async finishSession() {
    const s = this.state.active;
    if (!s) return null;
    s.status = 'done';
    s.endedAt = Date.now();
    s.rest = null;
    delete s.drafts;
    if (s.sets.length) {
      this.state.sessions.push(s);
      await this.repo.saveSession(s);
      if (s.templateId) {
        const t = this.template(s.templateId);
        if (t) { t.lastPerformedAt = s.endedAt; await this.repo.saveTemplate(t); }
      }
    }
    this.state.active = null;
    await this.repo.saveActive(null);
    this.emit();
    return s.sets.length ? s : null;
  }

  async discardSession() {
    this.state.active = null;
    await this.repo.saveActive(null);
    this.emit();
  }

  async deleteSession(id) {
    this.state.sessions = this.state.sessions.filter((s) => s.id !== id);
    await this.repo.deleteSession(id);
    this.emit();
  }

  /* ───────────── backup ───────────── */
  async exportJson() { return this.repo.exportAll(); }
  async importJson(data) { await this.repo.importAll(data); this.state = await this.repo.loadAll(); this.emit(); }
  async resetAll() { await this.repo.reset(); this.state = await this.repo.loadAll(); this.emit(); }
}

export const store = new Store();

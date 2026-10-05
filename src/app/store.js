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
import { ratePlan, activeSchedule } from '../engine/plan.js';
import { deloadState, deloadSets } from '../engine/deload.js';
import { generateWorkout } from '../engine/generator.js';
import { Sync } from '../storage/sync.js';
import { startOfWeek } from '../utils/date.js';
import { EXERCISE_BY_ID } from '../data/exercises.js';
import { uid } from '../utils/id.js';

export class Store {
  constructor() {
    this.listeners = new Set();
    this.version = 0;
    this.memo = {};
    this.state = { settings: defaultSettings(), templates: [], sessions: [], measures: [], active: null };
    this.syncStatus = { state: 'off' };
  }

  async init(adapter, { fetchImpl, autoSync = true } = {}) {
    this.repo = new Repository(adapter || (await createAdapter()));
    this.state = await this.repo.loadAll();
    this.sync = new Sync(this.repo, {
      fetchImpl,
      onPulled: () => this.reload(),
      onStatus: (st) => { this.syncStatus = st; this.listeners.forEach((fn) => fn({ syncOnly: true })); },
    });
    await this.sync.load();
    this.bump();
    if (autoSync && this.sync.enabled) this.sync.schedule(800);
  }

  /** Re-read everything from storage (after a cloud sync brought in changes). */
  async reload() {
    this.state = await this.repo.loadAll();
    this.bump();
    this.listeners.forEach((fn) => fn({ fromSync: true }));
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  bump() { this.version++; this.memo = {}; }
  emit() { this.bump(); this.listeners.forEach((fn) => fn()); this.sync?.schedule(); }

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
  rate(items, targetMinutes, focus = 'auto', customMuscles = []) {
    return rateWorkout(items, { settings: this.settings, profile: this.profile, caps: this.caps, progress: this.progress, targetMinutes, focus, customMuscles });
  }
  rateTemplate(t) {
    return this.rate(t.items, t.targetMinutes, t.focus || 'auto', t.customMuscles || []);
  }
  /** Weekday → template id, only for workouts that still exist. */
  get schedule() { return this.memoize('schedule', () => activeSchedule(this.settings.schedule, this.state.templates)); }
  get hasSchedule() { return Object.keys(this.schedule).length > 0; }
  /** Workouts in the weekly plan: the scheduled ones, or every saved workout unless excluded. */
  get planTemplates() {
    if (this.hasSchedule) return [...new Set(Object.values(this.schedule))].map((id) => this.template(id)).filter(Boolean);
    return this.state.templates.filter((t) => t.inPlan !== false && t.items.length);
  }
  get plan() {
    return this.memoize('plan', () => ratePlan(this.planTemplates, { settings: this.settings, allTemplates: this.state.templates, rateTemplate: (t) => this.rateTemplate(t) }));
  }
  /** Scheduled workout for a given day (default today), or null. */
  scheduledFor(t = Date.now()) {
    const id = this.schedule[new Date(t).getDay()];
    return id ? this.template(id) : null;
  }
  get deload() {
    return this.memoize('deload', () => deloadState(this.settings, this.done.map((s) => s.startedAt), Date.now()));
  }
  async startDeload() {
    const wk = startOfWeek(Date.now(), this.settings.weekStart ?? 1);
    await this.saveSettings({ deloadWeek: wk, deloadLast: wk, deloadSnooze: null });
  }
  async endDeload() { await this.saveSettings({ deloadWeek: null }); }
  async snoozeDeload() { await this.saveSettings({ deloadSnooze: startOfWeek(Date.now(), this.settings.weekStart ?? 1) }); }

  /** "Build it for me" — see engine/generator.js */
  generate({ focus, customMuscles, minutes, supersets, seed }) {
    return generateWorkout({
      focus, customMuscles, minutes, supersets, seed,
      rateCtx: { settings: this.settings, profile: this.profile, caps: this.caps, progress: this.progress },
      makeItem: (id, o) => this.makeItem(id, o),
    });
  }

  /* ───────────── body weight ───────────── */
  get measures() { return this.state.measures || []; }
  get bodyWeight() { const m = this.measures; return m.length ? m[m.length - 1] : null; }
  async addMeasure(kgValue, t = Date.now()) {
    const m = { id: uid('m'), t, kg: Math.round(kgValue * 10) / 10, createdAt: Date.now() };
    this.state.measures = [...this.measures, m].sort((a, b) => a.t - b.t);
    await this.repo.saveMeasure(m);
    this.emit();
    return m;
  }
  async deleteMeasure(id) {
    this.state.measures = this.measures.filter((m) => m.id !== id);
    await this.repo.deleteMeasure(id);
    this.emit();
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
      id: uid('t'), name, items, targetMinutes: this.settings.targetMinutes || 45, focus: 'auto', customMuscles: [], inPlan: true,
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
    const deload = this.deload.state === 'active';
    const items = template.items.map((it) => ({ ...it, ...(deload ? { sets: deloadSets(it.sets), plannedSets: it.sets } : {}) }));
    const session = {
      id: uid('s'), templateId: template.id || null, name: template.name || 'Workout',
      startedAt: Date.now(), status: 'active', items, sets: [], current: 0, drafts: {}, rest: null,
      targetMinutes: template.targetMinutes, ...(deload ? { deload: true } : {}),
      ratingAtStart: (() => { const r = this.rateTemplate({ ...template, items }); return { score: r.score, grade: r.grade, label: r.label, split: r.split?.name }; })(),
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
  async resetAll() {
    await this.sync.disable();
    await this.repo.reset();
    this.state = await this.repo.loadAll();
    this.emit();
  }

  /* ───────────── cloud backup ───────────── */
  async enableBackup() { await this.sync.enable(); this.emit(); return this.sync.key; }
  async connectBackup(key) {
    const res = await this.sync.connect(key, { preferRemote: true });
    await this.reload();
    return res;
  }
  async disableBackup() { await this.sync.disable(); this.emit(); }
  syncNow() { return this.sync.now(); }
}

export const store = new Store();

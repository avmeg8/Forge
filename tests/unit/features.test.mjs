/** v1.3 features: cloud backup sync, supersets, warm-ups, deload, weekly schedule, generator. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Repository, defaultSettings } from '../../src/storage/repository.js';
import { MemoryAdapter } from '../../src/storage/adapters.js';
import { Sync, newKey, normalizeKey } from '../../src/storage/sync.js';
import { Store } from '../../src/app/store.js';
import { blocks, groupLabels, afterSet, itemState, normalizeGroups } from '../../src/engine/session.js';
import { estimateMinutes, rateWorkout } from '../../src/engine/rating.js';
import { computeProgress } from '../../src/engine/xp.js';
import { deloadState, deloadSets } from '../../src/engine/deload.js';
import { ratePlan } from '../../src/engine/plan.js';
import { generateWorkout } from '../../src/engine/generator.js';
import { activeProfile, capabilities } from '../../src/engine/equipment.js';
import { EXERCISE_BY_ID } from '../../src/data/exercises.js';
import { startOfWeek } from '../../src/utils/date.js';

const DAY = 86400000;

/* ── a fake forge_sync server with the same semantics as the Postgres function ── */
function fakeServer() {
  const spaces = new Map();
  let seq = 0;
  const fetchImpl = async (url, init) => {
    const { p_key, p_since, p_records } = JSON.parse(init.body);
    if (!p_key || p_key.length < 24) return { ok: false, status: 400, json: async () => ({ message: 'invalid key' }) };
    const rows = spaces.get(p_key) || new Map();
    spaces.set(p_key, rows);
    for (const r of p_records || []) {
      const k = `${r.store}|${r.id}`;
      const cur = rows.get(k);
      if (!cur || cur.updatedAt < r.updatedAt) rows.set(k, { store: r.store, id: r.id, data: r.data, updatedAt: r.updatedAt, deleted: !!r.deleted, seq: ++seq });
    }
    const out = [...rows.values()].filter((r) => r.seq > (p_since || 0)).sort((a, b) => a.seq - b.seq).slice(0, 400);
    return { ok: true, json: async () => ({ records: out, seq: out.length ? out[out.length - 1].seq : p_since || 0, more: out.length >= 400 }) };
  };
  return { fetchImpl, spaces };
}

const tick = () => new Promise((r) => setTimeout(r, 2));

test('backup keys: 25 base32 chars, forgiving input', () => {
  const k = newKey();
  assert.match(k, /^[0-9A-Z]{5}(-[0-9A-Z]{5}){4}$/);
  assert.equal(normalizeKey(k.toLowerCase().replace(/-/g, ' ')), k);
  assert.equal(normalizeKey('abc'), null);
  assert.equal(normalizeKey('OOOOO-IIIII-LLLLL-00000-11111'), '00000-11111-11111-00000-11111');
});

test('cloud backup: two devices sync templates, sessions, deletions and settings', async () => {
  const server = fakeServer();
  const a = new Store();
  await a.init(new MemoryAdapter(), { fetchImpl: server.fetchImpl, autoSync: false });
  await a.saveSettings({ onboarded: true, experience: 'advanced' });
  const t = a.newTemplate('Push A', [a.makeItem('db_floor_press'), a.makeItem('lateral_raise')]);
  await a.saveTemplate(t);
  await a.addMeasure(80.4);
  const key = await a.enableBackup();
  await a.sync.running;
  assert.equal(a.syncStatus.state, 'ok');
  assert.equal((await a.repo.outbox()).length, 0, 'outbox flushed');

  // a fresh phone restores
  const b = new Store();
  await b.init(new MemoryAdapter(), { fetchImpl: server.fetchImpl, autoSync: false });
  assert.equal(b.settings.onboarded, false);
  await b.connectBackup(key.toLowerCase());
  assert.equal(b.settings.onboarded, true);
  assert.equal(b.settings.experience, 'advanced');
  assert.equal(b.state.templates.length, 1);
  assert.equal(b.state.templates[0].name, 'Push A');
  assert.equal(b.measures[0].kg, 80.4);

  // edit on B, delete on A → both converge
  await tick();
  const tb = b.template(t.id);
  tb.name = 'Push A (edited)';
  await b.saveTemplate(tb);
  await b.syncNow();
  await a.syncNow();
  assert.equal(a.template(t.id).name, 'Push A (edited)');

  await tick();
  await a.deleteTemplate(t.id);
  await a.syncNow();
  await b.syncNow();
  assert.equal(b.template(t.id), undefined, 'deletion propagated');
});

test('cloud backup: offline changes queue up and upload later', async () => {
  const server = fakeServer();
  let online = false;
  const flaky = (...args) => (online ? server.fetchImpl(...args) : Promise.reject(new TypeError('Failed to fetch')));
  const s = new Store();
  await s.init(new MemoryAdapter(), { fetchImpl: flaky, autoSync: false });
  s.sync.cfg = { key: newKey(), since: 0 };
  await s.repo.saveSyncConfig(s.sync.cfg);
  await s.saveTemplate(s.newTemplate('Legs', [s.makeItem('goblet_squat')]));
  await s.syncNow();
  assert.equal(s.syncStatus.state, 'offline');
  assert.ok((await s.repo.outbox()).length >= 1);
  online = true;
  await s.syncNow();
  assert.equal(s.syncStatus.state, 'ok');
  assert.equal((await s.repo.outbox()).length, 0);
});

test('cloud backup: restoring an unknown key fails cleanly', async () => {
  const server = fakeServer();
  const s = new Store();
  await s.init(new MemoryAdapter(), { fetchImpl: server.fetchImpl, autoSync: false });
  await assert.rejects(() => s.connectBackup(newKey()), /No backup found/);
  assert.equal(s.sync.enabled, false);
  await assert.rejects(() => s.connectBackup('nope'), /backup key/);
});

/* ── supersets ── */
const item = (exerciseId, sets, group) => ({ uid: exerciseId, exerciseId, sets, repMin: EXERCISE_BY_ID[exerciseId].reps[0], repMax: EXERCISE_BY_ID[exerciseId].reps[1], ...(group ? { group } : {}) });

test('supersets: blocks, labels and normalising leftovers', () => {
  const items = [item('db_floor_press', 3, 'g1'), item('one_arm_row', 3, 'g1'), item('goblet_squat', 3), item('lateral_raise', 3, 'g2'), item('hammer_curl', 3, 'g2'), item('plank', 3, 'g2')];
  assert.deepEqual(blocks(items).map((b) => b.idx), [[0, 1], [2], [3, 4, 5]]);
  assert.deepEqual(groupLabels(items), { 0: 'A1', 1: 'A2', 3: 'B1', 4: 'B2', 5: 'B3' });
  const lone = [item('db_floor_press', 3, 'g1'), item('goblet_squat', 3)];
  normalizeGroups(lone);
  assert.equal(lone[0].group, undefined);
});

test('supersets: alternate exercises, rest once per round, and save time', () => {
  const items = [item('db_floor_press', 3, 'g1'), item('one_arm_row', 3, 'g1')];
  const s = { items, sets: [] };
  const log = (i, side = null) => s.sets.push({ id: `x${s.sets.length}`, itemIndex: i, exerciseId: items[i].exerciseId, setIndex: itemState(s, i).setIndex, side, reps: 10, weight: 10, ts: s.sets.length });
  log(0);
  assert.deepEqual(afterSet(s, 0), { next: 1, rest: false, transition: true });
  log(1); log(1); // one-arm row is unilateral: L then R
  assert.equal(afterSet(s, 1).next, 0);
  assert.equal(afterSet(s, 1).rest, true);
  const settings = { restMode: 'exercise' };
  const single = estimateMinutes(items.map((i) => ({ ...i, group: null })), settings);
  const paired = estimateMinutes(items, settings);
  assert.ok(paired < single, `${paired} < ${single}`);
  const r = rateWorkout([...items, item('goblet_squat', 3, 'g2'), item('hammer_curl', 3, 'g2')], { settings, targetMinutes: 45 });
  assert.ok(r.savedMinutes > 0);
});

/* ── warm-ups ── */
test('warm-up sets earn no XP, set no PRs and do not count as working sets', () => {
  const t0 = new Date(2026, 0, 5, 18).getTime();
  const mk = (id, extra) => ({ id, exerciseId: 'goblet_squat', itemIndex: 0, setIndex: 0, weight: 16, reps: 10, ts: t0, ...extra });
  const s1 = { id: 'a', startedAt: t0, endedAt: t0 + 3600e3, status: 'done', sets: [mk('w1', { warmup: true, setIndex: -1, weight: 8, reps: 8 }), mk('x1', { ts: t0 + 60e3 })] };
  const p = computeProgress([s1], {}, t0 + 3600e3);
  assert.equal(p.sessions.a.setXp.w1, 0);
  assert.ok(p.sessions.a.setXp.x1 > 0);
  assert.equal(p.exercises.goblet_squat.sessions[0].sets.length, 1);
  assert.equal(itemState({ items: [{ exerciseId: 'goblet_squat', sets: 3 }], sets: s1.sets }, 0).done, 1);
});

/* ── deload ── */
test('deload: due after N−1 trained weeks, active once started, off when disabled', () => {
  const now = new Date(2026, 2, 4, 12).getTime(); // a Wednesday
  const weeks = (n) => Array.from({ length: n }, (_, k) => now - (k + 1) * 7 * DAY);
  assert.equal(deloadState({ deloadEvery: 6, weekStart: 1 }, weeks(3), now).state, 'building');
  assert.equal(deloadState({ deloadEvery: 6, weekStart: 1 }, weeks(5), now).state, 'due');
  assert.equal(deloadState({ deloadEvery: 0 }, weeks(9), now).state, 'off');
  const wk = startOfWeek(now, 1);
  assert.equal(deloadState({ deloadEvery: 6, weekStart: 1, deloadWeek: wk }, weeks(5), now).state, 'active');
  assert.equal(deloadState({ deloadEvery: 6, weekStart: 1, deloadSnooze: wk }, weeks(5), now).state, 'snoozed');
  // after a deload the count restarts
  assert.equal(deloadState({ deloadEvery: 6, weekStart: 1, deloadLast: wk - 7 * DAY }, weeks(5), now).state, 'building');
  // time off doesn't count as hard training
  const sparse = [now - 7 * DAY, now - 21 * DAY, now - 35 * DAY];
  assert.equal(deloadState({ deloadEvery: 6, weekStart: 1 }, sparse, now).state, 'building');
  assert.equal(deloadSets(3), 2);
  assert.equal(deloadSets(1), 1);
});

test('deload: sessions started in a deload week have fewer sets', async () => {
  const s = new Store();
  await s.init(new MemoryAdapter(), { autoSync: false });
  await s.saveSettings({ onboarded: true });
  const t = s.newTemplate('Full', [s.makeItem('goblet_squat', { sets: 4 })]);
  await s.saveTemplate(t);
  await s.startDeload();
  const sess = await s.startSession(t);
  assert.equal(sess.deload, true);
  assert.equal(sess.items[0].sets, 2);
  assert.equal(sess.items[0].plannedSets, 4);
});

/* ── weekly schedule ── */
test('schedule: counts scheduled days and flags back-to-back muscle overlap', () => {
  const T = (id, ids) => ({ id, name: id, items: ids.map((e) => item(e, 3)) });
  const push = T('push', ['db_floor_press', 'db_squeeze_press', 'arnold_press', 'lateral_raise']);
  const pull = T('pull', ['one_arm_row', 'rear_delt_row', 'hammer_curl']);
  const legs = T('legs', ['goblet_squat', 'db_rdl', 'walking_lunge']);
  const all = [push, pull, legs];
  const spaced = ratePlan(all, { settings: { experience: 'intermediate', schedule: { 1: 'push', 3: 'pull', 5: 'legs' } }, allTemplates: all });
  assert.equal(spaced.scheduled, true);
  assert.equal(spaced.days, 3);
  assert.equal(spaced.clashes.length, 0);
  const clash = ratePlan(all, { settings: { experience: 'intermediate', schedule: { 1: 'push', 2: 'push', 4: 'pull', 5: 'legs' } }, allTemplates: all });
  assert.equal(clash.clashes.length, 1);
  assert.ok(clash.improvements.some((i) => /Monday .* Tuesday/.test(i.text)));
  assert.ok(clash.components.spacing < 1);
  // a deleted workout in the schedule is ignored
  const stale = ratePlan(all, { settings: { schedule: { 1: 'gone' } }, allTemplates: all });
  assert.equal(stale.scheduled, false);
});

/* ── generator ── */
test('generator: builds well-rated, equipment-legal workouts for every focus', () => {
  const settings = { ...defaultSettings(), experience: 'intermediate' };
  const profile = activeProfile(settings);
  const caps = capabilities(profile);
  let n = 0;
  const makeItem = (id, o = {}) => ({ uid: `i${n++}`, exerciseId: id, sets: 3, repMin: EXERCISE_BY_ID[id].reps[0], repMax: EXERCISE_BY_ID[id].reps[1], weight: null, ...o });
  for (const focus of ['push', 'pull', 'legs', 'upper', 'lower', 'full', 'chest', 'back', 'shoulders', 'arms', 'glutes', 'core', 'chest_triceps', 'back_biceps']) {
    for (const minutes of [30, 45]) {
      const g = generateWorkout({ focus, minutes, seed: 3, rateCtx: { settings, profile, caps }, makeItem });
      assert.ok(g.items.length >= 2, `${focus}: ${g.items.length} items`);
      assert.ok(g.rating.score >= 75, `${focus} ${minutes}min scored ${g.rating.score}`);
      assert.ok(g.rating.estimatedMinutes <= minutes * 1.15, `${focus} ${minutes}: ~${g.rating.estimatedMinutes} min`);
      assert.equal(new Set(g.items.map((i) => i.exerciseId)).size, g.items.length, 'no duplicates');
    }
  }
  const ss = generateWorkout({ focus: 'full', minutes: 45, supersets: true, seed: 5, rateCtx: { settings, profile, caps }, makeItem });
  assert.ok(ss.items.some((i) => i.group), 'supersets used');
  const a = generateWorkout({ focus: 'push', minutes: 45, seed: 1, rateCtx: { settings, profile, caps }, makeItem });
  const b = generateWorkout({ focus: 'push', minutes: 45, seed: 99, rateCtx: { settings, profile, caps }, makeItem });
  assert.ok(a.items.length && b.items.length);
});

test('repository: every synced write is queued; the active workout is not', async () => {
  const repo = new Repository(new MemoryAdapter());
  await repo.saveTemplate({ id: 't1', name: 'x', items: [] });
  await repo.saveActive({ id: 's', sets: [] });
  await repo.deleteTemplate('t1');
  const q = await repo.outbox();
  assert.equal(q.length, 1);
  assert.equal(q[0].deleted, true);
});

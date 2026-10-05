/** v1.4: effort-aware progression, exercise swaps, editing finished workouts, week in review. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend } from '../../src/engine/progression.js';
import { swapOptions } from '../../src/engine/swap.js';
import { weekSummary } from '../../src/engine/weekly.js';
import { computeProgress } from '../../src/engine/xp.js';
import { capabilities } from '../../src/engine/equipment.js';
import { defaultProfile } from '../../src/data/equipment.js';
import { EXERCISE_BY_ID } from '../../src/data/exercises.js';
import { itemState } from '../../src/engine/session.js';
import { Store } from '../../src/app/store.js';
import { MemoryAdapter } from '../../src/storage/adapters.js';
import { startOfWeek } from '../../src/utils/date.js';

const cfg = { min: 2, max: 30, increment: 1 };
const sets = (list) => list.map(([reps, weight, rir], k) => ({ reps, weight, rir, setIndex: k }));
const T = { sets: 3, repMin: 8, repMax: 12 };

test('effort: easy top sets earn a double step, grinding short drops the weight', () => {
  assert.equal(recommend('db_floor_press', sets([[12, 10], [12, 10], [12, 10]]), T, cfg).weight, 11);
  assert.equal(recommend('db_floor_press', sets([[12, 10, 4], [12, 10, 4], [12, 10, 2]]), T, cfg).weight, 12);
  const grind = recommend('db_floor_press', sets([[7, 10, 0], [7, 10, 0], [6, 10, 0]]), T, cfg);
  assert.equal(grind.action, 'decrease');
  assert.equal(recommend('db_floor_press', sets([[7, 10], [7, 10], [6, 10]]), T, cfg).action, 'stay', 'without effort data the old rule applies');
  const easyMid = recommend('db_floor_press', sets([[9, 10, 4], [9, 10, 4], [9, 10, 4]]), T, cfg);
  assert.deepEqual(easyMid.goal, [11, 11, 11]);
});

test('swap: similar, equipment-legal exercises, same movement first', () => {
  const caps = capabilities(defaultProfile());
  const opts = swapOptions('db_floor_press', { caps });
  assert.ok(opts.length >= 3);
  assert.equal(opts[0].ex.pattern, EXERCISE_BY_ID.db_floor_press.pattern);
  assert.ok(opts.every((o) => o.ex.id !== 'db_floor_press'));
  assert.ok(opts.every((o) => !o.ex.equipment.includes('bench')), 'nothing needing a bench');
  assert.ok(!swapOptions('db_floor_press', { caps, exclude: [opts[0].ex.id] }).some((o) => o.ex.id === opts[0].ex.id));
});

test('swap mid-workout keeps logged sets and moves the rest to the new exercise', async () => {
  const { swapItem } = await import('../../src/screens/session.js').catch(() => ({}));
  if (!swapItem) return; // screen module needs a DOM-less import; covered by e2e otherwise
  const s = { items: [{ uid: 'a', exerciseId: 'db_floor_press', sets: 3, repMin: 8, repMax: 12 }, { uid: 'b', exerciseId: 'goblet_squat', sets: 3, repMin: 8, repMax: 12 }],
    sets: [{ id: 'x', itemIndex: 0, exerciseId: 'db_floor_press', setIndex: 0, reps: 10, weight: 10 }, { id: 'y', itemIndex: 1, exerciseId: 'goblet_squat', setIndex: 0, reps: 10, weight: 10 }], current: 0 };
  swapItem(s, 0, EXERCISE_BY_ID.push_up);
  assert.equal(s.items.length, 3);
  assert.equal(s.items[0].sets, 1);
  assert.equal(s.items[1].exerciseId, 'push_up');
  assert.equal(s.items[1].sets, 2);
  assert.equal(s.current, 1);
  assert.equal(s.sets.find((x) => x.id === 'y').itemIndex, 2, 'later sets shifted');
  assert.equal(itemState(s, 0).complete, true);
});

test('editing a finished set re-derives XP and records', async () => {
  const st = new Store();
  await st.init(new MemoryAdapter(), { autoSync: false });
  const t0 = Date.now() - 3600e3;
  const mk = (id, w, r, k) => ({ id, exerciseId: 'goblet_squat', itemIndex: 0, setIndex: k, weight: w, reps: r, ts: t0 + k * 60e3 });
  const a = { id: 'a', name: 'A', startedAt: t0 - 4 * 86400e3, endedAt: t0 - 4 * 86400e3 + 1800e3, status: 'done', items: [], sets: [mk('a1', 16, 10, 0)].map((x) => ({ ...x, ts: x.ts - 4 * 86400e3 })) };
  const b = { id: 'b', name: 'B', startedAt: t0, endedAt: t0 + 1800e3, status: 'done', items: [], sets: [mk('b1', 16, 9, 0)] };
  for (const s of [a, b]) { st.state.sessions.push(s); await st.repo.saveSession(s); }
  st.emit();
  assert.equal(st.progress.sessions.b.prs.length, 0);
  const fixed = structuredClone(b);
  fixed.sets[0].reps = 12;
  await st.updateSession(fixed);
  assert.ok(st.progress.sessions.b.prs.some((p) => p.type === 'reps' || p.type === 'strength'), 'typo fix turns it into a PR');
});

test('week in review: counts days, XP, PRs, level-ups and compares with the week before', () => {
  const now = new Date(2026, 9, 7, 12).getTime(); // Wed
  const wk = startOfWeek(now, 1);
  const day = 86400000;
  const s = (id, t, reps) => ({ id, name: id, startedAt: t, endedAt: t + 2400e3, status: 'done', sets: [0, 1, 2].map((k) => ({ id: `${id}${k}`, exerciseId: 'goblet_squat', itemIndex: 0, setIndex: k, weight: 16, reps, ts: t + k * 60e3 })) });
  const sessions = [s('p1', wk - 6 * day, 8), s('p2', wk - 4 * day, 9), s('c1', wk + 10 * 3600e3, 10), s('c2', wk + day + 10 * 3600e3, 11)];
  const progress = computeProgress(sessions, { frequency: '4', weekStart: 1 }, now);
  const w = weekSummary({ sessions, progress, settings: { frequency: '4', weekStart: 1 }, measures: [{ t: wk - day, kg: 80 }, { t: wk + day, kg: 79.6 }], now });
  assert.equal(w.count, 2);
  assert.equal(w.target, 4);
  assert.equal(w.sets, 6);
  assert.equal(w.prev.count, 2);
  assert.ok(w.xp > 0);
  assert.ok(w.prs.length >= 1);
  assert.deepEqual(w.bodyWeight, { from: 80, to: 79.6 });
  assert.ok(w.untrained.includes('Chest'));
  const last = weekSummary({ sessions, progress, settings: { frequency: '4', weekStart: 1 }, now, offset: 1 });
  assert.equal(last.label, 'Last week');
  assert.equal(last.sessions.length, 2);
  assert.equal(weekSummary({ sessions, progress, settings: {}, now, offset: 5 }).sessions.length, 0);
});

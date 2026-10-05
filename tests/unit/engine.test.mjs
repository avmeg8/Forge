import { test } from 'node:test';
import assert from 'node:assert/strict';

import { levelInfo, levelCost, THRESHOLDS, MAX_LEVEL } from '../../src/engine/levels.js';
import { computeProgress, setScore, intensityFactor } from '../../src/engine/xp.js';
import { computeStreak } from '../../src/engine/streak.js';
import { rateWorkout, detectSplit } from '../../src/engine/rating.js';
import { ratePlan } from '../../src/engine/plan.js';
import { recommend, sideBalance } from '../../src/engine/progression.js';
import { capabilities, isAvailable, snapWeight, weightSteps, unlockSuggestions, loadConfig, nextWeightUp } from '../../src/engine/equipment.js';
import { recoveryStatus } from '../../src/engine/recovery.js';
import { EXERCISES, EXERCISE_BY_ID } from '../../src/data/exercises.js';
import { MUSCLE_IDS } from '../../src/data/muscles.js';
import { defaultProfile } from '../../src/data/equipment.js';

const DAY = 86400000;
const T0 = new Date(2026, 0, 5, 18, 0, 0).getTime(); // a Monday evening
let n = 0;
const set = (exerciseId, weight, reps, t, extra = {}) => ({ id: `s${n++}`, exerciseId, weight, reps, ts: t, setIndex: extra.setIndex ?? 0, side: extra.side ?? null, ...extra });
function session(day, sets, id) {
  const start = T0 + day * DAY;
  return {
    id: id || `w${day}_${n++}`, startedAt: start, endedAt: start + 40 * 60000, status: 'done',
    sets: sets.map((s, i) => ({ ...s, ts: start + i * 60000 })),
  };
}
const settings = { frequency: '4', weekStart: 1, experience: 'intermediate' };

// ───────────────────────── Levels ─────────────────────────
test('everyone starts Beginner level 1 with 0 XP', () => {
  const i = levelInfo(0);
  assert.equal(i.level, 1);
  assert.equal(i.tier.id, 'beginner');
  assert.equal(i.xpIntoLevel, 0);
  assert.equal(i.xpForLevel, levelCost(1));
});

test('level and tier progression thresholds', () => {
  assert.equal(levelInfo(THRESHOLDS[11]).level, 11);
  assert.equal(levelInfo(THRESHOLDS[11]).tier.id, 'intermediate');
  assert.equal(levelInfo(THRESHOLDS[11] - 1).tier.id, 'beginner');
  assert.equal(levelInfo(THRESHOLDS[21]).tier.id, 'advanced');
  assert.equal(levelInfo(THRESHOLDS[31]).tier.id, 'elite');
  const max = levelInfo(1e9);
  assert.equal(max.level, MAX_LEVEL);
  assert.equal(max.isMax, true);
  assert.equal(max.progress, 1);
});

test('xpToNext + xpIntoLevel = cost of level', () => {
  const i = levelInfo(THRESHOLDS[14] + 123);
  assert.equal(i.level, 14);
  assert.equal(i.xpIntoLevel, 123);
  assert.equal(i.xpToNext, levelCost(14) - 123);
});

// ───────────────────────── XP ─────────────────────────
test('primary muscle gets more XP than secondary', () => {
  const p = computeProgress([session(0, [set('db_floor_press', 20, 12, 0)])], settings, T0 + DAY);
  assert.ok(p.muscles.chest.xp > 0);
  assert.ok(p.muscles.triceps.xp > 0);
  assert.ok(p.muscles.chest.xp > p.muscles.triceps.xp * 2);
  assert.equal(p.muscles.quads.xp, 0);
});

test('progressive overload earns more XP than repeating the same session', () => {
  const base = [set('db_floor_press', 20, 10), set('db_floor_press', 20, 10, 0, { setIndex: 1 })];
  const same = computeProgress([session(0, base), session(3, base)], settings, T0 + 4 * DAY);
  const better = computeProgress([session(0, base), session(3, [set('db_floor_press', 22, 10), set('db_floor_press', 22, 10, 0, { setIndex: 1 })])], settings, T0 + 4 * DAY);
  assert.ok(better.muscles.chest.xp > same.muscles.chest.xp);
});

test('light junk sets earn little XP', () => {
  const hist = session(0, [set('db_floor_press', 25, 10)]);
  const heavy = computeProgress([hist, session(3, [set('db_floor_press', 25, 10)])], settings);
  const light = computeProgress([hist, session(3, [set('db_floor_press', 5, 10)])], settings);
  const gainHeavy = heavy.sessions[Object.keys(heavy.sessions)[1]].xpByMuscle.chest;
  const gainLight = light.sessions[Object.keys(light.sessions)[1]].xpByMuscle.chest;
  assert.ok(gainLight < gainHeavy * 0.5, `${gainLight} vs ${gainHeavy}`);
  assert.equal(intensityFactor(0.5), 0.35);
});

test('volume caps: 40 sets in one session is not 4x the XP of 10 sets', () => {
  const ten = Array.from({ length: 10 }, (_, i) => set('db_floor_press', 20, 10, 0, { setIndex: i }));
  const forty = Array.from({ length: 40 }, (_, i) => set('db_floor_press', 20, 10, 0, { setIndex: i }));
  const a = computeProgress([session(0, ten)], settings).muscles.chest.xp;
  const b = computeProgress([session(0, forty)], settings).muscles.chest.xp;
  assert.ok(b < a * 1.6, `${b} vs ${a}`);
});

test('unilateral: left + right = one full set of XP', () => {
  const bi = computeProgress([session(0, [set('db_floor_press', 12, 10)])], settings).muscles.chest.xp;
  const uni = computeProgress([session(0, [set('single_arm_floor_press', 12, 10, 0, { side: 'L' }), set('single_arm_floor_press', 12, 10, 0, { side: 'R' })])], settings).muscles.chest.xp;
  // similar magnitude (difficulty factor differs slightly)
  assert.ok(uni > bi * 0.8 && uni < bi * 1.3, `${uni} vs ${bi}`);
});

test('progression survives exercise/equipment changes (muscle XP is continuous)', () => {
  const floor = session(0, [set('db_floor_press', 25, 10)]);
  const bench = session(3, [set('db_bench_press', 22.5, 8)]);
  const p1 = computeProgress([floor], settings);
  const p2 = computeProgress([floor, bench], settings);
  assert.ok(p2.muscles.chest.xp > p1.muscles.chest.xp);
  assert.ok(p2.exercises.db_floor_press.bestSet.weight === 25);
  assert.ok(p2.exercises.db_bench_press.bestSet.weight === 22.5);
});

// ───────────────────────── PRs ─────────────────────────
test('PR detection: weight, reps, volume, strength — none on first session', () => {
  const p0 = computeProgress([session(0, [set('hammer_curl', 15, 10)])], settings);
  assert.equal(p0.prs.length, 0);
  const p = computeProgress([
    session(0, [set('hammer_curl', 15, 10)]),
    session(2, [set('hammer_curl', 15, 12)]),
    session(4, [set('hammer_curl', 17, 8)]),
  ], settings);
  const types = p.prs.map((x) => `${x.type}`);
  assert.ok(types.includes('reps'), types.join());
  assert.ok(types.includes('weight'), types.join());
  assert.ok(types.includes('strength'), types.join());
  const rep = p.prs.find((x) => x.type === 'reps');
  assert.equal(rep.set.reps, 12);
  assert.equal(rep.previous.reps, 10);
});

// ───────────────────────── Streak ─────────────────────────
test('rest days do not break the streak', () => {
  // Mon, Tue, (Wed rest), Thu
  const times = [0, 1, 3].map((d) => T0 + d * DAY);
  const s = computeStreak(times, '4', T0 + 3 * DAY + 3600000, 1);
  assert.equal(s.streak, 3);
  assert.equal(s.alive, true);
});

test('streak breaks after too long a gap, and multiple sessions per day count once', () => {
  const times = [T0, T0 + 1000, T0 + DAY, T0 + 6 * DAY];
  const s = computeStreak(times, '4', T0 + 6 * DAY, 1);
  assert.equal(s.streak, 1);
  const s2 = computeStreak([T0, T0 + 1000], '4', T0 + 2 * DAY, 1);
  assert.equal(s2.streak, 1);
  const dead = computeStreak([T0], '4', T0 + 10 * DAY, 1);
  assert.equal(dead.streak, 0);
});

test('2–3 days/week allows longer gaps', () => {
  const times = [0, 4, 8].map((d) => T0 + d * DAY);
  assert.equal(computeStreak(times, '2-3', T0 + 8 * DAY, 1).streak, 3);
  assert.equal(computeStreak(times, '4', T0 + 8 * DAY, 1).streak, 1);
});

test('training every day gives no extra streak credit beyond target+1 per week', () => {
  const times = [0, 1, 2, 3, 4, 5, 6].map((d) => T0 + d * DAY); // Mon..Sun
  const s = computeStreak(times, '4', T0 + 6 * DAY, 1);
  assert.equal(s.streak, 5);
  assert.equal(s.weekCount, 7);
});

// ───────────────────────── Rating ─────────────────────────
const caps = capabilities(defaultProfile());
const it = (exerciseId, sets = 3) => ({ exerciseId, sets, repMin: EXERCISE_BY_ID[exerciseId].reps[0], repMax: EXERCISE_BY_ID[exerciseId].reps[1] });

test('rating: balanced 4-exercise upper workout is good and suggests delt work', () => {
  const r = rateWorkout([it('db_floor_press'), it('one_arm_row'), it('hammer_curl'), it('one_arm_oh_extension')], { settings: { experience: 'beginner' }, caps, targetMinutes: 45 });
  assert.ok(r.score >= 78 && r.score <= 88, String(r.score));
  assert.equal(r.split.id, 'upper');
  assert.equal(EXERCISE_BY_ID[r.suggestion.exerciseId].primary.includes('side_delts'), true);
});

test('rating: adding lateral raise improves the score', () => {
  const a = rateWorkout([it('db_floor_press'), it('one_arm_row'), it('hammer_curl'), it('one_arm_oh_extension')], { settings: { experience: 'beginner' }, caps });
  const b = rateWorkout([it('db_floor_press'), it('one_arm_row'), it('lateral_raise'), it('hammer_curl'), it('one_arm_oh_extension')], { settings: { experience: 'beginner' }, caps });
  assert.ok(b.score > a.score);
});

test('rating: 25 exercises for 90 minutes scores lower than a focused 35-minute workout', () => {
  const avail = EXERCISES.filter((e) => isAvailable(e, caps)).slice(0, 25).map((e) => it(e.id));
  const huge = rateWorkout(avail, { settings: { experience: 'beginner' }, caps, targetMinutes: 90 });
  const focused = rateWorkout([it('goblet_squat'), it('db_floor_press'), it('one_arm_row'), it('db_rdl')], { settings: { experience: 'beginner' }, caps, targetMinutes: 35 });
  assert.ok(focused.score > huge.score + 25, `${focused.score} vs ${huge.score}`);
});

test('rating: suggestions only include available exercises', () => {
  const r = rateWorkout([it('db_floor_press'), it('push_up')], { settings: {}, caps });
  if (r.suggestion) assert.ok(isAvailable(EXERCISE_BY_ID[r.suggestion.exerciseId], caps));
});

test('rating: recent training produces a recovery warning but does not block', () => {
  const p = computeProgress([session(0, [set('db_floor_press', 20, 10), set('db_floor_press', 20, 10), set('db_floor_press', 20, 10), set('push_up', 0, 15)])], settings, T0 + DAY / 2);
  const r = rateWorkout([it('db_floor_press'), it('one_arm_row')], { settings, caps, progress: p, now: T0 + DAY / 2 });
  assert.ok(r.warnings.some((w) => w.muscle === 'chest'));
  assert.ok(r.score > 0);
});

// ───────────────────────── Progression ─────────────────────────
const cfg = { min: 2.5, max: 30, increment: 2.5 };
test('progression: all sets at top of range → increase to next step', () => {
  const sets = [12, 12, 12].map((r, i) => ({ weight: 15, reps: r, setIndex: i }));
  const rec = recommend('hammer_curl', sets, { sets: 3, repMin: 8, repMax: 12 }, cfg);
  assert.equal(rec.action, 'increase');
  assert.equal(rec.weight, 17.5);
});

test('progression: not yet at top → stay and add reps', () => {
  const sets = [10, 10, 9].map((r, i) => ({ weight: 15, reps: r, setIndex: i }));
  const rec = recommend('hammer_curl', sets, { sets: 3, repMin: 8, repMax: 12 }, cfg);
  assert.equal(rec.action, 'stay');
  assert.equal(rec.weight, 15);
});

test('progression: never recommends beyond max weight — offers alternatives', () => {
  const sets = [12, 12, 12].map((r, i) => ({ weight: 30, reps: r, setIndex: i }));
  const rec = recommend('goblet_squat', sets, { sets: 3, repMin: 8, repMax: 12 }, cfg);
  assert.equal(rec.action, 'max');
  assert.ok(rec.alternatives.length >= 3);
  assert.equal(rec.alternatives[0].exerciseId, 'bulgarian_split_squat');
});

test('progression: weight respects increment config', () => {
  assert.equal(nextWeightUp(20, { min: 2, max: 30, increment: 1 }), 21);
  assert.equal(snapWeight(100, { min: 2, max: 30, increment: 1 }), 30);
  assert.equal(snapWeight(-5, { min: 2, max: 30, increment: 1 }), 2);
  assert.equal(weightSteps({ min: 2, max: 30, increment: 1 }).length, 29);
});

test('left/right: small gap is reported calmly', () => {
  const ex = EXERCISE_BY_ID.one_arm_row;
  const b = sideBalance(ex, [{ side: 'L', reps: 10, weight: 20, setIndex: 0 }, { side: 'R', reps: 9, weight: 20, setIndex: 0 }]);
  assert.equal(b.level, 'small');
  assert.equal(b.text, 'Right side: 1 rep behind.');
});

// ───────────────────────── Equipment ─────────────────────────
test('equipment: default profile hides bench exercises; adding a bench unlocks them', () => {
  const prof = defaultProfile();
  const c1 = capabilities(prof);
  assert.equal(isAvailable(EXERCISE_BY_ID.db_floor_press, c1), true);
  assert.equal(isAvailable(EXERCISE_BY_ID.single_arm_bench_press, c1), false);
  const prof2 = { ...prof, items: { ...prof.items, bench: {} } };
  assert.equal(isAvailable(EXERCISE_BY_ID.single_arm_bench_press, capabilities(prof2)), true);
  const unlocks = unlockSuggestions(prof);
  assert.ok(unlocks.find((u) => u.item.id === 'bench').gain > 0);
  assert.deepEqual(loadConfig(prof, 'dumbbell'), { min: 2, max: 30, increment: 1 });
});

test('data: every exercise references valid muscles', () => {
  for (const e of EXERCISES) {
    for (const m of [...e.primary, ...e.secondary]) assert.ok(MUSCLE_IDS.includes(m), `${e.id}: ${m}`);
    assert.ok(e.primary.length > 0, e.id);
    assert.ok(e.reps[0] <= e.reps[1], e.id);
  }
});

test('recovery: trained yesterday with real volume → limited', () => {
  const st = recoveryStatus({ lastTrained: T0, lastSessionSets: 6 }, T0 + 20 * 3600000);
  assert.equal(st.level, 'limited');
  assert.equal(recoveryStatus({ lastTrained: T0, lastSessionSets: 6 }, T0 + 3 * DAY).level, 'ready');
});

test('setScore uses e1RM for loaded sets', () => {
  assert.equal(setScore(EXERCISE_BY_ID.db_floor_press, { weight: 30, reps: 1 }), 30);
  assert.equal(setScore(EXERCISE_BY_ID.db_floor_press, { weight: 30, reps: 0 }), 0);
});

// ───────────────────────── Splits & weekly plan ─────────────────────────
const chestDay = () => [it('db_floor_press', 4), it('db_squeeze_press'), it('push_up'), it('db_floor_fly')];
test('split: a focused chest day is rated as a chest day, not penalised for missing legs/back', () => {
  const r = rateWorkout(chestDay(), { settings: { experience: 'intermediate' }, caps, focus: 'chest' });
  assert.equal(r.split.id, 'chest');
  assert.ok(r.score >= 85, String(r.score));
  assert.ok(!r.improvements.some((i) => /back|legs|quads/i.test(i.text)));
});

test('split: auto-detects common splits', () => {
  assert.equal(detectSplit(chestDay()), 'chest');
  assert.equal(detectSplit([it('db_floor_press', 4), it('one_arm_shoulder_press'), it('lateral_raise'), it('one_arm_oh_extension')]), 'push');
  assert.equal(detectSplit([it('one_arm_row', 4), it('rear_delt_row'), it('db_curl'), it('hammer_curl')]), 'back_biceps');
  assert.equal(detectSplit([it('goblet_squat', 4), it('db_rdl', 4), it('reverse_lunge'), it('single_leg_calf_raise')]), 'legs');
  assert.equal(detectSplit([it('db_curl'), it('hammer_curl'), it('one_arm_oh_extension'), it('triceps_kickback')]), 'arms');
  assert.equal(detectSplit([it('db_floor_press'), it('one_arm_row'), it('hammer_curl'), it('one_arm_oh_extension')]), 'upper');
});

test('split: off-focus work is penalised and suggestions stay on focus', () => {
  const onFocus = rateWorkout(chestDay(), { settings: {}, caps, focus: 'chest' });
  const mixed = rateWorkout([it('db_floor_press', 4), it('db_squeeze_press'), it('goblet_squat'), it('db_rdl')], { settings: {}, caps, focus: 'chest' });
  assert.ok(mixed.score < onFocus.score - 20, `${mixed.score} vs ${onFocus.score}`);
  assert.ok(mixed.improvements.some((i) => /off-focus/.test(i.text)));
  const push = rateWorkout([it('db_floor_press', 4), it('push_up'), it('one_arm_oh_extension')], { settings: {}, caps, focus: 'push' });
  assert.ok(push.suggestion);
  assert.ok(EXERCISE_BY_ID[push.suggestion.exerciseId].primary.includes('side_delts'));
});

test('split: custom focus judges only the chosen muscles', () => {
  const r = rateWorkout([it('db_curl', 4), it('hammer_curl', 3)], { settings: {}, caps, focus: 'custom', customMuscles: ['biceps'] });
  assert.equal(r.split.id, 'custom');
  assert.ok(r.score >= 75, String(r.score));
});

test('weekly plan: Push/Pull/Legs beats a push-only week, and more days help', () => {
  const T = (name, items) => ({ id: name, name, items, targetMinutes: 45, focus: 'auto' });
  const rt = (t) => rateWorkout(t.items, { settings: { experience: 'intermediate' }, caps, targetMinutes: 45, focus: t.focus });
  const ppl = [
    T('Push', [it('db_floor_press', 4), it('one_arm_shoulder_press'), it('lateral_raise'), it('one_arm_oh_extension')]),
    T('Pull', [it('one_arm_row', 4), it('rear_delt_row'), it('db_curl'), it('hammer_curl')]),
    T('Legs', [it('goblet_squat', 4), it('db_rdl', 4), it('reverse_lunge'), it('single_leg_calf_raise')]),
  ];
  const s = (f) => ({ settings: { experience: 'intermediate', frequency: f }, rateTemplate: rt });
  const p3 = ratePlan(ppl, s('2-3'));
  const p5 = ratePlan(ppl, s('5'));
  const pushOnly = ratePlan([ppl[0]], s('4'));
  assert.ok(p5.score > p3.score);
  assert.ok(ratePlan(ppl, s('4')).score > pushOnly.score + 20);
  assert.ok(pushOnly.improvements.some((i) => /Lats/.test(i.text)));
});

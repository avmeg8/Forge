/**
 * Workout analysis & rating (0–100).
 *
 * The rating judges STRUCTURE, not size. Components and weights:
 *
 *   Coverage     30  Does the workout train the muscles its type implies, in a productive
 *                    per-session range (≈3–8 effective sets per muscle for beginners, up to 5–12 for advanced)?
 *   Balance      12  Opposing muscles (chest/back, quads/posterior chain, biceps/triceps,
 *                    front/rear delts) — judged on this workout PLUS the last 7 days, so a
 *                    push day following a pull day is not penalised.
 *   Volume       14  Total sets appropriate for the target duration — too little or too much loses points.
 *   Variety       8  Distinct movement patterns.
 *   Redundancy    8  Several exercises doing the same job.
 *   Recovery      8  Targeted muscles trained hard in the last 24–48 h.
 *   Progression   8  Can these exercises be progressively overloaded with YOUR equipment?
 *                    Sensible rep ranges? Difficulty appropriate to experience?
 *   Duration     12  Estimated time vs. the workout's target duration.
 *
 * Effective sets: primary muscle = 1 set, secondary = 0.5 set.
 * Equipment-aware: suggestions only come from exercises you can do, and nothing is
 * penalised for equipment you don't own.
 */
import { EXERCISE_BY_ID, EXERCISES } from '../data/exercises.js';
import { MUSCLE_BY_ID, SIZE_WEIGHT, OPPOSING_PAIRS, COVERAGE_GROUPS } from '../data/muscles.js';
import { isAvailable, loadConfig } from './equipment.js';
import { recoveryStatus } from './recovery.js';

export const RATING_WEIGHTS = {
  coverage: 30, balance: 12, volume: 14, variety: 8, redundancy: 8, recovery: 8, progression: 8, duration: 12,
};

const IDEAL = { beginner: [3, 8], intermediate: [3, 10], advanced: [4, 12] };

export const TYPE_INFO = {
  upper: { name: 'Upper body', expect: ['chest', 'lats', 'traps', 'front_delts', 'side_delts', 'rear_delts', 'biceps', 'triceps'], pairs: ['push_pull', 'delts', 'arms'] },
  push: { name: 'Push', expect: ['chest', 'front_delts', 'side_delts', 'triceps'], pairs: ['push_pull', 'delts'], split: true },
  pull: { name: 'Pull', expect: ['lats', 'traps', 'rear_delts', 'biceps'], pairs: ['push_pull', 'delts'], split: true },
  lower: { name: 'Lower body', expect: ['quads', 'glutes', 'hamstrings', 'calves'], pairs: ['legs'] },
  full: { name: 'Full body', expect: ['chest', 'lats', 'quads', 'glutes', 'hamstrings', 'side_delts', 'abs'], pairs: ['push_pull', 'legs', 'arms'] },
  arms: { name: 'Arms', expect: ['biceps', 'triceps', 'forearms'], pairs: ['arms'], split: true },
  core: { name: 'Core', expect: ['abs', 'obliques', 'lower_back'], pairs: ['trunk'], split: true },
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Effective sets per muscle for a list of workout items. */
export function muscleVolume(items) {
  const eff = {};
  for (const it of items) {
    const ex = EXERCISE_BY_ID[it.exerciseId];
    if (!ex) continue;
    for (const m of ex.primary) eff[m] = (eff[m] || 0) + it.sets;
    for (const m of ex.secondary) if (!ex.primary.includes(m)) eff[m] = (eff[m] || 0) + it.sets * 0.5;
  }
  return eff;
}

function groupOf(m) {
  const g = MUSCLE_BY_ID[m].group;
  return m === 'lower_back' ? 'core' : g;
}

export function classify(items) {
  const share = { chest: 0, back: 0, shoulders: 0, arms: 0, legs: 0, core: 0 };
  const mshare = {};
  let total = 0;
  for (const it of items) {
    const ex = EXERCISE_BY_ID[it.exerciseId];
    if (!ex) continue;
    const per = it.sets / ex.primary.length;
    for (const m of ex.primary) {
      share[groupOf(m)] += per;
      mshare[m] = (mshare[m] || 0) + per;
      total += per;
    }
  }
  if (!total) return 'full';
  const s = (g) => share[g] / total;
  const ms = (list) => list.reduce((a, m) => a + (mshare[m] || 0), 0) / total;
  if (s('legs') >= 0.7) return 'lower';
  if (s('core') >= 0.7) return 'core';
  if (s('arms') >= 0.7) return 'arms';
  if (s('chest') + s('back') + s('shoulders') + s('arms') >= 0.75) {
    if (ms(['chest', 'front_delts', 'side_delts', 'triceps']) >= 0.75) return 'push';
    if (ms(['lats', 'traps', 'rear_delts', 'biceps', 'forearms']) >= 0.75) return 'pull';
    return 'upper';
  }
  return 'full';
}

export function coverageScore(eff, lo, hi) {
  if (eff <= 0) return 0;
  if (eff < lo) return 0.9 * (eff / lo) ** 1.2;
  if (eff <= hi) return 1;
  return Math.max(0.4, 1 - 0.08 * (eff - hi));
}

export function coverageLabel(eff) {
  if (eff >= 5) return 'Excellent';
  if (eff >= 3) return 'Good';
  if (eff >= 1.5) return 'Moderate';
  if (eff > 0) return 'Light';
  return 'Not trained';
}

export function restFor(ex, settings) {
  return settings?.restMode && settings.restMode !== 'exercise' ? Number(settings.restMode) : ex.rest;
}

/** Realistic duration estimate in minutes. */
export function estimateMinutes(items, settings) {
  let sec = 180; // warm-up
  for (const it of items) {
    const ex = EXERCISE_BY_ID[it.exerciseId];
    if (!ex) continue;
    const mid = ((it.repMin ?? ex.reps[0]) + (it.repMax ?? ex.reps[1])) / 2;
    const work = (ex.metric === 'time' ? mid : mid * 3.5) * (ex.unilateral ? 2 : 1) + 20;
    sec += it.sets * (work + restFor(ex, settings)) + 30;
  }
  return Math.round(sec / 60);
}

const listJoin = (arr) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * @param items     [{ exerciseId, sets, repMin, repMax, weight }]
 * @param ctx       { settings, profile, caps, progress, now, targetMinutes }
 */
export function rateWorkout(items, ctx = {}) {
  const settings = ctx.settings || {};
  const experience = settings.experience || 'beginner';
  const [lo, hi] = IDEAL[experience] || IDEAL.beginner;
  const progress = ctx.progress;
  const now = ctx.now || Date.now();
  const targetMinutes = ctx.targetMinutes || settings.targetMinutes || 45;
  const valid = items.filter((it) => EXERCISE_BY_ID[it.exerciseId] && it.sets > 0);
  const totalSets = valid.reduce((a, it) => a + it.sets, 0);
  const estimatedMinutes = valid.length ? estimateMinutes(valid, settings) : 0;

  if (!valid.length) {
    return {
      score: 0, grade: 'empty', label: 'Add exercises', type: null, typeName: '',
      headline: 'Add a few exercises and FORGE will analyse your workout.',
      positives: [], improvements: [], warnings: [], coverage: [], components: {},
      suggestion: null, estimatedMinutes: 0, totalSets: 0, muscleEff: {},
    };
  }

  const eff = muscleVolume(valid);
  const type = classify(valid);
  const info = TYPE_INFO[type];
  const C = {};

  // ── Coverage ──
  let cw = 0, cs = 0;
  const expectScores = {};
  for (const m of info.expect) {
    const w = SIZE_WEIGHT[MUSCLE_BY_ID[m].size];
    const sc = coverageScore(eff[m] || 0, lo, hi);
    expectScores[m] = sc;
    cw += w; cs += w * sc;
  }
  const missingCount = info.expect.filter((m) => expectScores[m] < 0.35).length;
  // squared so gaps matter; each completely-missed expected muscle costs extra
  C.coverage = clamp01((cs / cw) ** 2 - 0.12 * missingCount);

  // ── Balance (this workout + last 7 days) ──
  const week = (m) => progress?.muscles?.[m]?.weekSets || 0;
  const pairNotes = [];
  let bSum = 0, bN = 0;
  for (const pid of info.pairs) {
    const p = OPPOSING_PAIRS.find((x) => x.id === pid);
    const avg = (list, f) => list.reduce((a, m) => a + f(m), 0) / list.length;
    const wa = avg(p.a, (m) => eff[m] || 0);
    const wb = avg(p.b, (m) => eff[m] || 0);
    if (wa < 2 && wb < 2) continue;
    const A = wa + avg(p.a, week);
    const B = wb + avg(p.b, week);
    let sc;
    const weekA = avg(p.a, week), weekB = avg(p.b, week);
    if (info.split && (wa < 2 || wb < 2) && (wa < 2 ? weekA : weekB) === 0) sc = 0.8; // split day, other side not trained this week yet
    else sc = clamp01(Math.min(A, B) / Math.max(A, B) / 0.6);
    bSum += sc; bN++;
    pairNotes.push({ pair: p, score: sc, A, B, inWorkout: Math.min(wa, wb) >= 1 });
  }
  C.balance = bN ? bSum / bN : 1;

  // ── Volume ──
  const idealSets = targetMinutes / 2.6;
  const r = totalSets / idealSets;
  let vol = r < 0.55 ? Math.max(0.3, 1 - (0.55 - r) * 2.2) : r <= 1.3 ? 1 : Math.max(0, 1 - (r - 1.3) * 1.2);
  const excessive = Object.entries(eff).filter(([, e]) => e > 12).map(([m]) => m);
  vol = clamp01(vol - 0.15 * excessive.length);
  C.volume = vol;

  // ── Variety & redundancy ──
  const patterns = valid.map((it) => EXERCISE_BY_ID[it.exerciseId].pattern);
  const distinct = new Set(patterns).size;
  C.variety = valid.length === 1 ? 0.5 : clamp01((distinct / valid.length - 0.3) / 0.5);
  const groups = {};
  for (const it of valid) {
    const ex = EXERCISE_BY_ID[it.exerciseId];
    (groups[`${ex.pattern}:${ex.primary[0]}`] ||= []).push(ex);
  }
  let redPen = 0;
  const redundant = [];
  for (const g of Object.values(groups)) {
    if (g.length === 2) redPen += 0.1;
    else if (g.length === 3) redPen += 0.35;
    else if (g.length >= 4) redPen += 0.6 + 0.1 * (g.length - 4);
    if (g.length >= 2) redundant.push(g);
  }
  const dupIds = valid.length - new Set(valid.map((it) => it.exerciseId)).size;
  redPen += dupIds * 0.3;
  C.redundancy = clamp01(1 - redPen);

  // ── Recovery ──
  const warnings = [];
  let rW = 0, rS = 0;
  for (const [m, e] of Object.entries(eff)) {
    const primary = valid.some((it) => EXERCISE_BY_ID[it.exerciseId].primary.includes(m));
    if (!primary) continue;
    const st = recoveryStatus(progress?.muscles?.[m], now);
    const strain = st.level === 'limited' ? 1 : st.level === 'partial' ? 0.5 : 0;
    rW += e; rS += e * strain;
    if (strain > 0) warnings.push({ muscle: m, status: st, lastTrained: progress.muscles[m].lastTrained });
  }
  C.recovery = rW ? 1 - rS / rW : 1;

  // ── Progression suitability ──
  const progNotes = [];
  let pSum = 0;
  for (const it of valid) {
    const ex = EXERCISE_BY_ID[it.exerciseId];
    let s = 1;
    const rMin = it.repMin ?? ex.reps[0];
    const rMax = it.repMax ?? ex.reps[1];
    if (ex.metric !== 'time' && (rMin < 3 || rMax > 30)) { s = Math.min(s, 0.6); progNotes.push(`${ex.name}: ${rMin}–${rMax} reps is outside the useful 3–30 range.`); }
    if (ex.metric === 'time' && rMax > 180) s = Math.min(s, 0.7);
    if (experience === 'beginner' && ex.difficulty === 3) { s = Math.min(s, 0.75); progNotes.push(`${ex.name} is an advanced movement — consider ${ex.easier[0] ? EXERCISE_BY_ID[ex.easier[0]].name : 'an easier variation'} first.`); }
    const cfg = ctx.profile ? loadConfig(ctx.profile, ex.load) : null;
    const st = progress?.exercises?.[ex.id];
    if (cfg && st && st.maxWeight >= cfg.max && (st.repsAt[String(cfg.max)] || 0) >= rMax) {
      s = Math.min(s, 0.7);
      const alt = (ex.atMax || ex.harder).find((id) => EXERCISE_BY_ID[id] && (!ctx.caps || isAvailable(EXERCISE_BY_ID[id], ctx.caps)));
      progNotes.push(`Your dumbbell is maxed out on ${ex.name}${alt ? ` — ${EXERCISE_BY_ID[alt].name} keeps you progressing` : ''}.`);
    }
    if ((ex.load === 'bodyweight' || ex.load === 'bands') && !ex.harder.length) s = Math.min(s, 0.85);
    pSum += s;
  }
  C.progression = pSum / valid.length;

  // ── Duration ──
  const dr = estimatedMinutes / targetMinutes;
  C.duration = Math.abs(dr - 1) <= 0.2 ? 1 : clamp01(1 - (Math.abs(dr - 1) - 0.2) * 1.8);

  let score = 0;
  for (const [k, w] of Object.entries(RATING_WEIGHTS)) score += w * C[k];
  score = Math.round(score);
  if (totalSets < 4) score = Math.min(score, 45);
  score = Math.max(0, Math.min(100, score));

  // ── Coverage display ──
  const coverage = [];
  for (const g of COVERAGE_GROUPS) {
    const vals = g.muscles.map((m) => eff[m] || 0).sort((a, b) => b - a);
    const agg = vals[0] + vals.slice(1).reduce((a, v) => a + v * 0.5, 0);
    const expected = g.muscles.some((m) => info.expect.includes(m));
    if (agg <= 0 && !expected) continue;
    coverage.push({ id: g.id, name: g.name, eff: Math.round(agg * 10) / 10, pct: clamp01(agg / 6), label: coverageLabel(agg), expected });
  }
  coverage.sort((a, b) => b.eff - a.eff);

  // ── Explanation ──
  const positives = [];
  const improvements = [];
  const coveredGroups = coverage.filter((c) => c.expected && c.eff >= 3).map((c) => c.name.toLowerCase());
  if (coveredGroups.length) positives.push(`${cap(listJoin(coveredGroups.slice(0, 3)))} covered`);
  const goodPair = pairNotes.find((p) => p.inWorkout && p.score >= 0.9);
  if (goodPair) positives.push(`Strong ${goodPair.pair.aName}/${goodPair.pair.bName} balance`);
  if (C.volume >= 0.9) positives.push(`Reasonable volume (${totalSets} sets)`);
  if (C.variety >= 0.8 && C.redundancy >= 0.9 && C.progression >= 0.9) positives.push('Good exercise selection');
  if (C.duration >= 0.95) positives.push(`Fits your ${targetMinutes}-minute target`);
  if (C.recovery === 1 && progress && Object.values(progress.muscles).some((m) => m.lastTrained)) positives.push('Targets recovered muscles');

  const missing = info.expect.filter((m) => expectScores[m] < 0.35);
  const low = info.expect.filter((m) => expectScores[m] >= 0.35 && expectScores[m] < 0.75 && (eff[m] || 0) < lo);
  const high = info.expect.filter((m) => (eff[m] || 0) > hi && (eff[m] || 0) <= 12);
  if (missing.length) improvements.push({ kind: 'add', text: `Add ${listJoin(missing.map((m) => MUSCLE_BY_ID[m].short.toLowerCase()))} work` });
  if (low.length) improvements.push({ kind: 'warn', text: `${cap(listJoin(low.map((m) => MUSCLE_BY_ID[m].short.toLowerCase())))} volume is slightly low` });
  for (const p of pairNotes.filter((x) => x.score < 0.7)) {
    const heavy = p.A > p.B ? p.pair.aName : p.pair.bName;
    const light = p.A > p.B ? p.pair.bName : p.pair.aName;
    improvements.push({ kind: 'warn', text: info.split ? `This week favours ${heavy} — balance it with some ${light} work` : `${cap(heavy)} outweighs ${light} — add some ${light} work` });
  }
  if (r > 1.3) improvements.push({ kind: 'warn', text: `${totalSets} sets is a lot for ${targetMinutes} minutes — fewer, harder sets will serve you better` });
  else if (r < 0.55) improvements.push({ kind: 'add', text: 'Add a few more sets for a productive session' });
  if (high.length) improvements.push({ kind: 'warn', text: `${cap(listJoin(high.map((m) => MUSCLE_BY_ID[m].short.toLowerCase())))} volume is high for one session — ${lo}–${hi} hard sets is plenty` });
  if (excessive.length) improvements.push({ kind: 'warn', text: `${cap(listJoin(excessive.map((m) => MUSCLE_BY_ID[m].short.toLowerCase())))}: far past useful volume for one session` });
  const worst = redundant.filter((g) => g.length >= 3).sort((a, b) => b.length - a.length)[0];
  if (worst) improvements.push({ kind: 'warn', text: `${worst.length} exercises do the same job (${listJoin(worst.slice(0, 3).map((e) => e.name))}${worst.length > 3 ? '…' : ''}) — swap some for different movements` });
  if (dupIds) improvements.push({ kind: 'warn', text: 'The same exercise appears more than once — add sets instead' });
  if (C.duration < 0.95) {
    improvements.push(dr > 1
      ? { kind: 'warn', text: `Estimated ~${estimatedMinutes} min — longer than your ${targetMinutes}-minute target` }
      : { kind: 'add', text: `Only ~${estimatedMinutes} min — there's room within your ${targetMinutes}-minute target` });
  }
  for (const n of progNotes.slice(0, 2)) improvements.push({ kind: 'warn', text: n });

  // ── Suggested addition (optional, never forced) ──
  let suggestion = null;
  const needs = info.expect
    .map((m) => ({ m, need: SIZE_WEIGHT[MUSCLE_BY_ID[m].size] * (1 - expectScores[m]) }))
    .filter((n) => n.need > 0.2)
    .sort((a, b) => b.need - a.need);
  if (needs.length && r <= 1.3) {
    const inWorkout = new Set(valid.map((it) => it.exerciseId));
    const patternCount = {};
    patterns.forEach((p) => { patternCount[p] = (patternCount[p] || 0) + 1; });
    for (const { m } of needs) {
      const candidates = EXERCISES.filter((e) =>
        e.primary.includes(m) && !inWorkout.has(e.id) && (patternCount[e.pattern] || 0) < 2 &&
        (!ctx.caps || isAvailable(e, ctx.caps)) && !(experience === 'beginner' && e.difficulty === 3));
      if (!candidates.length) continue;
      const scoreC = (e) => {
        const used = progress?.exercises?.[e.id]?.sessions.length || 0;
        return used * 2 + (e.primary.length === 1 ? 1 : 0) - e.difficulty * 0.5 + (e.primary[0] === m ? 1 : 0);
      };
      const pick = candidates.sort((a, b) => scoreC(b) - scoreC(a))[0];
      suggestion = {
        exerciseId: pick.id, muscle: m,
        sets: r > 1 ? 2 : 3, repMin: pick.reps[0], repMax: pick.reps[1],
        reason: expectScores[m] === 0 ? `${MUSCLE_BY_ID[m].short} aren't trained yet` : `More ${MUSCLE_BY_ID[m].short.toLowerCase()} work`,
      };
      break;
    }
  }

  let grade, label;
  if (score >= 90) { grade = 'excellent'; label = 'Excellent'; }
  else if (score >= 80) { grade = 'good'; label = 'Good'; }
  else if (score >= 70) { grade = 'solid'; label = 'Solid'; }
  else if (score >= 55) { grade = 'fair'; label = 'Fair'; }
  else { grade = 'weak'; label = 'Needs work'; }

  const tName = info.name.toLowerCase();
  let headline;
  if (score >= 90) headline = `Excellent ${tName} workout for your equipment.`;
  else if (score >= 80) headline = goodPair && type === 'upper' ? 'Good upper-body balance.' : `Good ${tName} workout.`;
  else if (score >= 70) headline = `Solid ${tName} workout with room to improve.`;
  else if (score >= 55) headline = 'A decent start — a few tweaks will make this much better.';
  else headline = totalSets < 4 ? 'Too little work to be a full session yet.' : 'This workout needs restructuring.';

  return {
    score, grade, label, type, typeName: info.name, headline,
    positives, improvements: improvements.slice(0, 5), warnings, coverage, components: C,
    suggestion, estimatedMinutes, totalSets, muscleEff: eff, targetMinutes,
    improvementsAll: improvements,
  };
}

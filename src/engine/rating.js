/**
 * Workout analysis & rating (0–100) — judged against the workout's FOCUS.
 *
 * A workout has a focus (split): Push, Pull, Legs, Chest, Back & Biceps, Custom… or Auto,
 * where FORGE detects it from the exercises. The rating asks "is this a good <focus> workout?"
 * — a great chest day is never penalised for not training legs.
 *
 *   Coverage     30  Every TARGET muscle of the focus gets a productive dose. The per-muscle
 *                    dose depends on the focus type (single-muscle days expect more sets per
 *                    muscle than a full-body day) and on experience.
 *   Focus fit    10  How much of the work lands on the focus (target + support muscles).
 *   Balance      12  Proportions *inside* the focus (chest vs triceps on a chest & triceps day,
 *                    quads vs posterior chain on legs, front vs side/rear delts on shoulders…).
 *   Volume       12  Total sets appropriate for the target duration.
 *   Variety       7  Distinct movement patterns (focus days may repeat a pattern once).
 *   Redundancy    7  Too many exercises doing exactly the same job.
 *   Recovery      8  Target muscles trained hard in the last 24–48 h.
 *   Progression   6  Can these exercises be overloaded with YOUR equipment? Sensible rep ranges?
 *   Duration      8  Estimated time vs. the workout's target duration.
 *
 * Effective sets: primary muscle = 1 set, secondary = 0.5 set.
 * Equipment-aware: suggestions only come from exercises you can do, stay on focus,
 * and nothing is penalised for equipment you don't own.
 */
import { EXERCISE_BY_ID, EXERCISES } from '../data/exercises.js';
import { MUSCLE_BY_ID, SIZE_WEIGHT } from '../data/muscles.js';
import { SPLIT_BY_ID, resolveSplit, sessionDose } from '../data/splits.js';
import { isAvailable, loadConfig } from './equipment.js';
import { recoveryStatus } from './recovery.js';

export const RATING_WEIGHTS = {
  coverage: 30, focus: 10, balance: 12, volume: 12, variety: 7, redundancy: 7, recovery: 8, progression: 6, duration: 8,
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const listJoin = (arr) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const short = (m) => MUSCLE_BY_ID[m].short;
const lower = (m) => MUSCLE_BY_ID[m].short.toLowerCase();
const an = (w) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`);

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

/** Share of PRIMARY work landing on each muscle. */
function primaryShare(items) {
  const share = {};
  let total = 0;
  for (const it of items) {
    const ex = EXERCISE_BY_ID[it.exerciseId];
    if (!ex) continue;
    const per = it.sets / ex.primary.length;
    for (const m of ex.primary) { share[m] = (share[m] || 0) + per; total += per; }
  }
  return { share, total };
}

/**
 * Auto-detect the most specific split that explains the workout.
 * Candidates are scored by how much primary work lands on their target+support muscles,
 * minus a penalty for target muscles that get nothing; specific splits win ties.
 */
export function detectSplit(items) {
  const { share, total } = primaryShare(items);
  if (!total) return 'full';
  const s = (list) => list.reduce((a, m) => a + (share[m] || 0), 0) / total;
  const order = ['chest', 'back', 'shoulders', 'arms', 'glutes', 'core', 'chest_triceps', 'back_biceps', 'chest_back', 'shoulders_arms', 'push', 'pull', 'legs', 'upper', 'lower', 'full'];
  let best = 'full', bestScore = -Infinity;
  order.forEach((id, rank) => {
    const sp = SPLIT_BY_ID[id];
    const onTarget = s(sp.target);
    const on = s([...sp.target, ...sp.support]);
    const missing = sp.target.filter((m) => !(share[m] > 0)).length / sp.target.length;
    // must explain the workout well; specific splits (low rank) get a small edge
    if (on < 0.8 || onTarget < 0.6) return;
    const score = on + 0.25 * onTarget - 0.6 * missing - rank * 0.012;
    if (score > bestScore) { bestScore = score; best = id; }
  });
  return best;
}

export function coverageScore(eff, lo, hi) {
  if (eff <= 0) return 0;
  if (eff < lo) return 0.9 * (eff / lo) ** 1.2;
  if (eff <= hi) return 1;
  return Math.max(0.4, 1 - 0.07 * (eff - hi));
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

/**
 * @param items  [{ exerciseId, sets, repMin, repMax, weight }]
 * @param ctx    { settings, profile, caps, progress, now, targetMinutes, focus, customMuscles }
 */
export function rateWorkout(items, ctx = {}) {
  const settings = ctx.settings || {};
  const experience = settings.experience || 'beginner';
  const progress = ctx.progress;
  const now = ctx.now || Date.now();
  const targetMinutes = ctx.targetMinutes || settings.targetMinutes || 45;
  const valid = items.filter((it) => EXERCISE_BY_ID[it.exerciseId] && it.sets > 0);
  const totalSets = valid.reduce((a, it) => a + it.sets, 0);
  const estimatedMinutes = valid.length ? estimateMinutes(valid, settings) : 0;

  const focusSetting = ctx.focus || 'auto';
  const auto = focusSetting === 'auto';
  const split = auto ? SPLIT_BY_ID[detectSplit(valid)] : resolveSplit(focusSetting, ctx.customMuscles) || SPLIT_BY_ID.full;
  const splitInfo = { id: split.id, name: split.name, auto, target: split.target, support: split.support };

  if (!valid.length) {
    return {
      score: 0, grade: 'empty', label: 'Add exercises', split: splitInfo, typeName: split.name,
      headline: auto ? 'Add a few exercises and FORGE will analyse your workout.' : `Add exercises for your ${split.name.toLowerCase()} workout.`,
      positives: [], improvements: [], warnings: [], coverage: [], components: {},
      suggestion: null, estimatedMinutes: 0, totalSets: 0, muscleEff: {}, targetMinutes, dose: sessionDose(split.dose, experience),
    };
  }

  const eff = muscleVolume(valid);
  const [lo, hi] = sessionDose(split.dose, experience);
  const target = split.target;
  const onFocusSet = new Set([...target, ...split.support]);
  const C = {};

  // ── Coverage of target muscles ──
  let cw = 0, cs = 0;
  const tScore = {};
  for (const m of target) {
    const w = SIZE_WEIGHT[MUSCLE_BY_ID[m].size];
    tScore[m] = coverageScore(eff[m] || 0, lo, hi);
    cw += w; cs += w * tScore[m];
  }
  const missing = target.filter((m) => tScore[m] < 0.3);
  C.coverage = clamp01((cs / cw) ** 1.5 - 0.1 * missing.length);

  // ── Focus fit ──
  const totalEff = Object.values(eff).reduce((a, b) => a + b, 0) || 1;
  const onEff = Object.entries(eff).filter(([m]) => onFocusSet.has(m)).reduce((a, [, v]) => a + v, 0);
  const offShare = 1 - onEff / totalEff;
  C.focus = offShare <= 0.15 ? 1 : clamp01(1 - (offShare - 0.15) / 0.4);
  const offExercises = valid.map((it) => EXERCISE_BY_ID[it.exerciseId]).filter((ex) => ex.primary.every((m) => !onFocusSet.has(m)));

  // ── Balance inside the focus ──
  const pairNotes = [];
  let bSum = 0, bN = 0;
  for (const [a, b, minRatio] of split.balance || []) {
    const A = a.reduce((s, m) => s + (eff[m] || 0), 0);
    const B = b.reduce((s, m) => s + (eff[m] || 0), 0);
    if (A < 1 && B < 1) continue;
    const sc = clamp01(Math.min(A, B) / Math.max(A, B) / minRatio);
    bSum += sc; bN++;
    pairNotes.push({ a, b, A, B, score: sc });
  }
  C.balance = bN ? bSum / bN : 1;

  // ── Volume ──
  const idealSets = targetMinutes / 2.6;
  const r = totalSets / idealSets;
  let vol = r < 0.55 ? Math.max(0.3, 1 - (0.55 - r) * 2.2) : r <= 1.3 ? 1 : Math.max(0, 1 - (r - 1.3) * 1.2);
  const excessive = Object.entries(eff).filter(([, e]) => e > hi + 5).map(([m]) => m);
  vol = clamp01(vol - 0.12 * excessive.length);
  C.volume = vol;

  // ── Variety & redundancy ──
  const patterns = valid.map((it) => EXERCISE_BY_ID[it.exerciseId].pattern);
  const distinct = new Set(patterns).size;
  const focused = split.dose === 'focus';
  C.variety = valid.length === 1 ? 0.5 : clamp01((distinct / valid.length - (focused ? 0.2 : 0.3)) / 0.45);
  const groups = {};
  for (const it of valid) {
    const ex = EXERCISE_BY_ID[it.exerciseId];
    (groups[`${ex.pattern}:${ex.primary[0]}`] ||= []).push(ex);
  }
  const allowed = focused ? 2 : 1;
  let redPen = 0;
  const redundant = [];
  for (const g of Object.values(groups)) {
    if (g.length > allowed) { redPen += 0.25 * (g.length - allowed); redundant.push(g); }
  }
  const dupIds = valid.length - new Set(valid.map((it) => it.exerciseId)).size;
  redPen += dupIds * 0.3;
  C.redundancy = clamp01(1 - redPen);

  // ── Recovery (target muscles only) ──
  const warnings = [];
  let rW = 0, rS = 0;
  for (const m of target) {
    const e = eff[m] || 0;
    if (!e) continue;
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
  // a workout that's mostly something else can't score well as this focus
  if (offShare > 0.15) score = Math.min(score, Math.round(100 - 90 * (offShare - 0.15)));
  score = Math.max(0, Math.min(100, score));

  // ── Coverage display: target muscles first, then support / off-focus work ──
  const statusOf = (e) => (e <= 0 ? 'Missing' : e < lo * 0.6 ? 'Low' : e < lo ? 'Almost' : e <= hi ? 'On target' : 'High');
  const coverage = [
    ...target.map((m) => ({ id: m, name: short(m), eff: Math.round((eff[m] || 0) * 10) / 10, pct: clamp01((eff[m] || 0) / hi), label: statusOf(eff[m] || 0), role: 'target' })),
    ...Object.entries(eff).filter(([m, e]) => !target.includes(m) && e >= 1).sort((a, b) => b[1] - a[1])
      .map(([m, e]) => ({ id: m, name: short(m), eff: Math.round(e * 10) / 10, pct: clamp01(e / hi), label: onFocusSet.has(m) ? 'Support' : 'Off-focus', role: onFocusSet.has(m) ? 'support' : 'off' })),
  ];

  // ── Explanation ──
  const fname = split.name.toLowerCase();
  const positives = [];
  const improvements = [];
  const good = target.filter((m) => tScore[m] >= 0.85);
  if (good.length === target.length) positives.push(target.length === 1 ? `${short(target[0])} gets a full dose (${Math.round(eff[target[0]])} sets)` : `Every target muscle is covered`);
  else if (good.length) positives.push(`${cap(listJoin(good.map(lower)))} covered`);
  if (C.focus >= 0.95 && totalEff > 0) positives.push(`Stays on focus — ${Math.round((1 - offShare) * 100)}% of the work hits ${fname} muscles`);
  const goodPair = pairNotes.find((p) => p.score >= 0.95 && Math.min(p.A, p.B) >= 2);
  if (goodPair) positives.push(`Good ${listJoin(goodPair.a.map(lower))} / ${listJoin(goodPair.b.map(lower))} balance`);
  if (C.volume >= 0.9) positives.push(`Reasonable volume (${totalSets} sets)`);
  if (C.variety >= 0.8 && C.redundancy >= 0.9 && C.progression >= 0.9) positives.push('Good exercise selection');
  if (C.duration >= 0.95) positives.push(`Fits your ${targetMinutes}-minute target`);
  if (C.recovery === 1 && progress && Object.values(progress.muscles).some((m) => m.lastTrained)) positives.push('Target muscles are recovered');

  const why = auto ? '' : ` — part of ${an(fname)} workout`;
  if (missing.length) improvements.push({ kind: 'add', text: `Add ${listJoin(missing.map(lower))} work${why}` });
  const low = target.filter((m) => !missing.includes(m) && (eff[m] || 0) < lo);
  if (low.length) improvements.push({ kind: 'warn', text: `${cap(listJoin(low.map(lower)))}: ${low.length === 1 ? `${Math.round((eff[low[0]] || 0) * 10) / 10} sets — aim for ${lo}–${hi}` : `below the ${lo}–${hi} set range`}` });
  const high = target.filter((m) => (eff[m] || 0) > hi);
  if (high.length) improvements.push({ kind: 'warn', text: `${cap(listJoin(high.map(lower)))}: more than ${hi} sets in one session — extra sets add fatigue, not results` });
  if (offExercises.length && C.focus < 0.95) {
    improvements.push({ kind: 'warn', text: `${listJoin(offExercises.slice(0, 2).map((e) => e.name))}${offExercises.length > 2 ? '…' : ''} ${offExercises.length === 1 ? "doesn't" : "don't"} fit ${an(fname)} workout (${Math.round(offShare * 100)}% of the work is off-focus)` });
  }
  for (const p of pairNotes.filter((x) => x.score < 0.75)) {
    const [lowSide, highSide] = p.A < p.B ? [p.a, p.b] : [p.b, p.a];
    improvements.push({ kind: 'add', text: `${cap(listJoin(lowSide.map(lower)))} volume is low next to ${listJoin(highSide.map(lower))}` });
  }
  if (r > 1.3) improvements.push({ kind: 'warn', text: `${totalSets} sets is a lot for ${targetMinutes} minutes — fewer, harder sets will serve you better` });
  else if (r < 0.55) improvements.push({ kind: 'add', text: 'Add a few more sets for a productive session' });
  const worst = redundant.sort((a, b) => b.length - a.length)[0];
  if (worst) improvements.push({ kind: 'warn', text: `${worst.length} exercises do the same job (${listJoin(worst.slice(0, 3).map((e) => e.name))}) — swap one for a different angle` });
  if (dupIds) improvements.push({ kind: 'warn', text: 'The same exercise appears more than once — add sets instead' });
  if (C.duration < 0.95) {
    improvements.push(dr > 1
      ? { kind: 'warn', text: `Estimated ~${estimatedMinutes} min — longer than your ${targetMinutes}-minute target` }
      : { kind: 'add', text: `Only ~${estimatedMinutes} min — there's room within your ${targetMinutes}-minute target` });
  }
  for (const n of progNotes.slice(0, 2)) improvements.push({ kind: 'warn', text: n });

  // ── Suggested addition: only target muscles, only on-focus exercises ──
  let suggestion = null;
  const balanceNeeds = pairNotes.filter((p) => p.score < 0.75).flatMap((p) => (p.A < p.B ? p.a : p.b));
  const needs = target
    .map((m) => ({ m, need: SIZE_WEIGHT[MUSCLE_BY_ID[m].size] * (1 - tScore[m]) + (balanceNeeds.includes(m) ? 0.3 : 0) }))
    .filter((n) => n.need > 0.2)
    .sort((a, b) => b.need - a.need);
  if (needs.length && r <= 1.3) {
    const inWorkout = new Set(valid.map((it) => it.exerciseId));
    const patternCount = {};
    patterns.forEach((p) => { patternCount[p] = (patternCount[p] || 0) + 1; });
    for (const { m } of needs) {
      const candidates = EXERCISES.filter((e) =>
        e.primary.includes(m) && e.primary.every((p) => onFocusSet.has(p)) && !inWorkout.has(e.id) &&
        (patternCount[e.pattern] || 0) < allowed + (focused ? 0 : 1) &&
        (!ctx.caps || isAvailable(e, ctx.caps)) && !(experience === 'beginner' && e.difficulty === 3));
      if (!candidates.length) continue;
      const scoreC = (e) => {
        const used = progress?.exercises?.[e.id]?.sessions.length || 0;
        return used * 2 + (e.primary[0] === m ? 1.5 : 0) + (e.primary.length === 1 ? 0.5 : 0) - e.difficulty * 0.5 - (patternCount[e.pattern] ? 1 : 0);
      };
      const pick = candidates.sort((a, b) => scoreC(b) - scoreC(a))[0];
      suggestion = {
        exerciseId: pick.id, muscle: m,
        sets: r > 1 ? 2 : 3, repMin: pick.reps[0], repMax: pick.reps[1],
        reason: !(eff[m] > 0) ? `${short(m)} aren't trained yet` : `More ${lower(m)} work`,
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

  let headline;
  if (score >= 90) headline = `Excellent ${fname} workout for your equipment.`;
  else if (score >= 80) headline = `Good ${fname} workout.`;
  else if (score >= 70) headline = `Solid ${fname} workout with room to improve.`;
  else if (score >= 55) headline = `A decent start on ${an(fname)} workout — a few tweaks will make it much better.`;
  else headline = totalSets < 4 ? 'Too little work to be a full session yet.' : `This doesn't work well as a ${fname} workout yet.`;

  return {
    score, grade, label, split: splitInfo, typeName: split.name, headline,
    positives, improvements: improvements.slice(0, 5), improvementsAll: improvements, warnings, coverage, components: C,
    suggestion, estimatedMinutes, totalSets, muscleEff: eff, targetMinutes, dose: [lo, hi], offShare,
  };
}

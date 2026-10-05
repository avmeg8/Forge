/**
 * Workout generator — "build it for me".
 *
 * Uses the rating engine as its judge: starting from an empty workout it repeatedly adds
 * the on-focus exercise (from what YOUR equipment allows) that raises the rating most,
 * stops when nothing helps or the time budget is used, then fine-tunes set counts.
 * A small random nudge makes "Shuffle" give different — but still well-rated — workouts.
 *
 * With supersets on, exercises that don't share a main muscle are paired up, which cuts
 * rest time, so more fits into the same minutes.
 */
import { EXERCISES, EXERCISE_BY_ID } from '../data/exercises.js';
import { MUSCLE_BY_ID, SIZE_WEIGHT } from '../data/muscles.js';
import { resolveSplit, SPLIT_BY_ID } from '../data/splits.js';
import { isAvailable } from './equipment.js';
import { rateWorkout, estimateMinutes } from './rating.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Big compound lifts first, small isolation and core work last. */
function orderKey(ex) {
  const core = ex.primary.every((m) => MUSCLE_BY_ID[m].group === 'core');
  const size = Math.max(...ex.primary.map((m) => SIZE_WEIGHT[MUSCLE_BY_ID[m].size]));
  return (core ? -10 : 0) + size * 3 + (ex.primary.length + ex.secondary.length * 0.5) * 0.6 + (ex.metric === 'time' ? -1 : 0);
}

export function orderItems(items) {
  return [...items].sort((a, b) => orderKey(EXERCISE_BY_ID[b.exerciseId]) - orderKey(EXERCISE_BY_ID[a.exerciseId]));
}

/** Pair exercises that don't share a main muscle into supersets (keeps order otherwise). */
export function pairSupersets(items) {
  const list = items.map((it) => ({ ...it, group: null }));
  const out = [];
  const used = new Set();
  let g = 0;
  for (let i = 0; i < list.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    out.push(list[i]);
    const a = EXERCISE_BY_ID[list[i].exerciseId];
    for (let j = i + 1; j < list.length; j++) {
      if (used.has(j)) continue;
      const b = EXERCISE_BY_ID[list[j].exerciseId];
      const overlap = a.primary.some((m) => b.primary.includes(m) || b.secondary.includes(m)) || b.primary.some((m) => a.secondary.includes(m));
      if (overlap) continue;
      const id = `g${++g}`;
      list[i].group = id;
      list[j].group = id;
      used.add(j);
      out.push(list[j]);
      break;
    }
  }
  return out;
}

/**
 * @param opts {
 *   focus, customMuscles, minutes, supersets, seed,
 *   rateCtx: { settings, profile, caps, progress },
 *   makeItem(exerciseId, overrides) → item
 * }
 * @returns { items, rating, split, name }
 */
export function generateWorkout(opts) {
  const { minutes = 45, supersets = false, rateCtx = {}, makeItem } = opts;
  const focus = !opts.focus || opts.focus === 'auto' ? 'full' : opts.focus;
  const split = resolveSplit(focus, opts.customMuscles) || SPLIT_BY_ID.full;
  const rand = rng(opts.seed ?? Date.now());
  const experience = rateCtx.settings?.experience || 'beginner';
  const onFocus = new Set([...split.target, ...split.support]);
  const used = rateCtx.progress?.exercises || {};

  const candidates = EXERCISES.filter((e) =>
    (!rateCtx.caps || isAvailable(e, rateCtx.caps)) &&
    e.primary.some((m) => split.target.includes(m)) &&
    e.primary.every((m) => onFocus.has(m)) &&
    !(experience === 'beginner' && e.difficulty === 3));
  // a little random preference per exercise, fixed for this run, plus a nudge towards favourites
  const fit = { beginner: { 1: 1.6, 2: 0 }, intermediate: { 1: 0.9, 2: 0.9, 3: -1.6 }, advanced: { 1: 0.4, 2: 0.8, 3: 0.4 } }[experience] || {};
  const quality = (e) => (e.load === 'dumbbell' ? 1 : 0) + (fit[e.difficulty] || 0)
    + (e.primary.length >= 2 || e.secondary.length >= 3 ? 0.8 : 0);
  const pref = Object.fromEntries(candidates.map((e) => [e.id, quality(e) + rand() * 2.2 + Math.min(1, (used[e.id]?.sessions.length || 0) / 4)]));

  const arrange = (items) => (supersets ? pairSupersets(orderItems(items)) : orderItems(items));
  const rate = (items) => rateWorkout(items, { ...rateCtx, targetMinutes: minutes, focus, customMuscles: opts.customMuscles || [] });
  const budget = minutes * 1.12;

  let items = [];
  let current = rate(items).score;
  for (let guard = 0; guard < 14; guard++) {
    let best = null;
    const have = new Set(items.map((it) => it.exerciseId));
    for (const e of candidates) {
      if (have.has(e.id)) continue;
      const trial = arrange([...items, makeItem(e.id, { sets: 3 })]);
      if (estimateMinutes(trial, rateCtx.settings) > budget) continue;
      const s = rate(trial).score;
      const v = s + pref[e.id];
      if (!best || v > best.v) best = { v, s, trial };
    }
    // keep going while the rating holds up and there's time left; stop when it would drop
    const roomLeft = estimateMinutes(items, rateCtx.settings) < minutes * 0.85;
    if (!best || best.s < current + (items.length < 3 ? -5 : roomLeft ? 0 : 1)) break;
    items = best.trial;
    current = best.s;
  }

  // fine-tune set counts (2–5)
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < items.length; i++) {
      for (const d of [1, -1]) {
        const sets = items[i].sets + d;
        if (sets < 2 || sets > 5) continue;
        const trial = items.map((it, k) => (k === i ? { ...it, sets } : it));
        if (estimateMinutes(trial, rateCtx.settings) > budget) continue;
        const s = rate(trial).score;
        if (s > current) { items = trial; current = s; }
      }
    }
  }

  // give the groups stable, readable ids
  const ids = {};
  items.forEach((it) => { if (it.group) it.group = (ids[it.group] ||= `ss${Object.keys(ids).length + 1}${Math.round(rand() * 1e6)}`); });

  const name = split.id === 'custom' ? 'Custom Workout'
    : ['single', 'pair'].includes(split.group) ? `${split.name} Day`
      : split.id === 'full' ? 'Full Body' : split.id === 'upper' ? 'Upper Body' : split.id === 'lower' ? 'Lower Body' : split.name;
  return { items, rating: rate(items), split, name, focus };
}

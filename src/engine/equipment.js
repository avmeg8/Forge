/**
 * Equipment engine — decides what the user can do with what they own.
 * Pure functions over data; no exercise or screen ever checks equipment by hand.
 */
import { EQUIPMENT, EQUIPMENT_BY_ID, CAPABILITY_NAMES, CAPABILITY_SOURCE } from '../data/equipment.js';
import { EXERCISES } from '../data/exercises.js';

export function activeProfile(settings) {
  return settings.profiles.find((p) => p.id === settings.activeProfileId) || settings.profiles[0];
}

/** Set of capabilities provided by the owned items of a profile. */
export function capabilities(profile) {
  const caps = new Set(['bodyweight', 'floor']);
  for (const id of Object.keys(profile.items || {})) {
    const item = EQUIPMENT_BY_ID[id];
    if (item) item.provides.forEach((c) => caps.add(c));
  }
  return caps;
}

export function missingFor(exercise, caps) {
  return exercise.equipment.filter((c) => !caps.has(c));
}

export function isAvailable(exercise, caps) {
  return missingFor(exercise, caps).length === 0;
}

export function availableExercises(caps, list = EXERCISES) {
  return list.filter((e) => isAvailable(e, caps));
}

export function capabilityName(c) {
  return CAPABILITY_NAMES[c] || c;
}

/** Catalog item that would satisfy a missing capability (for "[ ADD BENCH ]"). */
export function sourceItemFor(capability) {
  return EQUIPMENT_BY_ID[CAPABILITY_SOURCE[capability]] || null;
}

/**
 * Weight options for a load capability, merged across owned items that provide it.
 * Returns null for bodyweight/band exercises (reps only).
 */
export function loadConfig(profile, loadCap) {
  if (!loadCap || loadCap === 'bodyweight' || loadCap === 'bands') return null;
  let cfg = null;
  for (const [id, conf] of Object.entries(profile.items || {})) {
    const item = EQUIPMENT_BY_ID[id];
    if (!item || item.loadCapability !== loadCap) continue;
    const l = { ...item.load, ...(conf.load || {}) };
    cfg = cfg
      ? { min: Math.min(cfg.min, l.min), max: Math.max(cfg.max, l.max), increment: Math.min(cfg.increment, l.increment) }
      : { ...l };
  }
  return cfg;
}

/** All selectable weights for a config, e.g. 2, 3, 4 … 30. */
export function weightSteps(cfg) {
  if (!cfg) return [];
  const out = [];
  const inc = cfg.increment > 0 ? cfg.increment : 1;
  for (let w = cfg.min; w <= cfg.max + 1e-9; w = Math.round((w + inc) * 1000) / 1000) out.push(w);
  if (out[out.length - 1] < cfg.max) out.push(cfg.max);
  return out;
}

/** Clamp and snap a weight to the nearest selectable value. Never outside the range. */
export function snapWeight(w, cfg) {
  if (!cfg) return 0;
  const steps = weightSteps(cfg);
  if (w == null || Number.isNaN(w)) return steps[0];
  let best = steps[0];
  for (const s of steps) if (Math.abs(s - w) < Math.abs(best - w)) best = s;
  return best;
}

export function stepWeight(w, dir, cfg) {
  const steps = weightSteps(cfg);
  if (!steps.length) return 0;
  const cur = snapWeight(w, cfg);
  const i = steps.indexOf(cur);
  return steps[Math.min(steps.length - 1, Math.max(0, i + dir))];
}

export function nextWeightUp(w, cfg) {
  const steps = weightSteps(cfg);
  return steps.find((s) => s > w + 1e-9) ?? null;
}

export function nextWeightDown(w, cfg) {
  const steps = weightSteps(cfg);
  return [...steps].reverse().find((s) => s < w - 1e-9) ?? null;
}

/**
 * "Unlock more exercises": for each catalog item the user does not own,
 * how many extra exercises adding it would make available.
 */
export function unlockSuggestions(profile, list = EXERCISES) {
  const owned = new Set(Object.keys(profile.items || {}));
  const base = capabilities(profile);
  const baseCount = availableExercises(base, list).length;
  return EQUIPMENT
    .filter((e) => !e.alwaysOwned && !owned.has(e.id))
    .map((item) => {
      const caps = new Set([...base, ...item.provides]);
      return { item, gain: availableExercises(caps, list).length - baseCount };
    })
    .sort((a, b) => b.gain - a.gain);
}

/**
 * Deload weeks — a planned lighter week after a block of hard training.
 *
 * Every `deloadEvery` weeks (Settings, default 6 → 5 hard weeks + 1 light week) FORGE
 * suggests a deload: the same workouts with ~40% fewer sets and ~10% less weight.
 * Only weeks you actually trained in count towards the block, so time off (holiday,
 * reserve duty, illness) already works as rest and pushes the deload back.
 *
 * Settings fields:
 *   deloadEvery   4 | 5 | 6 | 8 weeks, 0 = off
 *   deloadWeek    start-of-week timestamp of a deload week the user started
 *   deloadLast    start-of-week timestamp of the most recent deload week
 *   deloadSnooze  start-of-week timestamp of a week the user said "not now"
 */
import { startOfWeek, DAY } from '../utils/date.js';

export const DELOAD_OPTIONS = [[0, 'Off'], [4, '4 wk'], [5, '5 wk'], [6, '6 wk'], [8, '8 wk']];
export const DELOAD = { setFactor: 0.6, weightFactor: 0.9 };

/** Planned sets during a deload week. */
export function deloadSets(sets) {
  return Math.max(1, Math.round(sets * DELOAD.setFactor));
}

/**
 * @returns { state: 'off' | 'none' | 'building' | 'due' | 'snoozed' | 'active', trainedWeeks, every, weeksLeft }
 */
export function deloadState(settings = {}, sessionTimes = [], now = Date.now()) {
  const every = settings.deloadEvery ?? 6;
  const ws = settings.weekStart ?? 1;
  const wk = startOfWeek(now, ws);
  if (!every) return { state: 'off', every: 0 };
  if (settings.deloadWeek === wk) return { state: 'active', every, week: wk };
  if (!sessionTimes.length) return { state: 'none', every };
  const anchor = settings.deloadLast ?? -Infinity;
  const weeks = new Set(sessionTimes.filter((t) => t >= anchor + 7 * DAY && t < wk).map((t) => startOfWeek(t, ws)));
  const trainedWeeks = weeks.size; // completed weeks with training since the last deload
  const needed = every - 1;
  if (trainedWeeks >= needed) {
    return { state: settings.deloadSnooze === wk ? 'snoozed' : 'due', every, trainedWeeks, weeksLeft: 0, week: wk };
  }
  return { state: 'building', every, trainedWeeks, weeksLeft: needed - trainedWeeks, week: wk };
}

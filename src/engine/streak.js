/**
 * Consistency streak — counts TRAINING DAYS, not calendar days.
 *
 * Rest days never break the streak. The streak only breaks when the gap between
 * two training days is longer than the frequency allows (`maxGap` calendar days,
 * i.e. maxGap − 1 rest days in a row).
 *
 * Anti-overtraining: within one week, training days beyond (target + 1) still get
 * logged but do not extend the streak. Several sessions on the same day count once.
 */
import { DAY, startOfDay, daysBetween, startOfWeek } from '../utils/date.js';

export const FREQUENCIES = {
  '2-3': { id: '2-3', label: '2–3 days', target: 3, maxGap: 4 },
  '4': { id: '4', label: '4 days', target: 4, maxGap: 3 },
  '5': { id: '5', label: '5 days', target: 5, maxGap: 3 },
};

/** Display order (object keys like '4' would otherwise sort before '2-3'). */
export const FREQ_LIST = ['2-3', '4', '5'].map((k) => FREQUENCIES[k]);

export function frequency(key) {
  return FREQUENCIES[key] || FREQUENCIES['4'];
}

/** Streak value at a given moment from a list of session timestamps. */
export function computeStreak(times, freqKey, now = Date.now(), weekStart = 1) {
  const f = frequency(freqKey);
  const days = [...new Set(times.filter((t) => t <= now).map(startOfDay))].sort((a, b) => a - b);

  let streak = 0;
  let best = 0;
  let prev = null;
  const weekCounts = new Map();
  for (const d of days) {
    if (prev !== null && daysBetween(prev, d) > f.maxGap) streak = 0;
    const wk = startOfWeek(d, weekStart);
    const c = (weekCounts.get(wk) || 0) + 1;
    weekCounts.set(wk, c);
    if (c <= f.target + 1) streak++;
    best = Math.max(best, streak);
    prev = d;
  }

  const gapNow = prev === null ? Infinity : daysBetween(prev, now);
  const alive = gapNow <= f.maxGap;
  const current = alive ? streak : 0;
  const weekCount = weekCounts.get(startOfWeek(now, weekStart)) || 0;
  const trainedToday = gapNow === 0;

  // consecutive calendar training days ending at the last training day
  let consecutive = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (i === days.length - 1 || daysBetween(days[i], days[i + 1]) === 1) consecutive++;
    else break;
  }

  let nextRest;
  if (prev === null) nextRest = null;
  else if (trainedToday) nextRest = consecutive >= 2 || weekCount >= f.target ? 'Tomorrow' : 'In 2 days';
  else if ((gapNow === 1 && consecutive >= 3) || weekCount >= f.target) nextRest = 'Today';
  else nextRest = 'After your next session';

  return {
    streak: current,
    best,
    alive,
    weekCount,
    target: f.target,
    trainedToday,
    lastDay: prev,
    daysSinceLast: gapNow,
    consecutive,
    nextRest,
    // last calendar day you can train on and keep the streak
    keepUntil: prev === null ? null : prev + f.maxGap * DAY,
    // rest days you can still take (including today if you haven't trained) before the streak breaks
    restDaysLeft: alive ? Math.max(0, f.maxGap - 1 - gapNow + (trainedToday ? 0 : 1)) : 0,
  };
}

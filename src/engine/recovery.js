/**
 * Recovery — informative, never restrictive.
 * Based on how recently a muscle was trained and how much work it got.
 */
import { HOUR } from '../utils/date.js';

export function recoveryStatus(muscleState, now = Date.now()) {
  if (!muscleState?.lastTrained) return { level: 'ready', hours: Infinity, label: 'Fresh' };
  const hours = (now - muscleState.lastTrained) / HOUR;
  const sets = muscleState.lastSessionSets || 0;
  if (hours < 24 && sets >= 3) return { level: 'limited', hours, label: 'Recovery may be limited' };
  if (hours < 48 && sets >= 6) return { level: 'partial', hours, label: 'Still recovering' };
  if (hours < 48) return { level: 'ready', hours, label: 'Recovered' };
  return { level: 'ready', hours, label: 'Recovered' };
}

/** Map of muscle → status for every muscle. */
export function recoveryMap(progress, now = Date.now()) {
  return Object.fromEntries(Object.entries(progress.muscles).map(([id, m]) => [id, recoveryStatus(m, now)]));
}

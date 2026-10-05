/**
 * Week in review — what a training week added up to, compared with the week before.
 * Pure function over completed sessions + derived progress; no storage of its own.
 */
import { MUSCLES, MUSCLE_BY_ID } from '../data/muscles.js';
import { startOfWeek, DAY } from '../utils/date.js';
import { frequency } from './streak.js';

const MAJOR = new Set(['chest', 'lats', 'traps', 'front_delts', 'side_delts', 'rear_delts', 'biceps', 'triceps', 'abs', 'quads', 'glutes', 'hamstrings', 'calves']);

function weekStats(sessions, progress, from, to) {
  const list = sessions.filter((s) => s.startedAt >= from && s.startedAt < to).sort((a, b) => a.startedAt - b.startedAt);
  let sets = 0, xp = 0, ms = 0;
  const prs = [], levelUps = [], muscleXp = {};
  for (const s of list) {
    sets += s.sets.filter((x) => !x.warmup).length;
    ms += Math.max(0, (s.endedAt || s.startedAt) - s.startedAt);
    const r = progress.sessions[s.id];
    if (!r) continue;
    xp += r.totalXp;
    for (const p of r.prs) if (p.type !== 'volume') prs.push({ ...p, sessionName: s.name });
    levelUps.push(...r.levelUps);
    for (const [m, v] of Object.entries(r.xpByMuscle)) muscleXp[m] = (muscleXp[m] || 0) + v;
  }
  return { list, count: new Set(list.map((s) => new Date(s.startedAt).toDateString())).size, sessions: list.length, sets, xp, minutes: Math.round(ms / 60000), prs, levelUps, muscleXp };
}

/**
 * @param offset 0 = this week, 1 = last week, …
 */
export function weekSummary({ sessions, progress, settings = {}, measures = [], scheduledDays = 0, now = Date.now(), offset = 0 }) {
  const ws = settings.weekStart ?? 1;
  const thisWeek = startOfWeek(now, ws);
  // step back whole weeks via dates (DST-safe)
  const d = new Date(thisWeek);
  d.setDate(d.getDate() - 7 * offset);
  const from = startOfWeek(d.getTime() + DAY / 2, ws);
  const e = new Date(from);
  e.setDate(e.getDate() + 7);
  const to = e.getTime();
  const p = new Date(from);
  p.setDate(p.getDate() - 7);
  const prevFrom = p.getTime();

  const cur = weekStats(sessions, progress, from, to);
  const prev = weekStats(sessions, progress, prevFrom, from);
  const target = scheduledDays || frequency(settings.frequency).target;

  // keep only the best PR per exercise + type
  const seen = new Set();
  const prs = cur.prs.filter((x) => { const k = `${x.exerciseId}:${x.type}`; if (seen.has(k)) return false; seen.add(k); return true; });
  // level-ups: highest level reached per muscle this week
  const lv = {};
  for (const l of cur.levelUps) if (!lv[l.muscle] || l.to > lv[l.muscle].to) lv[l.muscle] = { ...l, from: Math.min(l.from, lv[l.muscle]?.from ?? l.from) };
  const topMuscles = Object.entries(cur.muscleXp).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, x]) => ({ id, name: MUSCLE_BY_ID[id].name, xp: x }));
  const untrained = cur.sessions ? MUSCLES.filter((m) => MAJOR.has(m.id) && !(cur.muscleXp[m.id] > 0)).map((m) => m.short) : [];

  const inWeek = measures.filter((m) => m.t >= from && m.t < to);
  const before = [...measures].reverse().find((m) => m.t < from);
  const bw = inWeek.length ? { to: inWeek[inWeek.length - 1].kg, from: (before || inWeek[0]).kg } : null;

  const end = new Date(to - DAY);
  const fmt = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const label = offset === 0 ? 'This week' : offset === 1 ? 'Last week' : `${fmt(from)} – ${fmt(end.getTime())}`;

  let headline;
  if (!cur.sessions) headline = offset === 0 ? 'No workouts yet this week.' : 'No workouts this week.';
  else if (cur.count >= target) headline = `Plan complete — ${cur.count} of ${target} training days.`;
  else headline = `${cur.count} of ${target} training days.`;

  const delta = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
  return {
    from, to, label, range: `${fmt(from)} – ${fmt(end.getTime())}`, offset, target, headline,
    count: cur.count, sessions: cur.list, sets: cur.sets, xp: Math.round(cur.xp), minutes: cur.minutes,
    prs, levelUps: Object.values(lv), topMuscles, untrained, bodyWeight: bw,
    prev: { count: prev.count, sets: prev.sets, xp: Math.round(prev.xp), minutes: prev.minutes },
    change: { sets: delta(cur.sets, prev.sets), xp: delta(cur.xp, prev.xp) },
    complete: cur.count >= target,
  };
}

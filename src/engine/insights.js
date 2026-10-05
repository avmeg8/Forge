/**
 * Insights — observations that help, never judge.
 */
import { MUSCLES, MUSCLE_BY_ID, OPPOSING_PAIRS } from '../data/muscles.js';
import { EXERCISES, EXERCISE_BY_ID } from '../data/exercises.js';
import { isAvailable } from './equipment.js';
import { setScore } from './xp.js';
import { kg } from '../utils/format.js';

// Muscles that most programs train only indirectly are excluded from "focus" nagging.
const FOCUS_EXCLUDE = new Set(['hip_flexors', 'adductors', 'forearms']);

/** Best available exercises for a muscle — preferring ones the user already does. */
export function exercisesForMuscle(muscleId, { caps, progress, experience = 'beginner', limit = 3, exclude = [] } = {}) {
  const skip = new Set(exclude);
  return EXERCISES
    .filter((e) => e.primary.includes(muscleId) && !skip.has(e.id) && (!caps || isAvailable(e, caps)))
    .filter((e) => !(experience === 'beginner' && e.difficulty === 3))
    .map((e) => {
      const used = progress?.exercises?.[e.id]?.sessions.length || 0;
      const focus = e.primary[0] === muscleId ? 2 : 0;
      return { e, s: used * 1.5 + focus + (e.primary.length === 1 ? 1 : 0) - Math.abs(e.difficulty - (experience === 'advanced' ? 2.5 : experience === 'intermediate' ? 2 : 1.2)) };
    })
    .sort((a, b) => b.s - a.s)
    .reduce((acc, { e }) => {
      // avoid two exercises of the same pattern
      if (!acc.some((x) => x.pattern === e.pattern)) acc.push(e);
      return acc;
    }, [])
    .slice(0, limit);
}

export function weakMuscles(progress, { caps, experience, sessionsCount } = {}) {
  if ((sessionsCount ?? 0) < 3) return [];
  const pool = MUSCLES.filter((m) => !FOCUS_EXCLUDE.has(m.id));
  const avg = pool.reduce((a, m) => a + progress.muscles[m.id].xp, 0) / pool.length;
  if (avg < 50) return [];
  return pool
    .map((m) => ({ muscle: m, state: progress.muscles[m.id] }))
    .filter((x) => x.state.xp < avg * 0.6)
    .sort((a, b) => a.state.xp - b.state.xp)
    .slice(0, 3)
    .map((x) => ({
      id: x.muscle.id,
      name: x.muscle.name,
      level: x.state.info.level,
      text: x.state.xp === 0 ? 'Not trained yet.' : 'Lower than your overall average.',
      suggestion: exercisesForMuscle(x.muscle.id, { caps, progress, experience, limit: 1 })[0] || null,
    }));
}

/** "Your back is progressing faster than your chest." — last 4 weeks. */
export function balanceObservations(progress) {
  const out = [];
  for (const p of OPPOSING_PAIRS) {
    const a = p.a.reduce((s, m) => s + progress.muscles[m].monthXp, 0) / p.a.length;
    const b = p.b.reduce((s, m) => s + progress.muscles[m].monthXp, 0) / p.b.length;
    if (Math.max(a, b) < 80) continue;
    if (a > b * 1.6) out.push(`Your ${p.aName} ${p.aName.endsWith('s') ? 'are' : 'is'} progressing faster than your ${p.bName}.`);
    else if (b > a * 1.6) out.push(`Your ${p.bName} ${p.bName.endsWith('s') ? 'are' : 'is'} progressing faster than your ${p.aName}.`);
  }
  return out.slice(0, 2);
}

/** Home "RECENT PROGRESS": rep/weight gains vs previous session, XP gains, level-ups. */
export function recentProgress(progress, sessions, limit = 4) {
  const out = [];
  const done = sessions.filter((s) => s.status !== 'active').sort((a, b) => b.startedAt - a.startedAt).slice(0, 3);
  for (const s of done) {
    const res = progress.sessions[s.id];
    if (!res) continue;
    for (const lu of res.levelUps) out.push({ kind: 'level', big: `Level ${lu.to}`, text: MUSCLE_BY_ID[lu.muscle].name, t: s.startedAt });
    const seen = new Set();
    for (const set of s.sets) {
      if (seen.has(set.exerciseId)) continue;
      seen.add(set.exerciseId);
      const ex = EXERCISE_BY_ID[set.exerciseId];
      const st = progress.exercises[set.exerciseId];
      if (!ex || !st) continue;
      const idx = st.sessions.findIndex((x) => x.sessionId === s.id);
      if (idx <= 0) continue;
      const cur = st.sessions[idx], prev = st.sessions[idx - 1];
      const cs = cur.bestSet, ps = prev.bestSet;
      if (!cs || !ps) continue;
      if ((cs.weight || 0) > (ps.weight || 0)) out.push({ kind: 'weight', big: `+${kg(cs.weight - ps.weight)} kg`, text: ex.name, t: s.startedAt });
      else if ((cs.weight || 0) === (ps.weight || 0)) {
        const a = ex.metric === 'time' ? (cs.seconds ?? cs.reps) : cs.reps;
        const b = ex.metric === 'time' ? (ps.seconds ?? ps.reps) : ps.reps;
        if (a > b) out.push({ kind: 'reps', big: ex.metric === 'time' ? `+${a - b} s` : `+${a - b} ${a - b === 1 ? 'rep' : 'reps'}`, text: ex.name, t: s.startedAt });
      } else if (setScore(ex, cs) > setScore(ex, ps)) out.push({ kind: 'strength', big: 'Stronger', text: ex.name, t: s.startedAt });
    }
    const top = Object.entries(res.xpByMuscle).sort((a, b) => b[1] - a[1])[0];
    if (top) out.push({ kind: 'xp', big: `+${Math.round(top[1])} XP`, text: MUSCLE_BY_ID[top[0]].name, t: s.startedAt });
  }
  // keep variety: at most 2 of a kind
  const counts = {};
  return out.filter((o) => (counts[o.kind] = (counts[o.kind] || 0) + 1) <= 2).slice(0, limit);
}

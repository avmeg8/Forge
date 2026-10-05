/**
 * Exercise swaps — similar exercises you can do right now with your equipment.
 * Ranked by how closely they do the same job: same movement pattern, same main muscle,
 * listed easier/harder/related variations, then similar difficulty.
 */
import { EXERCISES, EXERCISE_BY_ID } from '../data/exercises.js';
import { isAvailable } from './equipment.js';

export function swapOptions(exerciseId, { caps, experience = 'beginner', exclude = [], limit = 10 } = {}) {
  const ex = EXERCISE_BY_ID[exerciseId];
  if (!ex) return [];
  const linked = new Set([...ex.easier, ...ex.harder, ...ex.related.map((r) => r.id)]);
  const skip = new Set([exerciseId, ...exclude]);
  const scored = [];
  for (const e of EXERCISES) {
    if (skip.has(e.id) || (caps && !isAvailable(e, caps))) continue;
    const samePattern = e.pattern === ex.pattern;
    const sameMain = e.primary[0] === ex.primary[0];
    const overlap = e.primary.filter((m) => ex.primary.includes(m)).length;
    if (!samePattern && !sameMain && !overlap) continue;
    let score = (samePattern ? 3 : 0) + (sameMain ? 2 : 0) + overlap + (linked.has(e.id) ? 1.5 : 0)
      - Math.abs(e.difficulty - ex.difficulty) * 0.6 + (e.metric === ex.metric ? 0.5 : -1);
    if (experience === 'beginner' && e.difficulty === 3) score -= 2;
    const why = samePattern ? 'Same movement' : sameMain ? 'Same main muscle' : 'Similar muscles';
    const tag = ex.easier.includes(e.id) ? 'Easier' : ex.harder.includes(e.id) ? 'Harder' : null;
    scored.push({ ex: e, score, why, tag });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

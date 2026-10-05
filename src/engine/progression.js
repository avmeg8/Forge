/**
 * Automatic progression — "NEXT TIME" recommendations (double progression).
 *
 *  1. Work inside a rep range (e.g. 8–12).
 *  2. When EVERY working set reaches the top of the range → add the smallest
 *     weight step your dumbbell allows.
 *  3. If you fall far short of the bottom of the range → drop one step.
 *  4. Otherwise keep the weight and add reps.
 *  Effort (reps in reserve, optional per set) sharpens this: sets that all felt easy at the
 *  top of the range earn a double step; grinding short of the range drops the weight.
 *  5. If the dumbbell is already at its max → exercise-specific alternatives
 *     (harder variation, unilateral version, tempo, pauses, extra set, more reps).
 *
 * Recommendations never leave the user's configured weight range.
 */
import { EXERCISE_BY_ID } from '../data/exercises.js';
import { nextWeightUp, nextWeightDown, snapWeight } from './equipment.js';
import { kg } from '../utils/format.js';

/** Optional per-set effort: reps you could still have done (reps in reserve). */
export const EFFORT = [
  { v: 4, label: 'Easy', sub: '4+ more' },
  { v: 2, label: 'Good', sub: '2–3 more' },
  { v: 1, label: 'Hard', sub: '1 more' },
  { v: 0, label: 'Max', sub: 'no more' },
];
export const effortLabel = (rir) => EFFORT.find((e) => e.v === rir)?.label || '';

function workingSets(ex, sets) {
  if (!sets?.length) return [];
  const amount = (s) => (ex.metric === 'time' ? s.seconds ?? s.reps : s.reps);
  // the heaviest weight used is the working weight
  const top = Math.max(...sets.map((s) => s.weight || 0));
  let work = sets.filter((s) => (s.weight || 0) === top);
  if (ex.unilateral) {
    // weaker side decides: pair L/R by set index and keep the lower value
    const bySet = {};
    for (const s of work) {
      const k = s.setIndex;
      if (!bySet[k] || amount(s) < amount(bySet[k])) bySet[k] = s;
    }
    work = Object.values(bySet);
  }
  return work.map((s) => ({ weight: s.weight || 0, amount: amount(s) || 0, rir: s.rir ?? null }));
}

/** Exercise-specific options when weight can't go up. */
export function maxedAlternatives(ex, target) {
  const out = [];
  const custom = ex.atMax || [];
  const harder = custom.filter((id) => EXERCISE_BY_ID[id]).concat(ex.harder.filter((id) => !custom.includes(id)));
  const uni = !ex.unilateral && ex.related.map((r) => EXERCISE_BY_ID[r.id]).find((r) => r && r.unilateral && r.pattern === ex.pattern);
  if (harder[0]) out.push({ kind: 'harder', exerciseId: harder[0], text: `Harder variation: ${EXERCISE_BY_ID[harder[0]].name}` });
  if (uni) out.push({ kind: 'unilateral', exerciseId: uni.id, text: `Unilateral variation: ${uni.name}` });
  out.push({ kind: 'tempo', text: 'Controlled tempo — 3 seconds down, 1-second pause' });
  if (ex.metric !== 'time') out.push({ kind: 'reps', text: `More reps — push past ${target.repMax}` });
  out.push({ kind: 'sets', text: `Add one extra set (${target.sets + 1} total)` });
  return out;
}

/**
 * @param exerciseId
 * @param sets        sets logged for this exercise in the most recent session
 * @param target      { sets, repMin, repMax }
 * @param cfg         weight config ({min,max,increment}) or null for bodyweight
 */
export function recommend(exerciseId, sets, target, cfg) {
  const ex = EXERCISE_BY_ID[exerciseId];
  if (!ex) return null;
  const t = {
    sets: target?.sets || ex.sets,
    repMin: target?.repMin ?? ex.reps[0],
    repMax: target?.repMax ?? ex.reps[1],
  };
  const work = workingSets(ex, sets);
  if (!work.length) {
    return { action: 'start', weight: cfg ? snapWeight(ex.startKg, cfg) : 0, headline: 'First time', text: 'Pick a weight you could lift for a few more reps than the target.' };
  }
  const weight = work[0].weight;
  const amounts = work.map((w) => w.amount);
  const allTop = amounts.length >= t.sets && amounts.every((a) => a >= t.repMax);
  const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const unit = ex.metric === 'time' ? ' s' : '';
  const loaded = !!cfg && ex.load !== 'bodyweight' && ex.load !== 'bands';
  const rirs = work.map((w) => w.rir).filter((r) => r != null);
  const rated = rirs.length >= Math.ceil(work.length / 2);
  const avgRir = rated ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null;
  const easy = rated && avgRir >= 3;
  const grind = rated && Math.min(...rirs) === 0;

  if (ex.metric === 'time') {
    if (allTop) {
      const up = loaded ? nextWeightUp(weight, cfg) : null;
      if (up) return { action: 'increase', weight: up, headline: `Try ${kg(up)} kg`, text: `You held ${t.repMax} s on every set. Add weight, back to ${t.repMin} s.` };
      return { action: 'max', weight, headline: 'Progress the hold', text: `You own ${t.repMax} s. Choose a harder progression:`, alternatives: maxedAlternatives(ex, t) };
    }
    const next = Math.min(t.repMax, Math.round(Math.max(...amounts) + 5));
    return { action: 'stay', weight, headline: `Aim for ${next} s`, text: `Same load, hold 5 s longer.` };
  }

  if (allTop) {
    if (!loaded) {
      return { action: 'max', weight: 0, headline: 'Level up the movement', text: `${t.sets} × ${t.repMax} done. Time for a harder version:`, alternatives: maxedAlternatives(ex, t) };
    }
    const up = nextWeightUp(weight, cfg);
    const up2 = up && easy ? nextWeightUp(up, cfg) : null;
    if (up2 && (up2 - weight) / weight <= 0.2) {
      return { action: 'increase', weight: up2, headline: `Try ${kg(up2)} kg`, text: `All sets hit ${t.repMax} and felt easy — skip a step and aim for ${t.repMin}+ reps.` };
    }
    if (up) {
      const jump = (up - weight) / weight;
      return {
        action: 'increase', weight: up,
        headline: `Try ${kg(up)} kg`,
        text: jump > 0.15
          ? `All sets hit ${t.repMax}. It's a big jump — aim for ${t.repMin}+ reps and build back up.`
          : `All sets hit ${t.repMax} reps. Add weight and aim for ${t.repMin}+ reps.`,
      };
    }
    return { action: 'max', weight, headline: 'Dumbbell maxed out', text: `${kg(weight)} kg is your heaviest setting. Keep progressing with:`, alternatives: maxedAlternatives(ex, t) };
  }

  if (loaded && (avg < t.repMin - 2 || (grind && avg < t.repMin))) {
    const down = nextWeightDown(weight, cfg);
    if (down) return { action: 'decrease', weight: down, headline: `Try ${kg(down)} kg`, text: `Reps were well below ${t.repMin}. A slightly lighter weight will build more strength.` };
  }

  const goal = amounts.map((a) => Math.min(t.repMax, a + (easy ? 2 : 1)));
  if (easy && loaded) {
    return { action: 'stay', weight, headline: `Stay at ${kg(weight)} kg`, text: `Those sets felt easy — push closer to your limit: aim for ${goal.join(', ')}.`, goal };
  }
  return {
    action: 'stay', weight,
    headline: loaded ? `Stay at ${kg(weight)} kg` : `Aim for ${goal.join(', ')}${unit}`,
    text: loaded ? `Add a rep where you can: aim for ${goal.join(', ')}.` : `Add a rep to each set until you reach ${t.repMax} on all ${t.sets}.`,
    goal,
  };
}

/**
 * Left / right comparison for a unilateral exercise. Small gaps are reported
 * neutrally; only consistent, larger gaps get a gentle suggestion.
 */
export function sideBalance(ex, sets) {
  if (!ex?.unilateral) return null;
  const amount = (s) => (ex.metric === 'time' ? s.seconds ?? s.reps : s.reps) || 0;
  const pairs = {};
  for (const s of sets) {
    if (!s.side) continue;
    (pairs[s.setIndex] ||= {})[s.side] = s;
  }
  const diffs = Object.values(pairs).filter((p) => p.L && p.R && (p.L.weight || 0) === (p.R.weight || 0)).map((p) => amount(p.L) - amount(p.R));
  if (!diffs.length) return null;
  const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const unit = ex.metric === 'time' ? 's' : avg === 1 || avg === -1 ? 'rep' : 'reps';
  const gap = Math.round(Math.abs(avg) * 10) / 10;
  if (gap < 0.5) return { level: 'even', text: 'Left and right are even.' };
  const weaker = avg > 0 ? 'Right' : 'Left';
  const n = Number.isInteger(gap) ? gap : gap.toFixed(1);
  if (gap < (ex.metric === 'time' ? 10 : 3)) return { level: 'small', weaker, text: `${weaker} side: ${n} ${unit} behind.` };
  return { level: 'notable', weaker, text: `${weaker} side: ${n} ${unit} behind. Start sets with your ${weaker.toLowerCase()} side and match its reps on the other.` };
}

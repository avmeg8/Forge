/**
 * Pure helpers for a workout in progress: where am I, what's next, what should
 * the weight/reps steppers show. Kept free of DOM so it's testable.
 */
import { EXERCISE_BY_ID } from '../data/exercises.js';
import { snapWeight } from './equipment.js';

export function itemSets(session, itemIndex) {
  return session.sets.filter((s) => s.itemIndex === itemIndex);
}

/** Progress inside one exercise: completed sets, next side, next set index. */
export function itemState(session, itemIndex) {
  const item = session.items[itemIndex];
  const ex = EXERCISE_BY_ID[item.exerciseId];
  const logged = itemSets(session, itemIndex);
  if (ex?.unilateral) {
    const done = logged.filter((s) => s.side === 'R').length;
    const pendingLeft = logged.filter((s) => s.side === 'L').length > done;
    return {
      done,
      setIndex: done,
      side: pendingLeft ? 'R' : 'L',
      complete: done >= item.sets && !pendingLeft,
      logged,
    };
  }
  return { done: logged.length, setIndex: logged.length, side: null, complete: logged.length >= item.sets, logged };
}

export function nextIncomplete(session, from = 0) {
  const n = session.items.length;
  for (let k = 0; k < n; k++) {
    const i = (from + k) % n;
    if (!itemState(session, i).complete) return i;
  }
  return -1;
}

export function totals(session) {
  let planned = 0, done = 0;
  session.items.forEach((it, i) => {
    planned += it.sets;
    done += Math.min(it.sets, itemState(session, i).done);
  });
  return { planned, done };
}

/**
 * Default stepper values for the next set:
 *   weight → last weight logged for this exercise today → planned weight → last
 *            session's recommendation → exercise start weight (all snapped to the range)
 *   reps   → same set last session → last reps today → bottom of the target range
 */
export function defaultDraft({ session, itemIndex, previous, recommendation, cfg }) {
  const item = session.items[itemIndex];
  const ex = EXERCISE_BY_ID[item.exerciseId];
  const st = itemState(session, itemIndex);
  const today = st.logged[st.logged.length - 1];
  const prevSet = previous?.sets.find((p) => p.setIndex === st.setIndex && (p.side || null) === (st.side || null))
    || previous?.sets[previous.sets.length - 1];
  let weight = 0;
  if (cfg) {
    const w = today?.weight ?? item.weight ?? recommendation?.weight ?? prevSet?.weight ?? ex.startKg;
    weight = snapWeight(w, cfg);
  }
  const amountOf = (s) => (ex.metric === 'time' ? s.seconds ?? s.reps : s.reps);
  let reps;
  if (st.side === 'R' && today?.side === 'L') reps = amountOf(today);
  else if (prevSet && (!cfg || (prevSet.weight || 0) === weight)) reps = amountOf(prevSet);
  else if (today) reps = amountOf(today);
  else reps = ex.metric === 'time' ? item.repMin : item.repMin;
  return ex.metric === 'time' ? { weight, seconds: reps, reps: 0 } : { weight, reps, seconds: 0 };
}

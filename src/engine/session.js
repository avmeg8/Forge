/**
 * Pure helpers for a workout in progress: where am I, what's next, what should
 * the weight/reps steppers show. Kept free of DOM so it's testable.
 */
import { EXERCISE_BY_ID } from '../data/exercises.js';
import { snapWeight } from './equipment.js';

/** Working sets of one exercise (warm-up sets never count towards the plan). */
export function itemSets(session, itemIndex) {
  return session.sets.filter((s) => s.itemIndex === itemIndex && !s.warmup);
}

export function warmupSets(session, itemIndex) {
  return session.sets.filter((s) => s.itemIndex === itemIndex && s.warmup);
}

/** Suggested warm-up: ~50% of the working weight, 8 reps (dumbbell exercises only). */
export function warmupSuggestion(workWeight, cfg) {
  if (!cfg || !workWeight) return null;
  const w = snapWeight(Math.max(cfg.min, workWeight * 0.5), cfg);
  return w < workWeight ? { weight: w, reps: 8 } : null;
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

/* ───────────── supersets & circuits ─────────────
 * Items that sit next to each other and share a `group` id form a block:
 * 2 items = superset, 3+ = circuit. You do one set of each in turn, then rest once.
 */
export function blocks(items) {
  const out = [];
  items.forEach((it, i) => {
    const last = out[out.length - 1];
    if (it.group && last && last.group === it.group) last.idx.push(i);
    else out.push({ group: it.group || null, idx: [i] });
  });
  return out.map((b) => (b.idx.length > 1 ? b : { group: null, idx: b.idx }));
}

export function blockOf(items, i) {
  return blocks(items).find((b) => b.idx.includes(i));
}

export const GROUP_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Label each linked block "A", "B"… → { itemIndex: 'A' } (singles get nothing). */
export function groupLabels(items) {
  const labels = {};
  let n = 0;
  for (const b of blocks(items)) {
    if (b.idx.length < 2) continue;
    const L = GROUP_LETTERS[n++ % 26];
    b.idx.forEach((i, k) => { labels[i] = `${L}${k + 1}`; });
  }
  return labels;
}

/** Give every adjacent run of grouped items a fresh, stable group id (after reordering/removal). */
export function normalizeGroups(items) {
  for (const b of blocks(items)) {
    if (b.idx.length < 2) b.idx.forEach((i) => { if (items[i].group) delete items[i].group; });
  }
  return items;
}

/**
 * Where to go after a completed (non-left-side) set of item i.
 * @returns { next: index | -1, rest: boolean } — rest=false means "go straight to the next exercise"
 */
export function afterSet(session, i) {
  const b = blockOf(session.items, i);
  if (!b || b.idx.length < 2) {
    const st = itemState(session, i);
    const next = st.complete ? nextIncomplete(session, i) : i;
    return { next, rest: true, transition: false };
  }
  const done = (k) => itemState(session, k).done;
  const pos = b.idx.indexOf(i);
  const round = done(i); // rounds completed by this exercise, including the set just logged
  // next member in this round that hasn't done its set yet
  for (let k = pos + 1; k < b.idx.length; k++) {
    const j = b.idx[k];
    if (!itemState(session, j).complete && done(j) < round) return { next: j, rest: false, transition: true };
  }
  // round finished → first incomplete member, after a rest
  const first = b.idx.find((j) => !itemState(session, j).complete);
  if (first != null) return { next: first, rest: true, transition: false };
  return { next: nextIncomplete(session, i), rest: true, transition: false };
}

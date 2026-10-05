/**
 * FORGE progression engine.
 *
 * Muscle XP, levels, PRs and per-exercise history are DERIVED by replaying every
 * completed session in chronological order. Nothing is stored twice, so editing
 * or deleting a workout can never leave progress out of sync.
 *
 * ─────────────────────────────── XP FORMULA ───────────────────────────────
 *
 * For every logged set, each muscle the exercise trains receives:
 *
 *   XP = BASE (10)
 *      × involvement      primary 1.0 · secondary 0.4
 *      × side             0.5 for each side of a unilateral exercise (L + R = one full set)
 *      × effort           rep/time quality — 1.0 for 3–30 reps (10–120 s holds), less for
 *                         token reps or endless high-rep sets
 *      × intensity        how hard the set was relative to YOUR best on this exercise
 *                         (estimated-1RM ratio): ≥85% → 1.0, 70–85% → 0.6–1.0, <70% → 0.35.
 *                         Light "junk" sets earn little.
 *      × overload         1.5 for the first set that beats your all-time best (1.25 for later
 *                         ones in the same session), 1.15 for beating last session's same set.
 *                         This is where progressive overload is rewarded.
 *      × strength         1.0 → 1.5 as your best on the exercise grows from your first-ever
 *                         performance to double it. Getting stronger makes every set worth more.
 *      × difficulty       0.9 beginner · 1.0 intermediate · 1.1 advanced exercise
 *                         (deload-week sessions are never scored below 0.9 here)
 *      × consistency      1 + 2% per streak day (max +20%) at the start of the session
 *      × weeklyVolume     per muscle, rolling 7 days: first 12 effective sets 1.0,
 *                         sets 12–20 0.5, beyond 20 → 0.15 (junk-volume protection)
 *      × sessionVolume    per muscle in one session: beyond 10 effective sets → 0.3
 *
 * Warm-up sets (set.warmup) earn no XP and never count for PRs or volume.
 *
 * Why it resists exploitation:
 *   • 100 light reps of anything → effort + intensity penalties.
 *   • Doing 40 sets → weekly / session volume caps.
 *   • Training every day → no extra streak credit beyond target+1 days/week, and volume caps.
 *   • The only reliable way to level faster is to train consistently and get stronger.
 * ────────────────────────────────────────────────────────────────────────────
 */
import { EXERCISE_BY_ID } from '../data/exercises.js';
import { MUSCLE_IDS } from '../data/muscles.js';
import { levelInfo } from './levels.js';
import { computeStreak } from './streak.js';
import { DAY } from '../utils/date.js';

export const XP_RULES = {
  BASE: 10,
  PRIMARY: 1,
  SECONDARY: 0.4,
  VOLUME_PRIMARY: 1, // effective-set counting
  VOLUME_SECONDARY: 0.5,
  WEEK_SOFT: 12,
  WEEK_HARD: 20,
  SESSION_CAP: 10,
  PR_FIRST: 1.5,
  PR_MORE: 1.25,
  BEAT_LAST: 1.15,
  DIFFICULTY: { 1: 0.9, 2: 1, 3: 1.1 },
};

/** Value of a set used for comparisons: Epley e1RM for reps, load-weighted time for holds. */
export function setScore(ex, set) {
  if (!ex || !set) return 0;
  const bodyLoad = ex.load === 'bodyweight' || ex.load === 'bands' ? ex.bwKg || 20 : 0;
  const load = (set.weight || 0) + bodyLoad;
  if (ex.metric === 'time') {
    const s = set.seconds ?? set.reps ?? 0;
    if (s <= 0) return 0;
    return (load || 10) * (1 + s / 60);
  }
  const r = set.reps || 0;
  if (r <= 0 || load <= 0) return 0;
  return r === 1 ? load : load * (1 + r / 30);
}

/** Estimated 1-rep max for loaded rep sets (shown in exercise history). */
export function e1rm(set) {
  if (!set?.weight || !set.reps) return 0;
  return set.reps === 1 ? set.weight : set.weight * (1 + set.reps / 30);
}

export function effortFactor(ex, set) {
  if (ex.metric === 'time') {
    const s = set.seconds ?? set.reps ?? 0;
    if (s < 10) return 0.3;
    if (s <= 120) return 1;
    if (s <= 240) return 0.7;
    return 0.4;
  }
  const r = set.reps || 0;
  if (r < 1) return 0;
  if (r < 3) return 0.6;
  if (r <= 30) return 1;
  if (r <= 50) return 0.6;
  return 0.3;
}

export function intensityFactor(ratio) {
  if (ratio == null || !Number.isFinite(ratio)) return 1;
  if (ratio >= 0.85) return 1;
  if (ratio >= 0.7) return 0.6 + ((ratio - 0.7) / 0.15) * 0.4;
  return 0.35;
}

function newMuscle() {
  return { xp: 0, history: [], events: [], lastTrained: null, lastSessionSets: 0, exerciseXp: {}, sessions: 0 };
}

function newExerciseStats() {
  return {
    sessions: [], // [{ sessionId, t, sets, bestScore, bestSet, volume, maxWeight }]
    bestScore: 0, bestSet: null, bestT: null,
    firstScore: 0,
    maxWeight: 0, maxWeightSet: null,
    repsAt: {}, // weight → max reps (or seconds for holds)
    bestVolume: 0,
    lastT: null,
  };
}

function setVolume(ex, s) {
  if (ex.metric === 'time') return (s.seconds ?? s.reps ?? 0) * Math.max(1, s.weight || 1);
  return s.weight ? s.weight * (s.reps || 0) : s.reps || 0;
}

function amount(ex, s) {
  return ex.metric === 'time' ? s.seconds ?? s.reps ?? 0 : s.reps || 0;
}

/**
 * Replay sessions and derive the full progress state.
 * @param sessions   completed sessions (any order) — an in-progress session may be included
 * @param settings   user settings (frequency, weekStart)
 * @param now        reference time for weekly figures
 */
export function computeProgress(sessions, settings = {}, now = Date.now()) {
  const muscles = Object.fromEntries(MUSCLE_IDS.map((id) => [id, newMuscle()]));
  const exercises = {};
  const sessionResults = {};
  const prs = [];
  const volumeLog = []; // [{ t, muscle, eff }] rolling window for weekly volume
  const trainingTimes = [];

  const ordered = [...sessions].filter((s) => s.sets?.length).sort((a, b) => a.startedAt - b.startedAt);

  for (const session of ordered) {
    const streakInfo = computeStreak(trainingTimes, settings.frequency, session.startedAt - 1, settings.weekStart ?? 1);
    const consistency = 1 + 0.02 * Math.min(streakInfo.streak, 10);
    const before = Object.fromEntries(MUSCLE_IDS.map((id) => [id, levelInfo(muscles[id].xp).level]));
    const res = { xpByMuscle: {}, setXp: {}, totalXp: 0, prs: [], levelUps: [], consistency, effSets: {} };
    const sessionEff = {}; // muscle → effective sets this session
    const sessionBest = {}; // exerciseId → best score so far in this session
    const prFlag = {}; // exerciseId → PR bonus already granted this session
    const prevSessionOf = {}; // exerciseId → previous session record (before this one)
    // warm-up sets are logged for reference only: no XP, no PRs, no volume
    for (const w of session.sets) if (w.warmup) res.setXp[w.id] = 0;
    const sets = session.sets.filter((x) => !x.warmup).sort((a, b) => a.ts - b.ts);
    if (!sets.length) { sessionResults[session.id] = res; continue; }

    for (const set of sets) {
      const ex = EXERCISE_BY_ID[set.exerciseId];
      if (!ex) continue;
      const st = (exercises[ex.id] ||= newExerciseStats());
      if (!(ex.id in prevSessionOf)) prevSessionOf[ex.id] = st.sessions[st.sessions.length - 1] || null;
      const score = setScore(ex, set);
      if (score <= 0) { res.setXp[set.id] = 0; continue; }

      const priorBest = st.bestScore; // from previous sessions only
      const ref = priorBest || sessionBest[ex.id] || 0;
      // deload weeks are light on purpose — don't treat those sets as junk
      const intensity = ref ? Math.max(intensityFactor(score / ref), session.deload ? 0.9 : 0) : 1;
      const effort = effortFactor(ex, set);

      // progressive overload
      let overload = 1;
      const bestSoFar = Math.max(priorBest, sessionBest[ex.id] || 0);
      if (priorBest > 0 && score > bestSoFar * 1.005) {
        overload = prFlag[ex.id] ? XP_RULES.PR_MORE : XP_RULES.PR_FIRST;
        prFlag[ex.id] = true;
      } else {
        const prev = prevSessionOf[ex.id];
        const match = prev?.sets.find((p) => p.setIndex === set.setIndex && (p.side || null) === (set.side || null));
        if (match && score > setScore(ex, match) * 1.005) overload = XP_RULES.BEAT_LAST;
      }
      sessionBest[ex.id] = Math.max(sessionBest[ex.id] || 0, score);

      const strength = st.firstScore ? 1 + 0.5 * Math.min(1, Math.max(0, priorBest / st.firstScore - 1)) : 1;
      const difficulty = XP_RULES.DIFFICULTY[ex.difficulty] || 1;
      const side = ex.unilateral ? 0.5 : 1;

      let setTotal = 0;
      const involve = [
        ...ex.primary.map((m) => [m, XP_RULES.PRIMARY, XP_RULES.VOLUME_PRIMARY]),
        ...ex.secondary.filter((m) => !ex.primary.includes(m)).map((m) => [m, XP_RULES.SECONDARY, XP_RULES.VOLUME_SECONDARY]),
      ];
      for (const [m, inv, volW] of involve) {
        if (!muscles[m]) continue;
        // weekly volume before this set (rolling 7 days)
        let week = 0;
        for (let i = volumeLog.length - 1; i >= 0; i--) {
          const v = volumeLog[i];
          if (set.ts - v.t > 7 * DAY) break;
          if (v.muscle === m) week += v.eff;
        }
        const weekly = week < XP_RULES.WEEK_SOFT ? 1 : week < XP_RULES.WEEK_HARD ? 0.5 : 0.15;
        const sessionVol = (sessionEff[m] || 0) < XP_RULES.SESSION_CAP ? 1 : 0.3;

        const xp = XP_RULES.BASE * inv * side * effort * intensity * overload * strength * difficulty * consistency * weekly * sessionVol;
        const eff = volW * side * (effort >= 0.6 && intensity >= 0.6 ? 1 : 0.5);
        sessionEff[m] = (sessionEff[m] || 0) + eff;
        volumeLog.push({ t: set.ts, muscle: m, eff });

        const mu = muscles[m];
        mu.xp += xp;
        mu.events.push({ t: set.ts, xp, eff });
        mu.exerciseXp[ex.id] = (mu.exerciseXp[ex.id] || 0) + xp;
        res.xpByMuscle[m] = (res.xpByMuscle[m] || 0) + xp;
        setTotal += xp;
      }
      res.setXp[set.id] = setTotal;
      res.totalXp += setTotal;
    }

    // ── per-exercise session summaries + PR detection (vs. previous sessions only) ──
    const byEx = {};
    for (const set of sets) if (EXERCISE_BY_ID[set.exerciseId]) (byEx[set.exerciseId] ||= []).push(set);
    const endT = session.endedAt || sets[sets.length - 1].ts;
    for (const [exId, exSets] of Object.entries(byEx)) {
      const ex = EXERCISE_BY_ID[exId];
      const st = exercises[exId];
      const hadHistory = st.sessions.length > 0;
      let bestScore = 0, bestSet = null, maxWeight = 0, maxWeightSet = null, volume = 0;
      const repsAt = {};
      for (const s of exSets) {
        const sc = setScore(ex, s);
        if (sc > bestScore) { bestScore = sc; bestSet = s; }
        if ((s.weight || 0) > maxWeight || (s.weight === maxWeight && amount(ex, s) > amount(ex, maxWeightSet || {}))) { maxWeight = s.weight || 0; maxWeightSet = s; }
        const wk = String(s.weight || 0);
        repsAt[wk] = Math.max(repsAt[wk] || 0, amount(ex, s));
        volume += setVolume(ex, s);
      }
      const found = [];
      if (hadHistory) {
        if (bestScore > st.bestScore * 1.005) found.push({ type: 'strength', set: bestSet, previous: st.bestSet });
        if (ex.load !== 'bodyweight' && ex.load !== 'bands' && maxWeight > st.maxWeight) {
          found.push({ type: 'weight', set: maxWeightSet, previous: st.maxWeightSet });
        }
        // rep (or hold-time) PR at a weight you've used before
        let bestGain = 0, repPr = null;
        for (const [wk, r] of Object.entries(repsAt)) {
          const prior = st.repsAt[wk];
          if (prior != null && r > prior && r - prior > bestGain) {
            bestGain = r - prior;
            const w = Number(wk);
            repPr = { type: ex.metric === 'time' ? 'time' : 'reps', set: exSets.find((s) => (s.weight || 0) === w && amount(ex, s) === r), previous: { weight: w, reps: prior, seconds: prior } };
          }
        }
        if (repPr) found.push(repPr);
        if (volume > st.bestVolume * 1.005 && st.bestVolume > 0) found.push({ type: 'volume', value: volume, previousValue: st.bestVolume, set: bestSet });
      }
      for (const p of found) {
        const pr = { ...p, exerciseId: exId, sessionId: session.id, t: endT };
        prs.push(pr);
        res.prs.push(pr);
      }

      // fold into stats
      if (!st.firstScore) st.firstScore = bestScore;
      if (bestScore > st.bestScore) { st.bestScore = bestScore; st.bestSet = bestSet; st.bestT = endT; }
      if (maxWeight > st.maxWeight || (maxWeight === st.maxWeight && amount(ex, maxWeightSet) > amount(ex, st.maxWeightSet || {}))) { st.maxWeight = maxWeight; st.maxWeightSet = maxWeightSet; }
      for (const [wk, r] of Object.entries(repsAt)) st.repsAt[wk] = Math.max(st.repsAt[wk] || 0, r);
      st.bestVolume = Math.max(st.bestVolume, volume);
      st.lastT = endT;
      st.sessions.push({ sessionId: session.id, t: endT, sets: exSets, bestScore, bestSet, volume, maxWeight });
    }

    // ── muscle bookkeeping ──
    for (const m of Object.keys(res.xpByMuscle)) {
      const mu = muscles[m];
      mu.lastTrained = endT;
      mu.lastSessionSets = sessionEff[m] || 0;
      mu.sessions++;
      const info = levelInfo(mu.xp);
      mu.history.push({ t: endT, xp: mu.xp, level: info.level });
      if (info.level > before[m]) {
        res.levelUps.push({ muscle: m, from: before[m], to: info.level, tier: info.tier, tierUp: levelInfo(mu.xp - res.xpByMuscle[m]).tier.id !== info.tier.id });
      }
    }
    res.effSets = sessionEff;
    sessionResults[session.id] = res;
    if (session.status !== 'active') trainingTimes.push(session.startedAt);
  }

  // ── weekly figures relative to `now` ──
  const weekAgo = now - 7 * DAY;
  for (const m of MUSCLE_IDS) {
    const mu = muscles[m];
    mu.info = levelInfo(mu.xp);
    mu.weekXp = 0;
    mu.weekSets = 0;
    for (const e of mu.events) if (e.t >= weekAgo && e.t <= now) { mu.weekXp += e.xp; mu.weekSets += e.eff; }
    mu.monthXp = mu.events.filter((e) => e.t >= now - 28 * DAY).reduce((a, e) => a + e.xp, 0);
    mu.bestExercise = Object.entries(mu.exerciseXp).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }

  return { muscles, exercises, sessions: sessionResults, prs, trainingTimes };
}

/** Last performance of an exercise before a given session (for "Previous: 20 kg × 10"). */
export function previousPerformance(progress, exerciseId, excludeSessionId) {
  const st = progress.exercises[exerciseId];
  if (!st) return null;
  for (let i = st.sessions.length - 1; i >= 0; i--) {
    if (st.sessions[i].sessionId !== excludeSessionId) return st.sessions[i];
  }
  return null;
}

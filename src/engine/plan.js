/**
 * Weekly plan rating — do your workouts, together, make a good week?
 *
 * Two modes:
 *   • Schedule — workouts pinned to weekdays (settings.schedule[weekday] = templateId).
 *     Each workout counts as often as it's scheduled, and back-to-back days that hammer
 *     the same muscles are flagged.
 *   • Rotation — no schedule: every saved workout marked "in weekly plan" is rotated to
 *     fill your training days (Settings → days per week), so with 3 workouts and 4 days a
 *     week each workout happens ~1.33× per week.
 *
 *   Coverage    35  Weekly effective sets per muscle vs. a productive range (by experience)
 *   Frequency   15  Each major muscle trained at least twice a week
 *   Balance     20  Opposing muscles (chest/back, quads/posterior chain, biceps/triceps…)
 *   Excess      10  No muscle buried in far more volume than it can use
 *   Sessions    10  Average quality of the individual workouts
 *   Spacing     10  (schedule only) no muscle trained hard on two days in a row
 */
import { MUSCLES, MUSCLE_BY_ID, SIZE_WEIGHT, OPPOSING_PAIRS } from '../data/muscles.js';
import { weeklyDose, resolveSplit, SPLIT_BY_ID } from '../data/splits.js';
import { muscleVolume, coverageScore, detectSplit } from './rating.js';
import { frequency } from './streak.js';

export const PLAN_WEIGHTS = { coverage: 35, frequency: 15, balance: 20, excess: 10, sessions: 10, spacing: 10 };
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Scheduled template ids that still exist, keyed by weekday (0 = Sunday). */
export function activeSchedule(schedule, templates) {
  const ids = new Set(templates.filter((t) => t.items?.length).map((t) => t.id));
  const out = {};
  for (let d = 0; d < 7; d++) if (schedule?.[d] && ids.has(schedule[d])) out[d] = schedule[d];
  return out;
}

// small helper muscles count less and are never "missing"
const ACCESSORY = new Set(['hip_flexors', 'adductors', 'forearms', 'lower_back', 'obliques']);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const listJoin = (arr) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`);

/**
 * @param templates  workouts in the plan (with items)
 * @param ctx        { settings, rateTemplate(t) }
 */
export function ratePlan(templates, ctx = {}) {
  const settings = ctx.settings || {};
  const experience = settings.experience || 'beginner';
  const sched = activeSchedule(ctx.schedule || settings.schedule, ctx.allTemplates || templates);
  const scheduled = Object.keys(sched).length > 0;
  const byId = Object.fromEntries((ctx.allTemplates || templates).map((t) => [t.id, t]));
  const list = scheduled ? [...new Set(Object.values(sched))].map((id) => byId[id]) : templates.filter((t) => t.items?.length);
  const days = scheduled ? Object.keys(sched).length : frequency(settings.frequency).target;
  const [lo, hi] = weeklyDose(experience);
  if (!list.length) {
    return { score: 0, grade: 'empty', label: 'No plan yet', headline: 'Add workouts to your weekly plan to see how your week adds up.', muscles: [], positives: [], improvements: [], perWeek: 0, days, workouts: [], scheduled };
  }
  const times = {}; // workout id → times per week
  for (const t of list) times[t.id] = scheduled ? Object.values(sched).filter((id) => id === t.id).length : days / list.length;
  const perWeek = scheduled ? null : days / list.length;
  const weekly = {};
  const freq = {};
  const ratings = list.map((t) => ({ t, r: ctx.rateTemplate ? ctx.rateTemplate(t) : null }));
  const effOf = {};
  for (const { t } of ratings) {
    const eff = (effOf[t.id] = muscleVolume(t.items));
    const n = times[t.id];
    for (const [m, e] of Object.entries(eff)) {
      weekly[m] = (weekly[m] || 0) + e * n;
      if (e >= 2) freq[m] = (freq[m] || 0) + n;
      else if (e >= 1) freq[m] = (freq[m] || 0) + n * 0.5;
    }
  }

  // ── spacing: the same muscles trained hard on consecutive days ──
  const clashes = [];
  if (scheduled) {
    for (let d = 0; d < 7; d++) {
      const a = sched[d];
      const b = sched[(d + 1) % 7];
      if (!a || !b) continue;
      const hit = MUSCLES.filter((m) => !ACCESSORY.has(m.id) && (effOf[a][m.id] || 0) >= 3 && (effOf[b][m.id] || 0) >= 3).map((m) => m.id);
      if (hit.length) clashes.push({ day: d, next: (d + 1) % 7, a, b, muscles: hit });
    }
  }

  const C = {};
  let cw = 0, cs = 0, fw = 0, fs = 0;
  const muscles = MUSCLES.map((m) => {
    const w = weekly[m.id] || 0;
    const sc = coverageScore(w, lo, hi);
    const weight = SIZE_WEIGHT[m.size] * (ACCESSORY.has(m.id) ? 0.4 : 1);
    cw += weight; cs += weight * (ACCESSORY.has(m.id) ? Math.max(sc, 0.6) : sc);
    if (!ACCESSORY.has(m.id) && w >= lo / 2) { fw += weight; fs += weight * Math.min(1, (freq[m.id] || 0) / 2); }
    const status = w <= 0 ? 'Missing' : w < lo * 0.6 ? 'Low' : w < lo ? 'Almost' : w <= hi ? 'On target' : w <= hi * 1.3 ? 'High' : 'Too much';
    return { id: m.id, name: m.short, weekly: Math.round(w * 10) / 10, freq: Math.round((freq[m.id] || 0) * 10) / 10, status, accessory: ACCESSORY.has(m.id) };
  });
  C.coverage = clamp01((cs / cw) ** 1.4);
  C.frequency = fw ? fs / fw : 0;

  const pairs = [];
  let bs = 0, bn = 0;
  for (const p of OPPOSING_PAIRS) {
    if (p.a.every((m) => ACCESSORY.has(m)) || p.b.every((m) => ACCESSORY.has(m))) continue;
    const A = p.a.reduce((s, m) => s + (weekly[m] || 0), 0) / p.a.length;
    const B = p.b.reduce((s, m) => s + (weekly[m] || 0), 0) / p.b.length;
    if (A < 2 && B < 2) continue;
    const sc = clamp01(Math.min(A, B) / Math.max(A, B) / 0.6);
    bs += sc; bn++;
    pairs.push({ ...p, A, B, score: sc });
  }
  C.balance = bn ? bs / bn : 0;
  const tooMuch = muscles.filter((m) => m.weekly > hi * 1.3);
  C.excess = clamp01(1 - 0.2 * tooMuch.length);
  C.sessions = ratings.every((x) => x.r) ? ratings.reduce((a, x) => a + x.r.score, 0) / ratings.length / 100 : 1;
  C.spacing = clamp01(1 - clashes.reduce((a, c) => a + 0.15 + 0.1 * Math.min(3, c.muscles.length), 0));

  let score = 0;
  for (const [k, w] of Object.entries(PLAN_WEIGHTS)) score += w * C[k];
  score = Math.round(Math.max(0, Math.min(100, score)));

  // where to put missing work: a workout whose focus includes that muscle, else the lightest one
  const homeFor = (m) => {
    const scored = ratings.map(({ t, r }) => {
      const sp = r?.split ? (r.split.auto ? SPLIT_BY_ID[r.split.id] : resolveSplit(t.focus, t.customMuscles)) : SPLIT_BY_ID[detectSplit(t.items)];
      const fits = sp ? (sp.target.includes(m) ? 2 : sp.support.includes(m) ? 1 : 0) : 0;
      return { t, fits, sets: r?.totalSets ?? 0 };
    }).sort((a, b) => b.fits - a.fits || a.sets - b.sets);
    return scored[0]?.fits ? scored[0].t : null;
  };

  const positives = [];
  const improvements = [];
  const onTarget = muscles.filter((m) => !m.accessory && ['On target', 'High'].includes(m.status));
  const majors = muscles.filter((m) => !m.accessory);
  if (onTarget.length >= majors.length - 1) positives.push('Every major muscle gets a productive weekly dose');
  else if (onTarget.length >= majors.length / 2) positives.push(`${onTarget.length} of ${majors.length} major muscles are in the ${lo}–${hi} weekly set range`);
  if (C.frequency >= 0.9) positives.push('Muscles are trained about twice a week — ideal for growth');
  if (C.balance >= 0.9) positives.push('Opposing muscles are well balanced across the week');
  if (C.sessions >= 0.85) positives.push('The individual workouts are well built');

  const missing = majors.filter((m) => m.status === 'Missing');
  const low = majors.filter((m) => m.status === 'Low' || m.status === 'Almost');
  for (const m of missing.slice(0, 3)) {
    const home = homeFor(m.id);
    improvements.push({ kind: 'add', muscle: m.id, text: `${MUSCLE_BY_ID[m.id].name} ${/s$/.test(MUSCLE_BY_ID[m.id].name) ? "aren't" : "isn't"} trained this week${home ? ` — add an exercise to “${home.name}”` : ' — add it to one of your workouts'}` });
  }
  if (low.length) {
    improvements.push({ kind: 'add', text: `Low weekly volume: ${listJoin(low.slice(0, 4).map((m) => `${m.name.toLowerCase()} (${m.weekly})`))} — aim for ${lo}–${hi} sets` });
  }
  const once = majors.filter((m) => m.weekly >= lo / 2 && m.freq < 1.5).map((m) => m.name.toLowerCase());
  if (once.length) improvements.push({ kind: 'warn', text: `${listJoin(once.slice(0, 4))} ${once.length === 1 ? 'is' : 'are'} trained about once a week — splitting the volume over two days works better` });
  for (const p of pairs.filter((x) => x.score < 0.7)) {
    const heavy = p.A > p.B ? p.aName : p.bName;
    const light = p.A > p.B ? p.bName : p.aName;
    improvements.push({ kind: 'warn', text: `Your week favours ${heavy} over ${light}` });
  }
  if (tooMuch.length) improvements.push({ kind: 'warn', text: `${listJoin(tooMuch.map((m) => m.name.toLowerCase()))}: more than ${Math.round(hi * 1.3)} sets a week — past the point of useful returns` });
  for (const c of clashes.slice(0, 2)) {
    const names = listJoin(c.muscles.slice(0, 3).map((m) => MUSCLE_BY_ID[m].short.toLowerCase()));
    improvements.push({ kind: 'warn', text: `${WEEKDAYS[c.day]} (${byId[c.a].name}) and ${WEEKDAYS[c.next]} (${byId[c.b].name}) both train ${names} hard — leave a day between them` });
  }
  if (scheduled && !clashes.length && days >= 3) positives.push('Muscles get a recovery day between hard sessions');
  if (!scheduled && list.length > days) improvements.push({ kind: 'warn', text: `${list.length} workouts in the plan but ${days} training days — each workout comes around less than once a week` });

  let grade, label;
  if (score >= 90) { grade = 'excellent'; label = 'Excellent'; }
  else if (score >= 80) { grade = 'good'; label = 'Good'; }
  else if (score >= 70) { grade = 'solid'; label = 'Solid'; }
  else if (score >= 55) { grade = 'fair'; label = 'Fair'; }
  else { grade = 'weak'; label = 'Needs work'; }
  const headline = score >= 90 ? 'An excellent, well-rounded week.'
    : score >= 80 ? 'A good week — a couple of tweaks away from excellent.'
      : score >= 70 ? 'A solid week with some gaps.'
        : score >= 55 ? 'Your week leaves some muscles behind.'
          : 'Your week needs more structure.';

  return {
    score, grade, label, headline, components: C, muscles, positives, improvements: improvements.slice(0, 6),
    perWeek, days, dose: [lo, hi], scheduled, schedule: sched, clashes, times,
    workouts: ratings.map(({ t, r }) => ({ id: t.id, name: t.name, score: r?.score, grade: r?.grade, split: r?.split?.name, times: times[t.id] })),
  };
}

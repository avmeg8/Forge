/**
 * Cross-screen flows: muscle detail sheet, "Train <muscle>", start-workout picker,
 * adding equipment, and body-map value builders.
 */
import { MUSCLE_BY_ID, MUSCLES } from '../data/muscles.js';
import { EXERCISE_BY_ID } from '../data/exercises.js';
import { EQUIPMENT_BY_ID } from '../data/equipment.js';
import { levelEmphasis } from '../components/bodymap.js';
import { bar, icon, levelBlock, scoreBadge } from '../components/ui.js';
import { lineChart, barChart } from '../components/charts.js';
import { esc, num, setLabel, plural } from '../utils/format.js';
import { relativeDay, DAY, startOfWeek, shortDate } from '../utils/date.js';
import { recoveryStatus } from '../engine/recovery.js';
import { exercisesForMuscle } from '../engine/insights.js';
import { availableExercises, capabilities } from '../engine/equipment.js';
import { levelInfo } from '../engine/levels.js';

/* ───────────── body map values ───────────── */
export function mapValues(progress, mode = 'level', now = Date.now()) {
  const out = {};
  const maxWeek = Math.max(1, ...MUSCLES.map((m) => progress.muscles[m.id].weekXp));
  const maxXp = Math.max(1, ...MUSCLES.map((m) => progress.muscles[m.id].xp));
  for (const m of MUSCLES) {
    const st = progress.muscles[m.id];
    const info = st.info;
    let t = 0;
    let extra = '';
    if (mode === 'level') {
      // Tier sets the base emphasis; position relative to your strongest muscle nudges it
      // ±0.125 so lagging muscles read darker and leading ones brighter at a glance.
      t = st.xp > 0 ? Math.max(0.1, Math.min(1, levelEmphasis(info) + 0.25 * (st.xp / maxXp - 0.5))) : 0;
    }
    else if (mode === 'recent') {
      if (st.lastTrained) {
        const days = (now - st.lastTrained) / DAY;
        t = Math.max(0.06, 1 - days / 8);
      }
      extra = `, last trained ${relativeDay(st.lastTrained, now).toLowerCase()}`;
    } else if (mode === 'weekly') {
      t = st.weekXp > 0 ? Math.max(0.1, st.weekXp / maxWeek) : 0;
      extra = `, ${Math.round(st.weekXp)} XP this week`;
    }
    out[m.id] = {
      t,
      aria: `${m.name}: ${info.tier.name}, Level ${info.level}, ${num(info.xpIntoLevel)} of ${num(info.xpForLevel)} XP, ${Math.round(info.progress * 100)}% to next level${extra}`,
    };
  }
  return out;
}

/* ───────────── muscle detail sheet ───────────── */
function muscleDetail(ctx, id, showHistory) {
  const { store } = ctx;
  const p = store.progress;
  const st = p.muscles[id];
  const info = st.info;
  const now = Date.now();
  const rec = recoveryStatus(st, now);

  // most-used exercises for this muscle (by XP contributed)
  const top = Object.entries(st.exerciseXp).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([exId, xp]) => ({ ex: EXERCISE_BY_ID[exId], xp })).filter((x) => x.ex);
  const best = top[0]?.ex;
  const exStats = best ? p.exercises[best.id] : null;
  const recentSessions = exStats ? exStats.sessions.slice(-3).reverse() : [];
  const recentSets = recentSessions.flatMap((s) => [...s.sets].sort((a, b) => (b.weight || 0) - (a.weight || 0) || (b.reps || 0) - (a.reps || 0)).slice(0, 1));

  let html = `
    <div class="card">${levelBlock(info)}
      <div class="row mt-12" style="gap:8px;flex-wrap:wrap">
        <span class="tag ${st.weekXp > 0 ? 'tag--good' : ''} num">+${num(st.weekXp)} XP this week</span>
        <span class="tag ${rec.level === 'limited' ? 'tag--warn' : ''}">${esc(rec.level === 'ready' && !st.lastTrained ? 'Not trained yet' : rec.label)}</span>
      </div>
    </div>`;

  if (best) {
    html += `<div class="section"><p class="eyebrow">Recent performance</p>
      <div class="card mt-8"><div class="row row--between"><b>${esc(best.name)}</b><button class="link" data-action="open-exercise" data-id="${best.id}">History</button></div>
      <div class="mt-8 stack small num">${recentSets.map((s) => `<div class="row row--between"><span>${esc(setLabel(s, best))}</span><span class="muted">${relativeDay(s.ts, now)}</span></div>`).join('')}</div></div></div>
      <div class="section"><p class="eyebrow">Best performance</p>
      <div class="card mt-8 row row--between"><span>${esc(best.name)}</span><b class="num">${esc(setLabel(exStats.bestSet, best))}</b></div></div>`;
  }

  html += `<div class="section"><p class="eyebrow">Training</p>
    <div class="kv mt-8">
      <div><span>Last trained</span><b>${esc(relativeDay(st.lastTrained, now))}</b></div>
      <div><span>Sets this week</span><b class="num">${Math.round(st.weekSets)}</b></div>
      <div><span>Total XP</span><b class="num">${num(st.xp)}</b></div>
      <div><span>Sessions</span><b class="num">${st.sessions}</b></div>
    </div></div>`;

  if (!st.lastTrained) {
    html += `<p class="small muted mt-16">${esc(MUSCLE_BY_ID[id].name)} starts at Beginner · Level 1. FORGE learns from your actual workouts — log a set that trains it and it starts levelling up.</p>`;
  }

  if (st.history.length) {
    if (!showHistory) {
      html += `<button class="btn btn--ghost btn--block mt-16" data-action="m-history">${icon.history} Show progress history</button>`;
    } else {
      const weeks = [];
      const w0 = startOfWeek(now, ctx.store.settings.weekStart);
      for (let i = 7; i >= 0; i--) {
        const start = w0 - i * 7 * DAY;
        const sets = st.events.filter((e) => e.t >= start && e.t < start + 7 * DAY).reduce((a, e) => a + e.eff, 0);
        weeks.push({ label: shortDate(start), v: Math.round(sets * 10) / 10 });
      }
      html += `<div class="section"><p class="eyebrow">XP over time</p><div class="card mt-8">${lineChart(st.history.map((h) => ({ t: h.t, v: h.xp })), { label: 'XP over time', minZero: true })}</div></div>
        <div class="section"><p class="eyebrow">Level over time</p><div class="card mt-8">${lineChart(st.history.map((h) => ({ t: h.t, v: h.level })), { label: 'Level over time', step: true })}</div></div>
        <div class="section"><p class="eyebrow">Weekly sets (8 weeks)</p><div class="card mt-8">${barChart(weeks, { label: 'Training frequency', fmt: (v) => Math.round(v) })}</div></div>
        <div class="section"><p class="eyebrow">Best exercises</p><div class="list mt-8">${top.map((t) => `<button class="item" data-action="open-exercise" data-id="${t.ex.id}"><div class="grow"><div class="item-title">${esc(t.ex.name)}</div><div class="item-sub num">${num(t.xp)} XP contributed</div></div>${icon.chev.replace('<svg', '<svg class="chev"')}</button>`).join('')}</div></div>`;
    }
  }
  return html;
}

/** Highlight a muscle on every visible body map without re-rendering. */
export function highlightMuscle(id) {
  document.querySelectorAll('#app .bm-muscle').forEach((g) => {
    const on = g.dataset.muscle === id;
    g.classList.toggle('is-selected', on);
    g.setAttribute('aria-pressed', String(on));
  });
}

export function openMuscleSheet(ctx, id) {
  const m = MUSCLE_BY_ID[id];
  if (!m) return;
  let showHistory = false;
  highlightMuscle(id);
  ctx.sheet.open({
    title: m.name,
    tall: false,
    render: () => muscleDetail(ctx, id, showHistory),
    foot: () => `<button class="btn btn--primary btn--lg btn--block" data-action="train-muscle" data-muscle="${id}">Train ${esc(m.short)}</button>`,
    actions: { 'm-history': () => { showHistory = true; ctx.sheet.refresh(); } },
    onClose: () => highlightMuscle(null),
  });
}

/** "TRAIN CHEST": build a short focused workout and open it in the builder — the user stays in control. */
export async function trainMuscle(ctx, id) {
  const { store } = ctx;
  const m = MUSCLE_BY_ID[id];
  const picks = exercisesForMuscle(id, { caps: store.caps, progress: store.progress, experience: store.settings.experience, limit: 3 });
  if (!picks.length) { ctx.toast(`No ${m.short.toLowerCase()} exercises match your equipment yet.`); return; }
  const t = store.newTemplate(`${m.short} Focus`, picks.map((e) => store.makeItem(e.id)));
  await store.saveTemplate(t);
  ctx.sheet.close();
  ctx.go(`#/builder/${t.id}`);
  ctx.toast(`Drafted a ${m.short.toLowerCase()} workout — adjust it any way you like.`);
}

/* ───────────── start workout ───────────── */
export async function startTemplate(ctx, id) {
  const { store } = ctx;
  if (store.state.active) {
    ctx.sheet.close();
    ctx.go('#/session');
    return;
  }
  const t = store.template(id);
  if (!t || !t.items.length) { ctx.toast('Add at least one exercise first.'); return; }
  await store.startSession(t);
  ctx.sheet.close();
  ctx.go('#/session');
}

export function openStartPicker(ctx) {
  const { store } = ctx;
  if (store.state.active) { ctx.go('#/session'); return; }
  const list = store.state.templates.filter((t) => t.items.length);
  if (!list.length) {
    import('./generate.js').then((m) => m.openGenerator(ctx));
    return;
  }
  ctx.sheet.open({
    title: 'Start workout',
    render: () => `<div class="list">${[...list].sort((a, b) => (b.lastPerformedAt || 0) - (a.lastPerformedAt || 0)).map((t) => {
      const r = store.rateTemplate(t);
      return `<button class="item" data-action="start-template" data-id="${t.id}">${scoreBadge(r)}
        <div class="grow"><div class="item-title ellipsis">${esc(t.name)}</div>
        <div class="item-sub">${plural(t.items.length, 'exercise')} · ~${r.estimatedMinutes} min${t.lastPerformedAt ? ` · ${esc(relativeDay(t.lastPerformedAt).toLowerCase())}` : ''}</div></div>${icon.play.replace('<svg', '<svg style="width:22px;color:var(--accent)"')}</button>`;
    }).join('')}</div>
    <div class="btn-row mt-12" style="display:flex;gap:8px"><button class="btn btn--ghost" style="flex:1" data-action="gen-from-picker">${icon.spark} Build one for me</button>
      <button class="btn btn--ghost" style="flex:1" data-action="new-from-picker">${icon.plus} New workout</button></div>`,
    actions: {
      'gen-from-picker': () => import('./generate.js').then((m) => m.openGenerator(ctx)),
      'new-from-picker': async () => {
        const t = store.newTemplate('New Workout');
        await store.saveTemplate(t);
        ctx.sheet.close();
        ctx.go(`#/builder/${t.id}`);
      },
    },
  });
}

/* ───────────── equipment ───────────── */
export async function addEquipment(ctx, itemId) {
  const { store } = ctx;
  const item = EQUIPMENT_BY_ID[itemId];
  if (!item) return;
  const before = availableExercises(store.caps).length;
  await store.updateProfile((p) => {
    p.items[itemId] = item.load ? { load: { ...item.load } } : {};
  });
  const gained = availableExercises(capabilities(store.profile)).length - before;
  if (ctx.sheet.isOpen && ctx.sheet.def?.live) ctx.sheet.refresh();
  ctx.toast(`${esc(item.name)} added${gained > 0 ? ` — ${gained} new exercises unlocked` : ''}.`, { kind: 'good' });
}

export function muscleLevelRow(id, st, { button = true } = {}) {
  const m = MUSCLE_BY_ID[id];
  const info = st.info || levelInfo(st.xp);
  const tag = button ? 'button' : 'div';
  return `<${tag} class="mlevel" ${button ? `data-action="muscle" data-muscle="${id}"` : ''} aria-label="${esc(m.name)}, ${info.tier.name} level ${info.level}">
    <div><div class="name">${esc(m.name)}</div><div class="meta">${info.tier.name}${st.weekXp > 0 ? ` · <span style="color:var(--good)">+${num(st.weekXp)} XP</span> this week` : ''}</div></div>
    <div class="lv">${info.level}</div>
    ${bar(info.progress, 'bar--thin')}
  </${tag}>`;
}

/** Exercise detail — how-to, personal best, recent performance, progression graph, related movements. */
import { appbar, icon, SAFETY_TEXT, demo } from '../components/ui.js';
import { lineChart } from '../components/charts.js';
import { EXERCISES, EXERCISE_BY_ID, relatedExercises, RELATION_LABEL } from '../data/exercises.js';
import { MUSCLE_BY_ID } from '../data/muscles.js';
import { isAvailable, missingFor, capabilityName, sourceItemFor } from '../engine/equipment.js';
import { e1rm } from '../engine/xp.js';
import { esc, kg, setLabel, repsRange } from '../utils/format.js';
import { relativeDay, shortDate } from '../utils/date.js';
import { DIFFICULTY } from './exercises.js';

export function exerciseInfoHtml(ex, { withDemo = true } = {}) {
  return `
    ${withDemo ? demo(ex, { cls: 'demo--lg' }) : ''}
    <div class="row mt-12" style="flex-wrap:wrap;gap:6px">
      ${ex.primary.map((m) => `<span class="tag tag--accent">${esc(MUSCLE_BY_ID[m].name)}</span>`).join('')}
      ${ex.secondary.map((m) => `<span class="tag">${esc(MUSCLE_BY_ID[m].name)}</span>`).join('')}
    </div>
    <div class="kv mt-12">
      <div><span>Target</span><b>${ex.sets} × ${repsRange(ex.reps[0], ex.reps[1], ex.metric)}</b></div>
      <div><span>Rest</span><b>${ex.rest} s</b></div>
      <div><span>Level</span><b>${DIFFICULTY[ex.difficulty]}</b></div>
      <div><span>Type</span><b>${ex.unilateral ? 'One side at a time' : 'Both sides'}</b></div>
    </div>
    <div class="section"><p class="eyebrow">How to</p><ol class="ol mt-8">${ex.instructions.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>
    ${ex.cues.length ? `<div class="section"><p class="eyebrow">Form cues</p><ul class="ul mt-8">${ex.cues.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
    ${ex.mistakes.length ? `<div class="section"><p class="eyebrow">Common mistakes</p><ul class="ul mt-8">${ex.mistakes.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
    ${ex.progression?.notes ? `<div class="section"><p class="eyebrow">How to progress</p><p class="text-2 mt-8" style="margin-bottom:0">${esc(ex.progression.notes)}</p></div>` : ''}
    <p class="safety mt-16">${esc(SAFETY_TEXT)}</p>`;
}

export default {
  tab: 'exercises',
  title: (ctx) => EXERCISE_BY_ID[ctx.route.id]?.name || 'Exercise',
  render(ctx) {
    const ex = EXERCISE_BY_ID[ctx.route.id];
    if (!ex) return `${appbar({ title: 'Exercise', back: true })}<div class="card">Exercise not found.</div>`;
    const { store } = ctx;
    const caps = store.caps;
    const ok = isAvailable(ex, caps);
    const st = store.progress.exercises[ex.id];
    const loaded = !!store.cfgFor(ex.id);

    let lockHtml = '';
    if (!ok) {
      const miss = missingFor(ex, caps);
      lockHtml = `<div class="card mt-12" style="border-color:rgba(231,180,83,.35)"><div class="lock">🔒 Requires: ${esc(miss.map(capabilityName).join(', '))}</div>
        <div class="row mt-12" style="flex-wrap:wrap;gap:8px">${miss.map((c) => sourceItemFor(c)).filter(Boolean).map((it) => `<button class="btn btn--sm" data-action="add-equipment" data-item="${it.id}">I have a ${esc(it.short.toLowerCase())}</button>`).join('')}</div></div>`;
    }

    let perf = '';
    if (st) {
      const rec = store.recommendationFor(ex.id, null);
      const recent = st.sessions.slice(-5).reverse();
      const series = st.sessions.map((s) => ({ t: s.t, v: loaded && ex.metric !== 'time' ? e1rm(s.bestSet) : ex.metric === 'time' ? (s.bestSet.seconds ?? s.bestSet.reps) : s.bestSet.reps }));
      const chartLabel = loaded && ex.metric !== 'time' ? 'Estimated 1-rep max (kg)' : ex.metric === 'time' ? 'Best hold (s)' : 'Best set (reps)';
      perf = `
        <section class="section"><p class="eyebrow">Personal best</p>
          <div class="card mt-8 pr-card"><span class="trophy" aria-hidden="true">🏆</span><div class="grow"><div style="font-size:24px;font-weight:800" class="num">${esc(setLabel(st.bestSet, ex))}</div>
          <div class="small muted">${esc(relativeDay(st.bestT))}${loaded && st.maxWeight ? ` · heaviest ${kg(st.maxWeight)} kg` : ''}</div></div></div></section>
        ${rec && rec.action !== 'start' ? `<section class="section"><p class="eyebrow">Next time</p><div class="card mt-8"><b style="font-size:18px">${esc(rec.headline)}</b><p class="small text-2" style="margin:6px 0 0">${esc(rec.text)}</p>
          ${rec.alternatives ? `<ul class="ul mt-8 small">${rec.alternatives.map((a) => `<li>${a.exerciseId ? `<button class="link" style="padding:0" data-action="go" data-href="#/exercise/${a.exerciseId}">${esc(a.text)}</button>` : esc(a.text)}</li>`).join('')}</ul>` : ''}</div></section>` : ''}
        <section class="section"><p class="eyebrow">Recent</p><div class="card mt-8 stack">${recent.map((s) => `<div class="row row--between"><span class="num">${s.sets.map((x) => esc(setLabel(x, ex)) + (x.side ? ` <span class="muted tiny">${x.side}</span>` : '')).slice(0, 4).join(' · ')}</span><span class="small muted" style="flex:none">${shortDate(s.t)}</span></div>`).join('')}</div></section>
        <section class="section"><p class="eyebrow">Progression · ${esc(chartLabel)}</p><div class="card mt-8">${lineChart(series, { label: chartLabel, fmt: (v) => (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10) })}</div></section>`;
    } else if (ok) {
      perf = `<div class="card mt-16 small muted">No sets logged yet. Your personal best and progression graph appear after your first workout with this exercise.</div>`;
    }

    // same movement pattern — history survives equipment changes
    const family = EXERCISES.filter((e) => e.pattern === ex.pattern && e.id !== ex.id && store.progress.exercises[e.id] && e.primary.some((m) => ex.primary.includes(m)));
    const familyHtml = family.length ? `<section class="section"><p class="eyebrow">Same movement — your history</p><div class="list mt-8">${family.map((e) => {
      const fst = store.progress.exercises[e.id];
      return `<button class="item" data-action="go" data-href="#/exercise/${e.id}"><div class="grow"><div class="item-title">${esc(e.name)}</div><div class="item-sub">Best ${esc(setLabel(fst.bestSet, e))} · ${esc(relativeDay(fst.lastT).toLowerCase())}</div></div>${icon.chev.replace('<svg', '<svg class="chev"')}</button>`;
    }).join('')}</div><p class="tiny muted mt-8">Muscle progress is shared across related exercises, so switching variations never resets your levels.</p></section>` : '';

    const rel = [
      ...ex.easier.map((id) => ({ id, label: 'Easier' })),
      ...ex.harder.map((id) => ({ id, label: 'Harder' })),
      ...relatedExercises(ex.id).map((r) => ({ id: r.id, label: RELATION_LABEL[r.type] || 'Related' })),
    ].filter((r, i, arr) => EXERCISE_BY_ID[r.id] && arr.findIndex((x) => x.id === r.id) === i);
    const relHtml = rel.length ? `<section class="section"><p class="eyebrow">Related exercises</p><div class="list mt-8">${rel.map((r) => {
      const e = EXERCISE_BY_ID[r.id];
      const avail = isAvailable(e, caps);
      return `<button class="item ${avail ? '' : 'item--locked'}" data-action="go" data-href="#/exercise/${e.id}"><div class="grow"><div class="item-title">${esc(e.name)}</div><div class="item-sub">${esc(r.label)}${avail ? '' : ` · 🔒 ${esc(missingFor(e, caps).map(capabilityName).join(', '))}`}</div></div>${icon.chev.replace('<svg', '<svg class="chev"')}</button>`;
    }).join('')}</div></section>` : '';

    return `${appbar({ title: ex.name, back: true })}
      ${demo(ex, { cls: 'demo--lg' })}
      ${lockHtml}
      ${perf}
      ${familyHtml}
      <section class="section"><div class="card">${exerciseInfoHtml(ex, { withDemo: false })}</div></section>
      ${relHtml}`;
  },
};

/** Week in review. #/week?w=0 (this week), ?w=1 (last week)… */
import { appbar, icon } from '../components/ui.js';
import { EXERCISE_BY_ID } from '../data/exercises.js';
import { MUSCLE_BY_ID } from '../data/muscles.js';
import { weekSummary } from '../engine/weekly.js';
import { esc, num, kg, setLabel, plural } from '../utils/format.js';

const PR_LABEL = { strength: 'Strength PR', weight: 'Weight PR', reps: 'Rep PR', time: 'Time PR' };

export function summaryFor(ctx, offset) {
  const { store } = ctx;
  return weekSummary({
    sessions: store.done, progress: store.progress, settings: store.settings, measures: store.measures,
    scheduledDays: Object.keys(store.schedule).length, offset,
  });
}

function change(pct) {
  if (pct == null) return '';
  if (pct === 0) return '<span class="chg">same as the week before</span>';
  return `<span class="chg ${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs the week before</span>`;
}

export default {
  tab: 'progress',
  title: 'Week in review',
  render(ctx) {
    const offset = Math.max(0, Number(ctx.route.query.w) || 0);
    const w = summaryFor(ctx, offset);
    const dots = Array.from({ length: Math.max(w.target, w.count) }, (_, i) => `<i class="${i < w.count ? 'on' : ''}"></i>`).join('');
    const nav = `<div class="week-nav"><button class="icon-btn" data-action="wk-go" data-w="${offset + 1}" aria-label="Previous week">${icon.back}</button>
      <div class="grow center"><div class="item-title">${esc(w.label)}</div><div class="tiny muted">${esc(w.range)}</div></div>
      <button class="icon-btn" data-action="wk-go" data-w="${offset - 1}" aria-label="Next week" ${offset === 0 ? 'disabled' : ''}>${icon.chev}</button></div>`;
    if (!w.sessions.length) {
      return `${appbar({ title: 'Week in review', back: true })}${nav}
        <div class="card empty mt-12">${icon.calendar}<h3>${esc(w.headline)}</h3><p class="small">${w.prev.count ? `The week before: ${plural(w.prev.count, 'training day')}, ${num(w.prev.xp)} XP.` : 'Finished workouts show up here.'}</p></div>`;
    }
    const prs = w.prs.length ? `<section class="section"><p class="eyebrow">Personal records</p><div class="card card--flush mt-8">${w.prs.map((p) => {
      const ex = EXERCISE_BY_ID[p.exerciseId];
      return `<div class="eq-row"><span aria-hidden="true">🏆</span><div class="grow"><div class="item-title">${esc(ex?.name || p.exerciseId)}</div><div class="item-sub">${PR_LABEL[p.type] || 'PR'} · ${esc(setLabel(p.set, ex))}${p.previous ? ` <span class="muted">(was ${esc(setLabel(p.previous, ex))})</span>` : ''}</div></div></div>`;
    }).join('')}</div></section>` : '';
    const lv = w.levelUps.length ? `<section class="section"><p class="eyebrow">Level ups</p><div class="card card--flush mt-8">${w.levelUps.map((l) => `<button class="mlevel" data-action="muscle" data-muscle="${l.muscle}"><div><div class="name">${esc(MUSCLE_BY_ID[l.muscle].name)}</div><div class="meta">Level ${l.from} → ${l.to}${l.tierUp ? ` · new tier: ${esc(l.tier.name)}` : ''}</div></div><div class="lv">${l.to}</div></button>`).join('')}</div></section>` : '';
    const top = w.topMuscles.length ? `<section class="section"><p class="eyebrow">Most trained</p><div class="card mt-8">${w.topMuscles.map((m, k) => `<div class="row row--between ${k ? 'mt-8' : ''}"><span>${esc(m.name)}</span><b class="num" style="color:var(--accent-2)">+${num(m.xp)} XP</b></div>`).join('')}
      ${w.untrained.length ? `<p class="small muted mt-12" style="margin-bottom:0">Not trained this week: ${esc(w.untrained.join(', '))}.</p>` : ''}</div></section>` : '';
    const bw = w.bodyWeight ? `<p class="small text-2 mt-12" style="margin-bottom:0">Body weight: <b>${kg(w.bodyWeight.to)} kg</b>${w.bodyWeight.to !== w.bodyWeight.from ? ` (${w.bodyWeight.to > w.bodyWeight.from ? '+' : ''}${kg(Math.round((w.bodyWeight.to - w.bodyWeight.from) * 10) / 10)} kg)` : ''}</p>` : '';
    return `${appbar({ title: 'Week in review', back: true })}${nav}
      <div class="card ${w.complete ? 'card--deload' : 'card--accent'} mt-12">
        <p class="eyebrow">${w.complete ? 'Plan complete' : 'Training days'}</p>
        <h2 style="margin:6px 0 10px;font-size:21px">${esc(w.headline)}</h2>
        <div class="week-dots" aria-hidden="true">${dots}</div>
        <div class="stat-grid mt-12">
          <div class="stat"><b class="num">${w.sets}</b><span>sets</span></div>
          <div class="stat"><b class="num" style="color:var(--accent-2)">+${num(w.xp)}</b><span>XP</span></div>
          <div class="stat"><b class="num">${w.minutes}</b><span>minutes</span></div>
        </div>
        ${bw}
        <p class="small mt-8" style="margin-bottom:0">${change(w.change.xp)}</p>
      </div>
      ${prs}${lv}${top}
      <section class="section"><p class="eyebrow">Workouts</p><div class="list mt-8">${w.sessions.map((s) => `<button class="item" data-action="go" data-href="#/summary/${s.id}">
        <div class="grow" style="min-width:0"><div class="item-title ellipsis">${esc(s.name)}</div><div class="item-sub">${esc(new Date(s.startedAt).toLocaleDateString('en-GB', { weekday: 'long' }))} · ${plural(s.sets.filter((x) => !x.warmup).length, 'set')}</div></div>${icon.chev.replace('<svg', '<svg class="chev"')}</button>`).join('')}</div></section>`;
  },
  actions: {
    'wk-go': (ctx, el) => ctx.go(`#/week?w=${Math.max(0, Number(el.dataset.w))}`, { replace: true }),
  },
};

/** Home card: last week's review, shown for the first days of a new week. */
export function weekCard(ctx) {
  const { store } = ctx;
  const w = summaryFor(ctx, 1);
  const daysIn = Math.floor((Date.now() - w.to) / 86400000);
  if (!w.sessions.length || daysIn > 2 || store.settings.weekCardSeen === w.from) return '';
  return `<section class="section"><div class="card row" style="gap:12px;align-items:flex-start">
    <span class="feature-ic">${icon.calendar}</span><div class="grow" style="min-width:0"><div class="item-title">Last week in review</div>
    <p class="small text-2" style="margin:4px 0 10px">${w.count} of ${w.target} training days · +${num(w.xp)} XP${w.prs.length ? ` · ${plural(w.prs.length, 'PR')}` : ''}${w.levelUps.length ? ` · ${plural(w.levelUps.length, 'level up')}` : ''}</p>
    <button class="btn btn--sm btn--primary" data-action="h-week" data-from="${w.from}">See the week</button></div>
    <button class="icon-btn" data-action="h-week-dismiss" data-from="${w.from}" aria-label="Dismiss">${icon.close}</button></div></section>`;
}

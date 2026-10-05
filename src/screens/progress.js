/** Progress — the body map is the centrepiece; then every muscle's tier, level and XP. */
import { appbar, icon } from '../components/ui.js';
import { bodyMap, emphasisColor } from '../components/bodymap.js';
import { MUSCLES } from '../data/muscles.js';
import { weakMuscles, balanceObservations } from '../engine/insights.js';
import { esc, num } from '../utils/format.js';
import { mapValues, muscleLevelRow } from './shared.js';

const SORTS = {
  level: ['Level', (a, b) => b.s.xp - a.s.xp],
  progress: ['XP progress', (a, b) => b.s.info.progress - a.s.info.progress],
  recent: ['Recent activity', (a, b) => (b.s.lastTrained || 0) - (a.s.lastTrained || 0)],
  weakest: ['Weakest', (a, b) => a.s.xp - b.s.xp],
  strongest: ['Strongest', (a, b) => b.s.info.level - a.s.info.level || b.s.xp - a.s.xp],
};

function ui(ctx) { return (ctx.ui.progress ||= { view: 'front', mode: 'level', sort: 'level' }); }

function legend(mode) {
  if (mode === 'level') {
    return `<div class="bm-legend" aria-hidden="true">${[['Untrained', 0], ['Beginner', 0.25], ['Intermediate', 0.46], ['Advanced', 0.72], ['Elite', 0.95]].map(([n, t]) => `<span><i style="background:${emphasisColor(t, 'level')}"></i>${n}</span>`).join('')}</div>`;
  }
  if (mode === 'recent') {
    return `<div class="bm-legend" aria-hidden="true">${[['Today', 1], ['3 days', 0.62], ['1 week', 0.12], ['Not trained', 0]].map(([n, t]) => `<span><i style="background:${emphasisColor(t, 'recent')}"></i>${n}</span>`).join('')}</div>`;
  }
  return `<div class="bm-legend" aria-hidden="true">${[['None', 0], ['Some', 0.4], ['Most this week', 1]].map(([n, t]) => `<span><i style="background:${emphasisColor(t, 'weekly')}"></i>${n}</span>`).join('')}</div>`;
}

export default {
  tab: 'progress',
  title: 'Progress',
  render(ctx) {
    const u = ui(ctx);
    const { store } = ctx;
    const p = store.progress;
    const done = store.done;
    const totalSets = done.reduce((a, s) => a + s.sets.length, 0);
    const weekXp = MUSCLES.reduce((a, m) => a + p.muscles[m.id].weekXp, 0);
    const avgLevel = MUSCLES.reduce((a, m) => a + p.muscles[m.id].info.level, 0) / MUSCLES.length;

    const weak = weakMuscles(p, { caps: store.caps, experience: store.settings.experience, sessionsCount: done.length });
    const obs = balanceObservations(p);
    const insights = weak.length || obs.length ? `<section class="section"><p class="eyebrow">Muscles to focus on</p>
      ${weak.length ? `<div class="card card--flush mt-8">${weak.map((w) => `<button class="mlevel" data-action="muscle" data-muscle="${w.id}"><div><div class="name">${esc(w.name)}</div><div class="meta">Level ${w.level} · ${esc(w.text)}${w.suggestion ? ` Try ${esc(w.suggestion.name)}.` : ''}</div></div><div class="lv">${w.level}</div></button>`).join('')}</div>` : ''}
      ${obs.map((o) => `<div class="card mt-8 small text-2">${esc(o)}</div>`).join('')}</section>` : '';

    const rows = MUSCLES.map((m) => ({ m, s: p.muscles[m.id] })).sort(SORTS[u.sort][1]);

    return `${appbar({ title: 'Your body', right: `<button class="icon-btn" data-action="go" data-href="#/settings" aria-label="Settings">${icon.gear}</button>` })}
      <div class="bm-controls">
        <div class="seg" role="group" aria-label="Body view"><button data-action="p-view" data-v="front" aria-pressed="${u.view === 'front'}">Front</button><button data-action="p-view" data-v="back" aria-pressed="${u.view === 'back'}">Back</button></div>
        <div class="seg" role="group" aria-label="Map mode"><button data-action="p-mode" data-v="level" aria-pressed="${u.mode === 'level'}">Level</button><button data-action="p-mode" data-v="recent" aria-pressed="${u.mode === 'recent'}">Recent</button><button data-action="p-mode" data-v="weekly" aria-pressed="${u.mode === 'weekly'}">Weekly XP</button></div>
      </div>
      <div class="card" style="padding:14px 10px">
        <div id="p-map">${bodyMap({ view: u.view, values: mapValues(p, u.mode), mode: u.mode, cls: 'bm-lg' })}</div>
        ${legend(u.mode)}
        <p class="bm-hint">Tap any muscle for details</p>
      </div>
      <div class="stat-grid mt-12">
        <div class="stat"><b>${done.length}</b><span>workouts</span></div>
        <div class="stat"><b>${num(weekXp)}</b><span>XP this week</span></div>
        <div class="stat"><b>${avgLevel.toFixed(1)}</b><span>avg level</span></div>
      </div>
      ${!done.length ? `<p class="small muted mt-12 center">All 18 muscles start at Beginner · Level 1. Finish a workout and watch them develop.</p>` : ''}
      ${insights}
      <section class="section"><div class="section-head"><p class="eyebrow">Muscle levels</p>
        <label class="small muted row" style="gap:6px">Sort <select class="input" style="min-height:36px;width:auto;font-size:13.5px;padding:0 30px 0 10px;background-position:calc(100% - 14px) 15px, calc(100% - 9px) 15px" data-change="p-sort" aria-label="Sort muscles">
          ${Object.entries(SORTS).map(([k, [n]]) => `<option value="${k}" ${u.sort === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
        <div class="card card--flush">${rows.map(({ m, s }) => muscleLevelRow(m.id, s)).join('')}</div>
      </section>
      <p class="tiny muted center mt-16">${totalSets} sets logged in total</p>`;
  },
  actions: {
    'p-view': (ctx, el) => {
      const u = ui(ctx);
      u.view = el.dataset.v;
      // instant switch without re-rendering the map
      document.querySelector('#p-map .bodymap')?.setAttribute('data-view', u.view);
      document.querySelectorAll('#p-map .bm-face').forEach((f) => {
        const isOn = f.classList.contains(`bm-face--${u.view}`);
        f.toggleAttribute('inert', !isOn);
        f.setAttribute('aria-hidden', String(!isOn));
      });
      document.querySelectorAll('[data-action="p-view"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === u.view)));
    },
    'p-mode': (ctx, el) => { ui(ctx).mode = el.dataset.v; ctx.render(); },
  },
  changes: {
    'p-sort': (ctx, el) => { ui(ctx).sort = el.value; ctx.render(); },
  },
};

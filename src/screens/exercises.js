/** Exercise library — filtered by the user's equipment, with an optional "All" view. */
import { appbar, icon } from '../components/ui.js';
import { EXERCISES } from '../data/exercises.js';
import { GROUPS, GROUP_MUSCLES, MUSCLE_BY_ID } from '../data/muscles.js';
import { isAvailable, missingFor, capabilityName, sourceItemFor, unlockSuggestions } from '../engine/equipment.js';
import { esc, setLabel } from '../utils/format.js';

export const DIFFICULTY = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced' };

export function filterExercises({ query = '', group = 'all', scope = 'available', caps }) {
  const q = query.trim().toLowerCase();
  const gm = group !== 'all' ? new Set(GROUP_MUSCLES[group]) : null;
  return EXERCISES
    .filter((e) => scope === 'all' || isAvailable(e, caps))
    .filter((e) => !gm || e.primary.some((m) => gm.has(m)))
    .filter((e) => !q || e.name.toLowerCase().includes(q) || [...e.primary, ...e.secondary].some((m) => MUSCLE_BY_ID[m].name.toLowerCase().includes(q)))
    .sort((a, b) => {
      const av = isAvailable(a, caps) ? 0 : 1, bv = isAvailable(b, caps) ? 0 : 1;
      if (av !== bv) return av - bv;
      if (gm) {
        const ap = gm.has(a.primary[0]) ? 0 : 1, bp = gm.has(b.primary[0]) ? 0 : 1;
        if (ap !== bp) return ap - bp;
      }
      return a.difficulty - b.difficulty || a.name.localeCompare(b.name);
    });
}

/** One library row. `action` decides what tapping does (open details / add to workout). */
export function exerciseRow(e, { caps, action = 'open-exercise', added = 0, best = null } = {}) {
  const ok = isAvailable(e, caps);
  const muscles = e.primary.map((m) => MUSCLE_BY_ID[m].short).join(', ');
  const sub = `${esc(muscles)} · ${DIFFICULTY[e.difficulty]}${e.unilateral ? ' · L/R' : ''}${e.metric === 'time' ? ' · Timed' : ''}`;
  if (!ok) {
    const miss = missingFor(e, caps);
    const src = sourceItemFor(miss[0]);
    return `<div class="item item--locked">
      <button class="grow" style="background:none;border:0;padding:0;text-align:left;min-width:0" data-action="open-exercise" data-id="${e.id}">
        <div class="item-title ellipsis">${esc(e.name)}</div><div class="item-sub">${sub}</div>
        <div class="lock mt-8">🔒 Requires: ${esc(miss.map(capabilityName).join(', '))}</div></button>
      ${src ? `<button class="btn btn--sm" data-action="add-equipment" data-item="${src.id}">Add ${esc(src.short)}</button>` : ''}
    </div>`;
  }
  const right = added
    ? `<span class="tag tag--good">${icon.check.replace('<svg', '<svg style="width:14px"')} ${added > 1 ? `×${added}` : 'Added'}</span>`
    : action === 'b-add' ? `<span class="icon-btn" aria-hidden="true" style="color:var(--accent)">${icon.plus}</span>`
      : best ? `<span class="small num text-2">${esc(best)}</span>` : icon.chev.replace('<svg', '<svg class="chev"');
  return `<button class="item" data-action="${action}" data-id="${e.id}" ${action === 'b-add' ? `aria-label="Add ${esc(e.name)}"` : ''}>
    <div class="grow" style="min-width:0"><div class="item-title ellipsis">${esc(e.name)}</div><div class="item-sub ellipsis">${sub}</div></div>${right}</button>`;
}

export function filterBar(state, prefix) {
  return `<div class="search"><input class="input" type="search" placeholder="Search exercises or muscles" value="${esc(state.query)}" data-input="${prefix}-search" aria-label="Search exercises" enterkeyhint="search">${icon.search}</div>
    <div class="chips mt-12" role="toolbar" aria-label="Filter by muscle group">
      ${[{ id: 'all', name: 'All' }, ...GROUPS].map((g) => `<button class="chip" data-action="${prefix}-group" data-v="${g.id}" aria-pressed="${state.group === g.id}">${g.name}</button>`).join('')}
    </div>
    <div class="seg mt-12"><button data-action="${prefix}-scope" data-v="available" aria-pressed="${state.scope === 'available'}">My equipment</button><button data-action="${prefix}-scope" data-v="all" aria-pressed="${state.scope === 'all'}">All exercises</button></div>`;
}

function st(ctx) {
  return (ctx.ui.exercises ||= { query: '', group: 'all', scope: 'available' });
}

function results(ctx) {
  const s = st(ctx);
  const { store } = ctx;
  const list = filterExercises({ ...s, caps: store.caps });
  const p = store.progress;
  if (!list.length) return `<p class="muted center mt-24">No exercises match.</p>`;
  return `<p class="small muted" style="margin:0 2px 8px">${list.length} exercises</p><div class="list">${list.map((e) => {
    const best = p.exercises[e.id]?.bestSet;
    return exerciseRow(e, { caps: store.caps, best: best ? setLabel(best, e) : null });
  }).join('')}</div>`;
}

export default {
  tab: 'exercises',
  title: 'Exercises',
  render(ctx) {
    const s = st(ctx);
    const { store } = ctx;
    const unlocks = unlockSuggestions(store.profile).filter((u) => u.gain > 0).slice(0, 3);
    return `${appbar({ title: 'Exercises', right: `<button class="icon-btn" data-action="go" data-href="#/settings" aria-label="Settings">${icon.gear}</button>` })}
      ${filterBar(s, 'x')}
      <div class="mt-16" id="x-results">${results(ctx)}</div>
      ${unlocks.length ? `<section class="section"><p class="eyebrow">Unlock more exercises</p>
        <div class="card card--flush mt-8">${unlocks.map((u) => `<div class="eq-row"><div class="grow"><div class="item-title">${esc(u.item.name)}</div><div class="item-sub">+${u.gain} exercises</div></div><button class="btn btn--sm" data-action="add-equipment" data-item="${u.item.id}">I have this</button></div>`).join('')}</div>
        <p class="tiny muted mt-8">Only add equipment you actually own — FORGE never pushes purchases.</p></section>` : ''}`;
  },
  actions: {
    'x-group': (ctx, el) => { st(ctx).group = el.dataset.v; ctx.render(); },
    'x-scope': (ctx, el) => { st(ctx).scope = el.dataset.v; ctx.render(); },
  },
  inputs: {
    'x-search': (ctx, el) => {
      st(ctx).query = el.value;
      document.getElementById('x-results').innerHTML = results(ctx);
    },
  },
};

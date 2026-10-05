/** Workouts — my saved workouts + training history. */
import { appbar, icon, scoreBadge, empty } from '../components/ui.js';
import { planCard } from './plan.js';
import { openGenerator } from './generate.js';
import { esc, plural, duration, num } from '../utils/format.js';
import { dayHeading, dayKey, relativeDay } from '../utils/date.js';

function tab(ctx) {
  return ctx.route.query.tab === 'history' ? 'history' : 'mine';
}

export default {
  tab: 'workouts',
  title: 'Workouts',
  render(ctx) {
    const t = tab(ctx);
    return `${appbar({ title: 'Workouts', right: `<button class="icon-btn" data-action="go" data-href="#/settings" aria-label="Settings">${icon.gear}</button>` })}
      <div class="seg" role="tablist">
        <button role="tab" aria-selected="${t === 'mine'}" data-action="w-tab" data-v="mine">My workouts</button>
        <button role="tab" aria-selected="${t === 'history'}" data-action="w-tab" data-v="history">History</button>
      </div>
      <div class="mt-16">${t === 'mine' ? mine(ctx) : history(ctx)}</div>`;
  },
  actions: {
    'w-tab': (ctx, el) => ctx.go(el.dataset.v === 'history' ? '#/workouts?tab=history' : '#/workouts', { replace: true }),
    'w-new': async (ctx) => {
      const t = ctx.store.newTemplate('New Workout');
      await ctx.store.saveTemplate(t);
      ctx.go(`#/builder/${t.id}`);
    },
    'w-gen': (ctx) => openGenerator(ctx),
    'w-more': (ctx, el) => {
      const t = ctx.store.template(el.dataset.id);
      if (!t) return;
      ctx.sheet.open({
        title: t.name,
        render: () => `<div class="list">
          <button class="item" data-action="w-edit">${icon.edit}<span class="grow item-title">Edit workout</span></button>
          <button class="item" data-action="w-dup">${icon.copy}<span class="grow item-title">Duplicate</span></button>
          <button class="item" data-action="w-plan">${icon.list}<span class="grow item-title">${t.inPlan === false ? 'Add to weekly plan' : 'Remove from weekly plan'}</span></button>
          <button class="item" data-action="w-del" style="color:var(--bad)">${icon.trash}<span class="grow item-title">Delete</span></button></div>`,
        actions: {
          'w-edit': () => { ctx.sheet.close(); ctx.go(`#/builder/${t.id}`); },
          'w-plan': async () => { t.inPlan = t.inPlan === false; await ctx.store.saveTemplate(t); ctx.sheet.close(); ctx.toast(t.inPlan ? 'Added to your weekly plan.' : 'Removed from your weekly plan.'); },
          'w-dup': async () => {
            const copy = ctx.store.newTemplate(`${t.name} (copy)`, t.items.map((i) => ctx.store.makeItem(i.exerciseId, { sets: i.sets, repMin: i.repMin, repMax: i.repMax, weight: i.weight, ...(i.group ? { group: i.group } : {}) })));
            copy.focus = t.focus || 'auto'; copy.customMuscles = [...(t.customMuscles || [])];
            copy.targetMinutes = t.targetMinutes;
            await ctx.store.saveTemplate(copy);
            ctx.sheet.close();
            ctx.toast('Workout duplicated.');
          },
          'w-del': async () => {
            ctx.sheet.close();
            const ok = await ctx.confirm({ title: 'Delete workout?', text: `“${t.name}” will be removed. Your training history is kept.`, confirm: 'Delete', danger: true });
            if (ok) { await ctx.store.deleteTemplate(t.id); ctx.toast('Workout deleted.'); }
          },
        },
      });
    },
  },
};

function mine(ctx) {
  const { store } = ctx;
  const list = store.state.templates;
  const newBtn = `<div class="btn-row" style="display:flex;gap:8px"><button class="btn btn--primary" data-action="w-gen" style="flex:1">${icon.spark} Build it for me</button>
    <button class="btn" data-action="w-new" style="flex:1">${icon.plus} Start from scratch</button></div>`;
  if (!list.length) {
    return empty({
      title: 'Build your first workout',
      text: 'Let FORGE build one for your equipment, or pick the exercises yourself — it rates the workout as you build it.',
      action: newBtn,
    });
  }
  return `${planCard(ctx)}${newBtn}<div class="list mt-16">${list.map((t) => {
    const r = store.rateTemplate(t);
    return `<div class="item" style="padding-right:4px">
      <button class="row grow" style="background:none;border:0;padding:0;text-align:left;min-width:0;overflow:hidden" data-action="go" data-href="#/builder/${t.id}">
        ${scoreBadge(r)}<div class="grow" style="min-width:0"><div class="item-title ellipsis">${esc(t.name)}</div>
        <div class="item-sub ellipsis">${t.items.length ? `${esc(r.split.name)} · ${plural(t.items.length, 'exercise')} · ~${r.estimatedMinutes} min` : 'No exercises yet'}${t.inPlan === false ? ' · not in plan' : ''}</div>
        ${t.lastPerformedAt ? `<div class="item-sub">Last done ${esc(relativeDay(t.lastPerformedAt).toLowerCase())}</div>` : ''}</div></button>
      ${t.items.length ? `<button class="icon-btn" data-action="start-template" data-id="${t.id}" aria-label="Start ${esc(t.name)}" style="color:var(--accent)">${icon.play}</button>` : ''}
      <button class="icon-btn" data-action="w-more" data-id="${t.id}" aria-label="More options for ${esc(t.name)}">${icon.more}</button>
    </div>`;
  }).join('')}</div>`;
}

function history(ctx) {
  const { store } = ctx;
  const sessions = [...store.done].sort((a, b) => b.startedAt - a.startedAt);
  if (!sessions.length) return empty({ title: 'No workouts yet', text: 'Completed workouts show up here.', ic: icon.history });
  const p = store.progress;
  let out = '';
  let last = null;
  for (const s of sessions) {
    const k = dayKey(s.startedAt);
    if (k !== last) { out += `<p class="eyebrow" style="margin:${last ? 20 : 0}px 2px 8px">${esc(dayHeading(s.startedAt))}</p>`; last = k; }
    const res = p.sessions[s.id];
    out += `<button class="item mt-8" data-action="go" data-href="#/summary/${s.id}">
      <div class="grow"><div class="item-title ellipsis">${esc(s.name)}</div>
      <div class="item-sub num">${duration((s.endedAt || s.startedAt) - s.startedAt)} · ${plural(s.sets.filter((x) => !x.warmup).length, 'set')}${res ? ` · +${num(res.totalXp)} XP` : ''}${res?.prs.length ? ` · 🏆 ${res.prs.length}` : ''}</div></div>
      ${icon.chev.replace('<svg', '<svg class="chev"')}</button>`;
  }
  return out;
}

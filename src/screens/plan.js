/** Weekly plan — how your saved workouts add up over a week. */
import { appbar, scoreBadge, empty, icon } from '../components/ui.js';
import { FREQ_LIST } from '../engine/streak.js';
import { WEEKDAYS } from '../engine/plan.js';
import { esc } from '../utils/format.js';

function bandRow(m, lo, hi) {
  const max = hi * 1.5;
  const pct = Math.min(1, m.weekly / max) * 100;
  const color = m.status === 'On target' ? 'var(--good)' : m.status === 'Missing' || m.status === 'Too much' ? 'var(--bad)' : 'var(--warn)';
  return `<div class="plan-row"><span class="ellipsis">${esc(m.name)}</span>
    <div class="plan-bar" role="img" aria-label="${esc(m.name)}: ${m.weekly} sets per week, ${m.status}"><span class="band" style="left:${(lo / max) * 100}%;right:${100 - (hi / max) * 100}%"></span><i style="width:${pct}%;background:${color}"></i></div>
    <span class="tiny" style="color:${color};text-align:right">${m.weekly} · ${esc(m.status)}</span></div>`;
}

export default {
  tab: 'workouts',
  title: 'Weekly plan',
  render(ctx) {
    const { store } = ctx;
    const p = store.plan;
    const all = store.state.templates.filter((t) => t.items.length);
    if (!all.length) {
      return `${appbar({ title: 'Weekly plan', back: true })}${empty({ title: 'No workouts yet', text: 'Build a few workouts — e.g. Push, Pull and Legs — and FORGE rates how they work together as a week.', action: '<button class="btn btn--primary" data-action="go" data-href="#/workouts">Go to workouts</button>' })}`;
    }
    const [lo, hi] = p.dose || [0, 0];
    const majors = p.muscles.filter((m) => !m.accessory);
    const acc = p.muscles.filter((m) => m.accessory);
    return `${appbar({ title: 'Weekly plan', back: true })}
      <div class="card">
        <div class="rating">
          <div class="rating-score">${p.score}<small> / 100</small></div>
          <div><div class="rating-label ${p.grade}">${esc(p.label)}</div><div class="small text-2">${store.planTemplates.length} workouts · ${p.days} days a week${p.scheduled ? ' · scheduled' : ''}</div></div>
        </div>
        <p class="mt-12" style="margin-bottom:0">${esc(p.headline)}</p>
        ${p.positives.length ? `<div class="mt-16"><p class="eyebrow">Good</p><ul class="checks mt-8">${p.positives.map((x) => `<li><span class="ic ok">✓</span><span>${esc(x)}</span></li>`).join('')}</ul></div>` : ''}
        ${p.improvements.length ? `<div class="mt-16"><p class="eyebrow">Could improve</p><ul class="checks mt-8">${p.improvements.map((x) => `<li><span class="ic ${x.kind === 'add' ? 'add' : 'warn'}">${x.kind === 'add' ? '+' : '!'}</span><span>${esc(x.text)}</span></li>`).join('')}</ul></div>` : ''}
      </div>

      ${scheduleSection(ctx, all)}
      ${p.scheduled ? '' : `<section class="section"><div class="section-head"><p class="eyebrow">Or rotate through your workouts</p></div>
        <div class="seg">${FREQ_LIST.map((f) => `<button data-action="pl-days" data-v="${f.id}" aria-pressed="${store.settings.frequency === f.id}">${f.label}</button>`).join('')}</div>
        <p class="small muted mt-8">With no schedule, FORGE assumes you rotate through the workouts below to fill your training days${p.perWeek ? ` — each comes around about ${p.perWeek.toFixed(1).replace('.0', '')}× a week` : ''}.</p>
        <div class="card card--flush mt-8">${all.map((t) => {
          const r = store.rateTemplate(t);
          const on = t.inPlan !== false;
          return `<div class="eq-row">${scoreBadge(r)}<div class="grow" style="min-width:0"><div class="item-title ellipsis">${esc(t.name)}</div><div class="item-sub">${esc(r.split.name)}${r.split.auto ? ' (auto)' : ''} · ${r.totalSets} sets</div></div>
            <button class="switch" role="switch" aria-checked="${on}" aria-label="Include ${esc(t.name)} in weekly plan" data-action="pl-toggle" data-id="${t.id}"></button></div>`;
        }).join('')}</div>
      </section>`}

      <section class="section"><div class="section-head"><p class="eyebrow">Weekly sets per muscle</p><span class="tiny muted">target ${lo}–${hi}</span></div>
        <div class="card">${majors.map((m) => bandRow(m, lo, hi)).join('')}
          <p class="tiny muted mt-12" style="margin-bottom:0">Dashed lines mark the productive range. Effective sets: the main muscle of an exercise counts 1, helpers count ½.</p></div>
        <details class="card mt-8"><summary class="small text-2" style="cursor:pointer">Smaller accessory muscles</summary><div class="mt-8">${acc.map((m) => bandRow(m, lo, hi)).join('')}</div></details>
      </section>`;
  },
  actions: {
    'pl-toggle': async (ctx, el) => {
      const t = ctx.store.template(el.dataset.id);
      t.inPlan = t.inPlan === false;
      await ctx.store.saveTemplate(t);
    },
    'pl-days': (ctx, el) => ctx.store.saveSettings({ frequency: el.dataset.v }),
    'pl-clear': async (ctx) => {
      const ok = await ctx.confirm({ title: 'Clear the schedule?', text: 'FORGE will go back to rotating through your workouts.', confirm: 'Clear' });
      if (ok) await ctx.store.saveSettings({ schedule: {} });
    },
  },
  changes: {
    'pl-day': async (ctx, el) => {
      const schedule = { ...(ctx.store.settings.schedule || {}) };
      if (el.value) schedule[el.dataset.d] = el.value; else delete schedule[el.dataset.d];
      const n = Object.keys(schedule).length;
      // keep the streak target in line with the schedule
      const frequency = n <= 3 ? '2-3' : n === 4 ? '4' : '5';
      await ctx.store.saveSettings({ schedule, ...(n ? { frequency } : {}) });
    },
  },
};

function scheduleSection(ctx, all) {
  const { store } = ctx;
  const ws = store.settings.weekStart ?? 1;
  const sched = store.schedule;
  const clashDays = new Set((store.plan.clashes || []).flatMap((c) => [c.day, c.next]));
  const today = new Date().getDay();
  const rows = Array.from({ length: 7 }, (_, k) => (ws + k) % 7).map((d) => {
    const cur = sched[d] || '';
    return `<label class="sched-row ${d === today ? 'is-today' : ''} ${clashDays.has(d) ? 'is-clash' : ''}"><span class="sched-day">${WEEKDAYS[d].slice(0, 3)}${d === today ? '<small>today</small>' : ''}</span>
      <select class="input sched-select" data-change="pl-day" data-d="${d}" aria-label="Workout on ${WEEKDAYS[d]}">
        <option value="">Rest</option>${all.map((t) => `<option value="${t.id}" ${cur === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
      </select></label>`;
  }).join('');
  return `<section class="section"><div class="section-head"><p class="eyebrow">${icon.calendar.replace('<svg', '<svg style="width:14px;vertical-align:-2px;margin-right:4px"')}Weekly schedule</p>${store.hasSchedule ? '<button class="link" data-action="pl-clear">Clear</button>' : ''}</div>
    <div class="card card--flush">${rows}</div>
    <p class="small muted mt-8">${store.hasSchedule ? 'Home shows the workout scheduled for today. Days next to each other that train the same muscles hard are flagged.' : 'Pin workouts to days and Home will show today’s workout — or leave every day on Rest and FORGE rotates through your workouts.'}</p>
  </section>`;
}

export function planCard(ctx) {
  const { store } = ctx;
  const p = store.plan;
  if (!store.planTemplates.length) return '';
  return `<button class="item card--accent" data-action="go" data-href="#/plan" style="margin-bottom:12px">
    ${scoreBadge(p)}<div class="grow" style="min-width:0"><div class="tiny muted" style="letter-spacing:.1em;text-transform:uppercase;font-weight:700">Weekly plan</div>
    <div class="item-title ellipsis">${esc(p.headline)}</div><div class="item-sub">${store.planTemplates.length} workouts · ${p.days} days a week${p.scheduled ? ' · scheduled' : ''}</div></div>${icon.chev.replace('<svg', '<svg class="chev"')}</button>`;
}

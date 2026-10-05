/** Workout builder — create, edit, reorder; live analysis & rating as you build. */
import { appbar, icon, stepper, bar } from '../components/ui.js';
import { EXERCISE_BY_ID } from '../data/exercises.js';
import { MUSCLE_BY_ID } from '../data/muscles.js';
import { recoveryStatus } from '../engine/recovery.js';
import { stepWeight, snapWeight } from '../engine/equipment.js';
import { esc, kg, repsRange, plural } from '../utils/format.js';
import { relativeDay } from '../utils/date.js';
import { filterExercises, exerciseRow, filterBar } from './exercises.js';
import * as shared from './shared.js';

const DURATIONS = [30, 45, 60, 75, 90];

function ui(ctx) {
  const id = ctx.route.id;
  const u = (ctx.ui.builder ||= {});
  if (u.id !== id) { u.id = id; u.open = null; }
  return u;
}

function tpl(ctx) {
  return ctx.store.template(ctx.route.id);
}

function save(ctx, t, opts) {
  t.updatedAt = Date.now();
  return ctx.store.saveTemplate(t, opts);
}

function itemTarget(item, ex) {
  return `${item.sets} × ${repsRange(item.repMin, item.repMax, ex.metric)}`;
}

function weightText(ctx, item, ex) {
  const cfg = ctx.store.cfgFor(ex.id);
  if (!cfg) return ex.load === 'bands' ? 'Band' : 'Bodyweight';
  if (item.weight != null) return `${kg(item.weight)} kg`;
  const rec = ctx.store.recommendationFor(ex.id, item);
  return `Auto · ${kg(rec?.weight ?? snapWeight(ex.startKg, cfg))} kg`;
}

function recoveryNote(ctx, ex) {
  const p = ctx.store.progress;
  for (const m of ex.primary) {
    const st = recoveryStatus(p.muscles[m]);
    if (st.level !== 'ready') return `⚠️ ${MUSCLE_BY_ID[m].short} trained ${relativeDay(p.muscles[m].lastTrained).toLowerCase()} — ${st.label.toLowerCase()}`;
  }
  return '';
}

function itemCard(ctx, t, item, i) {
  const ex = EXERCISE_BY_ID[item.exerciseId];
  if (!ex) return '';
  const u = ui(ctx);
  const open = u.open === item.uid;
  const cfg = ctx.store.cfgFor(ex.id);
  const warn = recoveryNote(ctx, ex);
  const unit = ex.metric === 'time' ? 's' : '';
  const stepR = ex.metric === 'time' ? 5 : 1;
  return `<div class="wx" data-uid="${item.uid}">
    <div class="wx-head">
      <span class="wx-idx">${i + 1}</span>
      <button class="wx-main" data-action="b-toggle" data-uid="${item.uid}" aria-expanded="${open}">
        <div class="wx-name">${esc(ex.name)}</div>
        <div class="wx-target">${itemTarget(item, ex)} · ${esc(weightText(ctx, item, ex))}${ex.unilateral ? ' · per side' : ''}</div>
      </button>
      <button class="icon-btn" data-action="b-toggle" data-uid="${item.uid}" aria-label="${open ? 'Collapse' : 'Edit'} ${esc(ex.name)}">${open ? icon.up : icon.edit}</button>
    </div>
    ${warn ? `<div class="wx-warn">${esc(warn)}</div>` : ''}
    ${open ? `<div class="wx-body">
      <div class="wx-grid">
        <div><span class="field-label">Sets</span>${stepper({ value: item.sets, dec: 'b-sets-dec', inc: 'b-sets-inc', label: 'sets', sm: true, decDisabled: item.sets <= 1, incDisabled: item.sets >= 10 })}</div>
        <div><span class="field-label">Weight</span>${cfg
          ? stepper({ value: item.weight == null ? 'Auto' : kg(item.weight), dec: 'b-w-dec', inc: 'b-w-inc', label: 'weight', sm: true })
          : `<div class="small muted" style="min-height:40px;display:flex;align-items:center">${ex.load === 'bands' ? 'Band resistance' : 'Bodyweight'}</div>`}</div>
        <div><span class="field-label">${ex.metric === 'time' ? 'Min time' : 'Min reps'}</span>${stepper({ value: item.repMin, unit, dec: 'b-rmin-dec', inc: 'b-rmin-inc', label: 'minimum target', sm: true, decDisabled: item.repMin <= stepR })}</div>
        <div><span class="field-label">${ex.metric === 'time' ? 'Max time' : 'Max reps'}</span>${stepper({ value: item.repMax, unit, dec: 'b-rmax-dec', inc: 'b-rmax-inc', label: 'maximum target', sm: true, decDisabled: item.repMax <= item.repMin })}</div>
      </div>
      ${cfg && item.weight != null ? `<button class="link" style="justify-self:start;padding:0" data-action="b-w-auto">Use automatic weight</button>` : ''}
      <div class="wx-actions">
        <button class="btn btn--sm" data-action="b-up" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${icon.up} Up</button>
        <button class="btn btn--sm" data-action="b-down" ${i === t.items.length - 1 ? 'disabled' : ''} aria-label="Move down">${icon.down} Down</button>
        <button class="btn btn--sm" data-action="open-exercise" data-id="${ex.id}">${icon.info} Info</button>
        <button class="btn btn--sm btn--danger" data-action="b-remove">${icon.trash} Remove</button>
      </div>
    </div>` : ''}
  </div>`;
}

export function analysisCard(r, { withSuggestion = true } = {}) {
  if (!r.totalSets) {
    return `<div class="card"><p class="eyebrow">Workout rating</p><p class="muted mt-8">${esc(r.headline)}</p></div>`;
  }
  const checks = [
    ...r.positives.map((p) => `<li><span class="ic ok">✓</span><span>${esc(p)}</span></li>`),
  ].join('');
  const improve = r.improvements.map((p) => `<li><span class="ic ${p.kind === 'add' ? 'add' : 'warn'}">${p.kind === 'add' ? '+' : '!'}</span><span>${esc(p.text)}</span></li>`).join('');
  const warns = r.warnings.map((w) => `<li><span class="ic warn">⚠</span><span><b>${esc(MUSCLE_BY_ID[w.muscle].name)}</b> — trained ${esc(relativeDay(w.lastTrained).toLowerCase())}. ${esc(w.status.label)}. You can still train it.</span></li>`).join('');
  const sug = withSuggestion && r.suggestion ? (() => {
    const e = EXERCISE_BY_ID[r.suggestion.exerciseId];
    return `<div class="mt-16"><p class="eyebrow">Suggested addition</p>
      <div class="suggest mt-8"><div class="grow"><div class="item-title">${esc(e.name)}</div><div class="item-sub">${r.suggestion.sets} sets · ${repsRange(r.suggestion.repMin, r.suggestion.repMax, e.metric)} · ${esc(r.suggestion.reason)}</div></div>
      <button class="btn btn--sm btn--primary" data-action="b-add-suggest">Add</button></div></div>`;
  })() : '';
  return `<div class="card" id="analysis">
    <p class="eyebrow">Workout rating</p>
    <div class="rating mt-8">
      <div class="rating-score">${r.score}<small> / 100</small></div>
      <div><div class="rating-label ${r.grade}">${esc(r.label)}</div><div class="small text-2">${esc(r.typeName)} · ${r.totalSets} sets · ~${r.estimatedMinutes} min</div></div>
    </div>
    <p class="mt-12" style="margin-bottom:0">${esc(r.headline)}</p>
    <div class="mt-16"><p class="eyebrow">Muscle coverage</p>
      <div class="mt-8">${r.coverage.slice(0, 8).map((c) => `<div class="cov"><span class="ellipsis">${esc(c.name)}</span>${bar(c.pct, c.eff >= 3 ? 'bar--good' : '')}<span class="lbl">${esc(c.label)}</span></div>`).join('')}</div></div>
    ${checks ? `<div class="mt-16"><p class="eyebrow">Good</p><ul class="checks mt-8">${checks}</ul></div>` : ''}
    ${improve ? `<div class="mt-16"><p class="eyebrow">Could improve</p><ul class="checks mt-8">${improve}</ul></div>` : ''}
    ${warns ? `<div class="mt-16"><p class="eyebrow">Recovery</p><ul class="checks mt-8">${warns}</ul></div>` : ''}
    ${sug}
  </div>`;
}

/* ───────────── add-exercise sheet ───────────── */
function openAddSheet(ctx) {
  const s = (ctx.ui.addSheet ||= { query: '', group: 'all', scope: 'available' });
  const results = () => {
    const t = tpl(ctx);
    const counts = {};
    t.items.forEach((i) => { counts[i.exerciseId] = (counts[i.exerciseId] || 0) + 1; });
    const list = filterExercises({ ...s, caps: ctx.store.caps });
    return list.length ? `<div class="list">${list.map((e) => exerciseRow(e, { caps: ctx.store.caps, action: 'b-add', added: counts[e.id] || 0 })).join('')}</div>` : '<p class="muted center">No exercises match.</p>';
  };
  ctx.sheet.open({
    title: 'Add exercise',
    tall: true,
    render: () => `${filterBar(s, 'a')}<div class="mt-16" id="a-results">${results()}</div>`,
    foot: () => `<button class="btn btn--primary btn--block" data-action="close-sheet">Done</button>`,
    actions: {
      'a-group': (c, el) => { s.group = el.dataset.v; ctx.sheet.refresh({ keepScroll: false }); },
      'a-scope': (c, el) => { s.scope = el.dataset.v; ctx.sheet.refresh({ keepScroll: false }); },
      'b-add': async (c, el) => {
        const t = tpl(ctx);
        const ex = EXERCISE_BY_ID[el.dataset.id];
        t.items.push(ctx.store.makeItem(ex.id));
        await save(ctx, t);
        ctx.sheet.patch('#a-results', results());
        ctx.toast(`Added ${esc(ex.name)}`, { ms: 1400 });
      },
      'add-equipment': async (c, el) => { await shared.addEquipment(ctx, el.dataset.item); ctx.sheet.patch('#a-results', results()); },
    },
    inputs: { 'a-search': (c, el) => { s.query = el.value; ctx.sheet.patch('#a-results', results()); } },
  });
}

function mutateItem(ctx, el, fn) {
  const t = tpl(ctx);
  const uid = el.closest('[data-uid]')?.dataset.uid;
  const idx = t.items.findIndex((i) => i.uid === uid);
  if (idx < 0) return;
  fn(t.items[idx], idx, t);
  return save(ctx, t);
}

export default {
  tab: 'workouts',
  title: (ctx) => tpl(ctx)?.name || 'Workout',
  render(ctx) {
    const t = tpl(ctx);
    if (!t) return `${appbar({ title: 'Workout', back: true })}<div class="card">This workout no longer exists.</div>`;
    ui(ctx);
    const r = ctx.store.rate(t.items, t.targetMinutes);
    const active = ctx.store.state.active;
    return `${appbar({ title: 'Build workout', back: true, right: `<button class="icon-btn" data-action="b-delete" aria-label="Delete workout">${icon.trash}</button>` })}
      <label class="sr-only" for="b-name">Workout name</label>
      <input id="b-name" class="input input--title" value="${esc(t.name)}" data-input="b-name" maxlength="40" autocomplete="off" placeholder="Workout name">
      <div class="row mt-12" style="flex-wrap:wrap;gap:8px"><span class="small muted">Target</span>
        <div class="dur-chips" role="group" aria-label="Target duration">${DURATIONS.map((d) => `<button class="chip" data-action="b-dur" data-v="${d}" aria-pressed="${t.targetMinutes === d}">${d} min</button>`).join('')}</div></div>

      ${t.items.length ? `<a class="card row mt-16" href="#analysis" data-action="b-jump" style="text-decoration:none;color:inherit;padding:12px 14px">
        <div class="rating-score" style="font-size:30px">${r.score}</div>
        <div class="grow"><div class="rating-label ${r.grade}">${esc(r.label)}</div><div class="small text-2 ellipsis">${esc(r.headline)}</div></div>${icon.down}</a>` : ''}

      <section class="section"><div class="section-head"><p class="eyebrow">Exercises</p><span class="small muted">${plural(t.items.length, 'exercise')}</span></div>
        ${t.items.length ? t.items.map((it, i) => itemCard(ctx, t, it, i)).join('') : `<div class="card empty"><h3>Add your first exercise</h3><p class="small">Everything shown works with your current equipment.</p></div>`}
        <button class="btn btn--block mt-12" data-action="b-add-open" style="border-style:dashed">${icon.plus} Add exercise</button>
      </section>

      <section class="section">${analysisCard(r)}</section>

      <div class="sticky-foot">
        <button class="btn" data-action="b-save" style="flex:1">Save</button>
        <button class="btn btn--primary" data-action="b-start" style="flex:2" ${t.items.length ? '' : 'disabled'}>${icon.play} ${active ? 'Resume workout' : 'Start workout'}</button>
      </div>`;
  },
  actions: {
    'b-add-open': (ctx) => openAddSheet(ctx),
    'b-toggle': (ctx, el) => { const u = ui(ctx); u.open = u.open === el.dataset.uid ? null : el.dataset.uid; ctx.render(); },
    'b-dur': (ctx, el) => { const t = tpl(ctx); t.targetMinutes = Number(el.dataset.v); return save(ctx, t); },
    'b-jump': () => document.getElementById('analysis')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    'b-sets-dec': (ctx, el) => mutateItem(ctx, el, (it) => { it.sets = Math.max(1, it.sets - 1); }),
    'b-sets-inc': (ctx, el) => mutateItem(ctx, el, (it) => { it.sets = Math.min(10, it.sets + 1); }),
    'b-rmin-dec': (ctx, el) => mutateItem(ctx, el, (it) => { const s = EXERCISE_BY_ID[it.exerciseId].metric === 'time' ? 5 : 1; it.repMin = Math.max(s, it.repMin - s); }),
    'b-rmin-inc': (ctx, el) => mutateItem(ctx, el, (it) => { const s = EXERCISE_BY_ID[it.exerciseId].metric === 'time' ? 5 : 1; it.repMin += s; if (it.repMax < it.repMin) it.repMax = it.repMin; }),
    'b-rmax-dec': (ctx, el) => mutateItem(ctx, el, (it) => { const s = EXERCISE_BY_ID[it.exerciseId].metric === 'time' ? 5 : 1; it.repMax = Math.max(it.repMin, it.repMax - s); }),
    'b-rmax-inc': (ctx, el) => mutateItem(ctx, el, (it) => { const s = EXERCISE_BY_ID[it.exerciseId].metric === 'time' ? 5 : 1; it.repMax += s; }),
    'b-w-dec': (ctx, el) => mutateItem(ctx, el, (it) => {
      const cfg = ctx.store.cfgFor(it.exerciseId);
      const cur = it.weight ?? ctx.store.recommendationFor(it.exerciseId, it)?.weight ?? cfg.min;
      it.weight = stepWeight(cur, -1, cfg);
    }),
    'b-w-inc': (ctx, el) => mutateItem(ctx, el, (it) => {
      const cfg = ctx.store.cfgFor(it.exerciseId);
      const cur = it.weight ?? ctx.store.recommendationFor(it.exerciseId, it)?.weight ?? cfg.min;
      it.weight = stepWeight(cur, 1, cfg);
    }),
    'b-w-auto': (ctx, el) => mutateItem(ctx, el, (it) => { it.weight = null; }),
    'b-up': (ctx, el) => mutateItem(ctx, el, (it, i, t) => { if (i > 0) [t.items[i - 1], t.items[i]] = [t.items[i], t.items[i - 1]]; }),
    'b-down': (ctx, el) => mutateItem(ctx, el, (it, i, t) => { if (i < t.items.length - 1) [t.items[i + 1], t.items[i]] = [t.items[i], t.items[i + 1]]; }),
    'b-remove': (ctx, el) => {
      const t = tpl(ctx);
      const uid = el.closest('[data-uid]').dataset.uid;
      const idx = t.items.findIndex((i) => i.uid === uid);
      const [removed] = t.items.splice(idx, 1);
      save(ctx, t);
      ctx.toast(`Removed ${esc(EXERCISE_BY_ID[removed.exerciseId].name)}`, {
        action: { label: 'Undo', run: () => { const tt = tpl(ctx); tt.items.splice(idx, 0, removed); save(ctx, tt); } },
      });
    },
    'b-add-suggest': async (ctx) => {
      const t = tpl(ctx);
      const r = ctx.store.rate(t.items, t.targetMinutes);
      if (!r.suggestion) return;
      t.items.push(ctx.store.makeItem(r.suggestion.exerciseId, { sets: r.suggestion.sets }));
      await save(ctx, t);
      ctx.toast(`Added ${esc(EXERCISE_BY_ID[r.suggestion.exerciseId].name)}`);
    },
    'b-save': async (ctx) => {
      const t = tpl(ctx);
      if (!t.name.trim()) t.name = 'My Workout';
      await save(ctx, t);
      ctx.toast('Workout saved.', { kind: 'good' });
      ctx.go('#/workouts');
    },
    'b-start': async (ctx) => {
      const t = tpl(ctx);
      await save(ctx, t, { silent: true });
      await shared.startTemplate(ctx, t.id);
    },
    'b-delete': async (ctx) => {
      const t = tpl(ctx);
      const ok = await ctx.confirm({ title: 'Delete workout?', text: `“${t.name}” will be removed. Your training history is kept.`, confirm: 'Delete', danger: true });
      if (!ok) return;
      await ctx.store.deleteTemplate(t.id);
      ctx.go('#/workouts', { replace: true });
    },
  },
  inputs: {
    'b-name': (ctx, el) => {
      const t = tpl(ctx);
      t.name = el.value.slice(0, 40);
      save(ctx, t, { silent: true });
    },
  },
  unmount(ctx) {
    // Throw away a brand-new workout the user never added anything to.
    const id = ctx.ui.builder?.id;
    const t = id && ctx.store.template(id);
    if (t && !t.items.length && t.name === 'New Workout' && !t.lastPerformedAt) ctx.store.deleteTemplate(t.id);
  },
};

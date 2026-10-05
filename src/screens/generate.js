/** "Build it for me" — generate a well-rated workout for a focus and a time budget. */
import { icon, scoreBadge } from '../components/ui.js';
import { EXERCISE_BY_ID } from '../data/exercises.js';
import { SPLITS, SPLIT_GROUPS } from '../data/splits.js';
import { groupLabels } from '../engine/session.js';
import { esc, repsRange, plural } from '../utils/format.js';

const MINUTES = [20, 30, 45, 60, 75];

/**
 * @param ctx
 * @param opts { templateId?: string } — fill an existing workout instead of creating a new one
 */
export function openGenerator(ctx, { templateId = null } = {}) {
  const { store } = ctx;
  const t0 = templateId ? store.template(templateId) : null;
  let focus = t0?.focus && t0.focus !== 'auto' ? t0.focus : null;
  if (!focus && t0?.items.length) focus = store.rateTemplate(t0).split.id;
  if (focus === 'custom' && !(t0?.customMuscles || []).length) focus = null;
  const st = {
    focus: focus || 'full',
    customMuscles: t0?.customMuscles || [],
    minutes: t0?.targetMinutes || store.settings.targetMinutes || 45,
    supersets: !!store.settings.genSupersets,
    seed: Math.floor(Math.random() * 1e9),
    result: null,
  };
  const run = () => { st.result = store.generate(st); };
  run();

  const focusChips = () => SPLIT_GROUPS.filter((g) => !['auto', 'custom'].includes(g.id)).map((g) => `<div class="mt-12"><p class="tiny muted" style="margin:0 0 6px">${esc(g.name)}</p>
    <div class="focus-chips">${SPLITS.filter((sp) => sp.group === g.id && !sp.alias).map((sp) => `<button class="chip" data-action="g-focus" data-v="${sp.id}" aria-pressed="${st.focus === sp.id}">${esc(sp.name)}</button>`).join('')}
    ${g.id === 'whole' && st.focus === 'custom' ? `<button class="chip" data-action="g-focus" data-v="custom" aria-pressed="true">Custom</button>` : ''}</div></div>`).join('');

  const preview = () => {
    const { items, rating } = st.result;
    if (!items.length) return `<div class="card mt-16"><p class="small muted" style="margin:0">Your equipment doesn't have enough exercises for this focus yet. Try another focus or add equipment in Settings.</p></div>`;
    const labels = groupLabels(items);
    return `<div class="card mt-16 gen-preview">
      <div class="row" style="gap:12px">${scoreBadge(rating)}<div class="grow"><div class="item-title">${esc(st.result.name)}</div>
        <div class="item-sub">${plural(items.length, 'exercise')} · ${rating.totalSets} sets · ~${rating.estimatedMinutes} min</div></div></div>
      <ol class="gen-list mt-12">${items.map((it, i) => {
        const ex = EXERCISE_BY_ID[it.exerciseId];
        return `<li><span class="wx-idx ${labels[i] ? 'wx-idx--ss' : ''}">${labels[i] || i + 1}</span><span class="grow"><b>${esc(ex.name)}</b><br><span class="small muted">${it.sets} × ${repsRange(it.repMin, it.repMax, ex.metric)}${ex.unilateral ? ' · per side' : ''}</span></span></li>`;
      }).join('')}</ol>
      ${rating.positives.length ? `<p class="small text-2 mt-12" style="margin-bottom:0">✓ ${esc(rating.positives.slice(0, 2).join(' · '))}</p>` : ''}
    </div>`;
  };

  ctx.sheet.open({
    title: t0 ? 'Fill this workout for me' : 'Build a workout for me',
    tall: true,
    render: () => `<p class="small text-2" style="margin-top:0">FORGE picks exercises your equipment allows and keeps the one that rates best. Shuffle for a different take.</p>
      <p class="eyebrow mt-16">Focus</p>${focusChips()}
      <p class="eyebrow mt-16">Time</p>
      <div class="dur-chips mt-8" role="group" aria-label="Minutes">${MINUTES.map((m) => `<button class="chip" data-action="g-min" data-v="${m}" aria-pressed="${st.minutes === m}">${m} min</button>`).join('')}</div>
      <div class="eq-row mt-12" style="padding:10px 0;border:0"><div class="grow"><div class="item-title">Use supersets</div><div class="item-sub">Pair exercises for different muscles — less resting, more done</div></div>
        <button class="switch" role="switch" aria-checked="${st.supersets}" aria-label="Use supersets" data-action="g-ss"></button></div>
      <div id="g-preview">${preview()}</div>`,
    foot: () => `<div class="btn-row" style="display:flex;gap:8px"><button class="btn" data-action="g-shuffle" style="flex:1">${icon.history} Shuffle</button>
      <button class="btn btn--primary" data-action="g-use" style="flex:2" ${st.result.items.length ? '' : 'disabled'}>${t0 ? 'Use this' : 'Save workout'}</button></div>`,
    actions: {
      'g-focus': (c, el) => { if (el.dataset.v !== st.focus) { st.focus = el.dataset.v; st.customMuscles = []; } run(); ctx.sheet.refresh(); },
      'g-min': (c, el) => { st.minutes = Number(el.dataset.v); run(); ctx.sheet.refresh(); },
      'g-ss': () => { st.supersets = !st.supersets; store.saveSettings({ genSupersets: st.supersets }); run(); ctx.sheet.refresh(); },
      'g-shuffle': () => { st.seed = Math.floor(Math.random() * 1e9); run(); ctx.sheet.refresh(); },
      'g-use': async () => {
        const { items, name } = st.result;
        if (t0) {
          const t = store.template(t0.id);
          if (t.items.length) {
            const ok = await ctx.confirm({ title: 'Replace exercises?', text: `The ${plural(t.items.length, 'exercise')} in “${t.name}” will be replaced.`, confirm: 'Replace' });
            if (!ok) return;
          }
          t.items = items;
          t.focus = st.focus;
          t.customMuscles = st.customMuscles;
          t.targetMinutes = st.minutes;
          if (t.name === 'New Workout') t.name = name;
          await store.saveTemplate(t);
          ctx.sheet.close();
          ctx.toast('Workout filled in — tweak anything you like.', { kind: 'good' });
        } else {
          const t = store.newTemplate(name, items);
          t.focus = st.focus;
          t.customMuscles = st.customMuscles;
          t.targetMinutes = st.minutes;
          await store.saveTemplate(t);
          ctx.sheet.close();
          ctx.go(`#/builder/${t.id}`);
          ctx.toast('Workout created — tweak anything you like.', { kind: 'good' });
        }
      },
    },
  });
}


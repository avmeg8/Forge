/** Workout summary — shown after finishing and when opening a past workout from history. */
import { appbar, icon, bar } from '../components/ui.js';
import { EXERCISE_BY_ID } from '../data/exercises.js';
import { MUSCLE_BY_ID } from '../data/muscles.js';
import { recommend, sideBalance } from '../engine/progression.js';
import { levelInfo } from '../engine/levels.js';
import { esc, num, duration, setLabel, plural } from '../utils/format.js';
import { dayHeading } from '../utils/date.js';

const PR_LABEL = { strength: 'Strength PR', weight: 'Weight PR', reps: 'Rep PR', time: 'Time PR', volume: 'Volume PR' };

export default {
  tab: 'workouts',
  title: 'Workout summary',
  render(ctx) {
    const { store } = ctx;
    const s = store.state.sessions.find((x) => x.id === ctx.route.id);
    if (!s) return `${appbar({ title: 'Workout', back: true })}<div class="card">This workout was deleted.</div>`;
    const fresh = ctx.route.query.fresh === '1';
    const p = store.progress;
    const res = p.sessions[s.id] || { xpByMuscle: {}, prs: [], levelUps: [], totalXp: 0 };

    // group sets by exercise item, in order
    const groups = [];
    for (const set of [...s.sets].sort((a, b) => a.ts - b.ts)) {
      let g = groups.find((x) => x.itemIndex === set.itemIndex && x.exerciseId === set.exerciseId);
      if (!g) { g = { itemIndex: set.itemIndex, exerciseId: set.exerciseId, sets: [] }; groups.push(g); }
      g.sets.push(set);
    }

    const muscles = Object.entries(res.xpByMuscle).sort((a, b) => b[1] - a[1]);
    const head = `<div class="card ${fresh ? 'card--accent' : ''}">
      ${fresh ? '<p class="eyebrow" style="color:var(--good)">Workout complete</p>' : `<p class="eyebrow">${esc(dayHeading(s.startedAt))}</p>`}
      <h2 style="margin:6px 0 14px;font-size:22px">${esc(s.name)}</h2>
      <div class="stat-grid">
        ${(() => { const mins = Math.max(1, Math.round(((s.endedAt || s.startedAt) - s.startedAt) / 60000)); return `<div class="stat"><b>${mins}</b><span>${mins === 1 ? 'minute' : 'minutes'}</span></div>`; })()}
        <div class="stat"><b>${s.sets.filter((x) => !x.warmup).length}</b><span>sets</span></div>
        <div class="stat"><b style="color:var(--accent-2)">+${num(res.totalXp)}</b><span>XP</span></div>
      </div>
      ${s.deload ? `<p class="small muted mt-12" style="margin-bottom:0">🪶 Deload-week session — lighter on purpose.</p>` : ''}
      ${s.ratingAtStart ? `<p class="small muted mt-12" style="margin-bottom:0">Workout rating: <b class="text-2">${s.ratingAtStart.score}/100 · ${esc(s.ratingAtStart.label)}${s.ratingAtStart.split ? ` ${esc(s.ratingAtStart.split.toLowerCase())} workout` : ""}</b></p>` : ''}
    </div>`;

    const lvl = res.levelUps.length ? `<section class="section"><p class="eyebrow">Level up</p><div class="stack mt-8">${res.levelUps.map((l) => `<div class="lvlup">${icon.bolt}<span class="grow">${esc(MUSCLE_BY_ID[l.muscle].name)} reached Level ${l.to}${l.tierUp ? ` — <b>${esc(l.tier.name)}</b>` : ''}</span></div>`).join('')}</div></section>` : '';

    const prs = res.prs.length ? `<section class="section"><p class="eyebrow">Personal records</p><div class="stack mt-8">${res.prs.map((pr) => {
      const ex = EXERCISE_BY_ID[pr.exerciseId];
      const val = pr.type === 'volume' ? `${num(pr.value)} ${ex.metric === 'time' ? 's' : 'kg'} total` : setLabel(pr.set, ex);
      const prev = pr.type === 'volume' ? `${num(pr.previousValue)}` : pr.previous ? setLabel(pr.previous, ex) : '';
      return `<div class="card pr-card"><span class="trophy" aria-hidden="true">🏆</span><div class="grow"><div class="tiny" style="color:var(--accent-2);font-weight:800;letter-spacing:.12em">NEW ${esc(PR_LABEL[pr.type].toUpperCase())}</div>
        <div class="item-title">${esc(ex.name)}</div><div class="num">${esc(val)}</div>${prev ? `<div class="small muted">Previous: ${esc(prev)}</div>` : ''}</div></div>`;
    }).join('')}</div></section>` : '';

    const xp = muscles.length ? `<section class="section"><p class="eyebrow">Muscles trained</p><div class="card card--flush mt-8">${muscles.map(([m, x]) => {
      const info = p.muscles[m].info;
      // level as of right after this session
      const h = p.muscles[m].history.find((e) => e.t === (s.endedAt || 0)) || null;
      const at = h ? levelInfo(h.xp) : info;
      return `<button class="mlevel" data-action="muscle" data-muscle="${m}"><div><div class="name">${esc(MUSCLE_BY_ID[m].name)}</div><div class="meta">${at.tier.name} · Level ${at.level}</div></div>
        <div class="lv" style="color:var(--accent-2);font-size:16px">+${num(x)} XP</div>${bar(at.progress, 'bar--thin')}</button>`;
    }).join('')}</div></section>` : '';

    const next = groups.length ? `<section class="section"><p class="eyebrow">Next time</p><div class="stack mt-8">${groups.map((g) => {
      const ex = EXERCISE_BY_ID[g.exerciseId];
      if (!ex) return '';
      const item = s.items?.[g.itemIndex] || {};
      const work = g.sets.filter((x) => !x.warmup);
      if (!work.length) return '';
      const r = recommend(ex.id, work, { sets: item.sets || ex.sets, repMin: item.repMin, repMax: item.repMax }, store.cfgFor(ex.id));
      return `<div class="card"><div class="row row--between"><b>${esc(ex.name)}</b><span class="tag ${r.action === 'increase' ? 'tag--good' : r.action === 'max' ? 'tag--accent' : ''}">${esc(r.headline)}</span></div>
        <p class="small text-2" style="margin:6px 0 0">${esc(r.text)}</p>
        ${r.alternatives ? `<ul class="ul small mt-8">${r.alternatives.slice(0, 3).map((a) => `<li>${esc(a.text)}</li>`).join('')}</ul>` : ''}</div>`;
    }).join('')}</div></section>` : '';

    const detail = `<section class="section"><p class="eyebrow">Sets</p><div class="stack mt-8">${groups.map((g) => {
      const ex = EXERCISE_BY_ID[g.exerciseId];
      if (!ex) return '';
      const work = g.sets.filter((x) => !x.warmup);
      const bal = sideBalance(ex, work);
      return `<div class="card"><div class="row row--between"><button class="link" style="padding:0;font-size:15px;color:var(--text)" data-action="go" data-href="#/exercise/${ex.id}">${esc(ex.name)}</button><span class="small muted">${plural(work.length, 'set')}</span></div>
        <div class="mt-8 small num text-2">${g.sets.map((x) => `<div class="row row--between"><span>${x.warmup ? `<span class="tag" style="min-width:52px;justify-content:center">WARM-UP</span> ` : x.side ? `<span class="tag" style="min-width:52px;justify-content:center">${x.side === 'L' ? 'LEFT' : 'RIGHT'}</span> ` : ''}${esc(setLabel(x, ex))}</span><span class="muted">${x.warmup ? '—' : `+${Math.round(res.setXp?.[x.id] || 0)} XP`}</span></div>`).join('')}</div>
        ${bal && bal.level !== 'even' ? `<p class="balance-note ${bal.level}">${esc(bal.text)}</p>` : ''}</div>`;
    }).join('')}</div></section>`;

    const pain = s.painFlags?.length ? `<p class="safety mt-16">You stopped an exercise because of pain. If it persists or worries you, please consult a qualified healthcare professional.</p>` : '';

    return `${appbar({ title: fresh ? 'Summary' : 'Workout', back: !fresh, right: `<button class="icon-btn" data-action="sum-del" aria-label="Delete workout from history">${icon.trash}</button>` })}
      ${head}${lvl}${prs}${xp}${next}${detail}${pain}
      ${fresh ? `<button class="btn btn--primary btn--lg btn--block mt-24" data-action="go" data-href="#/">Done</button>` : ''}`;
  },
  actions: {
    'sum-del': async (ctx) => {
      const ok = await ctx.confirm({ title: 'Delete this workout?', text: 'Its sets, XP and records will be removed and your progress recalculated.', confirm: 'Delete', danger: true });
      if (!ok) return;
      await ctx.store.deleteSession(ctx.route.id);
      ctx.toast('Workout deleted.');
      ctx.go('#/workouts?tab=history', { replace: true });
    },
  },
};

/** Home — how am I doing, what should I train, am I getting stronger. */
import { bodyMap } from '../components/bodymap.js';
import { brandMark, icon, scoreBadge } from '../components/ui.js';
import { MUSCLES, MUSCLE_BY_ID } from '../data/muscles.js';
import { EXERCISE_BY_ID } from '../data/exercises.js';
import { recentProgress, weakMuscles } from '../engine/insights.js';
import { totals } from '../engine/session.js';
import { esc, plural } from '../utils/format.js';
import { greeting, relativeDay } from '../utils/date.js';
import { mapValues } from './shared.js';
import { WEEKDAYS } from '../engine/plan.js';
import { backupActions } from './backup.js';
import { weekCard } from './week.js';

export default {
  tab: 'home',
  title: 'Home',
  actions: {
    'h-deload-start': async (ctx) => { await ctx.store.startDeload(); ctx.toast('Deload week on — workouts this week start lighter.', { kind: 'good' }); },
    'h-deload-snooze': async (ctx) => { await ctx.store.snoozeDeload(); ctx.toast('Okay — FORGE will ask again next week.'); },
    'h-deload-end': async (ctx) => { await ctx.store.endDeload(); ctx.toast('Deload ended — back to normal training.'); },
    'h-backup-dismiss': (ctx) => ctx.store.saveSettings({ backupNudgeDismissed: Date.now() }),
    'bk-on': backupActions['bk-on'],
    'h-week': async (ctx, el) => { await ctx.store.saveSettings({ weekCardSeen: Number(el.dataset.from) }); ctx.go('#/week?w=1'); },
    'h-week-dismiss': (ctx, el) => ctx.store.saveSettings({ weekCardSeen: Number(el.dataset.from) }),
  },
  render(ctx) {
    const { store } = ctx;
    const p = store.progress;
    const st = store.streak;
    const done = store.done;
    const active = store.state.active;

    const hero = active
      ? (() => {
        const t = totals(active);
        return `<div class="card card--accent hero">
          <p class="eyebrow">Workout in progress</p>
          <h2>${esc(active.name)}</h2>
          <p class="small muted" style="margin:-8px 0 14px">${t.done} of ${t.planned} sets · started ${new Date(active.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          <button class="btn btn--primary btn--lg btn--block" data-action="go" data-href="#/session">Resume workout</button></div>`;
      })()
      : store.hasSchedule ? scheduledHero(ctx)
      : `<div class="card card--accent hero">
          <p class="greet">${greeting()}</p>
          <h2>Ready to train?</h2>
          <button class="btn btn--primary btn--lg btn--block" data-action="open-start">${icon.play} Start workout</button>
          ${nextUp(ctx)}
        </div>`;

    const weekDots = Array.from({ length: st.target }, (_, i) => `<i class="${i < st.weekCount ? 'on' : ''}"></i>`).join('');
    const streakCard = `<div class="card">
      <div class="streak">
        <div class="streak-num" aria-hidden="true">🔥</div>
        <div class="grow"><div class="row" style="align-items:baseline;gap:8px"><b class="num" style="font-size:28px;font-weight:800">${st.streak}</b><span class="text-2">training ${st.streak === 1 ? 'day' : 'days'} streak</span></div>
          <div class="small muted num">${st.weekCount} / ${st.target} sessions this week${st.best > st.streak ? ` · best ${st.best}` : ''}</div></div>
      </div>
      <div class="week-dots" aria-hidden="true">${weekDots}</div>
      <div class="row row--between mt-12 small">
        <span class="muted">${st.nextRest ? 'Next rest day' : 'Consistency beats intensity'}</span>
        <b>${esc(st.nextRest || 'Log your first workout')}</b>
      </div>
      ${st.alive && !st.trainedToday && st.lastDay ? `<div class="small muted mt-8">${st.restDaysLeft > 0 ? `You can rest ${plural(st.restDaysLeft, 'more day')} without losing your streak.` : 'Train today to keep your streak going.'}</div>` : ''}
    </div>`;

    const sorted = MUSCLES.map((m) => ({ m, s: p.muscles[m.id] })).sort((a, b) => b.s.xp - a.s.xp);
    const body = `<div class="card">
      ${bodyMap({ both: true, values: mapValues(p, 'level'), mode: 'level' })}
      <p class="bm-hint">Tap a muscle for details</p>
      <div class="mini-list mt-12">
        ${sorted.slice(0, 5).map(({ m, s }) => `<button class="mini-row" data-action="muscle" data-muscle="${m.id}">
          <span class="lvl">${s.info.level}</span><span class="grow"><span class="nm">${esc(m.name)}</span><br><span class="tr">${s.info.tier.name} · Level ${s.info.level}</span></span>
          <span style="width:30%">${`<div class="bar bar--thin"><i style="width:${(s.info.progress * 100).toFixed(0)}%"></i></div>`}</span></button>`).join('')}
      </div>
      <button class="btn btn--ghost btn--block btn--sm mt-8" data-action="go" data-href="#/progress">All 18 muscles</button>
    </div>`;

    const rp = recentProgress(p, done);
    const recent = rp.length
      ? `<div class="progress-list">${rp.map((r) => `<div class="pchip k-${r.kind}"><b>${esc(r.big)}</b><span>${esc(r.text)}</span></div>`).join('')}</div>`
      : `<div class="card small muted">${done.length ? 'Repeat an exercise in a later workout to see your progress here.' : 'Your progress will appear here after your first workout.'}</div>`;

    const weak = weakMuscles(p, { caps: store.caps, experience: store.settings.experience, sessionsCount: done.length });
    const focus = weak.length ? `<section class="section"><div class="section-head"><p class="eyebrow">Muscles to focus on</p></div>
      <div class="card card--flush">${weak.map((w) => `<button class="mlevel" data-action="muscle" data-muscle="${w.id}"><div><div class="name">${esc(w.name)}</div><div class="meta">Level ${w.level} · ${esc(w.text)}${w.suggestion ? ` Try ${esc(w.suggestion.name)}.` : ''}</div></div><div class="lv">${w.level}</div></button>`).join('')}</div></section>` : '';

    return `
      <header class="appbar"><div class="brand">${brandMark}<span class="brand-name">FORGE</span></div>
        <button class="icon-btn" data-action="go" data-href="#/settings" aria-label="Settings">${icon.gear}</button></header>
      ${hero}
      ${weekCard(ctx)}
      ${deloadCard(ctx)}
      ${backupNudge(ctx)}
      <section class="section"><div class="section-head"><p class="eyebrow">Streak</p></div>${streakCard}</section>
      <section class="section"><div class="section-head"><p class="eyebrow">Your body</p><button class="link" data-action="go" data-href="#/progress">Progress</button></div>${body}</section>
      ${focus}
      <section class="section"><div class="section-head"><p class="eyebrow">Recent progress</p>${done.length ? '<button class="link" data-action="go" data-href="#/workouts?tab=history">History</button>' : ''}</div>${recent}</section>
    `;
  },
};

/** One-line suggestion of which saved workout fits best today (most-recovered). */
function nextUp(ctx) {
  const { store } = ctx;
  const list = store.state.templates.filter((t) => t.items.length);
  if (!list.length) return `<p class="small muted mt-12 center">Build your first workout in a minute.</p>`;
  const scored = list.map((t) => ({ t, r: store.rateTemplate(t) }))
    .sort((a, b) => (b.r.components.recovery - a.r.components.recovery) || ((a.t.lastPerformedAt || 0) - (b.t.lastPerformedAt || 0)));
  const { t, r } = scored[0];
  const muscles = [...new Set(t.items.flatMap((i) => EXERCISE_BY_ID[i.exerciseId]?.primary || []))].slice(0, 3).map((m) => MUSCLE_BY_ID[m].short).join(', ');
  return `<button class="item mt-12" data-action="start-template" data-id="${t.id}" style="background:var(--surface-2)">
    ${scoreBadge(r)}<div class="grow"><div class="tiny muted" style="letter-spacing:.1em;text-transform:uppercase;font-weight:700">Suggested today</div>
    <div class="item-title ellipsis">${esc(t.name)}</div><div class="item-sub ellipsis">${esc(muscles)}${t.lastPerformedAt ? ` · last ${esc(relativeDay(t.lastPerformedAt).toLowerCase())}` : ''}</div></div>
    ${icon.play.replace('<svg', '<svg style="width:22px;color:var(--accent);flex:none"')}</button>`;
}

function scheduledHero(ctx) {
  const { store } = ctx;
  const t = store.scheduledFor();
  if (t) {
    const r = store.rateTemplate(t);
    const doneToday = t.lastPerformedAt && new Date(t.lastPerformedAt).toDateString() === new Date().toDateString();
    return `<div class="card card--accent hero">
      <p class="greet">${greeting()} ${doneToday ? 'Done for today.' : 'Today is'}</p>
      <h2>${esc(t.name)}</h2>
      <p class="small muted" style="margin:-8px 0 14px">${esc(r.split.name)} · ${plural(t.items.length, 'exercise')} · ~${r.estimatedMinutes} min</p>
      ${doneToday
        ? `<button class="btn btn--lg btn--block" data-action="open-start">${icon.play} Train again</button>`
        : `<button class="btn btn--primary btn--lg btn--block" data-action="start-template" data-id="${t.id}">${icon.play} Start ${esc(t.name)}</button>
           <button class="link center mt-12" style="display:block;margin:12px auto 0" data-action="open-start">Do a different workout</button>`}
    </div>`;
  }
  // rest day: show the next scheduled workout
  let next = null;
  for (let k = 1; k <= 7 && !next; k++) {
    const d = (new Date().getDay() + k) % 7;
    const id = store.schedule[d];
    if (id) next = { t: store.template(id), day: k === 1 ? 'Tomorrow' : WEEKDAYS[d] };
  }
  return `<div class="card card--accent hero">
    <p class="greet">${greeting()}</p>
    <h2>Rest day</h2>
    <p class="small text-2" style="margin:-8px 0 14px">Recovery is when muscles grow.${next ? ` Next up: <b>${esc(next.t.name)}</b> · ${esc(next.day)}.` : ''}</p>
    <button class="btn btn--block" data-action="open-start">${icon.play} Train anyway</button>
  </div>`;
}

function deloadCard(ctx) {
  const d = ctx.store.deload;
  if (d.state === 'due') {
    return `<section class="section"><div class="card card--deload">
      <div class="row" style="gap:12px;align-items:flex-start"><span class="feature-ic">${icon.feather}</span><div class="grow">
        <div class="item-title">Time for a deload week</div>
        <p class="small text-2" style="margin:4px 0 0">${d.trainedWeeks} weeks of hard training. A lighter week — about 40% fewer sets and 10% less weight — lets your joints and muscles catch up, so you come back stronger.</p></div></div>
      <div class="btn-row mt-12"><button class="btn btn--primary" data-action="h-deload-start">Start deload</button><button class="btn" data-action="h-deload-snooze">Not now</button></div>
    </div></section>`;
  }
  if (d.state === 'active') {
    return `<section class="section"><div class="card card--deload row" style="gap:12px">
      <span class="feature-ic">${icon.feather}</span><div class="grow"><div class="item-title">Deload week</div><div class="small text-2">Workouts start lighter this week. Normal training returns next week.</div></div>
      <button class="btn btn--sm" data-action="h-deload-end">End</button></div></section>`;
  }
  return '';
}

function backupNudge(ctx) {
  const { store } = ctx;
  if (store.sync?.enabled || store.done.length < 3 || store.settings.backupNudgeDismissed) return '';
  return `<section class="section"><div class="card row" style="gap:12px;align-items:flex-start">
    <span class="feature-ic">${icon.cloud}</span><div class="grow"><div class="item-title">Back up your progress</div>
    <p class="small text-2" style="margin:4px 0 10px">${store.done.length} workouts are stored only on this phone. Cloud backup keeps them safe and moves them to a new phone.</p>
    <button class="btn btn--sm btn--primary" data-action="bk-on">Turn on backup</button></div>
    <button class="icon-btn" data-action="h-backup-dismiss" aria-label="Dismiss">${icon.close}</button></div></section>`;
}

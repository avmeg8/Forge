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

export default {
  tab: 'home',
  title: 'Home',
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

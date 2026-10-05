/** Focused workout mode — log sets in one tap, rest timer, left/right tracking. */
import { icon, stepper, SAFETY_TEXT, demo } from '../components/ui.js';
import { EXERCISE_BY_ID } from '../data/exercises.js';
import { MUSCLE_BY_ID } from '../data/muscles.js';
import { itemState, nextIncomplete, totals, defaultDraft, afterSet, blockOf, groupLabels, warmupSets, warmupSuggestion } from '../engine/session.js';
import { DELOAD } from '../engine/deload.js';
import { previousPerformance } from '../engine/xp.js';
import { stepWeight, snapWeight, nextWeightUp, nextWeightDown } from '../engine/equipment.js';
import { restFor } from '../engine/rating.js';
import { sideBalance, EFFORT, effortLabel } from '../engine/progression.js';
import { swapOptions } from '../engine/swap.js';
import { esc, kg, clock, setLabel, repsRange, plural } from '../utils/format.js';
import { uid } from '../utils/id.js';
import { exerciseInfoHtml } from './exercise.js';
import { filterExercises, exerciseRow, filterBar } from './exercises.js';

let timer = null;
let wakeLock = null;

function A(ctx) { return ctx.store.state.active; }
function ui(ctx) { return (ctx.ui.session ||= { stopwatch: null }); }

const PR_LABEL = { strength: 'Strength PR', weight: 'Weight PR', reps: 'Rep PR', time: 'Time PR', volume: 'Volume PR' };

/** Current draft for the stepper, recomputed whenever the set/side changes. */
function draft(ctx) {
  const a = A(ctx);
  const i = a.current;
  const st = itemState(a, i);
  const key = `${st.setIndex}:${st.side}`;
  const d = a.drafts?.[i];
  if (d && d.key === key) return d;
  const item = a.items[i];
  const prev = previousPerformance(ctx.store.progress, item.exerciseId, a.id);
  const rec = ctx.store.recommendationFor(item.exerciseId, item, a.id);
  const cfg = ctx.store.cfgFor(item.exerciseId);
  const nd = { ...defaultDraft({ session: a, itemIndex: i, previous: prev, recommendation: rec, cfg }), key };
  // deload week: start ~10% lighter (once you've logged a set, your own choice carries over)
  if (a.deload && cfg && !st.logged.length && item.weight == null) nd.weight = snapWeight(nd.weight * DELOAD.weightFactor, cfg);
  // effort hint from the previous set ("felt easy" → a step up, "max and short" → a step down)
  const hint = a.hints?.[i];
  if (hint && cfg && hint.forSet === st.setIndex) nd.weight = hint.weight;
  (a.drafts ||= {})[i] = nd;
  return nd;
}

function setDraft(ctx, patch) {
  const a = A(ctx);
  const d = draft(ctx);
  Object.assign(d, patch);
  ctx.store.updateActive(() => {}, { silent: true });
  ctx.render();
}

/** Keep set numbers contiguous after a delete (per side for unilateral work). */
function renumber(a, itemIndex) {
  for (const side of [null, 'L', 'R']) {
    a.sets.filter((x) => x.itemIndex === itemIndex && !x.warmup && (x.side || null) === side)
      .sort((x, y) => x.ts - y.ts)
      .forEach((x, k) => { x.setIndex = k; });
  }
}

function elapsed(a) { return clock((Date.now() - a.startedAt) / 1000); }

function restView(ctx, a) {
  const r = a.rest;
  const left = Math.max(0, (r.endsAt - Date.now()) / 1000);
  const done = left <= 0;
  const nextI = a.current;
  const nextItem = a.items[nextI];
  const nextEx = nextItem && EXERCISE_BY_ID[nextItem.exerciseId];
  const nst = nextItem ? itemState(a, nextI) : null;
  return `<div class="rest ${done ? 'rest-done' : ''}" role="dialog" aria-label="Rest timer">
    <div class="rest-set"><div class="small" style="color:var(--good);font-weight:800;letter-spacing:.1em">✓ SET COMPLETE</div>
      <div style="font-size:20px;font-weight:800" class="num mt-8">${esc(r.label)}</div>
      ${r.xp ? `<div class="small muted num">+${Math.round(r.xp)} XP</div>` : ''}
      ${r.setIds?.length && ctx.store.settings.askEffort !== false ? (() => {
        const cur = a.sets.find((x) => x.id === r.setIds[r.setIds.length - 1])?.rir;
        return `<div class="effort mt-12" role="group" aria-label="How hard was that set?"><div class="tiny muted" style="margin-bottom:6px">How hard was it? <span class="faint">(reps left in the tank)</span></div>
          <div class="effort-row">${EFFORT.map((e) => `<button class="effort-chip" data-action="s-rir" data-v="${e.v}" aria-pressed="${cur === e.v}"><b>${e.label}</b><small>${e.sub}</small></button>`).join('')}</div></div>`;
      })() : ''}</div>
    <div class="rest-label">${done ? 'REST COMPLETE' : 'REST'}</div>
    <div class="rest-time" id="rest-time" aria-live="off">${clock(left)}</div>
    <div class="rest-ring"><i id="rest-bar" style="width:${(100 * (1 - left / r.total)).toFixed(1)}%"></i></div>
    ${nextEx && nst && !nst.complete ? `<p class="small muted" style="margin:0 0 16px">Next: <b class="text-2">${esc(nextEx.name)}</b> · Set ${nst.setIndex + 1} / ${nextItem.sets}${nst.side ? ` · ${nst.side === 'L' ? 'Left' : 'Right'}` : ''}</p>` : ''}
    ${done
      ? `<button class="btn btn--primary btn--lg rest-next" data-action="s-rest-skip" autofocus>Next set</button>`
      : `<div class="rest-actions"><button class="btn btn--lg" data-action="s-rest-add">+30 sec</button><button class="btn btn--lg" data-action="s-rest-skip">Skip</button></div>`}
  </div>`;
}

function render(ctx) {
  const a = A(ctx);
  if (!a) {
    return `<div class="empty card mt-24"><h3>No workout in progress</h3><p class="small">Start one from Home or Workouts.</p>
      <button class="btn btn--primary mt-12" data-action="go" data-href="#/">Go home</button></div>`;
  }
  if (a.current == null || a.current >= a.items.length) a.current = 0;
  const i = a.current;
  const item = a.items[i];
  const ex = EXERCISE_BY_ID[item.exerciseId];
  const st = itemState(a, i);
  const t = totals(a);
  const cfg = ctx.store.cfgFor(ex.id);
  const prev = previousPerformance(ctx.store.progress, ex.id, a.id);
  const prevSet = prev?.sets.find((p) => p.setIndex === st.setIndex && (p.side || null) === (st.side || null)) || prev?.bestSet;
  const live = ctx.store.liveProgress.sessions[a.id];
  const allDone = nextIncomplete(a, i) === -1;
  const labels = groupLabels(a.items);
  const blk = blockOf(a.items, i);
  const inBlock = blk && blk.idx.length > 1;
  const nextInBlock = inBlock ? blk.idx[(blk.idx.indexOf(i) + 1) % blk.idx.length] : null;
  const warmups = warmupSets(a, i);
  const segs = a.items.map((it, k) => {
    const s = itemState(a, k);
    return Array.from({ length: it.sets }, (_, j) => `<i class="${j < s.done ? 'done' : k === i && j === s.done ? 'cur' : ''}"></i>`).join('');
  }).join('');

  let body;
  if (st.complete) {
    body = `<div class="card center mt-16"><div style="font-size:30px">✓</div><h3 style="margin:6px 0">${esc(ex.name)} complete</h3>
      <p class="small muted">${plural(st.done, 'set')} logged.</p>
      <div class="btn-row mt-12">
        <button class="btn" data-action="s-add-set">${icon.plus} Add a set</button>
        ${allDone ? '' : `<button class="btn btn--primary" data-action="s-next-ex">Next exercise</button>`}
      </div></div>`;
  } else {
    const d = draft(ctx);
    const sw = ui(ctx).stopwatch;
    const amount = ex.metric === 'time'
      ? `<div><div class="log-label">Time</div>${stepper({ value: `<span id="sw-val">${sw ? Math.floor((Date.now() - sw) / 1000) : d.seconds}</span>`, unit: 's', dec: 's-amt-dec', inc: 's-amt-inc', label: 'seconds', decDisabled: d.seconds <= 5 })}
          <button class="btn btn--block mt-8 ${sw ? 'btn--primary' : ''}" data-action="s-sw">${icon.timer} ${sw ? 'Stop timer' : 'Start timer'}</button></div>`
      : `<div><div class="log-label">Reps</div>${stepper({ value: d.reps, dec: 's-amt-dec', inc: 's-amt-inc', label: 'reps', decDisabled: d.reps <= 0 })}</div>`;
    body = `
      <div class="log-block">
        ${cfg ? `<div><div class="log-label">Weight</div>${stepper({ value: kg(d.weight), unit: 'kg', dec: 's-w-dec', inc: 's-w-inc', label: 'weight', decDisabled: d.weight <= cfg.min, incDisabled: d.weight >= cfg.max })}</div>` : ''}
        ${amount}
        <button class="btn btn--primary btn--block btn-log" data-action="s-log">Log set${st.side ? ` · ${st.side === 'L' ? 'Left' : 'Right'}` : ''}</button>
        ${(() => {
          const wu = !st.logged.length && cfg ? warmupSuggestion(d.weight, cfg) : null;
          return wu ? `<button class="btn btn--ghost btn--block btn--sm" data-action="s-warmup" data-w="${wu.weight}" data-r="${wu.reps}">${icon.feather} Log a warm-up set · ${kg(wu.weight)} kg × ${wu.reps} <span class="muted">(no XP)</span></button>` : '';
        })()}
      </div>`;
  }

  const logged = st.logged.length || warmups.length ? `<div class="logged">${[...warmups, ...st.logged].map((s) => `<div class="logged-row ${s.warmup ? 'logged-row--wu' : ''}"><span class="tag">${s.warmup ? 'W' : `${s.setIndex + 1}${s.side ? s.side : ''}`}</span><span>${esc(setLabel(s, ex))}</span>
      <span class="x num">${s.warmup ? 'warm-up' : `${s.rir != null ? `<span class="rir-tag rir-${s.rir}">${effortLabel(s.rir)}</span> ` : ''}+${Math.round(live?.setXp[s.id] || 0)} XP`}</span>
      <button class="icon-btn" style="width:36px;height:36px" data-action="s-del-set" data-id="${s.id}" aria-label="Delete this set">${icon.close}</button></div>`).join('')}</div>` : '';
  const bal = sideBalance(ex, st.logged);
  const balance = bal && bal.level !== 'even' ? `<p class="balance-note ${bal.level}">${esc(bal.text)}</p>` : '';

  return `
    <div class="sess-top">
      <button class="icon-btn" data-action="s-menu" aria-label="Workout options">${icon.close}</button>
      <div class="grow center"><div class="small text-2 ellipsis">${esc(a.name)}</div><div class="sess-time" id="s-elapsed">${elapsed(a)}</div></div>
      <button class="icon-btn" data-action="s-list" aria-label="All exercises">${icon.list}</button>
    </div>
    <div class="sess-progress" aria-label="${t.done} of ${t.planned} sets done">${segs}</div>
    ${a.deload ? `<div class="deload-pill">${icon.feather} Deload week — lighter on purpose: fewer sets, ~10% less weight</div>` : ''}
    ${inBlock ? `<div class="ss-pill"><b>${blk.idx.length === 2 ? 'Superset' : 'Circuit'} ${esc(labels[i])}</b><span>then ${esc(EXERCISE_BY_ID[a.items[nextInBlock].exerciseId].name)}${blk.idx.indexOf(i) === blk.idx.length - 1 ? ' after rest' : ' — no rest'}</span></div>` : ''}
    <div class="row row--between"><span class="ex-muscle">${esc(ex.primary.map((m) => MUSCLE_BY_ID[m].short).join(' · '))}</span>
      <span class="small muted">Exercise ${i + 1} / ${a.items.length} · <button class="link" style="padding:4px 2px;font-size:13px" data-action="s-swap">⇄ Swap</button></span></div>
    <div class="row" style="align-items:center;gap:12px"><h1 class="ex-title grow">${esc(ex.name)}</h1>
      ${demo(ex, { cls: 'demo--thumb', open: true, caption: false })}</div>
    <div class="row row--between mt-8">
      <div style="font-size:20px;font-weight:800" class="num">SET ${Math.min(st.setIndex + 1, item.sets)} <span class="muted" style="font-weight:600">/ ${item.sets}</span></div>
      ${ex.unilateral ? `<div class="side-pill" aria-label="Side"><span class="${st.side === 'L' && !st.complete ? 'on' : ''}">LEFT</span><span class="${st.side === 'R' && !st.complete ? 'on' : ''}">RIGHT</span></div>` : ''}
    </div>
    <div class="set-meta">
      <div><span>${ex.metric === 'time' ? 'Target' : 'Target reps'}</span><b>${repsRange(item.repMin, item.repMax, ex.metric)}</b></div>
      <div><span>Previous</span><b>${prevSet ? esc(setLabel(prevSet, ex)) : '—'}</b></div>
      <div><span>XP today</span><b class="num">${Math.round(st.logged.reduce((s, x) => s + (live?.setXp[x.id] || 0), 0))}</b></div>
    </div>
    ${body}
    ${balance}
    ${logged}
    ${allDone ? `<button class="btn btn--primary btn--lg btn--block mt-24" data-action="s-finish">Finish workout</button>` : `<button class="btn btn--ghost btn--block mt-24" data-action="s-finish">Finish workout</button>`}
    <button class="link center" style="display:block;margin:14px auto 0" data-action="s-pain">Feeling pain?</button>
    ${a.rest ? restView(ctx, a) : ''}`;
}

function tick(ctx) {
  const a = A(ctx);
  if (!a) return;
  const el = document.getElementById('s-elapsed');
  if (el) el.textContent = elapsed(a);
  const sw = ui(ctx).stopwatch;
  if (sw) { const v = document.getElementById('sw-val'); if (v) v.textContent = Math.floor((Date.now() - sw) / 1000); }
  if (a.rest) {
    const left = (a.rest.endsAt - Date.now()) / 1000;
    const t = document.getElementById('rest-time');
    if (t) t.textContent = clock(Math.max(0, left));
    const b = document.getElementById('rest-bar');
    if (b) b.style.width = `${Math.min(100, 100 * (1 - Math.max(0, left) / a.rest.total)).toFixed(1)}%`;
    if (left <= 0 && !a.rest.notified) {
      a.rest.notified = true;
      ctx.store.updateActive(() => {}, { silent: true });
      notifyRestDone(ctx);
      ctx.render();
    }
  }
}

function notifyRestDone(ctx) {
  const s = ctx.store.settings;
  if (s.vibrate !== false) navigator.vibrate?.([180, 90, 180]);
  if (s.sound !== false) {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18].forEach((d) => {
        const o = ac.createOscillator(); const g = ac.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ac.destination);
        g.gain.setValueAtTime(0.0001, ac.currentTime + d);
        g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d + 0.15);
        o.start(ac.currentTime + d); o.stop(ac.currentTime + d + 0.16);
      });
      setTimeout(() => ac.close(), 600);
    } catch { /* audio not available */ }
  }
}

async function logSet(ctx) {
  const { store } = ctx;
  const a = A(ctx);
  const i = a.current;
  const item = a.items[i];
  const ex = EXERCISE_BY_ID[item.exerciseId];
  const st = itemState(a, i);
  const d = draft(ctx);
  const u = ui(ctx);
  let seconds = d.seconds;
  if (ex.metric === 'time' && u.stopwatch) { seconds = Math.floor((Date.now() - u.stopwatch) / 1000); u.stopwatch = null; }
  const amount = ex.metric === 'time' ? seconds : d.reps;
  if (!(amount > 0)) { ctx.toast(ex.metric === 'time' ? 'Set the time first.' : 'Set your reps first.'); return; }

  const set = {
    id: uid('x'), exerciseId: ex.id, itemIndex: i, setIndex: st.setIndex, side: st.side,
    weight: store.cfgFor(ex.id) ? d.weight : 0, reps: ex.metric === 'time' ? 0 : d.reps, ts: Date.now(),
    ...(ex.metric === 'time' ? { seconds } : {}),
  };
  await store.updateActive((s) => { s.sets.push(set); }, { silent: true });

  // live XP + PR detection for this set
  const res = store.liveProgress.sessions[a.id];
  const xp = res?.setXp[set.id] || 0;
  const announced = (a.prAnnounced ||= {});
  for (const pr of res?.prs || []) {
    if (pr.set?.id !== set.id) continue;
    const k = `${pr.exerciseId}:${pr.type}`;
    const value = pr.type === 'volume' ? pr.value : pr.set ? `${pr.set.weight}x${pr.set.reps || pr.set.seconds}` : '';
    if (announced[k] === value) continue;
    announced[k] = value;
    if (pr.type === 'volume') continue; // volume PRs are shown in the summary
    ctx.toast(`🏆 <span><b>NEW ${PR_LABEL[pr.type].toUpperCase()}</b><br>${esc(ex.name)} · ${esc(setLabel(pr.set, ex))}${pr.previous ? `<br><span class="small muted">Previous: ${esc(setLabel(pr.previous, ex))}</span>` : ''}</span>`, { kind: 'pr', ms: 4200 });
    navigator.vibrate?.(60);
  }

  const label = `${setLabel(set, ex)}${set.side ? ` · ${set.side === 'L' ? 'Left' : 'Right'}` : ''}`;
  if (set.side === 'L') {
    // switch straight to the right side — no rest between sides
    ctx.toast(`✓ Left done · ${esc(setLabel(set, ex))} — now right side`, { kind: 'good', ms: 1800 });
    await store.updateActive(() => {});
    return;
  }
  const nav = afterSet(a, i);
  const blk = blockOf(a.items, i);
  // supersets rest once per round, as long as the longest rest in the block
  const restSec = blk && blk.idx.length > 1 ? Math.max(...blk.idx.map((k) => restFor(EXERCISE_BY_ID[a.items[k].exerciseId], store.settings))) : restFor(ex, store.settings);
  if (nav.transition) {
    const nx = EXERCISE_BY_ID[a.items[nav.next].exerciseId];
    await store.updateActive((s) => { s.current = nav.next; s.rest = null; });
    ctx.toast(`✓ ${esc(label)} · +${Math.round(xp)} XP — now ${esc(nx.name)}`, { kind: 'good', ms: 1800 });
    return;
  }
  await store.updateActive((s) => {
    if (nav.next !== -1) s.current = nav.next;
    const finished = nextIncomplete(s, s.current) === -1;
    const ids = [set.id, ...(set.side === 'R' ? s.sets.filter((x) => x.itemIndex === i && x.side === 'L' && x.setIndex === set.setIndex).map((x) => x.id) : [])];
    s.rest = finished ? null : { endsAt: Date.now() + restSec * 1000, total: restSec, label, xp, setIds: ids, itemIndex: i };
  });
  if (nextIncomplete(a, a.current) === -1) ctx.toast(`✓ ${esc(label)} · +${Math.round(xp)} XP — all sets done!`, { kind: 'good' });
}

/** Store how hard the last set felt and nudge the next set's weight if it was clearly off. */
async function rateEffort(ctx, rir) {
  const a = A(ctx);
  const r = a?.rest;
  if (!r?.setIds) return;
  const sets = a.sets.filter((x) => r.setIds.includes(x.id));
  if (!sets.length) return;
  const i = sets[0].itemIndex;
  const item = a.items[i];
  const ex = EXERCISE_BY_ID[item.exerciseId];
  const cfg = ctx.store.cfgFor(ex.id);
  const amount = Math.min(...sets.map((x) => (ex.metric === 'time' ? x.seconds ?? 0 : x.reps)));
  let msg = '';
  await ctx.store.updateActive((s) => {
    for (const x of s.sets) if (r.setIds.includes(x.id)) x.rir = rir;
    const next = sets[0].setIndex + 1;
    const w = sets[0].weight;
    if (!s.hints) s.hints = {};
    delete s.hints[i];
    if (cfg && ex.metric !== 'time' && next < item.sets) {
      if (rir >= 4 && amount >= item.repMax) {
        const up = nextWeightUp(w, cfg);
        if (up) { s.hints[i] = { forSet: next, weight: up }; msg = `Felt easy — next set at ${kg(up)} kg.`; }
      } else if (rir === 0 && amount < item.repMin) {
        const down = nextWeightDown(w, cfg);
        if (down) { s.hints[i] = { forSet: next, weight: down }; msg = `That was a grind — next set at ${kg(down)} kg.`; }
      }
      if (s.drafts?.[i]) delete s.drafts[i];
    }
  });
  if (msg) ctx.toast(msg, { ms: 2200 });
}

/** Replace the current exercise with a similar one (keeps the remaining sets). */
function swapSheet(ctx) {
  const a = A(ctx);
  const i = a.current;
  const item = a.items[i];
  const ex = EXERCISE_BY_ID[item.exerciseId];
  const opts = swapOptions(ex.id, { caps: ctx.store.caps, experience: ctx.store.settings.experience, exclude: a.items.map((x) => x.exerciseId) });
  ctx.sheet.open({
    title: `Swap ${ex.name}`,
    tall: true,
    render: () => `<p class="small text-2" style="margin-top:0">Similar exercises you can do with your equipment. ${itemState(a, i).done ? 'Sets you already logged stay; the rest move to the new exercise.' : 'Your planned sets carry over.'}</p>
      ${opts.length ? `<div class="list">${opts.map((o) => `<button class="item" data-action="s-swap-pick" data-id="${o.ex.id}">
        <div class="grow" style="min-width:0"><div class="item-title ellipsis">${esc(o.ex.name)}</div>
        <div class="item-sub">${esc(o.why)}${o.tag ? ` · ${o.tag}` : ''} · ${esc(o.ex.primary.map((m) => MUSCLE_BY_ID[m].short).join(', '))}</div></div>${icon.chev.replace('<svg', '<svg class="chev"')}</button>`).join('')}</div>`
        : '<p class="muted">No similar exercise fits your equipment — try “Add exercise” from the exercise list instead.</p>'}`,
    actions: {
      's-swap-pick': async (c, el) => {
        const nx = EXERCISE_BY_ID[el.dataset.id];
        await ctx.store.updateActive((s) => swapItem(s, s.current, nx));
        ctx.sheet.close();
        ctx.toast(`Swapped to ${esc(nx.name)}.`, { kind: 'good' });
      },
    },
  });
}

export function swapItem(s, i, nx) {
  const item = s.items[i];
  const done = itemState(s, i).done;
  const fresh = { uid: uid('i'), exerciseId: nx.id, sets: Math.max(1, item.sets - done), repMin: nx.reps[0], repMax: nx.reps[1], weight: null, ...(item.group ? { group: item.group } : {}), swappedFrom: item.exerciseId };
  if (!done && !s.sets.some((x) => x.itemIndex === i)) {
    s.items[i] = { ...fresh, sets: item.sets };
  } else {
    // keep what was logged under the old exercise; insert the new one right after it
    item.sets = done;
    s.items.splice(i + 1, 0, fresh);
    for (const x of s.sets) if (x.itemIndex > i) x.itemIndex += 1;
    const shift = (obj) => obj && Object.fromEntries(Object.entries(obj).map(([k, v]) => [Number(k) > i ? Number(k) + 1 : Number(k), v]));
    s.drafts = shift(s.drafts) || {};
    s.hints = shift(s.hints) || {};
    s.current = i + 1;
  }
  if (s.drafts) delete s.drafts[s.current];
  if (s.hints) delete s.hints[s.current];
  s.rest = null;
}

function exerciseListSheet(ctx) {
  ctx.sheet.open({
    title: 'Exercises',
    live: true,
    render: () => {
      const a = A(ctx);
      if (!a) return '';
      const labels = groupLabels(a.items);
      return `<div class="list">${a.items.map((it, k) => {
        const ex = EXERCISE_BY_ID[it.exerciseId];
        const s = itemState(a, k);
        return `<button class="item" data-action="s-jump" data-i="${k}" ${k === a.current ? 'style="border-color:var(--accent)"' : ''}>
          <span class="wx-idx ${labels[k] ? 'wx-idx--ss' : ''}">${s.complete ? '✓' : labels[k] || k + 1}</span><div class="grow"><div class="item-title ellipsis">${esc(ex.name)}</div>
          <div class="item-sub">${s.done} / ${it.sets} sets · ${repsRange(it.repMin, it.repMax, ex.metric)}</div></div></button>`;
      }).join('')}</div>
      <button class="btn btn--block mt-12" data-action="s-add-ex" style="border-style:dashed">${icon.plus} Add exercise</button>`;
    },
    actions: {
      's-jump': (c, el) => {
        ctx.store.updateActive((s) => { s.current = Number(el.dataset.i); s.rest = null; });
        ctx.sheet.close();
      },
      's-add-ex': () => addExerciseSheet(ctx),
    },
  });
}

function addExerciseSheet(ctx) {
  const s = (ctx.ui.sessAdd ||= { query: '', group: 'all', scope: 'available' });
  const results = () => `<div class="list">${filterExercises({ ...s, caps: ctx.store.caps }).map((e) => exerciseRow(e, { caps: ctx.store.caps, action: 's-add-pick' })).join('')}</div>`;
  ctx.sheet.open({
    title: 'Add to this workout',
    tall: true,
    render: () => `${filterBar(s, 'sa')}<div class="mt-16" id="sa-results">${results()}</div>`,
    actions: {
      'sa-group': (c, el) => { s.group = el.dataset.v; ctx.sheet.refresh({ keepScroll: false }); },
      'sa-scope': (c, el) => { s.scope = el.dataset.v; ctx.sheet.refresh({ keepScroll: false }); },
      's-add-pick': async (c, el) => {
        await ctx.store.updateActive((a) => { a.items.push(ctx.store.makeItem(el.dataset.id)); a.current = a.items.length - 1; a.rest = null; });
        ctx.sheet.close();
      },
    },
    inputs: { 'sa-search': (c, el) => { s.query = el.value; ctx.sheet.patch('#sa-results', results()); } },
  });
}

async function finish(ctx) {
  const a = A(ctx);
  const t = totals(a);
  if (!a.sets.length) {
    const ok = await ctx.confirm({ title: 'End workout?', text: 'No sets have been logged, so nothing will be saved.', confirm: 'End workout', danger: true });
    if (!ok) return;
    await ctx.store.discardSession();
    ctx.go('#/', { replace: true });
    return;
  }
  if (t.done < t.planned) {
    const ok = await ctx.confirm({ title: 'Finish early?', text: `${t.planned - t.done} planned ${t.planned - t.done === 1 ? 'set is' : 'sets are'} not logged. Everything you did log is saved and counts.`, confirm: 'Finish workout' });
    if (!ok) return;
  }
  const done = await ctx.store.finishSession();
  ctx.go(done ? `#/summary/${done.id}?fresh=1` : '#/', { replace: true });
}

export default {
  hideNav: true,
  focus: true,
  title: 'Workout',
  render,
  mount(ctx) {
    clearInterval(timer);
    timer = setInterval(() => tick(ctx), 250);
    if ('wakeLock' in navigator && !wakeLock && A(ctx)) {
      navigator.wakeLock.request('screen').then((l) => { wakeLock = l; l.addEventListener('release', () => { wakeLock = null; }); }).catch(() => {});
    }
  },
  unmount() {
    clearInterval(timer);
    timer = null;
    wakeLock?.release?.().catch(() => {});
    wakeLock = null;
  },
  actions: {
    's-log': (ctx) => logSet(ctx),
    's-rir': (ctx, el) => rateEffort(ctx, Number(el.dataset.v)),
    's-swap': (ctx) => swapSheet(ctx),
    's-warmup': async (ctx, el) => {
      const a = A(ctx);
      const item = a.items[a.current];
      await ctx.store.updateActive((s) => {
        s.sets.push({ id: uid('x'), exerciseId: item.exerciseId, itemIndex: s.current, setIndex: -1, side: null, warmup: true, weight: Number(el.dataset.w), reps: Number(el.dataset.r), ts: Date.now() });
      });
      ctx.toast('Warm-up logged — now your working sets.', { ms: 1600 });
    },
    's-w-dec': (ctx) => { const d = draft(ctx); setDraft(ctx, { weight: stepWeight(d.weight, -1, ctx.store.cfgFor(A(ctx).items[A(ctx).current].exerciseId)) }); },
    's-w-inc': (ctx) => { const d = draft(ctx); setDraft(ctx, { weight: stepWeight(d.weight, 1, ctx.store.cfgFor(A(ctx).items[A(ctx).current].exerciseId)) }); },
    's-amt-dec': (ctx) => {
      const ex = EXERCISE_BY_ID[A(ctx).items[A(ctx).current].exerciseId];
      const d = draft(ctx);
      if (ex.metric === 'time') { ui(ctx).stopwatch = null; setDraft(ctx, { seconds: Math.max(5, d.seconds - 5) }); } else setDraft(ctx, { reps: Math.max(0, d.reps - 1) });
    },
    's-amt-inc': (ctx) => {
      const ex = EXERCISE_BY_ID[A(ctx).items[A(ctx).current].exerciseId];
      const d = draft(ctx);
      if (ex.metric === 'time') { ui(ctx).stopwatch = null; setDraft(ctx, { seconds: d.seconds + 5 }); } else setDraft(ctx, { reps: Math.min(100, d.reps + 1) });
    },
    's-sw': (ctx) => {
      const u = ui(ctx);
      if (u.stopwatch) { const secs = Math.floor((Date.now() - u.stopwatch) / 1000); u.stopwatch = null; setDraft(ctx, { seconds: Math.max(1, secs) }); }
      else { u.stopwatch = Date.now(); ctx.render(); }
    },
    's-rest-add': (ctx) => ctx.store.updateActive((a) => { if (a.rest) { a.rest.endsAt = Math.max(a.rest.endsAt, Date.now()) + 30000; a.rest.total += 30; a.rest.notified = false; } }),
    's-rest-skip': (ctx) => ctx.store.updateActive((a) => { a.rest = null; }),
    's-next-ex': (ctx) => ctx.store.updateActive((a) => { const n = nextIncomplete(a, a.current); if (n !== -1) a.current = n; }),
    's-add-set': (ctx) => ctx.store.updateActive((a) => { a.items[a.current].sets += 1; }),
    's-del-set': async (ctx, el) => {
      const a = A(ctx);
      const idx = a.sets.findIndex((s) => s.id === el.dataset.id);
      if (idx < 0) return;
      const [removed] = a.sets.splice(idx, 1);
      renumber(a, removed.itemIndex);
      await ctx.store.updateActive(() => {});
      ctx.toast('Set deleted.', { action: { label: 'Undo', run: () => ctx.store.updateActive((s) => { s.sets.splice(idx, 0, removed); renumber(s, removed.itemIndex); }) } });
    },
    's-list': (ctx) => exerciseListSheet(ctx),
    's-info': (ctx) => {
      const ex = EXERCISE_BY_ID[A(ctx).items[A(ctx).current].exerciseId];
      ctx.sheet.open({ title: ex.name, render: () => exerciseInfoHtml(ex) });
    },
    's-finish': (ctx) => finish(ctx),
    's-menu': (ctx) => {
      ctx.sheet.open({
        title: 'Workout',
        render: () => `<div class="list">
          <button class="item" data-action="s-m-finish">${icon.check}<span class="grow item-title">Finish & save workout</span></button>
          <button class="item" data-action="s-m-home">${icon.home}<span class="grow item-title">Leave (keep workout running)</span></button>
          <button class="item" data-action="s-m-discard" style="color:var(--bad)">${icon.trash}<span class="grow item-title">Discard workout</span></button></div>`,
        actions: {
          's-m-finish': () => { ctx.sheet.close(); finish(ctx); },
          's-m-home': () => { ctx.sheet.close(); ctx.go('#/'); },
          's-m-discard': async () => {
            ctx.sheet.close();
            const ok = await ctx.confirm({ title: 'Discard workout?', text: 'All sets logged in this workout will be deleted.', confirm: 'Discard', danger: true });
            if (ok) { await ctx.store.discardSession(); ctx.go('#/', { replace: true }); }
          },
        },
      });
    },
    's-pain': (ctx) => {
      ctx.sheet.open({
        title: 'Feeling pain?',
        render: () => `<p style="font-size:17px;font-weight:700;margin-top:0">Stop the exercise now.</p>
          <ul class="ul"><li>Sharp, sudden or joint pain is a signal to stop — not to push through.</li>
          <li>Don't continue this movement today. A pain-free alternative or rest is fine.</li>
          <li>If pain persists, gets worse, or worries you, consult a qualified healthcare professional.</li></ul>
          <p class="safety mt-16">${esc(SAFETY_TEXT)} FORGE can't diagnose injuries.</p>`,
        foot: () => `<div class="stack"><button class="btn btn--primary btn--block" data-action="s-p-skip">Stop this exercise</button>
          <button class="btn btn--block" data-action="s-p-end">End workout</button>
          <button class="btn btn--ghost btn--block" data-action="close-sheet">It's just normal muscle effort</button></div>`,
        actions: {
          's-p-skip': async () => {
            await ctx.store.updateActive((a) => {
              const st = itemState(a, a.current);
              (a.painFlags ||= []).push({ exerciseId: a.items[a.current].exerciseId, ts: Date.now() });
              // drop an unmatched left-side set, then cap the planned sets at what's done
              if (st.side === 'R') a.sets = a.sets.filter((s) => !(s.itemIndex === a.current && s.setIndex === st.setIndex && s.side === 'L'));
              a.items[a.current].sets = Math.max(0, st.done);
              a.rest = null;
              const n = nextIncomplete(a, a.current);
              if (n !== -1) a.current = n;
            });
            ctx.sheet.close();
            ctx.toast('Exercise stopped. Take care.');
          },
          's-p-end': () => { ctx.sheet.close(); finish(ctx); },
        },
      });
    },
  },
};

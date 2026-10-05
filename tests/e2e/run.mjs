/**
 * End-to-end test of the whole connected system in a real (headless) Chromium,
 * emulating an Android phone. Run with `npm run test:e2e` (needs `npm install`).
 *
 * Covers: onboarding, workout builder (add/remove/undo/reorder), live rating + suggestion,
 * session logging, rest timer, left/right tracking, XP + levels, PR detection, streak,
 * history, body map + muscle sheet + front/back, "Train <muscle>", equipment unlocks,
 * persistence across reloads, offline mode via the service worker, PWA manifest/icons,
 * and no horizontal scrolling at 320/360/390/412 px.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const root = join(fileURLToPath(import.meta.url), '..', '..', '..');
const PORT = 5199;
const BASE = `http://localhost:${PORT}/`;
const SHOTS = join(root, 'tests', 'e2e', 'screenshots');
await mkdir(SHOTS, { recursive: true });

const server = spawn(process.execPath, [join(root, 'scripts', 'serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'pipe' });
await new Promise((r) => server.stdout.once('data', r));

const results = [];
async function step(name, fn) {
  try { await fn(); results.push(['✓', name]); console.log(`  ✓ ${name}`); }
  catch (e) { results.push(['✗', name, e]); console.log(`  ✗ ${name}\n    ${e.message.split('\n').join('\n    ')}`); }
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'allow' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const S = (sel) => page.locator(sel);
const state = (fn, arg) => page.evaluate(fn, arg);
const shot = (name) => page.screenshot({ path: join(SHOTS, `${name}.png`) });
const wait = (ms = 150) => page.waitForTimeout(ms);
const tap = async (sel) => { await S(sel).first().click(); await wait(); };

console.log('FORGE E2E');
await page.goto(BASE);
await wait(500);

await step('onboarding: experience, dumbbell range, frequency → welcome → home', async () => {
  await tap('[data-action="onb-exp"][data-v="intermediate"]');
  await S('[data-k="min"]').fill('2');
  await S('[data-k="max"]').fill('30');
  await S('[data-k="inc"]').fill('1');
  await tap('[data-action="onb-freq"][data-v="4"]');
  await shot('01-onboarding');
  await tap('[data-action="onb-next"]');
  await S('text=WELCOME TO').or(S('text=Welcome to')).first().waitFor();
  await tap('[data-action="onb-start"]');
  await S('text=Ready to train?').waitFor();
  const s = await state(() => FORGE.store.settings);
  assert.equal(s.onboarded, true);
  assert.deepEqual(s.profiles[0].items.adjustable_dumbbell.load, { min: 2, max: 30, increment: 1 });
  const lvls = await state(() => Object.values(FORGE.store.progress.muscles).map((m) => m.info.level));
  assert.equal(lvls.length, 18);
  assert.ok(lvls.every((l) => l === 1), 'everyone starts at level 1');
  await shot('02-home-empty');
});

async function addExercise(name) {
  await S('.sheet input[type="search"]').fill(name);
  await wait(120);
  await S(`.sheet [data-action="b-add"]:has-text("${name}")`).first().click();
  await wait(150);
}

await step('builder: create, name, add exercises, live rating', async () => {
  await tap('.nav a[href="#/workouts"]');
  await tap('[data-action="w-new"]');
  await S('#b-name').fill('My Upper Body');
  await tap('[data-action="b-add-open"]');
  for (const n of ['Dumbbell Floor Press', 'One-Arm Dumbbell Row', 'Hammer Curl', 'One-Arm Overhead Extension']) await addExercise(n);
  await shot('03-add-sheet');
  await tap('.sheet [data-action="close-sheet"]');
  const t = await state(() => FORGE.store.state.templates[0]);
  assert.equal(t.name, 'My Upper Body');
  assert.equal(t.items.length, 4);
  const r = await state(() => { const t = FORGE.store.state.templates[0]; return FORGE.store.rate(t.items, t.targetMinutes); });
  assert.ok(r.score >= 70 && r.score <= 92, `score ${r.score}`);
  assert.ok(r.suggestion, 'expects a suggestion');
  await S('#analysis').scrollIntoViewIfNeeded();
  await shot('04-analysis');
  assert.ok(await S('#analysis >> text=Target muscles').count());
});

await step('builder: suggested addition raises the rating', async () => {
  const before = await state(() => { const t = FORGE.store.state.templates[0]; return FORGE.store.rate(t.items, t.targetMinutes).score; });
  await tap('[data-action="b-add-suggest"]');
  const after = await state(() => { const t = FORGE.store.state.templates[0]; return FORGE.store.rate(t.items, t.targetMinutes).score; });
  assert.ok(after > before, `${after} > ${before}`);
});

await step('builder: reorder, edit sets, remove + undo', async () => {
  const ids = await state(() => FORGE.store.state.templates[0].items.map((i) => i.exerciseId));
  await S('.wx').nth(1).locator('[data-action="b-toggle"]').first().click();
  await wait();
  await tap('.wx-body [data-action="b-up"]');
  let now = await state(() => FORGE.store.state.templates[0].items.map((i) => i.exerciseId));
  assert.equal(now[0], ids[1]);
  assert.equal(now[1], ids[0]);
  await tap('.wx-body [data-action="b-sets-inc"]');
  assert.equal(await state(() => FORGE.store.state.templates[0].items[0].sets), 4);
  await tap('.wx-body [data-action="b-sets-dec"]');
  await tap('.wx-body [data-action="b-remove"]');
  now = await state(() => FORGE.store.state.templates[0].items.length);
  assert.equal(now, ids.length - 1);
  await tap('.toast-action');
  now = await state(() => FORGE.store.state.templates[0].items.map((i) => i.exerciseId));
  assert.equal(now[0], ids[1], 'undo restores position');
  // restore original order: move row back down
  await S('.wx').first().locator('[data-action="b-toggle"]').first().click();
  await wait();
  if (!(await S('.wx-body').count())) { await S('.wx').first().locator('[data-action="b-toggle"]').first().click(); await wait(); }
  await tap('.wx-body [data-action="b-down"]');
  now = await state(() => FORGE.store.state.templates[0].items.map((i) => i.exerciseId));
  assert.equal(now[0], ids[0]);
});

await step('builder: workout focus — pick a split and the rating follows it', async () => {
  const before = await state(() => { const t = FORGE.store.state.templates[0]; return FORGE.store.rateTemplate(t).split; });
  assert.equal(before.auto, true);
  await tap('[data-action="b-focus"]');
  await S('.sheet >> text=Workout focus').first().waitFor();
  await tap('.sheet [data-action="f-pick"][data-v="chest_back"]');
  await shot('04b-focus-sheet');
  await tap('.sheet [data-action="close-sheet"]');
  const r = await state(() => { const t = FORGE.store.state.templates[0]; return { focus: t.focus, split: FORGE.store.rateTemplate(t).split.name }; });
  assert.equal(r.focus, 'chest_back');
  assert.equal(r.split, 'Chest & Back');
  assert.ok(await S('#analysis >> text=Chest & Back').count());
  // back to automatic for the rest of the run
  await tap('[data-action="b-focus"]');
  await tap('.sheet [data-action="f-pick"][data-v="auto"]');
  await tap('.sheet [data-action="close-sheet"]');
});

await step('session: start, log sets, rest timer (+30 / skip), XP flows to muscles', async () => {
  await tap('[data-action="b-start"]');
  await S('.ex-title').waitFor();
  assert.equal(await S('.ex-title').innerText(), 'Dumbbell Floor Press');
  await shot('05-session');
  // set 1: default weight, bump reps to 10
  const reps = Number(await S('.stepper[aria-label="reps"] .stepper-value').innerText());
  for (let i = reps; i < 10; i++) await tap('[data-action="s-amt-inc"]');
  await tap('[data-action="s-log"]');
  await S('.rest').waitFor();
  await shot('06-rest');
  const t1 = await state(() => FORGE.store.state.active.rest.endsAt);
  await tap('[data-action="s-rest-add"]');
  const t2 = await state(() => FORGE.store.state.active.rest.endsAt);
  assert.ok(t2 - t1 >= 29000, 'rest +30 s');
  await tap('[data-action="s-rest-skip"]');
  assert.equal(await S('.rest').count(), 0);
  // sets 2 and 3 — next set is already prepared
  for (let k = 0; k < 2; k++) { await tap('[data-action="s-log"]'); await tap('[data-action="s-rest-skip"]'); }
  const live = await state(() => { const a = FORGE.store.state.active; const r = FORGE.store.liveProgress.sessions[a.id]; return { sets: a.sets.length, chest: r.xpByMuscle.chest, triceps: r.xpByMuscle.triceps }; });
  assert.equal(live.sets, 3);
  assert.ok(live.chest > live.triceps && live.triceps > 0, JSON.stringify(live));
  assert.equal(await S('.ex-title').innerText(), 'One-Arm Dumbbell Row', 'auto-advances to next exercise');
});

await step('session: left/right tracking, no rest between sides, imbalance note', async () => {
  assert.ok(await S('.side-pill span.on:has-text("LEFT")').count());
  await tap('[data-action="s-log"]'); // left
  assert.equal(await S('.rest').count(), 0, 'no rest between sides');
  assert.ok(await S('.side-pill span.on:has-text("RIGHT")').count());
  await tap('[data-action="s-amt-dec"]'); // right side one rep fewer
  await tap('[data-action="s-log"]');
  await tap('[data-action="s-rest-skip"]');
  const note = await S('.balance-note').innerText();
  assert.match(note, /Right side: 1 rep behind\./);
  const sides = await state(() => FORGE.store.state.active.sets.filter((s) => s.exerciseId === 'one_arm_row').map((s) => s.side));
  assert.deepEqual(sides, ['L', 'R']);
  await shot('07-unilateral');
});

await step('session: finish early → summary with XP, level and next-time advice', async () => {
  await tap('[data-action="s-finish"]');
  await tap('.sheet [data-action="c-yes"]');
  await S('text=Workout complete').waitFor();
  await shot('08-summary');
  assert.ok(await S('text=Next time').count());
  const d = await state(() => ({ sessions: FORGE.store.done.length, chestXp: FORGE.store.progress.muscles.chest.xp, active: FORGE.store.state.active }));
  assert.equal(d.sessions, 1);
  assert.ok(d.chestXp > 0);
  assert.equal(d.active, null);
  await tap('[data-action="go"][data-href="#/"]');
});

await step('home: streak counts the training day; recent progress', async () => {
  const st = await state(() => FORGE.store.streak);
  assert.equal(st.streak, 1);
  assert.equal(st.weekCount, 1);
  assert.ok(await S('text=training day streak').count());
  await shot('09-home-after');
});

await step('PR detection: beating last session announces a new PR', async () => {
  // second workout: same template, one more rep on the floor press
  await tap('[data-action="open-start"]');
  await tap('.sheet [data-action="start-template"]');
  await S('.ex-title').waitFor();
  const prevReps = await state(() => FORGE.store.done[0].sets[0].reps);
  const cur = Number(await S('.stepper[aria-label="reps"] .stepper-value').innerText());
  for (let i = cur; i < prevReps + 2; i++) await tap('[data-action="s-amt-inc"]');
  await tap('[data-action="s-log"]');
  await S('.toast--pr').first().waitFor({ timeout: 3000 });
  const txt = await S('.toast--pr').first().innerText();
  assert.match(txt, /NEW (REP|STRENGTH) PR/);
  await shot('10-pr');
  await tap('[data-action="s-rest-skip"]');
  await tap('[data-action="s-finish"]');
  await tap('.sheet [data-action="c-yes"]');
  await S('text=Workout complete').waitFor();
  const prs = await state(() => FORGE.store.progress.prs.map((p) => p.type));
  assert.ok(prs.includes('reps') || prs.includes('strength'), prs.join());
});

await step('progress: body map, modes, front/back toggle, muscle sheet', async () => {
  await page.goto(`${BASE}#/progress`);
  await S('#p-map .bodymap').waitFor();
  const labels = await S('#p-map .bm-face--front .bm-muscle').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  assert.equal(labels.length, 12);
  assert.ok(labels.every((l) => /Level \d+/.test(l) && /XP/.test(l)), 'accessible labels');
  await tap('[data-action="p-view"][data-v="back"]');
  assert.equal(await S('#p-map .bodymap').getAttribute('data-view'), 'back');
  await tap('[data-action="p-view"][data-v="front"]');
  await tap('[data-action="p-mode"][data-v="recent"]');
  await tap('[data-action="p-mode"][data-v="weekly"]');
  await tap('[data-action="p-mode"][data-v="level"]');
  await shot('11-progress');
  await S('#p-map .bm-face--front .bm-muscle[data-muscle="chest"] path').first().click();
  await S('.sheet.is-open').waitFor();
  await wait(300);
  assert.ok(await S('.sheet >> text=Recent performance').count());
  assert.ok(await S('#p-map .bm-muscle.is-selected[data-muscle="chest"]').count(), 'highlighted');
  await tap('.sheet [data-action="m-history"]');
  assert.ok(await S('.sheet >> text=XP over time').count());
  await shot('12-muscle-sheet');
  await tap('.sheet [data-action="train-muscle"]');
  await S('#b-name').waitFor();
  assert.match(await S('#b-name').inputValue(), /Chest/);
  const items = await state(() => FORGE.store.template(FORGE.route.id).items.map((i) => i.exerciseId));
  assert.ok(items.length >= 2);
});

await step('progress: sorting muscle list', async () => {
  await page.goto(`${BASE}#/progress`);
  await S('[data-change="p-sort"]').selectOption('weakest');
  await wait();
  const first = await S('.mlevel .name').first().innerText();
  assert.ok(first.length > 0);
});

await step('weekly plan: rates the saved workouts together', async () => {
  await page.goto(`${BASE}#/workouts`);
  await S('[data-href="#/plan"]').first().click();
  await S('text=Weekly sets per muscle').waitFor();
  const p = await state(() => FORGE.store.plan);
  assert.ok(p.score > 0 && p.muscles.length === 18);
  await shot('12b-plan');
  const id = await state(() => FORGE.store.planTemplates[0].id);
  await S(`[data-action="pl-toggle"][data-id="${id}"]`).click();
  await wait(200);
  assert.equal(await state(() => FORGE.store.template(FORGE.store.state.templates.find((t) => t.inPlan === false)?.id)?.inPlan), false);
  await S(`[data-action="pl-toggle"][data-id="${id}"]`).click();
});

await step('history: list and open a workout', async () => {
  await page.goto(`${BASE}#/workouts?tab=history`);
  await S('text=Today').first().waitFor();
  assert.equal(await S('[data-href^="#/summary/"]').count(), 2);
  await S('[data-href^="#/summary/"]').first().click();
  await S('text=Sets').first().waitFor();
});

await step('exercise demos: every exercise has an animated how-to', async () => {
  await page.goto(`${BASE}#/exercise/db_floor_press`);
  await S('.demo .demo-svg').first().waitFor();
  const d1 = await S('.demo .demo-svg [data-p="armN"]').first().getAttribute('d');
  await wait(600);
  const d2 = await S('.demo .demo-svg [data-p="armN"]').first().getAttribute('d');
  assert.notEqual(d1, d2, 'demo animates');
  await shot('16-exercise-demo');
  // tap pauses
  await S('.demo').first().click();
  assert.ok(await S('.demo.is-paused').count());
  // every exercise resolves to an animation
  const missing = await page.evaluate(async () => {
    const { EXERCISES } = await import('./src/data/exercises.js');
    const { animFor } = await import('./src/data/animations.js');
    return EXERCISES.filter((e) => !animFor(e.id)).map((e) => e.id);
  });
  assert.deepEqual(missing, []);
});

await step('equipment: adding a bench unlocks exercises; locked view shows requirement', async () => {
  await page.goto(`${BASE}#/exercises`);
  const before = await state(() => document.querySelectorAll('#x-results .item:not(.item--locked)').length);
  await tap('[data-action="x-scope"][data-v="all"]');
  assert.ok(await S('text=🔒 Requires: Bench').count());
  await shot('13-library-all');
  await S('.item--locked:has-text("Single-Arm Bench Press") [data-action="add-equipment"]').click();
  await wait(300);
  await tap('[data-action="x-scope"][data-v="available"]');
  const after = await state(() => document.querySelectorAll('#x-results .item:not(.item--locked)').length);
  assert.ok(after > before, `${after} > ${before}`);
  // progression survives equipment changes: chest XP unchanged by adding equipment
  const xp = await state(() => FORGE.store.progress.muscles.chest.xp);
  assert.ok(xp > 0);
});


/* ───────────── v1.3 features ───────────── */
// a fake forge_sync endpoint (same semantics as the Postgres function) so tests never touch the real cloud
const cloud = new Map();
let cloudSeq = 0;
async function fakeCloud(route) {
  const { p_key, p_since, p_records } = JSON.parse(route.request().postData() || '{}');
  const rows = cloud.get(p_key) || new Map();
  cloud.set(p_key, rows);
  for (const r of p_records || []) {
    const k = `${r.store}|${r.id}`;
    const cur = rows.get(k);
    if (!cur || cur.updatedAt < r.updatedAt) rows.set(k, { ...r, deleted: !!r.deleted, seq: ++cloudSeq });
  }
  const out = [...rows.values()].filter((r) => r.seq > (p_since || 0)).sort((a, b) => a.seq - b.seq);
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ records: out, seq: out.length ? out[out.length - 1].seq : p_since || 0, more: false }) });
}
await context.route('**/rest/v1/rpc/forge_sync', fakeCloud);

await step('build it for me: generator creates a well-rated workout for a focus', async () => {
  await page.goto(`${BASE}#/workouts`);
  await wait(200);
  await tap('[data-action="w-gen"]');
  await S('.sheet .gen-preview').waitFor();
  await tap('.sheet [data-action="g-focus"][data-v="pull"]');
  await tap('.sheet [data-action="g-min"][data-v="30"]');
  const before = await S('.sheet .gen-list').innerText();
  await shot('20-generator');
  await tap('.sheet [data-action="g-shuffle"]');
  await tap('.sheet [data-action="g-use"]');
  await S('#b-name').waitFor();
  const t = await state(() => { const t = FORGE.store.state.templates.at(-1); return { name: t.name, n: t.items.length, focus: t.focus, score: FORGE.store.rateTemplate(t).score, min: t.targetMinutes }; });
  assert.equal(t.focus, 'pull');
  assert.equal(t.min, 30);
  assert.ok(t.n >= 2, `items: ${t.n}`);
  assert.ok(t.score >= 75, `score ${t.score}`);
  assert.ok(before.length > 0);
  await shot('21-generated-builder');
});

await step('supersets: link two exercises, session alternates without rest between them', async () => {
  const id = await state(() => FORGE.store.state.templates.at(-1).id);
  await page.goto(`${BASE}#/builder/${id}`);
  await wait(200);
  await S('[data-action="b-toggle"]').first().click();
  await wait(150);
  await tap('[data-action="b-link"]');
  await S('.ss-block').first().waitFor();
  assert.match(await S('.ss-head').first().innerText(), /SUPERSET A/i);
  await shot('22-builder-superset');
  const first = await state(() => FORGE.store.state.templates.at(-1).items.slice(0, 2).map((i) => i.group));
  assert.ok(first[0] && first[0] === first[1]);
  await tap('[data-action="b-start"]');
  await S('.ss-pill').waitFor();
  const ex0 = await S('.ex-title').innerText();
  // log until the first exercise's set is done (unilateral → L+R)
  for (let k = 0; k < 2; k++) {
    if (await S('.rest').count()) break;
    const cur = await state(() => FORGE.store.state.active.current);
    if (cur !== 0) break;
    await tap('[data-action="s-log"]');
  }
  const after = await state(() => ({ cur: FORGE.store.state.active.current, rest: !!FORGE.store.state.active.rest }));
  assert.equal(after.cur, 1, 'moved to the second exercise of the superset');
  assert.equal(after.rest, false, 'no rest inside a superset');
  assert.notEqual(await S('.ex-title').innerText(), ex0);
  await shot('23-session-superset');
});

await step('warm-up sets: logged separately, no XP, working sets unchanged', async () => {
  // jump to an exercise with a dumbbell and no sets yet
  const idx = await state(() => {
    const a = FORGE.store.state.active;
    return a.items.findIndex((it, i) => FORGE.store.cfgFor(it.exerciseId) && !a.sets.some((s) => s.itemIndex === i));
  });
  assert.ok(idx >= 0, 'has a fresh dumbbell exercise');
  await state((i) => FORGE.store.updateActive((a) => { a.current = i; a.rest = null; }), idx);
  await wait(200);
  if (!(await S('[data-action="s-warmup"]').count())) {
    // unilateral exercises have no warm-up button — fine; check a bilateral one instead
    const j = await state(() => FORGE.store.state.active.items.findIndex((it) => FORGE.store.cfgFor(it.exerciseId) && !window.FORGE.store.state.active.sets.some((s) => s.exerciseId === it.exerciseId)));
    assert.ok(j >= 0);
  }
  if (!(await S('[data-action="s-warmup"]').count())) {
    const dbg = await state(() => { const a = FORGE.store.state.active; return { cur: a.current, item: a.items[a.current], drafts: a.drafts, screen: document.querySelector('main')?.dataset.screen, html: document.querySelector('.log-block')?.outerHTML?.slice(0, 600) }; });
    console.log(JSON.stringify(dbg, null, 1));
  }
  await S('[data-action="s-warmup"]').waitFor({ timeout: 4000 });
  const before = await state(() => FORGE.store.state.active.sets.filter((s) => !s.warmup).length);
  await tap('[data-action="s-warmup"]');
  await S('.logged-row--wu').waitFor();
  const a = await state(() => { const a = FORGE.store.state.active; const w = a.sets.find((s) => s.warmup); return { work: a.sets.filter((s) => !s.warmup).length, xp: FORGE.store.liveProgress.sessions[a.id].setXp[w.id] }; });
  assert.equal(a.work, before);
  assert.equal(a.xp, 0);
  assert.match(await S('.sess-progress').getAttribute('aria-label'), /^\d+ of/);
  await shot('24-session-warmup');
  await state(() => FORGE.store.discardSession());
});

await step('weekly schedule: pin a workout to today → Home shows it', async () => {
  await page.goto(`${BASE}#/plan`);
  await S('.sched-row').first().waitFor();
  assert.equal(await S('.sched-row').count(), 7);
  const today = await state(() => new Date().getDay());
  const tid = await state(() => FORGE.store.state.templates[0].id);
  await S(`select[data-d="${today}"]`).selectOption(tid);
  await wait(250);
  const tomorrow = (today + 1) % 7;
  await S(`select[data-d="${tomorrow}"]`).selectOption(tid);
  await wait(250);
  const p = await state(() => FORGE.store.plan);
  assert.equal(p.scheduled, true);
  assert.equal(p.days, 2);
  assert.ok(p.clashes.length >= 1, 'same workout two days in a row is flagged');
  await shot('25-plan-schedule');
  await page.goto(`${BASE}#/`);
  await wait(250);
  const name = await state(() => FORGE.store.state.templates[0].name);
  assert.match(await S('.hero').innerText(), new RegExp(name.replace(/[()]/g, '.')));
  await shot('26-home-scheduled');
  await state(() => FORGE.store.saveSettings({ schedule: {} }));
});

await step('deload week: suggested on Home, lighter session when active', async () => {
  // pretend 5 earlier training weeks
  await state(async () => {
    const s = FORGE.store.done[0];
    for (let k = 1; k <= 5; k++) {
      const copy = structuredClone(s);
      copy.id = `deload-seed-${k}`;
      copy.startedAt -= k * 7 * 86400000; copy.endedAt -= k * 7 * 86400000;
      copy.sets.forEach((x) => { x.ts -= k * 7 * 86400000; });
      FORGE.store.state.sessions.push(copy);
      await FORGE.store.repo.saveSession(copy);
    }
    FORGE.store.emit();
  });
  await page.goto(`${BASE}#/`);
  await S('[data-action="h-deload-start"]').waitFor();
  await shot('27-home-deload');
  await tap('[data-action="h-deload-start"]');
  await S('[data-action="h-deload-end"]').waitFor();
  const t = await state(() => FORGE.store.state.templates[0]);
  await state((id) => FORGE.shared.startTemplate(FORGE, id), t.id);
  await S('.deload-pill').waitFor();
  const sets = await state(() => FORGE.store.state.active.items.map((i) => [i.sets, i.plannedSets]));
  assert.ok(sets.every(([s, p]) => s < p || p === 1), JSON.stringify(sets));
  await state(() => FORGE.store.discardSession());
  await state(async () => {
    for (let k = 1; k <= 5; k++) await FORGE.store.deleteSession(`deload-seed-${k}`);
    await FORGE.store.endDeload();
    await FORGE.store.saveSettings({ deloadLast: null });
  });
});

await step('body weight: log and see it on Progress', async () => {
  await page.goto(`${BASE}#/progress`);
  await tap('[data-action="p-bw"]');
  await S('#bw-input').fill('80.6');
  await tap('.sheet [data-action="bw-save"]');
  await S('#bw-input').fill('80.2');
  await tap('.sheet [data-action="bw-save"]');
  await tap('.sheet [data-action="close-sheet"], .sheet-close');
  await page.keyboard.press('Escape');
  await wait(200);
  const m = await state(() => FORGE.store.measures.map((x) => x.kg));
  assert.deepEqual(m, [80.6, 80.2]);
  assert.match(await page.locator('main').innerText(), /80\.2/);
  await S('text=Body weight').first().scrollIntoViewIfNeeded();
  await shot('28-progress-bodyweight');
});

await step('cloud backup: turn on, key shown, restore on a second phone', async () => {
  await page.goto(`${BASE}#/settings`);
  await S('#backup').scrollIntoViewIfNeeded();
  assert.match(await S('#backup').innerText(), /Cloud backup is off/);
  await tap('[data-action="bk-on"]');
  await S('.backup-key').waitFor();
  const key = (await S('.backup-key').innerText()).replace(/\s/g, '');
  assert.match(key, /^[0-9A-Z]{5}(-[0-9A-Z]{5}){4}$/);
  await shot('29-backup-key');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => FORGE.store.syncStatus.state === 'ok', null, { timeout: 5000 });
  await wait(200);
  assert.match(await S('#backup').innerText(), /Backed up/);
  await shot('30-settings-backup');
  const mine = await state(() => ({ t: FORGE.store.state.templates.length, s: FORGE.store.done.length }));

  // second phone: fresh browser profile
  const ctx2 = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx2.route('**/rest/v1/rpc/forge_sync', fakeCloud);
  const p2 = await ctx2.newPage();
  await p2.goto(BASE);
  await p2.locator('[data-action="onb-restore"]').click();
  await p2.locator('#bk-input').fill(key.toLowerCase().replace(/-/g, ' '));
  await p2.locator('.sheet [data-action="bk-go"]').click();
  await p2.waitForFunction(() => FORGE.store.settings.onboarded && location.hash.startsWith('#/'), null, { timeout: 5000 });
  await p2.waitForTimeout(300);
  const theirs = await p2.evaluate(() => ({ t: FORGE.store.state.templates.length, s: FORGE.store.done.length, sync: FORGE.store.sync.enabled }));
  assert.deepEqual(theirs, { ...mine, sync: true });
  await p2.screenshot({ path: join(SHOTS, '31-restored-home.png') });
  await ctx2.close();
});

await step('persistence: reload keeps workouts, history and settings', async () => {
  await page.reload();
  await wait(600);
  const d = await state(() => ({ t: FORGE.store.state.templates.length, s: FORGE.store.done.length, bench: !!FORGE.store.profile.items.bench }));
  assert.ok(d.t >= 2);
  assert.equal(d.s, 2);
  assert.equal(d.bench, true);
});

await step('PWA: manifest, icons and service worker', async () => {
  const m = await (await page.request.get(`${BASE}manifest.json`)).json();
  assert.equal(m.display, 'standalone');
  for (const ic of m.icons) assert.equal((await page.request.get(BASE + ic.src)).status(), 200, ic.src);
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
  assert.ok(sw);
});

await step('offline: app loads and works with no network', async () => {
  await page.reload(); // ensure the page is controlled by the SW
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 5000 });
  await context.setOffline(true);
  await page.goto(`${BASE}#/progress`);
  await S('#p-map .bodymap').waitFor({ timeout: 5000 });
  await page.goto(`${BASE}#/exercises`);
  await S('#x-results .item').first().waitFor();
  await page.goto(`${BASE}#/workouts`);
  await tap('[data-action="w-new"]');
  await S('#b-name').waitFor();
  await context.setOffline(false);
});

await step('narrow Android widths: no horizontal scrolling (320/360/390/412)', async () => {
  const routes = ['#/', '#/workouts', '#/workouts?tab=history', '#/progress', '#/exercises', '#/settings', '#/plan', `#/exercise/db_floor_press`];
  const tplId = await state(() => FORGE.store.state.templates[0].id);
  routes.push(`#/builder/${tplId}`);
  const bad = [];
  for (const w of [320, 360, 390, 412]) {
    await page.setViewportSize({ width: w, height: 760 });
    for (const r of routes) {
      await page.goto(BASE + r);
      await wait(250);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 0) bad.push(`${w}px ${r} (+${over}px)`);
    }
    await page.goto(`${BASE}#/`);
    await wait(200);
    await shot(`14-home-${w}`);
  }
  // session screen at 320
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(`${BASE}#/workouts`);
  await tap('[data-action="start-template"]');
  await S('.ex-title').waitFor();
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (over > 0) bad.push(`320px session (+${over}px)`);
  await shot('15-session-320');
  assert.deepEqual(bad, []);
});

await step('no uncaught errors during the run', async () => {
  assert.deepEqual(errors.filter((e) => !/Failed to load resource/.test(e)), []);
});

await browser.close();
server.kill();
const failed = results.filter((r) => r[0] === '✗');
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);

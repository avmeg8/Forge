/**
 * FORGE bootstrap: storage → store → router → event delegation → service worker.
 */
import { store } from './app/store.js';
import { sheet, toast, confirmSheet } from './components/overlay.js';
import { icon } from './components/ui.js';
import { mountDemos } from './components/demo.js';
import { animFor } from './data/animations.js';
import * as shared from './screens/shared.js';
import home from './screens/home.js';
import workouts from './screens/workouts.js';
import builder from './screens/builder.js';
import session from './screens/session.js';
import summary from './screens/summary.js';
import progress from './screens/progress.js';
import exercises from './screens/exercises.js';
import exercise from './screens/exercise.js';
import settings from './screens/settings.js';
import onboarding from './screens/onboarding.js';
import plan from './screens/plan.js';

const screens = { home, workouts, builder, session, summary, progress, exercises, exercise, settings, onboarding, plan };

const ROUTES = [
  [/^\/?$/, 'home'],
  [/^\/workouts$/, 'workouts'],
  [/^\/builder\/([\w-]+)$/, 'builder'],
  [/^\/session$/, 'session'],
  [/^\/summary\/([\w-]+)$/, 'summary'],
  [/^\/progress$/, 'progress'],
  [/^\/exercises$/, 'exercises'],
  [/^\/exercise\/([\w-]+)$/, 'exercise'],
  [/^\/settings$/, 'settings'],
  [/^\/plan$/, 'plan'],
];

const NAV = [
  ['home', '#/', 'Home', icon.home],
  ['workouts', '#/workouts', 'Workouts', icon.workouts],
  ['progress', '#/progress', 'Progress', icon.progress],
  ['exercises', '#/exercises', 'Exercises', icon.exercises],
];

function parseRoute() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  for (const [re, name] of ROUTES) {
    const m = path.match(re);
    if (m) return { name, id: m[1], query: Object.fromEntries(new URLSearchParams(qs || '')) };
  }
  return { name: 'home', query: {} };
}

const main = document.getElementById('app');
const navEl = document.getElementById('nav');
let current = null; // { name, screen }

export const ctx = {
  store,
  sheet,
  toast,
  confirm: confirmSheet,
  route: parseRoute(),
  ui: {}, // per-screen view state (tabs, filters) that survives re-renders
  go(hash, { replace = false } = {}) {
    if (replace) { replacingIdx = history.state?.idx ?? 0; location.replace(hash); } else location.hash = hash;
  },
  back(fallback = '#/') {
    // Only go "back" inside FORGE's own history; otherwise jump to a sensible parent.
    if ((history.state?.idx || 0) > 0) history.back();
    else ctx.go(fallback, { replace: true });
  },
  render: () => render(false),
  shared,
};

function screenFor(route) {
  if (!store.settings.onboarded) return 'onboarding';
  return route.name;
}

function render(routeChanged) {
  const name = screenFor(ctx.route);
  const scr = screens[name];
  if (current && (current.name !== name || routeChanged)) current.screen.unmount?.(ctx);
  const y = window.scrollY;
  main.innerHTML = `<main class="screen ${scr.focus ? 'screen--focus' : ''}" id="screen" data-screen="${name}">${scr.render(ctx)}</main>`;
  current = { name, screen: scr };
  scr.mount?.(ctx, main);
  const tab = scr.tab ?? name;
  navEl.hidden = !!scr.hideNav;
  navEl.innerHTML = `<div class="nav-inner">${NAV.map(([id, href, label, ic]) =>
    `<a href="${href}" ${tab === id ? 'aria-current="page"' : ''}>${ic}<span>${label}</span></a>`).join('')}</div>`;
  if (routeChanged) window.scrollTo(0, 0); else window.scrollTo(0, y);
  document.title = scr.title ? `${typeof scr.title === 'function' ? scr.title(ctx) : scr.title} · FORGE` : 'FORGE';
}

/* ───────────── event delegation ───────────── */
function findHandler(kind, name, el) {
  const inSheet = el.closest('.sheet');
  if (inSheet && sheet.def?.[kind]?.[name]) return sheet.def[kind][name];
  if (!inSheet && current?.screen[kind]?.[name]) return current.screen[kind][name];
  if (kind === 'actions' && GLOBAL[name]) return GLOBAL[name];
  if (inSheet && current?.screen[kind]?.[name]) return current.screen[kind][name];
  return null;
}

const GLOBAL = {
  go: (c, el) => c.go(el.dataset.href),
  back: (c, el) => c.back(el.dataset.fallback),
  'close-sheet': () => sheet.close(),
  muscle: (c, el) => shared.openMuscleSheet(c, el.dataset.muscle),
  'train-muscle': (c, el) => shared.trainMuscle(c, el.dataset.muscle),
  'add-equipment': (c, el) => shared.addEquipment(c, el.dataset.item),
  'start-template': (c, el) => shared.startTemplate(c, el.dataset.id),
  'open-start': (c) => shared.openStartPicker(c),
  'open-exercise': (c, el) => { sheet.close(); c.go(`#/exercise/${el.dataset.id}`); },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = findHandler('actions', el.dataset.action, el);
  if (!fn) return;
  ev.preventDefault();
  Promise.resolve(fn(ctx, el, ev)).catch(reportError);
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && sheet.isOpen) { sheet.close(); return; }
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[role="button"][data-action]:not(button)')) {
    ev.preventDefault();
    ev.target.click();
  }
});

for (const type of ['input', 'change']) {
  document.addEventListener(type, (ev) => {
    const el = ev.target.closest(`[data-${type}]`);
    if (!el) return;
    const fn = findHandler(type === 'input' ? 'inputs' : 'changes', el.dataset[type], el);
    if (fn) Promise.resolve(fn(ctx, el, ev)).catch(reportError);
  });
}

function reportError(e) {
  console.error(e);
  toast(`Something went wrong: ${e.message || e}`, { kind: 'bad', ms: 4000 });
}
window.addEventListener('unhandledrejection', (e) => console.error('[FORGE]', e.reason));

let navCounter = 0;
let replacingIdx = null;
if (history.state?.idx == null) history.replaceState({ idx: 0 }, '');
else navCounter = history.state.idx;
window.addEventListener('hashchange', () => {
  ctx.route = parseRoute();
  if (sheet.isOpen) sheet.close();
  if (history.state?.idx == null) history.replaceState({ idx: replacingIdx ?? ++navCounter }, '');
  replacingIdx = null;
  render(true);
});

let pending = false;
store.subscribe(() => {
  if (pending) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    if (current?.screen.skipRender?.(ctx)) return;
    render(false);
    if (sheet.isOpen && sheet.def.live) sheet.refresh();
  });
});

/* ───────────── service worker ───────────── */
function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./service-worker.js').then((reg) => {
    const offer = (w) => toast('A new version of FORGE is ready.', {
      ms: 15000, action: { label: 'Reload', run: () => w.postMessage('skip-waiting') },
    });
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
  }).catch((e) => console.warn('[FORGE] SW registration failed', e));
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}

/* ───────────── exercise demos: animate any .demo element that appears ───────────── */
let demoQueued = false;
new MutationObserver(() => {
  if (demoQueued) return;
  demoQueued = true;
  requestAnimationFrame(() => { demoQueued = false; mountDemos(document, animFor); });
}).observe(document.body, { childList: true, subtree: true });

/* ───────────── boot ───────────── */
(async function boot() {
  try {
    await store.init();
    navigator.storage?.persist?.().catch(() => {});
  } catch (e) {
    main.innerHTML = `<div class="screen"><div class="card"><h2>FORGE couldn't open its storage</h2><p class="muted">${String(e.message || e)}</p></div></div>`;
    return;
  }
  // Resume an interrupted workout straight away.
  if (store.state.active && ctx.route.name === 'home' && store.settings.onboarded) {
    ctx.go('#/session', { replace: true });
    ctx.route = parseRoute();
  }
  render(true);
  document.documentElement.classList.add('ready');
  registerSW();
})();

window.FORGE = ctx; // handy for debugging and E2E tests

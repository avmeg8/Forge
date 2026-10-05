/**
 * FORGE service worker — offline-first.
 *
 * • Install: precache the entire app shell (it's small), so FORGE works fully offline
 *   right after the first visit / installation.
 * • Fetch: cache-first from the precache of THIS version only (instant start, never a mix
 *   of releases); navigations get the cached index.html.
 * • Update: `npm run build` rewrites VERSION + APP_SHELL below; the browser notices the new
 *   service worker on the next launch, installs the complete new version, takes over and
 *   the page reloads once.
 */
// <precache>
const VERSION = '1ae73f727e';
const APP_SHELL = [
  "./",
  "index.html",
  "manifest.json",
  "src/app/store.js",
  "src/assets/icons/apple-touch-icon.png",
  "src/assets/icons/icon-192.png",
  "src/assets/icons/icon-512.png",
  "src/assets/icons/icon.svg",
  "src/assets/icons/maskable-512.png",
  "src/components/bodymap.js",
  "src/components/charts.js",
  "src/components/demo.js",
  "src/components/overlay.js",
  "src/components/ui.js",
  "src/data/animations.js",
  "src/data/equipment.js",
  "src/data/exercises.js",
  "src/data/muscles.js",
  "src/data/splits.js",
  "src/engine/deload.js",
  "src/engine/equipment.js",
  "src/engine/generator.js",
  "src/engine/insights.js",
  "src/engine/levels.js",
  "src/engine/plan.js",
  "src/engine/progression.js",
  "src/engine/rating.js",
  "src/engine/recovery.js",
  "src/engine/session.js",
  "src/engine/streak.js",
  "src/engine/xp.js",
  "src/main.js",
  "src/screens/backup.js",
  "src/screens/builder.js",
  "src/screens/exercise.js",
  "src/screens/exercises.js",
  "src/screens/generate.js",
  "src/screens/home.js",
  "src/screens/onboarding.js",
  "src/screens/plan.js",
  "src/screens/progress.js",
  "src/screens/session.js",
  "src/screens/settings.js",
  "src/screens/shared.js",
  "src/screens/summary.js",
  "src/screens/workouts.js",
  "src/storage/adapters.js",
  "src/storage/repository.js",
  "src/storage/sync.js",
  "src/styles/main.css",
  "src/utils/date.js",
  "src/utils/format.js",
  "src/utils/id.js"
];
// </precache>

const CACHE = `forge-${VERSION}`;

/*
 * Every file is served from ONE versioned cache that is filled in a single step at install.
 * Files are never refreshed one by one in the background — that could leave a cache holding
 * a mix of two releases (modules that don't fit together → the app can't start). A new
 * release = a new VERSION = a complete new cache, switched over all at once.
 */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP_SHELL.map((u) => new Request(u, { cache: 'reload' })));
    await self.skipWaiting(); // take over right away; the page reloads itself once
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('forge-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      const shell = await cache.match('index.html');
      if (shell) return shell;
      try { return await fetch(req); } catch { return new Response('FORGE is offline and not cached yet.', { status: 503 }); }
    }
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      return await fetch(req);
    } catch {
      return new Response('', { status: 504 });
    }
  })());
});

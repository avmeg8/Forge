/**
 * FORGE service worker — offline-first.
 *
 * • Install: precache the entire app shell (it's small), so FORGE works fully offline
 *   right after the first visit / installation.
 * • Fetch: cache-first for same-origin files (instant start on slow phones), refreshed in
 *   the background; navigations fall back to the cached index.html.
 * • Update: `npm run build` rewrites VERSION + APP_SHELL below; a new VERSION installs
 *   alongside the old one and the app offers a "Reload" toast to switch.
 */
// <precache>
const VERSION = '38366bf46a';
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
  "src/engine/equipment.js",
  "src/engine/insights.js",
  "src/engine/levels.js",
  "src/engine/progression.js",
  "src/engine/rating.js",
  "src/engine/recovery.js",
  "src/engine/session.js",
  "src/engine/streak.js",
  "src/engine/xp.js",
  "src/main.js",
  "src/screens/builder.js",
  "src/screens/exercise.js",
  "src/screens/exercises.js",
  "src/screens/home.js",
  "src/screens/onboarding.js",
  "src/screens/progress.js",
  "src/screens/session.js",
  "src/screens/settings.js",
  "src/screens/shared.js",
  "src/screens/summary.js",
  "src/screens/workouts.js",
  "src/storage/adapters.js",
  "src/storage/repository.js",
  "src/styles/main.css",
  "src/utils/date.js",
  "src/utils/format.js",
  "src/utils/id.js"
];
// </precache>

const CACHE = `forge-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL.map((u) => new Request(u, { cache: 'reload' })))),
  );
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

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match('index.html') || await cache.match('./');
      const network = fetch(req).then((res) => {
        if (res.ok) cache.put('index.html', res.clone());
        return res;
      }).catch(() => null);
      return cached || (await network) || new Response('FORGE is offline and not cached yet.', { status: 503 });
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    return (await network) || new Response('', { status: 504 });
  })());
});

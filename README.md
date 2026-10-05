# FORGE

**Build. Train. Level Up.**

FORGE is a mobile-first, offline-capable workout tracker (Progressive Web App) designed for someone who owns **one adjustable dumbbell**, and it can grow with you as you add equipment.

- **Build**: create your own workouts from a library of 90+ dumbbell and bodyweight exercises (plus 45 more that unlock as you add equipment). FORGE rates each workout from 0 to 100 while you build it.
- **Train**: a focused logging screen with one-tap sets, a rest timer, separate left/right tracking and automatic PR detection.
- **Progress**: an interactive anatomical body map and an 18-muscle Tier → Level → XP system that rewards real progressive overload instead of junk volume.

No backend, no account, no build step. Everything is stored on the device in IndexedDB, and the app keeps working with no connection once it has loaded.

---

## Quick start

### 1. Create the repository

1. On GitHub, click **New repository** and name it, for example, `forge`.
2. Upload this folder's contents, or push them from your computer:

```bash
cd forge
git init
git add .
git commit -m "FORGE v1"
git branch -M main
git remote add origin https://github.com/<your-username>/forge.git
git push -u origin main
```

### 2. Install dependencies (optional)

The app itself has **zero runtime dependencies**. You need Node.js 18+ only for local tooling:

```bash
npm install        # installs Playwright, used only by the end-to-end tests
```

### 3. Run locally

```bash
npm start          # → http://localhost:5173
```

Any static file server will also work, for example `python3 -m http.server`. The service worker only runs on `localhost` or HTTPS.

To test on your phone over Wi-Fi, open `http://<your-computer-ip>:5173`. Offline mode and installation need HTTPS, so do that part on the deployed GitHub Pages URL.

### 4. Build

```bash
npm run build      # refreshes the service-worker cache list + version hash, copies the app to dist/
```

### 5. Deploy to GitHub Pages

The repository includes `.github/workflows/deploy.yml`, which runs the unit tests, builds the app and publishes it on every push to `main`.

1. On GitHub, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main`, or open the **Actions** tab and run *Test & deploy to GitHub Pages*.
4. Your app will be live at `https://<your-username>.github.io/forge/`.

All paths are relative, so FORGE works from any sub-path without extra configuration.

*Alternative without Actions:* run `npm run build`, commit, and set **Pages → Source: Deploy from a branch → `main` / root**. The root folder is deployable as-is.

### 6. Install on Android

1. Open your GitHub Pages URL in **Chrome** on Android.
2. Tap **⋮ → Install app** (or **Add to Home screen**). Chrome may also show an install banner.
3. Launch FORGE from the home screen. It opens full-screen, works offline and keeps your data on the phone.

> Tip: export a backup now and then (**Settings → Your data → Export backup**). Uninstalling the app or clearing Chrome's site data deletes local data.

---

## Tests

```bash
npm test           # engine unit tests (node:test, no dependencies): XP, levels, tiers, PRs,
                   # streaks, rest days, rating, progression, equipment, recovery
npm run test:e2e   # full end-to-end run in headless Chromium emulating an Android phone
```

The E2E suite (`tests/e2e/run.mjs`) walks through the whole connected system: onboarding → building a workout (add, remove, undo, reorder, edit sets) → live rating and suggested addition → logging sets → rest timer (+30 s, skip) → left/right tracking and imbalance note → summary → streak → PR detection on the next workout → body map, modes, front/back switch, muscle sheet, *Train Chest* → history → equipment unlocks → persistence across reloads → manifest, icons and service worker → **offline mode** → **no horizontal scrolling at 320 / 360 / 390 / 412 px**. Screenshots are saved to `tests/e2e/screenshots/`.

---

## Project structure

```
index.html              App shell
manifest.json           PWA manifest (standalone, portrait, maskable icons)
service-worker.js       Offline-first cache (list + version written by `npm run build`)
src/
  main.js               Bootstrap, hash router, event delegation, SW registration
  app/store.js          State, persistence and memoized derived data
  storage/              Storage abstraction: IndexedDB adapter (+ in-memory fallback) and repository
  data/                 Muscles, equipment catalog, exercise database (data-driven)
  engine/               Pure, tested domain logic
    xp.js               XP formula + progression replay (muscle XP, PRs, exercise history)
    levels.js           Tier → Level → XP curve
    rating.js           Workout analysis and 0–100 rating
    progression.js      "Next time" recommendations, left/right balance
    streak.js           Consistency streak (training days, rest days allowed)
    recovery.js         Recently-trained warnings
    equipment.js        Availability, unlocks, weight steps (never outside your range)
    insights.js         Weak-muscle detection, recent progress
    session.js          In-workout state helpers
  components/           Body map (SVG), charts, sheets/toasts, UI primitives
  screens/              Home, Workouts, Builder, Session, Summary, Progress, Exercises, Exercise, Settings, Onboarding
  styles/main.css       Design tokens and all styles
  assets/icons/         App icons (SVG + PNG + maskable)
scripts/                serve.mjs (dev server), build.mjs, icons.mjs
tests/                  unit/ (node:test) and e2e/ (Playwright)
```

---

## How the systems connect

```
Build workout ──► rating.js analyses coverage, balance, volume, variety, overlap,
                  recovery, progression fit, duration ──► score + advice + suggestion
      │
Start ──► log set ──► saved to IndexedDB immediately (survives reloads)
      │                 │
      │                 └► xp.js replays all sessions ──► muscle XP → level → tier
      │                                                  ──► PRs, exercise history
      ▼
Finish ──► summary (XP per muscle, level-ups, PRs, NEXT TIME advice)
       ──► body map, streak, history, recommendations and the next rating all update
```

Progress is **derived** by replaying the logged sets, never stored separately, so it can't drift out of sync. Deleting a workout recalculates everything.

### XP formula (see `src/engine/xp.js`)

For every set, each muscle trained gets:

```
XP = 10 × involvement (primary 1.0 / secondary 0.4)
        × side (0.5 per side for unilateral work)
        × effort (good reps 3–30 / holds 10–120 s)
        × intensity (vs. your best e1RM: ≥85% full, <70% only 35% — warm-ups and junk sets earn little)
        × overload (+50% for beating your best, +15% for beating last session)
        × strength (up to +50% as your best lift grows from your first)
        × difficulty (0.9 / 1.0 / 1.1)
        × consistency (+2% per streak day, max +20%)
        × weekly volume cap (per muscle: full to 12 sets, ½ to 20, then 0.15)
        × session volume cap (beyond 10 sets for one muscle in one session → 0.3)
```

Levels: `cost(L → L+1) = 50 + 8·L^1.5` (rounded). With consistent training you reach Intermediate in about 2–3 months, Advanced in about a year and Elite after about 2.5 years. There are 40 levels in total.

### Equipment is data, not code

Exercises declare the **capabilities** they need (`['dumbbell', 'bench']`), and equipment items declare what they **provide**. Add a bench in Settings and every bench exercise unlocks automatically. No code changes are needed to add equipment or exercises. Equipment **profiles** (for example *Home* and *Full gym*) can be switched at any time. Muscle progress is shared across all exercises, so moving from Floor Press to Bench Press never resets your chest level.

### Adding cloud sync later

All reads and writes go through `src/storage/repository.js` → an adapter (`src/storage/adapters.js`). Every record has an `id` and an `updatedAt` timestamp. A future `SyncAdapter` can wrap the IndexedDB adapter and push or pull changed records without touching any screen code.

---

## Safety

FORGE gives training guidance, not medical advice. Exercise always carries some risk. If something hurts, stop the exercise. If pain persists or worries you, consult a qualified healthcare professional. The in-workout **Feeling pain?** button stops the current exercise and shows this guidance.

## License

MIT

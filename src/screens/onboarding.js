/** First-time setup: experience, dumbbell range, training frequency → welcome. */
import { brandMark, SAFETY_TEXT } from '../components/ui.js';
import { FREQ_LIST } from '../engine/streak.js';
import { defaultProfile } from '../data/equipment.js';
import { detectWeekStart } from '../utils/date.js';
import { esc } from '../utils/format.js';

function ui(ctx) {
  return (ctx.ui.onb ||= { step: 'setup', experience: 'beginner', min: 2, max: 30, inc: 1, frequency: '4', error: '' });
}

const EXP = [
  ['beginner', 'Beginner', 'New or returning'],
  ['intermediate', 'Intermediate', '6+ months consistent'],
  ['advanced', 'Advanced', 'Years of training'],
];

export default {
  hideNav: true,
  title: 'Welcome',
  render(ctx) {
    const s = ui(ctx);
    if (s.step === 'welcome') {
      return `<div class="onb"><div class="welcome">
        ${brandMark.replace('class="brand-mark"', 'class="mark"')}
        <p class="tagline">Welcome to</p>
        <h1>FORGE</h1>
        <p class="tagline">Build. Train. Level Up.</p>
        <p class="text-2 mt-16" style="max-width:320px">Every muscle starts at <b>Beginner · Level 1</b>. FORGE doesn't guess your strength — it learns from the sets you log.</p>
        <p class="safety mt-16" style="max-width:360px;text-align:left">${esc(SAFETY_TEXT)}</p>
      </div>
      <button class="btn btn--primary btn--lg btn--block" data-action="onb-start">Start</button></div>`;
    }
    return `<div class="onb">
      <div class="row">${brandMark}<span class="brand-name">FORGE</span></div>
      <h1>Let's set you up.</h1>
      <p class="muted">Three quick questions. You can change everything later in Settings.</p>

      <div class="onb-q"><p class="field-label">Your experience</p>
        <div class="choice-grid">${EXP.map(([id, n, d]) => `<button class="choice" data-action="onb-exp" data-v="${id}" aria-pressed="${s.experience === id}">${n}<small>${d}</small></button>`).join('')}</div>
      </div>

      <div class="onb-q"><p class="field-label">Your dumbbell (kg)</p>
        <div class="db-grid">
          <label class="field"><span class="tiny muted">Minimum</span><input class="input num" type="number" inputmode="decimal" step="0.5" min="0.5" data-input="onb-db" data-k="min" value="${s.min}" aria-label="Minimum dumbbell weight in kg"></label>
          <label class="field"><span class="tiny muted">Maximum</span><input class="input num" type="number" inputmode="decimal" step="0.5" min="1" data-input="onb-db" data-k="max" value="${s.max}" aria-label="Maximum dumbbell weight in kg"></label>
          <label class="field"><span class="tiny muted">Increment</span><input class="input num" type="number" inputmode="decimal" step="0.25" min="0.25" data-input="onb-db" data-k="inc" value="${s.inc}" aria-label="Weight increment in kg"></label>
        </div>
        <p class="small muted mt-8" id="onb-err" role="alert">${esc(s.error)}</p>
      </div>

      <div class="onb-q"><p class="field-label">Training frequency</p>
        <div class="choice-grid choice-grid--3">${FREQ_LIST.map((f) => `<button class="choice" data-action="onb-freq" data-v="${f.id}" aria-pressed="${s.frequency === f.id}">${f.label}<small>per week</small></button>`).join('')}</div>
        <p class="small muted mt-8">Rest days never break your streak.</p>
      </div>

      <div style="flex:1;min-height:24px"></div>
      <button class="btn btn--primary btn--lg btn--block" data-action="onb-next">Continue</button>
    </div>`;
  },
  actions: {
    'onb-exp': (ctx, el) => { ui(ctx).experience = el.dataset.v; ctx.render(); },
    'onb-freq': (ctx, el) => { ui(ctx).frequency = el.dataset.v; ctx.render(); },
    'onb-next': (ctx) => {
      const s = ui(ctx);
      const err = validate(s);
      s.error = err;
      if (err) { ctx.render(); return; }
      s.step = 'welcome';
      ctx.render();
    },
    'onb-start': async (ctx) => {
      const s = ui(ctx);
      const restMode = 'exercise';
      await ctx.store.saveSettings({
        onboarded: true,
        experience: s.experience,
        frequency: s.frequency,
        restMode,
        weekStart: detectWeekStart(),
        targetMinutes: 45,
        activeProfileId: 'home',
        profiles: [defaultProfile({ min: s.min, max: s.max, increment: s.inc })],
      });
      delete ctx.ui.onb;
      ctx.go('#/', { replace: true });
      ctx.render();
    },
  },
  inputs: {
    'onb-db': (ctx, el) => {
      const s = ui(ctx);
      s[el.dataset.k] = Number(el.value);
      const e = validate(s);
      const out = document.getElementById('onb-err');
      if (out) out.textContent = e;
    },
  },
};

export function validate(s) {
  if (!(s.min > 0)) return 'Minimum must be more than 0 kg.';
  if (!(s.max > s.min)) return 'Maximum must be heavier than the minimum.';
  if (!(s.inc > 0)) return 'Increment must be more than 0 kg.';
  if (s.inc > s.max - s.min) return 'Increment is larger than your whole range.';
  if (s.max > 200) return 'That seems heavier than any adjustable dumbbell.';
  return '';
}

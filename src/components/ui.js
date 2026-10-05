/** Shared UI building blocks (pure functions returning HTML strings). */
import { esc, num, kg } from '../utils/format.js';

const s = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;

export const icon = {
  home: s('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>'),
  workouts: s('<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>'),
  progress: s('<circle cx="12" cy="5" r="2.2"/><path d="M8 9.5c2.5-1.2 5.5-1.2 8 0M12 9v6M12 15l-3 6M12 15l3 6M8 9.5l-2 5M16 9.5l2 5"/>'),
  exercises: s('<path d="M4 6h16M4 12h16M4 18h10"/>'),
  plus: s('<path d="M12 5v14M5 12h14"/>'),
  minus: s('<path d="M5 12h14"/>'),
  back: s('<path d="M15 18l-6-6 6-6"/>'),
  close: s('<path d="M6 6l12 12M18 6 6 18"/>'),
  chev: s('<path d="M9 6l6 6-6 6"/>'),
  up: s('<path d="M6 15l6-6 6 6"/>'),
  down: s('<path d="M6 9l6 6 6-6"/>'),
  gear: s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  trash: s('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  edit: s('<path d="M4 20h4L19 9l-4-4L4 16v4z"/>'),
  play: s('<path d="M7 5v14l11-7z" fill="currentColor"/>'),
  search: s('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  info: s('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  list: s('<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>'),
  lock: s('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  check: s('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  timer: s('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>'),
  copy: s('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  history: s('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 3"/>'),
  more: s('<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>'),
  bolt: s('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  alert: s('<path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5M12 18v.01"/>'),
  skip: s('<path d="M5 5l10 7-10 7zM19 5v14"/>'),
  dumbbell: s('<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>'),
};

/** FORGE mark: an anvil-like F built from two bars — subtle and geometric. */
export const brandMark = `<svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#171a1f"/><path d="M18 14h30v8H27v7h16v8H27v13h-9z" fill="#eceef1"/><rect x="31" y="44" width="17" height="6" rx="1.5" fill="#f08a3c"/></svg>`;

export function bar(p, cls = '') {
  const w = Math.max(0, Math.min(1, p || 0)) * 100;
  return `<div class="bar ${cls}" role="presentation"><i style="width:${w.toFixed(1)}%"></i></div>`;
}

/** Text progress bar for screen readers + visuals (████████░░). */
export function levelBlock(info, { compact = false } = {}) {
  return `
    <div class="row row--between"><span class="tag tag--accent">${esc(info.tier.name)}</span><span class="num muted small">${info.isMax ? 'Max level' : `${num(info.xpIntoLevel)} / ${num(info.xpForLevel)} XP`}</span></div>
    <div class="row mt-8" style="align-items:baseline;gap:8px"><b style="font-size:${compact ? 22 : 30}px;font-weight:800" class="num">Level ${info.level}</b></div>
    <div class="mt-8">${bar(info.progress, 'bar--lg')}</div>
    <div class="small muted mt-8 num">${info.isMax ? 'Maximum level reached.' : `${num(info.xpToNext)} XP to Level ${info.level + 1}`}</div>`;
}

export function stepper({ value, unit = '', dec, inc, label, sm = false, decDisabled = false, incDisabled = false }) {
  return `<div class="stepper ${sm ? 'stepper--sm' : ''}" role="group" aria-label="${esc(label)}">
    <button type="button" data-action="${dec}" aria-label="Decrease ${esc(label)}" ${decDisabled ? 'disabled' : ''}>${icon.minus}</button>
    <div class="stepper-value" aria-live="polite">${value}${unit ? `<small>${unit}</small>` : ''}</div>
    <button type="button" data-action="${inc}" aria-label="Increase ${esc(label)}" ${incDisabled ? 'disabled' : ''}>${icon.plus}</button>
  </div>`;
}

export function appbar({ title, back = false, right = '' }) {
  return `<header class="appbar">
    ${back ? `<button class="icon-btn" data-action="back" aria-label="Back">${icon.back}</button>` : ''}
    <h1>${esc(title)}</h1>${right}
  </header>`;
}

export function empty({ title, text = '', action = '' , ic = icon.workouts }) {
  return `<div class="empty card">${ic}<h3>${esc(title)}</h3><p class="small">${esc(text)}</p>${action}</div>`;
}

export function scoreBadge(rating) {
  return `<div class="score-badge ${rating.grade}" aria-label="Workout rating ${rating.score} out of 100">${rating.score}</div>`;
}

export function weightLabel(w) {
  return w ? `${kg(w)} kg` : 'Bodyweight';
}

export const SAFETY_TEXT = 'Exercise always carries some risk. Warm up, use a weight you can control, and stop if something hurts. FORGE does not give medical advice.';

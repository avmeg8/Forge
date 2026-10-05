/** Bottom sheets and toasts. One sheet at a time (stacking would be confusing on a phone). */
import { esc } from '../utils/format.js';
import { icon } from './ui.js';

let current = null;
let lastFocus = null;

export const sheet = {
  /**
   * @param def { title, render(): html, foot?(): html, actions?, inputs?, tall?, onClose? }
   */
  open(def) {
    if (current) this.close();
    lastFocus = document.activeElement;
    const root = document.getElementById('overlay-root');
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.dataset.action = 'close-sheet';
    const el = document.createElement('section');
    el.className = `sheet${def.tall ? ' sheet--tall' : ''}`;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', def.title || 'Details');
    root.append(scrim, el);
    current = { def, el, scrim };
    this.refresh();
    requestAnimationFrame(() => {
      scrim.classList.add('is-open');
      el.classList.add('is-open');
      const f = el.querySelector('[autofocus]') || el.querySelector('.sheet-head button, button, [tabindex="0"]');
      f?.focus({ preventScroll: true });
    });
  },

  refresh({ keepScroll = true } = {}) {
    if (!current) return;
    const { def, el } = current;
    const body = el.querySelector('.sheet-body');
    const top = keepScroll && body ? body.scrollTop : 0;
    el.innerHTML = `<div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><h2>${esc(def.title || '')}</h2><button class="icon-btn" data-action="close-sheet" aria-label="Close">${icon.close}</button></div>
      <div class="sheet-body">${def.render()}</div>
      ${def.foot ? `<div class="sheet-foot">${def.foot()}</div>` : ''}`;
    const nb = el.querySelector('.sheet-body');
    if (nb) nb.scrollTop = top;
    def.mount?.(el);
  },

  /** Update just one region inside the sheet (keeps input focus). */
  patch(selector, html) {
    const t = current?.el.querySelector(selector);
    if (t) t.innerHTML = html;
  },

  close() {
    if (!current) return;
    const { el, scrim, def } = current;
    current = null;
    el.classList.remove('is-open');
    scrim.classList.remove('is-open');
    setTimeout(() => { el.remove(); scrim.remove(); }, 260);
    def.onClose?.();
    lastFocus?.focus?.({ preventScroll: true });
  },

  get isOpen() { return !!current; },
  get def() { return current?.def; },
  get el() { return current?.el; },
};

export function toast(html, { kind = '', ms = 2600, action = null } = {}) {
  const root = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = `toast ${kind ? `toast--${kind}` : ''}`;
  t.setAttribute('role', 'status');
  t.innerHTML = html + (action ? `<button class="toast-action">${esc(action.label)}</button>` : '');
  if (action) t.querySelector('.toast-action').addEventListener('click', () => { action.run(); t.remove(); });
  // a new message replaces older plain ones, so toasts never pile up over the screen
  for (const old of [...root.children]) if (!old.matches('.toast--pr') && !old.querySelector('.toast-action')) old.remove();
  root.append(t);
  while (root.children.length > 2) root.firstChild.remove();
  t.addEventListener('click', (e) => { if (!e.target.closest('.toast-action')) t.remove(); });
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, ms);
}

/** Promise-based confirm sheet (no blocking browser dialogs). */
export function confirmSheet({ title, text, confirm = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    sheet.open({
      title,
      render: () => `<p class="text-2">${esc(text)}</p>`,
      foot: () => `<div class="btn-row"><button class="btn" data-action="c-no">Cancel</button><button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-action="c-yes">${esc(confirm)}</button></div>`,
      actions: {
        'c-yes': () => { answered = true; sheet.close(); resolve(true); },
        'c-no': () => { answered = true; sheet.close(); resolve(false); },
      },
      onClose: () => { if (!answered) resolve(false); },
    });
  });
}

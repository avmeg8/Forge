/** Escape a value for safe interpolation into HTML. */
export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format a weight in kg without trailing zeros: 17.5 → "17.5", 20 → "20". */
export function kg(w) {
  if (w == null || Number.isNaN(w)) return '—';
  return (Math.round(w * 100) / 100).toString();
}

export function num(n) {
  return Math.round(n).toLocaleString('en-US');
}

export function pct(n) {
  return `${Math.round(n * 100)}%`;
}

/** "20 kg × 10", "Bodyweight × 15", "45 s", "16 kg · 45 s" */
export function setLabel(set, ex) {
  if (!set) return '—';
  if (ex?.metric === 'time') {
    return set.weight ? `${kg(set.weight)} kg · ${set.seconds ?? set.reps} s` : `${set.seconds ?? set.reps} s`;
  }
  if (!set.weight) return `${set.reps} reps`;
  return `${kg(set.weight)} kg × ${set.reps}`;
}

export function duration(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

export function clock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function plural(n, word, pluralWord) {
  return `${n} ${n === 1 ? word : pluralWord || word + 's'}`;
}

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

export function repsRange(min, max, metric) {
  const unit = metric === 'time' ? ' s' : '';
  return min === max ? `${min}${unit}` : `${min}–${max}${unit}`;
}

export const DAY = 86400000;
export const HOUR = 3600000;

/** Local calendar day key, e.g. "2026-10-05". */
export function dayKey(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function startOfDay(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Whole calendar days between two timestamps (local time, DST-safe). */
export function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY);
}

/** Start of the week containing t. weekStart: 0 = Sunday, 1 = Monday. */
export function startOfWeek(t, weekStart = 1) {
  const d = new Date(startOfDay(t));
  const diff = (d.getDay() - weekStart + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

/** "Today", "Yesterday", "2 days ago", "3 weeks ago" */
export function relativeDay(t, now = Date.now()) {
  if (!t) return 'Never';
  const d = daysBetween(t, now);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  return `${Math.round(d / 30)} months ago`;
}

/** Section heading for history lists. */
export function dayHeading(t, now = Date.now()) {
  const d = daysBetween(t, now);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  return new Date(t).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}

export function shortDate(t) {
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function greeting(now = Date.now()) {
  const h = new Date(now).getHours();
  if (h < 5) return 'Good night.';
  if (h < 12) return 'Good morning.';
  if (h < 18) return 'Good afternoon.';
  return 'Good evening.';
}

/** Best guess at the user's first day of week from the browser locale. */
export function detectWeekStart() {
  try {
    const loc = new Intl.Locale(navigator.language);
    const info = loc.getWeekInfo ? loc.getWeekInfo() : loc.weekInfo;
    if (info && info.firstDay) return info.firstDay % 7; // Intl: 1 = Monday … 7 = Sunday
  } catch { /* ignore */ }
  return 1;
}

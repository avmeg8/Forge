/** Minimal SVG charts — simple by design. */
import { shortDate } from '../utils/date.js';
import { esc } from '../utils/format.js';

const W = 320, H = 140, PL = 34, PR = 10, PT = 12, PB = 22;

function scale(vals, pad = 0.08) {
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const r = hi - lo;
  return [lo - r * pad, hi + r * pad];
}

/** points: [{ t, v }] → line chart with dots. */
export function lineChart(points, { label = '', fmt = (v) => Math.round(v), step = false, minZero = false } = {}) {
  if (!points.length) return '<p class="small muted">No data yet.</p>';
  const pts = points.length === 1 ? [points[0], { ...points[0], t: points[0].t + 1 }] : points;
  const ts = pts.map((p) => p.t);
  const t0 = Math.min(...ts), t1 = Math.max(...ts);
  let [lo, hi] = scale(pts.map((p) => p.v));
  if (minZero) lo = Math.min(0, lo);
  const x = (t) => PL + ((t - t0) / (t1 - t0 || 1)) * (W - PL - PR);
  const y = (v) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
  let d = '';
  pts.forEach((p, i) => {
    if (i === 0) d += `M${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`;
    else if (step) d += `H${x(p.t).toFixed(1)}V${y(p.v).toFixed(1)}`;
    else d += `L${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`;
  });
  const area = `${d}V${H - PB}H${PL}Z`;
  const ticks = [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1];
  const dots = points.length <= 24 ? points.map((p) => `<circle class="dot" cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="2.6"/>`).join('') : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
    <defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f08a3c" stop-opacity=".22"/><stop offset="1" stop-color="#f08a3c" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map((v) => `<line class="grid" x1="${PL}" x2="${W - PR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="axis" x="${PL - 6}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end">${esc(fmt(v))}</text>`).join('')}
    <path class="area" d="${area}"/><path class="line" d="${d}"/>${dots}
    <text class="axis" x="${PL}" y="${H - 6}">${shortDate(t0)}</text>
    <text class="axis" x="${W - PR}" y="${H - 6}" text-anchor="end">${shortDate(points[points.length - 1].t)}</text>
  </svg>`;
}

/** bars: [{ label, v }] */
export function barChart(bars, { label = '', fmt = (v) => Math.round(v) } = {}) {
  if (!bars.length) return '<p class="small muted">No data yet.</p>';
  const max = Math.max(1, ...bars.map((b) => b.v));
  const bw = (W - PL - PR) / bars.length;
  const y = (v) => PT + (1 - v / max) * (H - PT - PB);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
    <line class="grid" x1="${PL}" x2="${W - PR}" y1="${y(max)}" y2="${y(max)}"/>
    <text class="axis" x="${PL - 6}" y="${y(max) + 3}" text-anchor="end">${esc(fmt(max))}</text>
    <line class="grid" x1="${PL}" x2="${W - PR}" y1="${H - PB}" y2="${H - PB}"/>
    ${bars.map((b, i) => {
      const h = Math.max(b.v > 0 ? 2 : 1.5, H - PB - y(b.v));
      return `<rect class="barr ${b.v > 0 ? '' : 'zero'}" x="${(PL + i * bw + bw * 0.18).toFixed(1)}" y="${(H - PB - h).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${h.toFixed(1)}" rx="2"><title>${esc(b.label)}: ${esc(fmt(b.v))}</title></rect>`;
    }).join('')}
    ${bars.map((b, i) => (i % Math.ceil(bars.length / 4) === 0 || i === bars.length - 1 ? `<text class="axis" x="${(PL + i * bw + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(b.label)}</text>` : '')).join('')}
  </svg>`;
}

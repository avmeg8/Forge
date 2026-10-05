/**
 * Interactive anatomical body map (SVG).
 *
 * Shapes are drawn for the figure's left half (viewer's left) and mirrored, so
 * both sides are always symmetric. Every muscle region is an accessible button
 * (role, tabindex, aria-label with name, tier, level, XP and progress).
 *
 * Visual emphasis uses ONE hue blended into the neutral muscle tone — stronger
 * blend = more developed. It reads as "definition", not as a heat map.
 */
import { MUSCLE_BY_ID } from '../data/muscles.js';
import { esc } from '../utils/format.js';

const MIRROR = 'matrix(-1 0 0 1 200 0)';

const SILHOUETTE = `M100 47 L91 49 C90 55 90 60 89 64 C82 70 72 73 62 76 C50 79 43 88 41 100
C39 112 39 124 39 134 C38 146 37 156 36 166 C34 176 30 190 28 204 C27 214 26 224 26 232
C24 238 23 248 25 256 C27 263 31 265 34 262 C36 256 37 248 38 240 C40 232 42 222 44 212
C47 200 51 188 53 176 C55 166 57 154 59 144 C60 136 61 130 62 126 C64 140 66 156 67 172
C68 186 66 198 64 210 C60 226 58 244 58 262 C58 286 61 310 65 332 C66 342 65 350 64 358
C61 374 61 392 64 408 C66 416 66 422 65 428 C62 432 63 437 71 437 L86 437 C89 433 86 426 85 420
C87 404 90 388 90 372 C90 362 89 354 89 346 C91 330 94 300 96 276 C97 266 98 258 100 254 Z`;

/** Muscle shapes per view. Draw order matters (later shapes sit on top). */
const FRONT = [
  ['quads', 'M65 212 C60 232 58 252 59 274 C60 298 63 318 67 334 C73 339 81 340 87 338 C88 322 89 302 89 288 C89 276 89 266 90 256 C84 248 78 238 73 228 C70 222 67 216 65 212 Z'],
  ['adductors', 'M97 253 C99 262 98 280 95 296 C93 306 91 316 88 322 C89 306 89 294 89 288 C89 276 89 266 90 256 C92 254 95 253 97 253 Z'],
  ['hip_flexors', 'M88 214 C83 214 77 212 71 209 C73 220 78 232 85 242 C89 247 93 250 97 252 C96 240 93 226 88 214 Z'],
  ['obliques', 'M84 123 C77 122 71 118 67 112 C66 128 67 148 68 166 C68 182 68 196 70 206 C76 211 82 213 87 213 C86 198 85 180 85 160 C85 146 85 134 86 124 Z'],
  ['abs', 'M99 124 L87 124 C86 140 86 164 87 188 C88 204 91 216 99 226 Z'],
  ['chest', 'M99 80 C92 78 81 77 73 79 C69 85 67 94 67 104 C69 114 75 120 84 121 C92 121 97 118 99 114 Z'],
  ['traps', 'M89 62 C84 68 76 72 66 75 C74 77 82 78 91 77 C91 71 91 66 89 62 Z'],
  ['side_delts', 'M62 76 C52 78 45 86 43 97 C41 107 42 117 46 125 C50 125 54 125 57 124 C56 116 56 104 58 94 C59 88 61 83 64 79 Z'],
  ['front_delts', 'M64 79 C68 78 71 78 73 79 C69 86 67 94 67 104 C66 112 62 120 57 124 C56 116 56 104 58 94 C59 88 61 83 64 79 Z'],
  ['biceps', 'M46 128 C43 138 42 150 43 162 C45 170 49 174 53 172 C57 164 59 150 59 138 C58 132 57 128 56 126 C52 126 49 126 46 128 Z'],
  ['forearms', 'M43 175 C38 185 33 198 31 212 C30 220 30 226 30 230 L41 230 C44 220 47 208 50 196 C52 188 54 180 54 175 C50 177 46 177 43 175 Z'],
  ['calves', 'M65 356 C61 370 61 388 63 402 C66 408 70 408 72 402 C73 388 72 370 70 356 Z'],
  ['calves', 'M86 354 C90 366 91 382 89 398 C87 406 83 408 82 400 C81 386 82 368 84 354 Z'],
];

const FRONT_DETAIL = [
  'M87 143 L99 142', 'M87 162 L99 161', 'M86.5 181 L99 181', // ab segments
  'M75 254 C78 280 80 306 81 332', // rectus femoris edge
  'M70 300 C74 316 78 328 84 336', // vastus medialis/lateralis hint
  'M70 100 C78 106 88 110 98 110', // pec lower fibre
];

const BACK = [
  ['lats', 'M89 100 C92 108 94 118 96 130 C97 140 98 148 99 156 L99 182 C97 192 92 198 85 200 C77 190 71 176 68 162 C65 148 64 132 65 116 C68 118 70 118 72 118 C80 114 86 108 89 100 Z'],
  ['lower_back', 'M99 150 C96 160 94 172 93 186 C92 198 93 210 96 220 L99 224 Z'],
  ['obliques', 'M68 164 C68 180 67 196 66 210 C72 214 80 216 88 214 C86 206 82 198 78 190 C74 182 70 172 68 164 Z'],
  ['traps', 'M100 48 C96 58 92 64 86 68 C78 72 70 74 64 77 C72 79 82 84 88 92 C92 100 95 116 97 132 C98 136 99 140 100 142 Z'],
  ['traps', 'M68 80 C80 84 87 92 89 100 C86 108 80 114 72 118 C68 118 66 116 65 112 C64 104 66 92 68 80 Z'],
  ['side_delts', 'M60 76 C51 79 45 86 43 97 C41 107 42 117 46 124 C47 116 46 108 47 100 C49 90 54 82 60 76 Z'],
  ['rear_delts', 'M60 76 C54 82 49 90 47 100 C46 108 47 116 48 121 C55 117 61 109 64 101 C67 94 68 86 68 79 C66 77 63 76 60 76 Z'],
  ['triceps', 'M46 126 C42 138 41 152 42 164 C45 170 49 172 52 170 C55 160 58 148 59 136 C58 130 57 125 56 122 C52 121 48 122 46 126 Z'],
  ['forearms', 'M43 175 C38 185 33 198 31 212 C30 220 30 226 30 230 L41 230 C44 220 47 208 50 196 C52 188 54 180 54 175 C50 177 46 177 43 175 Z'],
  ['glutes', 'M99 222 C92 218 80 216 70 218 C64 228 62 242 63 256 C66 270 78 278 90 278 C95 278 98 276 99 274 Z'],
  ['hamstrings', 'M64 264 C60 284 60 306 64 326 C66 334 68 340 70 344 L88 344 C90 330 92 312 93 296 C94 288 95 282 96 278 C88 282 76 280 68 272 C66 270 65 268 64 264 Z'],
  ['calves', 'M66 350 C61 362 60 378 63 392 C66 400 72 402 77 396 C79 384 79 366 78 352 C74 348 70 348 66 350 Z'],
  ['calves', 'M80 352 C84 362 89 376 89 390 C88 400 84 404 80 398 C79 384 80 366 80 352 Z'],
];

const BACK_DETAIL = [
  'M80 284 C79 304 79 324 79 342', // hamstring split
  'M70 120 C76 136 82 150 88 162', // lat fibre
];

export const VIEW_MUSCLES = {
  front: [...new Set(FRONT.map(([m]) => m))],
  back: [...new Set(BACK.map(([m]) => m))],
};

/* ───────────── colour ─────────────
 * Interpolated in OKLCH so mid-levels stay clean (no muddy browns):
 * lightness and chroma rise together along a single hue. */
const RAMPS = {
  level: { l: [0.37, 0.80], c: [0.008, 0.16], h: 58 },  // forged copper → bright amber
  weekly: { l: [0.37, 0.80], c: [0.008, 0.16], h: 58 },
  recent: { l: [0.37, 0.78], c: [0.008, 0.13], h: 245 }, // cool steel blue
};

function oklchToRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lin.map((v) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, c)) * 255);
  });
}

/** Emphasis 0..1 → fill colour. */
export function emphasisColor(t, mode = 'level') {
  const r = RAMPS[mode] || RAMPS.level;
  const k = Math.max(0, Math.min(1, t || 0));
  const L = r.l[0] + (r.l[1] - r.l[0]) * k;
  const C = r.c[0] + (r.c[1] - r.c[0]) * Math.pow(k, 1.7);
  return `rgb(${oklchToRgb(L, C, r.h).join(',')})`;
}

/** Level → emphasis: each tier occupies a band, levels move within it. */
export function levelEmphasis(info) {
  if (!info || info.xp <= 0) return 0;
  const bands = { beginner: [0.16, 0.34], intermediate: [0.36, 0.56], advanced: [0.62, 0.8], elite: [0.86, 1] };
  const [lo, hi] = bands[info.tier.id];
  const within = (info.level - info.tier.min + info.progress) / 10;
  return lo + (hi - lo) * Math.min(1, within);
}

/**
 * @param opts.view      'front' | 'back'
 * @param opts.values    { muscleId: { t: 0..1, aria: string } }
 * @param opts.mode      'level' | 'recent' | 'weekly'
 * @param opts.selected  muscle id
 * @param opts.both      render both views side by side (compact home map)
 */
export function bodyMap({ view = 'front', values = {}, mode = 'level', selected = null, both = false, cls = '' } = {}) {
  const fig = (v) => {
    const shapes = v === 'front' ? FRONT : BACK;
    const detail = v === 'front' ? FRONT_DETAIL : BACK_DETAIL;
    const groups = {};
    for (const [m, d] of shapes) (groups[m] ||= []).push(d);
    const muscleSvg = Object.entries(groups).map(([m, ds]) => {
      const val = values[m] || {};
      const fill = emphasisColor(val.t, mode);
      const sel = selected === m;
      const elite = mode === 'level' && val.t >= 0.86;
      const paths = ds.map((d) => `<path d="${d}"/><path d="${d}" transform="${MIRROR}"/>`).join('');
      const label = esc(val.aria || MUSCLE_BY_ID[m].name);
      return `<g class="bm-muscle${sel ? ' is-selected' : ''}${elite ? ' is-elite' : ''}" data-action="muscle" data-muscle="${m}" role="button" tabindex="0" aria-label="${label}" aria-pressed="${sel}" style="fill:${fill}"><title>${label}</title>${paths}</g>`;
    }).join('');
    const det = detail.map((d) => `<path d="${d}"/><path d="${d}" transform="${MIRROR}"/>`).join('');
    return `<svg class="bm-svg bm-${v}" viewBox="0 0 200 444" role="group" aria-label="${v === 'front' ? 'Front' : 'Back'} view muscle map" focusable="false">
      <ellipse class="bm-skin" cx="100" cy="29" rx="15.5" ry="19.5"/>
      <path class="bm-skin" d="${SILHOUETTE}"/><path class="bm-skin" d="${SILHOUETTE}" transform="${MIRROR}"/>
      ${v === 'back' ? '<path class="bm-detail-soft" d="M100 50 L100 226"/>' : ''}
      ${muscleSvg}
      <g class="bm-detail" aria-hidden="true">${det}</g>
    </svg>`;
  };
  if (both) {
    return `<div class="bodymap bodymap--both ${cls}">${fig('front')}${fig('back')}</div>`;
  }
  return `<div class="bodymap ${cls}" data-view="${view}">
    <div class="bm-stage">
      <div class="bm-face bm-face--front" ${view === 'front' ? '' : 'aria-hidden="true" inert'}>${fig('front')}</div>
      <div class="bm-face bm-face--back" ${view === 'back' ? '' : 'aria-hidden="true" inert'}>${fig('back')}</div>
    </div>
  </div>`;
}

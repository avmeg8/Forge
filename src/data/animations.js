/**
 * Demo animations for every exercise.
 *
 * Coordinates: floor at y = 0, up is negative, the figure faces right (side view).
 * Angles: 0 = down, 90 = forward, 180 = up, -90 = backward.
 * See src/components/demo.js for the pose format.
 *
 * ANIMS holds reusable movement templates; EXERCISE_ANIM maps every exercise id to a
 * template (+ what's held, props, and small overrides). Exercises not listed fall back
 * to a template chosen from their movement pattern, so every exercise always has a demo.
 */
import { EXERCISES } from './exercises.js';

const FY = -2; // ankle height above the floor
const STAND_HIP = [0, -39.4];
const feet = (n = 2, f = -2, bend = 1) => ({ legN: { to: [n, FY], bend }, legF: { to: [f, FY], bend } });
const stand = (o = {}) => ({ hip: STAND_HIP, torso: 180, ...feet(), armN: [3, 3], armF: [-2, -2], ...o });
const lying = (o = {}) => ({ hip: [0, -5.5], torso: -90, legN: { to: [17, FY], bend: 1 }, legF: { to: [15, FY], bend: 1 }, ...o });
const seat = (h = -20) => [{ type: 'box', x: -14, y: h + 4, w: 20, h: -(h + 4) }];

/* ───────────── front-view helpers (armN / legN = viewer-left side) ───────────── */
const fStand = (o = {}) => ({ hip: [0, -39.4], torso: 180, legN: { to: [-7, FY], bend: -1 }, armN: [-5, -4], ...o });

export const ANIMS = {
  /* ── SQUAT ── */
  squat_goblet: {
    hold: 'vertical',
    frames: [
      stand({ armN: { toS: [8, 5], bend: -1 }, ...feet(4, 0) }),
      { hip: [-10, -18], torso: 148, ...feet(4, 0), armN: { toS: [8, 5], bend: -1 } },
    ],
  },
  squat_bw: {
    hold: 'none',
    frames: [stand({ ...feet(4, 0), armN: [8, 8] }), { hip: [-10, -18], torso: 150, ...feet(4, 0), armN: [95, 95] }],
  },
  squat_hang: {
    hold: 'vertical',
    frames: [stand({ ...feet(4, 0), armN: [2, 2] }), { hip: [-6, -18], torso: 160, ...feet(4, 0), armN: [8, 4] }],
  },
  squat_heel: {
    hold: 'vertical',
    props: [{ type: 'box', x: -4, y: -4, w: 8, h: 4, r: 1 }],
    frames: [
      { ...stand({ armN: { toS: [8, 5], bend: -1 } }), legN: { to: [3, -5], bend: 1 }, legF: { to: [1, -5], bend: 1 }, hip: [0, -42], footN: 75 },
      { hip: [-6, -19], torso: 162, legN: { to: [3, -5], bend: 1 }, legF: { to: [1, -5], bend: 1 }, armN: { toS: [8, 5], bend: -1 }, footN: 75 },
    ],
  },
  squat_back: {
    hold: 'barbellBack',
    frames: [
      stand({ ...feet(4, 0), armN: { toS: [3, -1], bend: -1 } }),
      { hip: [-11, -19], torso: 143, ...feet(4, 0), armN: { toS: [3, -1], bend: -1 } },
    ],
  },
  squat_front: {
    hold: 'barbell',
    frames: [
      stand({ ...feet(4, 0), armN: { toS: [8, -1], bend: -1 } }),
      { hip: [-8, -18], torso: 155, ...feet(4, 0), armN: { toS: [8, -1], bend: -1 } },
    ],
  },
  leg_press: {
    hold: 'none',
    props: [{ type: 'box', x: -22, y: -16, w: 26, h: 16 }, { type: 'box', x: 34, y: -64, w: 4, h: 36 }],
    frames: [
      { hip: [0, -18], torso: -125, legN: { to: [22, -38], bend: 1 }, footN: 175, armN: [40, 70] },
      { hip: [0, -18], torso: -125, legN: { to: [31, -46], bend: 1 }, footN: 175, armN: [40, 70] },
    ],
  },
  /* ── LUNGES ── */
  split_squat: {
    hold: 'N',
    frames: [
      { hip: [-4, -38.5], torso: 180, legN: { to: [10, FY], bend: 1 }, legF: { to: [-21, -6], bend: 1 }, footF: 45, armN: [2, 2], armF: [-2, -2] },
      { hip: [-6, -20], torso: 175, legN: { to: [10, FY], bend: 1 }, legF: { to: [-21, -6], bend: 1 }, footF: 45, armN: [2, 2], armF: [-2, -2] },
    ],
  },
  bulgarian: {
    hold: 'N',
    props: [{ type: 'box', x: -36, y: -19, w: 18, h: 19 }],
    frames: [
      { hip: [-3, -37.5], torso: 175, legN: { to: [12, FY], bend: 1 }, legF: { to: [-24, -21], bend: 1 }, footF: -95, armN: [2, 2], armF: [-2, -2] },
      { hip: [-5, -21], torso: 165, legN: { to: [12, FY], bend: 1 }, legF: { to: [-24, -21], bend: 1 }, footF: -95, armN: [6, 6], armF: [-2, -2] },
    ],
  },
  reverse_lunge: {
    hold: 'vertical',
    frames: [
      stand({ ...feet(2, 0), armN: { toS: [8, 5], bend: -1 } }),
      { hip: [-6, -20], torso: 176, legN: { to: [2, FY], bend: 1 }, legF: { to: [-26, -6], bend: 1 }, footF: 45, armN: { toS: [8, 5], bend: -1 } },
    ],
  },
  forward_lunge: {
    hold: 'vertical',
    frames: [
      stand({ ...feet(2, 0), armN: { toS: [8, 5], bend: -1 } }),
      { hip: [8, -20], torso: 176, legN: { to: [24, FY], bend: 1 }, legF: { to: [-4, -6], bend: 1 }, footF: 45, armN: { toS: [8, 5], bend: -1 } },
    ],
  },
  step_up: {
    hold: 'N',
    props: [{ type: 'box', x: 8, y: -18, w: 22, h: 18 }],
    frames: [
      { hip: [0, -38], torso: 172, legN: { to: [16, -20], bend: 1 }, legF: { to: [-2, FY], bend: 1 }, armN: [3, 3], armF: [-2, -2] },
      { hip: [15, -56], torso: 178, legN: { to: [16, -20], bend: 1 }, legF: { to: [9, -26], bend: 1 }, armN: [3, 3], armF: [-2, -2] },
    ],
  },
  single_leg_squat: {
    hold: 'none',
    props: [{ type: 'box', x: -26, y: -20, w: 18, h: 20 }],
    frames: [
      { hip: [-2, -39], torso: 178, legN: { to: [4, FY], bend: 1 }, legF: [42, 42], armN: [80, 80] },
      { hip: [-12, -22], torso: 150, legN: { to: [4, FY], bend: 1 }, legF: [78, 82], armN: [95, 95] },
    ],
  },
  pistol: {
    hold: 'none',
    frames: [
      { hip: [-2, -39], torso: 178, legN: { to: [4, FY], bend: 1 }, legF: [30, 30], armN: [85, 85] },
      { hip: [-8, -12], torso: 145, legN: { to: [4, FY], bend: 1 }, legF: [88, 90], armN: [95, 95] },
    ],
  },
  lateral_lunge: {
    view: 'front',
    hold: 'both',
    frames: [
      { hip: [0, -36], torso: 180, legN: { to: [-20, FY], bend: -1 }, legF: { to: [20, FY], bend: 1 }, armN: { toS: [-3, 8], bend: 1 } },
      { hip: [-12, -20], torso: 172, legN: { to: [-20, FY], bend: -1 }, legF: { to: [20, FY], bend: 1 }, armN: { toS: [-3, 8], bend: 1 } },
    ],
  },
  cossack: {
    view: 'front',
    hold: 'both',
    frames: [
      { hip: [0, -34], torso: 180, legN: { to: [-24, FY], bend: -1 }, legF: { to: [24, FY], bend: 1 }, armN: { toS: [-3, 8], bend: 1 } },
      { hip: [-16, -12], torso: 168, legN: { to: [-24, FY], bend: -1 }, legF: { to: [24, FY], bend: 1 }, armN: { toS: [-3, 8], bend: 1 } },
    ],
  },
  lateral_walk: {
    view: 'front',
    hold: 'none',
    frames: [
      { hip: [0, -34], torso: 180, legN: { to: [-9, FY], bend: -1 }, legF: { to: [9, FY], bend: 1 }, armN: { toS: [-3, 10], bend: 1 } },
      { hip: [-6, -34], torso: 180, legN: { to: [-22, -4], bend: -1 }, legF: { to: [9, FY], bend: 1 }, armN: { toS: [-3, 10], bend: 1 } },
      { hip: [-10, -34], torso: 180, legN: { to: [-22, FY], bend: -1 }, legF: { to: [2, FY], bend: 1 }, armN: { toS: [-3, 10], bend: 1 } },
    ],
  },
  /* ── HINGE ── */
  rdl: {
    hold: 'vertical',
    frames: [
      stand({ ...feet(3, 1), armN: [2, 2] }),
      { hip: [-12, -37], torso: 102, ...feet(3, 1), armN: [0, 0] },
    ],
  },
  staggered_rdl: {
    hold: 'N',
    frames: [
      { hip: [-1, -39], torso: 180, legN: { to: [5, FY], bend: 1 }, legF: { to: [-8, -4], bend: 1 }, footF: 45, armN: [2, 2], armF: [-2, -2] },
      { hip: [-11, -36], torso: 104, legN: { to: [5, FY], bend: 1 }, legF: { to: [-8, -4], bend: 1 }, footF: 45, armN: [0, 0], armF: [-5, -5] },
    ],
  },
  single_leg_rdl: {
    hold: 'N',
    frames: [
      { hip: [0, -39], torso: 180, legN: { to: [3, FY], bend: 1 }, legF: [-8, -8], armN: [2, 2], armF: [-2, -2] },
      { hip: [-6, -37], torso: 98, legN: { to: [3, FY], bend: 1 }, legF: [-82, -84], armN: [0, 0], armF: [-15, -15] },
    ],
  },
  good_morning: {
    hold: 'vertical',
    frames: [
      stand({ ...feet(3, 1), armN: { toS: [7, 3], bend: -1 } }),
      { hip: [-10, -37.5], torso: 100, ...feet(3, 1), armN: { toS: [7, 3], bend: -1 } },
    ],
  },
  deadlift: {
    hold: 'barbell',
    frames: [
      { hip: [-12, -24], torso: 128, ...feet(4, 2), armN: { to: [4, -9], bend: 1 } },
      stand({ ...feet(4, 2), armN: [0, 0] }),
    ],
  },
  suitcase_deadlift: {
    hold: 'N',
    frames: [
      { hip: [-10, -24], torso: 140, ...feet(3, 1), armN: { to: [3, -8], bend: 1 } },
      stand({ ...feet(3, 1), armN: [0, 0] }),
    ],
  },
  swing: {
    hold: 'kb',
    frames: [
      { hip: [-11, -34], torso: 112, ...feet(4, 0), armN: [-25, -28] },
      stand({ ...feet(4, 0), armN: [96, 96], torso: 184 }),
    ],
    dur: [0.55, 0.8],
  },
  /* ── BRIDGES ── */
  glute_bridge: {
    hold: 'hip',
    frames: [
      lying({ armN: [92, 92] }),
      { hip: [0, -22], torso: -54, head: -36, legN: { to: [17, FY], bend: 1 }, legF: { to: [15, FY], bend: 1 }, armN: [96, 96] },
    ],
  },
  glute_bridge_bw: {
    hold: 'none',
    frames: [
      lying({ armN: [92, 92] }),
      { hip: [0, -22], torso: -54, head: -36, legN: { to: [17, FY], bend: 1 }, legF: { to: [15, FY], bend: 1 }, armN: [96, 96] },
    ],
  },
  single_leg_bridge: {
    hold: 'none',
    frames: [
      { ...lying({ armN: [92, 92] }), legF: [150, 150] },
      { hip: [0, -22], torso: -54, head: -36, legN: { to: [17, FY], bend: 1 }, legF: [115, 115], armN: [96, 96] },
    ],
  },
  hip_thrust: {
    hold: 'hip',
    props: [{ type: 'box', x: -50, y: -17, w: 26, h: 17 }],
    frames: [
      { hip: [0, -7], torso: -112, legN: { to: [16, FY], bend: 1 }, legF: { to: [14, FY], bend: 1 }, armN: [60, 80] },
      { hip: [0, -23], torso: -86, legN: { to: [16, FY], bend: 1 }, legF: { to: [14, FY], bend: 1 }, armN: [60, 80] },
    ],
  },
  slider_curl: {
    hold: 'none',
    frames: [
      { hip: [0, -20], torso: -58, head: -32, legN: { to: [18, FY], bend: 1 }, legF: { to: [16, FY], bend: 1 }, armN: [96, 96] },
      { hip: [0, -11], torso: -72, head: -18, legN: { to: [34, FY], bend: 1 }, legF: { to: [32, FY], bend: 1 }, armN: [96, 96] },
    ],
  },
  /* ── CALVES ── */
  calf_raise: {
    hold: 'N',
    frames: [
      { hip: [0, -39.6], torso: 180, legN: [0, 0], armN: [2, 2], armF: [-3, -3], footN: 90 },
      { hip: [2, -45], torso: 180, legN: [0, 0], armN: [2, 2], armF: [-3, -3], footN: 42 },
    ],
  },
  calf_seated: {
    hold: 'knee',
    props: seat(-20),
    frames: [
      { hip: [-2, -22], torso: 178, legN: { to: [17, FY], bend: 1 }, armN: { toS: [10, 14], bend: 1 }, footN: 90 },
      { hip: [-2, -22], torso: 178, legN: { to: [17, -6.5], bend: 1 }, armN: { toS: [10, 13], bend: 1 }, footN: 45 },
    ],
  },
  /* ── CORE ── */
  crunch: {
    hold: 'vertical',
    frames: [
      lying({ armN: { toS: [5, 4], bend: 1 } }),
      lying({ torso: -122, armN: { toS: [5, 4], bend: 1 } }),
    ],
  },
  situp: {
    hold: 'vertical',
    frames: [
      lying({ armN: { toS: [5, 4], bend: 1 } }),
      lying({ torso: -168, armN: { toS: [5, 4], bend: 1 } }),
    ],
  },
  cable_crunch: {
    hold: 'none',
    rope: [8, -78],
    frames: [
      { hip: [0, -21], torso: 168, legN: [0, -90], footN: -90, armN: { toS: [3, -2], bend: 1 } },
      { hip: [0, -21], torso: 112, legN: [0, -90], footN: -90, armN: { toS: [3, -2], bend: 1 } },
    ],
  },
  russian_twist: {
    view: 'front',
    hold: 'both',
    noFloor: false,
    frames: [
      { hip: [0, -6], torso: 186, torsoLen: 0.9, legN: { to: [-8, -14], bend: -1, len: 0.6 }, armN: { to: [-15, -26], bend: 1 }, armF: { to: [-13, -24], bend: 1 } },
      { hip: [0, -6], torso: 174, torsoLen: 0.9, legN: { to: [-8, -14], bend: -1, len: 0.6 }, armN: { to: [13, -24], bend: -1 }, armF: { to: [15, -26], bend: -1 } },
    ],
    dur: [0.8, 0.8],
  },
  woodchop: {
    view: 'front',
    hold: 'both',
    frames: [
      { hip: [0, -36], torso: 178, legN: { to: [-10, FY], bend: -1 }, armN: { to: [-16, -30], bend: 1 }, armF: { to: [-14, -28], bend: 1 } },
      { hip: [0, -38], torso: 184, legN: { to: [-10, FY], bend: -1 }, armN: { to: [14, -84], bend: -1 }, armF: { to: [16, -82], bend: -1 } },
    ],
  },
  side_bend: {
    view: 'front',
    hold: 'N',
    frames: [fStand({ armN: [-3, -3], armF: [3, 3] }), fStand({ torso: 197, armN: [-1, -1], armF: [12, 12] })],
  },
  suitcase_hold: {
    view: 'front',
    hold: 'N',
    frames: [fStand({ armN: [-4, -4], armF: [4, 4] }), fStand({ armN: [-4, -4], armF: [4, 4], hip: [0, -39.1] })],
    dur: [1.2, 1.2],
  },
  march: {
    hold: 'N',
    frames: [
      { hip: [0, -39.4], torso: 180, legN: [80, -5], legF: { to: [-1, FY], bend: 1 }, armN: [0, 0], armF: [-4, -4] },
      { hip: [0, -39.4], torso: 180, legF: [80, -5], legN: { to: [1, FY], bend: 1 }, armN: [0, 0], armF: [-4, -4] },
    ],
    dur: [0.8, 0.8],
  },
  carry: {
    hold: 'NF',
    frames: [
      { hip: [0, -39], torso: 180, legN: { to: [9, FY], bend: 1 }, legF: { to: [-8, FY], bend: 1 }, armN: [0, 0], armF: [0, 0] },
      { hip: [0, -39], torso: 180, legN: { to: [-8, FY], bend: 1 }, legF: { to: [9, FY], bend: 1 }, armN: [0, 0], armF: [0, 0] },
    ],
    dur: [0.7, 0.7],
  },
  plank: {
    hold: 'none',
    frames: [
      { hip: [0, -11], torso: -98, legN: { to: [36, -5], bend: -1 }, footN: 175, armN: { to: [-26, -1], bend: 1 } },
      { hip: [0, -12], torso: -97, legN: { to: [36, -5], bend: -1 }, footN: 175, armN: { to: [-26, -1], bend: 1 } },
    ],
    dur: [1.4, 1.4],
  },
  side_plank: {
    view: 'front',
    hold: 'none',
    frames: [
      { hip: [0, -9], torso: -104, legN: { to: [36, -2], bend: 1 }, legF: { to: [36, -6], bend: 1 }, armN: { to: [-26, -1], bend: 1 }, armF: { to: [4, -16], bend: -1 } },
      { hip: [0, -13], torso: -98, legN: { to: [36, -2], bend: 1 }, legF: { to: [36, -6], bend: 1 }, armN: { to: [-26, -1], bend: 1 }, armF: { to: [4, -20], bend: -1 } },
    ],
  },
  dead_bug: {
    hold: 'none',
    frames: [
      lying({ legN: [180, 90], legF: [180, 90], armN: [180, 180], armF: [180, 180] }),
      lying({ legN: [180, 90], legF: [100, 96], armN: [-96, -96], armF: [180, 180] }),
      lying({ legN: [180, 90], legF: [180, 90], armN: [180, 180], armF: [180, 180] }),
      lying({ legN: [100, 96], legF: [180, 90], armN: [180, 180], armF: [-96, -96] }),
    ],
  },
  dead_bug_weighted: {
    hold: 'both',
    frames: [
      lying({ legN: [180, 90], legF: [180, 90], armN: [180, 180], armF: [180, 180] }),
      lying({ legN: [180, 90], legF: [100, 96], armN: [180, 180], armF: [180, 180] }),
      lying({ legN: [180, 90], legF: [180, 90], armN: [180, 180], armF: [180, 180] }),
      lying({ legN: [100, 96], legF: [180, 90], armN: [180, 180], armF: [180, 180] }),
    ],
  },
  leg_raise: {
    hold: 'none',
    frames: [lying({ legN: [92, 92], legF: [92, 92], armN: [92, 92] }), lying({ legN: [178, 178], legF: [178, 178], armN: [92, 92] })],
  },
  leg_raise_weighted: {
    hold: 'feet',
    frames: [lying({ legN: [92, 92], legF: [92, 92], armN: [92, 92] }), lying({ legN: [172, 172], legF: [172, 172], armN: [92, 92] })],
  },
  hanging_knee: {
    hold: 'none',
    noFloor: true,
    props: [{ type: 'bar', x1: -14, x2: 14, y: -95 }],
    frames: [
      { hip: [0, -43], torso: 180, legN: [0, 0], armN: { to: [1, -95], bend: 1 } },
      { hip: [2, -45], torso: 175, legN: [92, 0], armN: { to: [1, -95], bend: 1 } },
    ],
  },
  hanging_leg: {
    hold: 'none',
    noFloor: true,
    props: [{ type: 'bar', x1: -14, x2: 14, y: -95 }],
    frames: [
      { hip: [0, -43], torso: 180, legN: [0, 0], armN: { to: [1, -95], bend: 1 } },
      { hip: [3, -45], torso: 172, legN: [92, 92], armN: { to: [1, -95], bend: 1 } },
    ],
  },
  dead_hang: {
    hold: 'none',
    noFloor: true,
    props: [{ type: 'bar', x1: -14, x2: 14, y: -95 }],
    frames: [
      { hip: [0, -43], torso: 180, legN: [0, 0], armN: { to: [1, -95], bend: 1 } },
      { hip: [0, -43.6], torso: 180, legN: [0, 0], armN: { to: [1, -95], bend: 1 } },
    ],
    dur: [1.4, 1.4],
  },
  bird_dog: {
    hold: 'none',
    frames: [
      { hip: [0, -20], torso: -90, legN: [0, 90], legF: [0, 90], footN: 180, footF: 180, armN: [0, 0], armF: [0, 0] },
      { hip: [0, -20], torso: -90, legN: [0, 90], legF: [92, 92], footN: 180, footF: 180, armN: [-92, -92], armF: [0, 0] },
    ],
  },
  superman: {
    hold: 'none',
    frames: [
      { hip: [0, -5], torso: -90, legN: [90, 90], footN: 175, armN: [-90, -90] },
      { hip: [0, -5], torso: -104, head: -6, legN: [104, 102], footN: 175, armN: [-105, -105] },
    ],
  },
  back_extension: {
    hold: 'none',
    frames: [
      { hip: [0, -5], torso: -90, legN: [90, 90], footN: 175, armN: [-40, -150] },
      { hip: [0, -5], torso: -112, legN: [90, 90], footN: 175, armN: [-55, -165] },
    ],
  },
  y_raise: {
    hold: 'none',
    frames: [
      { hip: [0, -5], torso: -90, legN: [90, 90], footN: 175, armN: [-92, -92] },
      { hip: [0, -5], torso: -92, legN: [90, 90], footN: 175, armN: [-112, -112] },
    ],
  },
  adductor_raise: {
    view: 'front',
    hold: 'none',
    frames: [
      { hip: [0, -6], torso: -90, legN: [88, 88], legF: { to: [16, FY], bend: 1 }, armN: [-90, -90], armF: [60, 100] },
      { hip: [0, -6], torso: -90, legN: [78, 78], legF: { to: [16, FY], bend: 1 }, armN: [-90, -90], armF: [60, 100] },
    ],
  },
  pallof: {
    hold: 'none',
    rope: [-30, -64],
    frames: [
      stand({ ...feet(4, -4), armN: { toS: [6, 7], bend: -1 } }),
      stand({ ...feet(4, -4), armN: { toS: [24, 6], bend: -1 } }),
    ],
  },
  /* ── PRESS (lying) ── */
  floor_press: {
    hold: 'N',
    frames: [lying({ armN: [74, 180] }), lying({ armN: [180, 180] })],
  },
  floor_press_both: {
    hold: 'both',
    frames: [lying({ armN: [74, 180] }), lying({ armN: [180, 180] })],
  },
  bench_press: {
    hold: 'N',
    props: [{ type: 'box', x: -40, y: -18, w: 38, h: 18 }],
    frames: [
      { hip: [0, -22.5], torso: -90, legN: { to: [14, FY], bend: -1 }, legF: { to: [12, FY], bend: -1 }, armN: [-10, 175] },
      { hip: [0, -22.5], torso: -90, legN: { to: [14, FY], bend: -1 }, legF: { to: [12, FY], bend: -1 }, armN: [180, 180] },
    ],
  },
  incline_press: {
    hold: 'N',
    props: [{ type: 'box', x: -10, y: -18, w: 16, h: 18 }, { type: 'pad', x1: -2, y1: -16, x2: -26, y2: -32 }],
    frames: [
      { hip: [0, -22.5], torso: -125, legN: { to: [16, FY], bend: -1 }, armN: [-30, 170] },
      { hip: [0, -22.5], torso: -125, legN: { to: [16, FY], bend: -1 }, armN: [165, 165] },
    ],
  },
  barbell_bench: {
    hold: 'barbell',
    props: [{ type: 'box', x: -40, y: -18, w: 38, h: 18 }],
    frames: [
      { hip: [0, -22.5], torso: -90, legN: { to: [14, FY], bend: -1 }, armN: [-10, 175] },
      { hip: [0, -22.5], torso: -90, legN: { to: [14, FY], bend: -1 }, armN: [180, 180] },
    ],
  },
  pullover: {
    hold: 'both',
    frames: [lying({ armN: [180, 175] }), lying({ armN: [-100, -104] })],
  },
  bench_pullover: {
    hold: 'both',
    props: [{ type: 'box', x: -40, y: -18, w: 38, h: 18 }],
    frames: [
      { hip: [0, -22.5], torso: -90, legN: { to: [14, FY], bend: -1 }, armN: [180, 175] },
      { hip: [0, -22.5], torso: -90, legN: { to: [14, FY], bend: -1 }, armN: [-100, -106] },
    ],
  },
  skull_crusher: {
    hold: 'both',
    frames: [lying({ armN: [176, 178] }), lying({ armN: [-176, -112] })],
  },
  fly_top: {
    // seen from above, lying on the floor
    view: 'front',
    hold: 'N',
    noFloor: true,
    frames: [
      { hip: [0, -40], torso: 180, legN: { to: [-6, FY], bend: -1 }, armN: { ang: [-90, -78] }, armF: [10, 10] },
      { hip: [0, -40], torso: 180, legN: { to: [-6, FY], bend: -1 }, armN: { ang: [-8, 8], len: 0.35 }, armF: [10, 10] },
    ],
  },
  fly_top_both: {
    view: 'front',
    hold: 'NF',
    noFloor: true,
    frames: [
      { hip: [0, -40], torso: 180, legN: { to: [-6, FY], bend: -1 }, armN: { ang: [-90, -78] } },
      { hip: [0, -40], torso: 180, legN: { to: [-6, FY], bend: -1 }, armN: { ang: [-8, 8], len: 0.35 } },
    ],
  },
  /* ── PUSH-UPS ── */
  push_up: {
    hold: 'none',
    frames: [
      { hip: [0, -19], torso: -98, legN: { to: [37, -5], bend: -1 }, footN: 175, armN: { to: [-27, FY + 1], bend: 1 } },
      { hip: [0, -9], torso: -93, legN: { to: [37, -5], bend: -1 }, footN: 175, armN: { to: [-27, FY + 1], bend: 1 } },
    ],
  },
  push_up_knee: {
    hold: 'none',
    frames: [
      { hip: [0, -15], torso: -103, legN: { to: [16, -12], bend: 1 }, footN: 120, armN: { to: [-25, FY + 1], bend: 1 } },
      { hip: [0, -7], torso: -95, legN: { to: [17, -10], bend: 1 }, footN: 120, armN: { to: [-25, FY + 1], bend: 1 } },
    ],
  },
  push_up_incline: {
    hold: 'none',
    props: [{ type: 'box', x: -44, y: -22, w: 22, h: 22 }],
    frames: [
      { hip: [0, -29], torso: -115, legN: { to: [32, FY], bend: -1 }, footN: 150, armN: { to: [-28, -23], bend: 1 } },
      { hip: [-4, -22], torso: -108, legN: { to: [32, FY], bend: -1 }, footN: 150, armN: { to: [-28, -23], bend: 1 } },
    ],
  },
  push_up_decline: {
    hold: 'none',
    props: [{ type: 'box', x: 30, y: -16, w: 20, h: 16 }],
    frames: [
      { hip: [0, -24], torso: -87, legN: { to: [36, -19], bend: -1 }, footN: 175, armN: { to: [-28, FY + 1], bend: 1 } },
      { hip: [-2, -15], torso: -80, legN: { to: [36, -19], bend: -1 }, footN: 175, armN: { to: [-28, FY + 1], bend: 1 } },
    ],
  },
  pike_push_up: {
    hold: 'none',
    frames: [
      { hip: [0, -39], torso: -45, legN: { to: [5, FY], bend: -1 }, footN: 120, armN: { to: [-24, FY + 1], bend: 1 } },
      { hip: [0, -34], torso: -25, legN: { to: [5, FY], bend: -1 }, footN: 120, armN: { to: [-24, FY + 1], bend: 1 } },
    ],
  },
  plank_drag: {
    hold: 'N',
    frames: [
      { hip: [0, -19], torso: -98, legN: { to: [37, -5], bend: -1 }, footN: 175, armF: { to: [-27, FY + 1], bend: 1 }, armN: { to: [-20, -5], bend: 1 } },
      { hip: [0, -19.5], torso: -97, legN: { to: [37, -5], bend: -1 }, footN: 175, armF: { to: [-27, FY + 1], bend: 1 }, armN: { to: [-34, -5], bend: 1 } },
    ],
  },
  renegade_row: {
    hold: 'N',
    frames: [
      { hip: [0, -19], torso: -98, legN: { to: [37, -5], bend: -1 }, footN: 175, armF: { to: [-27, FY + 1], bend: 1 }, armN: { to: [-27, -4], bend: 1 } },
      { hip: [0, -19], torso: -98, legN: { to: [37, -5], bend: -1 }, footN: 175, armF: { to: [-27, FY + 1], bend: 1 }, armN: [-165, -5] },
    ],
  },
  /* ── DIPS / PUSHDOWNS ── */
  bench_dip: {
    hold: 'none',
    props: [{ type: 'box', x: -30, y: -20, w: 22, h: 20 }],
    frames: [
      { hip: [-6, -24], torso: 176, legN: { to: [24, FY], bend: 1 }, armN: { to: [-15, -21], bend: -1 } },
      { hip: [-7, -12], torso: 172, legN: { to: [24, FY], bend: 1 }, armN: { to: [-15, -21], bend: -1 } },
    ],
  },
  pushdown: {
    hold: 'none',
    rope: [12, -96],
    frames: [stand({ armN: [6, 150] }), stand({ armN: [4, 6] })],
  },
  /* ── PRESS (standing / seated) ── */
  ohp: {
    hold: 'N',
    frames: [stand({ armN: [22, 178], armF: [-3, -3] }), stand({ armN: [178, 180], armF: [-3, -3] })],
  },
  ohp_both: {
    hold: 'NF',
    frames: [stand({ armN: [22, 178] }), stand({ armN: [178, 180] })],
  },
  ohp_kneel: {
    hold: 'N',
    frames: [
      { hip: [0, -22], torso: 180, legN: { to: [17, FY], bend: 1 }, legF: { to: [-14, -3], bend: 1 }, footF: 175, armN: [22, 178], armF: [-3, -3] },
      { hip: [0, -22], torso: 180, legN: { to: [17, FY], bend: 1 }, legF: { to: [-14, -3], bend: 1 }, footF: 175, armN: [178, 180], armF: [-3, -3] },
    ],
  },
  ohp_floor: {
    hold: 'N',
    frames: [
      { hip: [0, -5], torso: 180, legN: [90, 90], footN: 180, armN: [22, 178], armF: [-3, -3] },
      { hip: [0, -5], torso: 180, legN: [90, 90], footN: 180, armN: [178, 180], armF: [-3, -3] },
    ],
  },
  ohp_seated: {
    hold: 'N',
    props: [{ type: 'box', x: -12, y: -18, w: 18, h: 18 }, { type: 'box', x: -16, y: -60, w: 4, h: 42 }],
    frames: [
      { hip: [-2, -22], torso: 180, legN: { to: [17, FY], bend: 1 }, armN: [22, 178], armF: [-3, -3] },
      { hip: [-2, -22], torso: 180, legN: { to: [17, FY], bend: 1 }, armN: [178, 180], armF: [-3, -3] },
    ],
  },
  barbell_ohp: {
    hold: 'barbell',
    frames: [stand({ armN: [24, 176] }), stand({ armN: [176, 178] })],
  },
  clean_press: {
    hold: 'kb',
    frames: [stand({ armN: [0, 0] }), stand({ armN: [22, 175] }), stand({ armN: [178, 180] })],
  },
  front_raise: {
    hold: 'both',
    frames: [stand({ armN: [12, 12] }), stand({ armN: [100, 102] })],
  },
  lateral_raise: {
    view: 'front',
    hold: 'N',
    frames: [fStand({ armN: [-8, -6], armF: [4, 4] }), fStand({ armN: [-88, -82], armF: [4, 4] })],
  },
  lateral_raise_lean: {
    view: 'front',
    hold: 'N',
    props: [{ type: 'post', x: 22, y: -90 }],
    frames: [
      { hip: [0, -39.4], torso: 168, legN: { to: [-3, FY], bend: -1 }, legF: { to: [6, FY], bend: 1 }, armN: [-14, -12], armF: { to: [21, -68], bend: 1 } },
      { hip: [0, -39.4], torso: 168, legN: { to: [-3, FY], bend: -1 }, legF: { to: [6, FY], bend: 1 }, armN: [-96, -90], armF: { to: [21, -68], bend: 1 } },
    ],
  },
  upright_row: {
    view: 'front',
    hold: 'both',
    frames: [
      fStand({ armN: { to: [-2, -26], bend: -1 } }),
      fStand({ armN: { to: [-2, -60], bend: 1 } }),
    ],
  },
  shrug: {
    view: 'front',
    hold: 'N',
    frames: [fStand({ armN: [-4, -4], armF: [4, 4] }), fStand({ armN: [-4, -4], armF: [4, 4], shY: -4 })],
  },
  /* ── HINGED PULLS ── */
  row: {
    hold: 'N',
    frames: [
      { hip: [-4, -34], torso: 112, legN: { to: [12, FY], bend: 1 }, legF: { to: [-14, FY], bend: 1 }, armF: { to: [14, -23], bend: 1 }, armN: [0, 0] },
      { hip: [-4, -34], torso: 112, legN: { to: [12, FY], bend: 1 }, legF: { to: [-14, FY], bend: 1 }, armF: { to: [14, -23], bend: 1 }, armN: [-150, 0] },
    ],
  },
  row_bench: {
    hold: 'N',
    props: [{ type: 'box', x: -6, y: -20, w: 34, h: 20 }],
    frames: [
      { hip: [-8, -34], torso: 102, legN: { to: [-12, FY], bend: 1 }, legF: { to: [2, -21], bend: -1 }, armF: { to: [22, -21], bend: 1 }, armN: [0, 0] },
      { hip: [-8, -34], torso: 102, legN: { to: [-12, FY], bend: 1 }, legF: { to: [2, -21], bend: -1 }, armF: { to: [22, -21], bend: 1 }, armN: [-148, 0] },
    ],
  },
  row_chest_supported: {
    hold: 'N',
    props: [{ type: 'pad', x1: -12, y1: -22, x2: 7, y2: -40 }, { type: 'post', x: -6, y: -26 }],
    frames: [
      { hip: [-20, -26], torso: 132, legN: { to: [-30, FY], bend: 1 }, armN: [0, 0] },
      { hip: [-20, -26], torso: 132, legN: { to: [-30, FY], bend: 1 }, armN: [-148, 0] },
    ],
  },
  barbell_row: {
    hold: 'barbell',
    frames: [
      { hip: [-6, -34], torso: 115, ...feet(4, 0), armN: [0, 0] },
      { hip: [-6, -34], torso: 115, ...feet(4, 0), armN: [-115, -5] },
    ],
  },
  reverse_fly: {
    view: 'front',
    hold: 'N',
    frames: [
      { hip: [0, -38], torso: 180, torsoLen: 0.6, head: 180, legN: { to: [-7, FY], bend: -1 }, armN: [-4, -4], armF: [5, 5] },
      { hip: [0, -38], torso: 180, torsoLen: 0.6, head: 180, legN: { to: [-7, FY], bend: -1 }, armN: [-88, -82], armF: [5, 5] },
    ],
  },
  reverse_fly_both: {
    view: 'front',
    hold: 'NF',
    frames: [
      { hip: [0, -38], torso: 180, torsoLen: 0.6, head: 180, legN: { to: [-7, FY], bend: -1 }, armN: [-4, -4] },
      { hip: [0, -38], torso: 180, torsoLen: 0.6, head: 180, legN: { to: [-7, FY], bend: -1 }, armN: [-88, -82] },
    ],
  },
  rear_delt_row: {
    view: 'front',
    hold: 'N',
    frames: [
      { hip: [0, -38], torso: 180, torsoLen: 0.6, head: 180, legN: { to: [-7, FY], bend: -1 }, armN: [-4, -4], armF: [5, 5] },
      { hip: [0, -38], torso: 180, torsoLen: 0.6, head: 180, legN: { to: [-7, FY], bend: -1 }, armN: [-92, -2], armF: [5, 5] },
    ],
  },
  face_pull: {
    view: 'front',
    hold: 'none',
    frames: [
      fStand({ armN: { ang: [-12, -8], len: 0.4 } }),
      fStand({ armN: [-92, 178] }),
    ],
  },
  pull_apart: {
    view: 'front',
    hold: 'none',
    frames: [
      fStand({ armN: { ang: [-20, -14], len: 0.35 } }),
      fStand({ armN: [-90, -90] }),
    ],
  },
  /* ── VERTICAL PULLS ── */
  pull_up: {
    hold: 'none',
    noFloor: true,
    props: [{ type: 'bar', x1: -14, x2: 14, y: -95 }],
    frames: [
      { hip: [0, -43], torso: 180, legN: [10, -15], armN: { to: [2, -95], bend: 1 } },
      { hip: [-2, -64], torso: 176, legN: [10, -15], armN: { to: [2, -95], bend: 1 } },
    ],
  },
  lat_pulldown: {
    hold: 'none',
    rope: [6, -100],
    props: [{ type: 'box', x: -12, y: -18, w: 18, h: 18 }],
    frames: [
      { hip: [-2, -22], torso: 172, legN: { to: [17, FY], bend: 1 }, armN: [176, 178] },
      { hip: [-2, -22], torso: 166, legN: { to: [17, FY], bend: 1 }, armN: [10, 170] },
    ],
  },
  cable_row: {
    hold: 'none',
    rope: [54, -30],
    props: [{ type: 'box', x: -14, y: -6, w: 20, h: 6 }, { type: 'box', x: 52, y: -34, w: 4, h: 34 }],
    frames: [
      { hip: [-2, -10], torso: 160, legN: { to: [30, -6], bend: 1 }, footN: 180, armN: [90, 90] },
      { hip: [-2, -10], torso: 182, legN: { to: [30, -6], bend: 1 }, footN: 180, armN: [-20, 90] },
    ],
  },
  /* ── ARMS ── */
  curl: {
    hold: 'N',
    frames: [stand({ armN: [4, 4] }), stand({ armN: [6, 164] })],
  },
  curl_both: {
    hold: 'both',
    frames: [stand({ armN: [4, 4] }), stand({ armN: [6, 164] })],
  },
  barbell_curl: {
    hold: 'barbell',
    frames: [stand({ armN: [4, 4] }), stand({ armN: [6, 164] })],
  },
  drag_curl: {
    hold: 'N',
    frames: [stand({ armN: [4, 4] }), stand({ armN: [-38, 178] })],
  },
  concentration_curl: {
    hold: 'N',
    props: seat(-20),
    frames: [
      { hip: [-2, -22], torso: 140, legN: { to: [17, FY], bend: 1 }, armN: [8, 6] },
      { hip: [-2, -22], torso: 140, legN: { to: [17, FY], bend: 1 }, armN: [8, 150] },
    ],
  },
  spider_curl: {
    hold: 'N',
    props: [{ type: 'pad', x1: -12, y1: -22, x2: 7, y2: -40 }, { type: 'post', x: -6, y: -26 }],
    frames: [
      { hip: [-20, -26], torso: 132, legN: { to: [-30, FY], bend: 1 }, armN: [0, 0] },
      { hip: [-20, -26], torso: 132, legN: { to: [-30, FY], bend: 1 }, armN: [0, 165] },
    ],
  },
  wrist_curl: {
    hold: 'N',
    props: seat(-20),
    frames: [
      { hip: [-2, -22], torso: 150, legN: { to: [17, FY], bend: 1 }, armN: [30, 92], wristN: 40 },
      { hip: [-2, -22], torso: 150, legN: { to: [17, FY], bend: 1 }, armN: [30, 92], wristN: 140 },
    ],
  },
  oh_extension: {
    hold: 'N',
    frames: [stand({ armN: [176, 178] }), stand({ armN: [172, -22] })],
  },
  oh_extension_both: {
    hold: 'both',
    frames: [stand({ armN: [176, 178] }), stand({ armN: [172, -22] })],
  },
  kickback: {
    hold: 'N',
    frames: [
      { hip: [-4, -34], torso: 115, legN: { to: [12, FY], bend: 1 }, legF: { to: [-14, FY], bend: 1 }, armF: { to: [14, -23], bend: 1 }, armN: [-62, 0] },
      { hip: [-4, -34], torso: 115, legN: { to: [12, FY], bend: 1 }, legF: { to: [-14, FY], bend: 1 }, armF: { to: [14, -23], bend: 1 }, armN: [-62, -64] },
    ],
  },
  /* ── MACHINES ── */
  leg_curl: {
    hold: 'none',
    props: [{ type: 'box', x: -14, y: -18, w: 20, h: 18 }, { type: 'box', x: -18, y: -58, w: 4, h: 40 }],
    frames: [
      { hip: [-2, -22], torso: 172, legN: [90, 90], footN: 180, armN: [20, 80] },
      { hip: [-2, -22], torso: 172, legN: [90, -10], footN: 90, armN: [20, 80] },
    ],
  },
  leg_extension: {
    hold: 'none',
    props: [{ type: 'box', x: -14, y: -18, w: 20, h: 18 }, { type: 'box', x: -18, y: -58, w: 4, h: 40 }],
    frames: [
      { hip: [-2, -22], torso: 172, legN: [90, 0], armN: [20, 80] },
      { hip: [-2, -22], torso: 172, legN: [90, 88], footN: 180, armN: [20, 80] },
    ],
  },
};

/** Exercise → template (+ hold / prop overrides). */
const MAP = {
  db_floor_press: 'floor_press_both', single_arm_floor_press: 'floor_press', db_squeeze_press: 'floor_press_both',
  close_grip_floor_press: 'floor_press_both', tate_press: 'floor_press',
  db_pullover: 'pullover', bench_pullover: 'bench_pullover',
  push_up: 'push_up', push_up_knee: 'push_up_knee', push_up_incline: 'push_up_incline', push_up_decline: 'push_up_decline',
  close_grip_push_up: 'push_up', diamond_push_up: 'push_up', uneven_push_up: 'push_up', archer_push_up: 'push_up',
  db_floor_fly: 'fly_top', db_fly: 'fly_top_both', cable_fly: 'fly_top_both',
  one_arm_row: 'row', supported_row: 'row', kroc_row: 'row', bench_row: 'row_bench', chest_supported_row: 'row_chest_supported',
  rear_delt_row: 'rear_delt_row', reverse_fly: 'reverse_fly', high_row: 'rear_delt_row', rear_delt_fly: 'reverse_fly',
  db_shrug: 'shrug', renegade_row_single: 'renegade_row', renegade_row: 'renegade_row',
  superman: 'superman', back_extension_prone: 'back_extension', bird_dog: 'bird_dog', y_raise_prone: 'y_raise',
  one_arm_shoulder_press: 'ohp', half_kneeling_press: 'ohp_kneel', z_press: 'ohp_floor', arnold_press: 'ohp',
  pike_push_up: 'pike_push_up', lateral_raise: 'lateral_raise', leaning_lateral_raise: 'lateral_raise_lean',
  front_raise: 'front_raise', upright_row: 'upright_row',
  db_curl: 'curl', goblet_curl: 'curl_both', hammer_curl: 'curl', cross_body_hammer_curl: 'curl', concentration_curl: 'concentration_curl',
  reverse_curl: 'curl', zottman_curl: 'curl', drag_curl: 'drag_curl',
  one_arm_oh_extension: 'oh_extension', two_hand_oh_extension: 'oh_extension_both', db_skull_crusher: 'skull_crusher',
  triceps_kickback: 'kickback', wrist_curl: 'wrist_curl', reverse_wrist_curl: 'wrist_curl',
  bodyweight_squat: 'squat_bw', goblet_squat: 'squat_goblet', heel_elevated_goblet_squat: 'squat_heel', sumo_squat: 'squat_hang',
  split_squat: 'split_squat', bulgarian_split_squat: 'bulgarian', reverse_lunge: 'reverse_lunge', forward_lunge: 'forward_lunge',
  walking_lunge: 'forward_lunge', lateral_lunge: 'lateral_lunge', cossack_squat: 'cossack', single_leg_squat: 'single_leg_squat',
  pistol_squat: 'pistol', db_rdl: 'rdl', staggered_rdl: 'staggered_rdl', single_leg_rdl: 'single_leg_rdl', good_morning: 'good_morning',
  slider_leg_curl: 'slider_curl', glute_bridge_bw: 'glute_bridge_bw', glute_bridge: 'glute_bridge', db_hip_thrust: 'hip_thrust',
  single_leg_glute_bridge: 'single_leg_bridge', curtsy_lunge: 'reverse_lunge',
  calf_raise_bw: ['calf_raise', { hold: 'none' }], loaded_calf_raise: 'calf_raise', single_leg_calf_raise: 'calf_raise', seated_calf_raise: 'calf_seated',
  weighted_crunch: 'crunch', db_sit_up: 'situp', russian_twist: 'russian_twist', db_woodchop: 'woodchop',
  suitcase_hold: 'suitcase_hold', suitcase_march: 'march', suitcase_deadlift: 'suitcase_deadlift', side_bend: 'side_bend',
  plank: 'plank', plank_drag: 'plank_drag', side_plank: 'side_plank', dead_bug: 'dead_bug', weighted_dead_bug: 'dead_bug_weighted',
  lying_leg_raise: 'leg_raise', weighted_leg_raise: 'leg_raise_weighted', adductor_raise: 'adductor_raise',
  single_arm_bench_press: 'bench_press', incline_single_arm_press: 'incline_press', db_bench_press: ['bench_press', { hold: 'NF' }],
  seated_db_press: 'ohp_seated', spider_curl: 'spider_curl', bench_dip: 'bench_dip', step_up: 'step_up',
  db_shoulder_press_pair: 'ohp_both', farmers_carry: 'carry',
  pull_up: 'pull_up', chin_up: 'pull_up', hanging_knee_raise: 'hanging_knee', hanging_leg_raise: 'hanging_leg', dead_hang: 'dead_hang',
  band_pull_apart: 'pull_apart', face_pull: 'face_pull', band_lateral_raise: ['lateral_raise', { hold: 'none' }], pallof_press: 'pallof',
  band_pushdown: 'pushdown', band_lat_pulldown: 'lat_pulldown', band_lateral_walk: 'lateral_walk',
  kb_swing: 'swing', kb_clean_press: 'clean_press',
  barbell_bench_press: 'barbell_bench', back_squat: 'squat_back', front_squat: 'squat_front', barbell_deadlift: 'deadlift',
  barbell_rdl: ['rdl', { hold: 'barbell' }], barbell_row: 'barbell_row', barbell_ohp: 'barbell_ohp',
  barbell_hip_thrust: ['hip_thrust', { hold: 'barbellHip' }], barbell_curl: 'barbell_curl',
  lat_pulldown: 'lat_pulldown', cable_row: 'cable_row', cable_pushdown: 'pushdown', cable_crunch: 'cable_crunch',
  leg_press: 'leg_press', leg_curl_machine: 'leg_curl', leg_extension: 'leg_extension',
};

/** Fallback by movement pattern so any future exercise still gets a sensible demo. */
const PATTERN_FALLBACK = {
  horizontal_press: 'floor_press', vertical_press: 'ohp', horizontal_pull: 'row', vertical_pull: 'pull_up',
  squat: 'squat_goblet', lunge: 'reverse_lunge', hinge: 'rdl', hip_extension: 'glute_bridge', elbow_flexion: 'curl',
  elbow_extension: 'oh_extension', lateral_raise: 'lateral_raise', rear_delt: 'reverse_fly', front_raise: 'front_raise',
  calf_raise: 'calf_raise', core_flexion: 'crunch', core_rotation: 'russian_twist', anti_extension: 'plank',
  anti_lateral: 'side_plank', anti_rotation: 'bird_dog', carry: 'suitcase_hold', shrug: 'shrug', pullover: 'pullover',
  fly: 'fly_top', wrist: 'wrist_curl', adduction: 'adductor_raise', abduction: 'lateral_walk', hip_flexion: 'leg_raise',
  back_extension: 'superman', upright_row: 'upright_row', knee_flexion: 'leg_curl', knee_extension: 'leg_extension',
  swing: 'swing', lateral_flexion: 'side_bend',
};

const cache = {};
/** Resolved animation for an exercise id (always returns one for known exercises). */
export function animFor(exerciseId) {
  if (cache[exerciseId]) return cache[exerciseId];
  const ex = EXERCISES.find((e) => e.id === exerciseId);
  let entry = MAP[exerciseId] || (ex && PATTERN_FALLBACK[ex.pattern]) || 'squat_bw';
  let over = {};
  if (Array.isArray(entry)) [entry, over] = entry;
  const base = ANIMS[entry];
  if (!base) return null;
  let hold = over.hold ?? base.hold;
  // bodyweight-only exercises never show a dumbbell
  if (ex && (ex.load === 'bodyweight' || ex.load === 'bands') && ['N', 'NF', 'both', 'vertical', 'hip', 'knee', 'feet'].includes(hold)) hold = 'none';
  if (hold === 'barbellHip') hold = 'hip';
  const anim = { ...base, ...over, hold, key: entry };
  cache[exerciseId] = anim;
  return anim;
}

export const ANIM_MAP = MAP;

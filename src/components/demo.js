/**
 * Exercise demo animations — a tiny 2D skeletal rig rendered as SVG.
 *
 * Each animation is a list of keyframe POSES (see src/data/animations.js). A pose gives:
 *   hip: [x, y]         world position of the pelvis (floor is y = 0, up is negative)
 *   torso: deg          direction hip → shoulders. 0 = down, 90 = forward (right), 180 = up, -90 = back
 *   armN / armF         near / far arm (side view) — or viewer-left / viewer-right arm (front view)
 *   legN / legF         same for legs
 *     limb forms:  [upper, lower]               absolute angles (deg)
 *                  { to: [x, y], bend: ±1 }     two-bone IK to a world target (feet stay planted)
 *                  { toS: [dx, dy], bend: ±1 }  IK to a point relative to the shoulder, in the torso's frame
 *                  any form may add `len` (0–1) to foreshorten a limb pointing toward the viewer
 *   footN/footF: deg    foot direction (default 90 = flat, toes forward)
 *   wristN: deg         optional hand segment (for wrist curls)
 *   shY                 shoulder elevation (shrugs)
 *
 * Interpolation is per-number between consecutive keyframes with an ease-in-out curve, then
 * solved with forward kinematics + IK — so planted feet and hands never slide.
 */
const L = { torso: 28, neck: 3.5, head: 6.4, upper: 14, fore: 13, thigh: 19, shin: 19, foot: 8, hand: 4.5 };
const SHOULDER_W = 9.5;
const HIP_W = 5.2;

const rad = (d) => (d * Math.PI) / 180;
const dir = (a) => [Math.sin(rad(a)), Math.cos(rad(a))];
const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
const angleOf = (v) => (Math.atan2(v[0], v[1]) * 180) / Math.PI;

/** Two-bone IK. bend +1 puts the middle joint on the clockwise side (knee forward for a leg pointing down). */
function ik(S, T, a, b, bend = 1) {
  let dx = T[0] - S[0];
  let dy = T[1] - S[1];
  let d = Math.hypot(dx, dy) || 0.0001;
  const max = a + b - 0.01;
  const min = Math.abs(a - b) + 0.01;
  const dc = Math.min(max, Math.max(min, d));
  const base = Math.atan2(dy, dx);
  const off = Math.acos(Math.min(1, Math.max(-1, (a * a + dc * dc - b * b) / (2 * a * dc))));
  const th = base - bend * off;
  const J = [S[0] + Math.cos(th) * a, S[1] + Math.sin(th) * a];
  const v = [T[0] - J[0], T[1] - J[1]];
  const vl = Math.hypot(v[0], v[1]) || 1;
  const E = [J[0] + (v[0] / vl) * b, J[1] + (v[1] / vl) * b];
  return [J, E];
}

function solveLimb(spec, root, a, b, torso, mirror, cx = 0) {
  if (!spec) return null;
  const len = spec.len ?? 1;
  const A = a * len;
  const B = b * len;
  if (Array.isArray(spec)) {
    const s = mirror ? [-spec[0], -spec[1]] : spec;
    const J = add(root, dir(s[0]), A);
    return [J, add(J, dir(s[1]), B)];
  }
  if (spec.ang) {
    const s = mirror ? [-spec.ang[0], -spec.ang[1]] : spec.ang;
    const J = add(root, dir(s[0]), A);
    return [J, add(J, dir(s[1]), B)];
  }
  let T;
  if (spec.to) T = mirror ? [2 * cx - spec.to[0], spec.to[1]] : spec.to;
  else if (spec.toS) {
    // relative to the shoulder in the torso frame: x = forward (perpendicular to torso), y = down the torso
    const tilt = rad(180 - torso);
    const [fx, fy] = spec.toS;
    const x = fx * Math.cos(tilt) - fy * Math.sin(tilt);
    const y = fx * Math.sin(tilt) + fy * Math.cos(tilt);
    T = [root[0] + (mirror ? -x : x), root[1] + y];
  }
  return ik(root, T, A, B, mirror ? -(spec.bend ?? 1) : (spec.bend ?? 1));
}

/** Pose → joint positions. */
export function solvePose(p, view = 'side') {
  const hip = p.hip;
  const t = p.torso ?? 180;
  const td = dir(t);
  const perp = [td[1], -td[0]]; // perpendicular to the torso (screen-left when upright)
  const tl = L.torso * (p.torsoLen ?? 1);
  const spine = add(hip, td, tl);
  const shY = p.shY || 0;
  const neck = add(spine, td, shY * 0.4);
  const headC = add(neck, dir(t + (p.head || 0)), L.neck + L.head);
  const front = view === 'front';
  const sh = front ? [add(add(spine, perp, SHOULDER_W), td, shY), add(add(spine, perp, -SHOULDER_W), td, shY)] : [add(spine, td, -2 + shY), add(spine, td, -2 + shY)];
  const hp = front ? [add(hip, perp, HIP_W), add(hip, perp, -HIP_W)] : [hip, hip];
  const armN = solveLimb(p.armN, sh[0], L.upper, L.fore, t, false);
  const armF = solveLimb(p.armF ?? p.armN, sh[1], L.upper, L.fore, t, front && !p.armF, hip[0]);
  const legN = solveLimb(p.legN, hp[0], L.thigh, L.shin, t, false);
  const legF = solveLimb(p.legF ?? p.legN, hp[1], L.thigh, L.shin, t, front && !p.legF, hip[0]);
  const footDir = (ang, leg) => (front ? 0 : ang ?? 90);
  const toeN = legN && add(legN[1], dir(footDir(p.footN)), front ? 3 : L.foot);
  const toeF = legF && add(legF[1], dir(footDir(p.footF ?? p.footN)), front ? 3 : L.foot);
  const wristN = p.wristN != null && armN ? add(armN[1], dir(p.wristN), L.hand) : null;
  return { hip, hp, spine, neck, headC, sh, armN, armF, legN, legF, toeN, toeF, wristN, torso: t };
}

/* ───────────── interpolation ───────────── */
function lerpVal(a, b, k) {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * k;
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => lerpVal(v, b[i], k));
  if (a && b && typeof a === 'object') {
    const o = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      o[key] = key in a && key in b ? lerpVal(a[key], b[key], k) : (k < 0.5 ? a[key] ?? b[key] : b[key] ?? a[key]);
    }
    return o;
  }
  return k < 0.5 ? a ?? b : b ?? a;
}
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** Timeline: keyframes with per-segment durations and holds (seconds). */
function timeline(anim) {
  const frames = anim.frames;
  const segs = [];
  const n = frames.length;
  const dur = anim.dur || [];
  const hold = anim.pause || [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (n === 1) { segs.push({ a: 0, b: 0, d: 2 }); break; }
    segs.push({ a: i, b: i, d: hold[i] ?? (i === 0 ? 0.55 : 0.3) });
    segs.push({ a: i, b: j, d: dur[i] ?? (i === 0 ? 1.15 : 1.3), move: true });
  }
  const total = segs.reduce((s, x) => s + x.d, 0);
  return { segs, total };
}

export function poseAt(anim, time) {
  const { segs, total } = anim._tl || (anim._tl = timeline(anim));
  let t = ((time % total) + total) % total;
  for (const s of segs) {
    if (t <= s.d) {
      const k = s.move ? ease(t / s.d) : 0;
      return { pose: lerpVal(anim.frames[s.a], anim.frames[s.b], k), seg: s };
    }
    t -= s.d;
  }
  return { pose: anim.frames[0], seg: segs[0] };
}

/* ───────────── rendering ───────────── */
const C = { near: '#d5dbe3', far: '#7d8794', farFront: '#aab3be', torso: '#c6ccd5', db: '#f08a3c', prop: '#262b33', propEdge: '#3a414b', floor: '#2a3038', rope: '#5d6672' };

const seg = (a, b) => (a && b ? `M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${b[0].toFixed(2)} ${b[1].toFixed(2)}` : '');
const poly = (pts) => (pts.every(Boolean) ? `M${pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join('L')}` : '');

function dumbbellPath(c, angle, size = 1) {
  // handle along `angle`, plates perpendicular
  const d = dir(angle);
  const n = [d[1], -d[0]];
  const h = 6.5 * size;
  const a = add(c, d, -h);
  const b = add(c, d, h);
  const plate = (p) => {
    const w = 3.2 * size, r = 4.6 * size;
    const p1 = add(add(p, n, -r), d, -w / 2), p2 = add(add(p, n, r), d, -w / 2);
    const p3 = add(add(p, n, r), d, w / 2), p4 = add(add(p, n, -r), d, w / 2);
    return `${poly([p1, p2, p3, p4])}Z`;
  };
  return { handle: seg(a, b), plates: plate(a) + plate(b) };
}

export function frameParts(anim, pose) {
  const view = anim.view || 'side';
  const J = solvePose(pose, view);
  const out = {};
  const limb = (root, l, tip) => (l ? `${seg(root, l[0])}${seg(l[0], l[1])}${tip ? seg(l[1], tip) : ''}` : '');
  out.armF = limb(J.sh[1], J.armF);
  out.legF = limb(J.hp[1], J.legF, J.toeF);
  out.armN = limb(J.sh[0], J.armN, J.wristN);
  out.legN = limb(J.hp[0], J.legN, J.toeN);
  if (view === 'front') {
    out.torso = `${poly([J.hp[0], J.sh[0], J.sh[1], J.hp[1]])}Z`;
  } else {
    out.torso = seg(J.hip, J.spine);
  }
  out.neck = seg(J.spine, J.headC);
  out.head = J.headC;
  // equipment held
  const handN = J.wristN || J.armN?.[1];
  const handF = J.armF?.[1];
  const hold = anim.hold || 'N';
  let dbs = [];
  const foreAng = (arm, sh) => (arm ? angleOf([arm[1][0] - arm[0][0], arm[1][1] - arm[0][1]]) : 0);
  if (hold === 'N' && handN) dbs.push([handN, (J.wristN ? pose.wristN : foreAng(J.armN)) + 90]);
  else if (hold === 'NF' && handN && handF) { dbs.push([handF, foreAng(J.armF) + 90]); dbs.push([handN, foreAng(J.armN) + 90]); }
  else if (hold === 'both' && handN && handF) dbs.push([[(handN[0] + handF[0]) / 2, (handN[1] + handF[1]) / 2], view === 'front' ? 90 : foreAng(J.armN) + 90]);
  else if (hold === 'vertical' && handN) dbs.push([handN, 0]);
  else if (hold === 'hip') dbs.push([add(J.hip, dir(J.torso + 90), -5), J.torso]);
  else if (hold === 'knee' && J.legN) dbs.push([add(J.legN[0], [0, -4]), 90]);
  else if (hold === 'feet' && J.toeN) dbs.push([J.legN[1], 0]);
  out.dbs = dbs.map(([c, a]) => dumbbellPath(c, a));
  out.plateAt = null;
  if (hold === 'barbell' && handN) out.plateAt = handN;
  if (hold === 'barbellBack') out.plateAt = add(J.spine, dir(J.torso + 90), -3);
  if (hold === 'kb' && handN) out.kb = add(handN, dir(foreAng(J.armN)), 4);
  if (anim.rope && handN) out.rope = seg(handN, anim.rope);
  return { parts: out, J };
}

function bbox(anim) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (p, r = 0) => { if (!p) return; x0 = Math.min(x0, p[0] - r); y0 = Math.min(y0, p[1] - r); x1 = Math.max(x1, p[0] + r); y1 = Math.max(y1, p[1] + r); };
  const { total } = anim._tl || (anim._tl = timeline(anim));
  for (let i = 0; i <= 24; i++) {
    const { pose } = poseAt(anim, (total * i) / 24);
    const J = solvePose(pose, anim.view);
    [J.hip, J.spine, ...J.sh, ...J.hp, J.toeN, J.toeF, J.wristN].forEach((p) => take(p, 5));
    take(J.headC, L.head + 1);
    [J.armN, J.armF, J.legN, J.legF].forEach((l) => l && l.forEach((p) => take(p, 7)));
  }
  for (const pr of anim.props || []) {
    if (pr.type === 'box') { take([pr.x, pr.y]); take([pr.x + pr.w, pr.y + pr.h]); }
    if (pr.type === 'bar') { take([pr.x1, pr.y]); take([pr.x2, pr.y]); }
    if (pr.type === 'pad') { take([pr.x1, pr.y1], 4); take([pr.x2, pr.y2], 4); }
  }
  if (anim.rope) take(anim.rope, 2);
  take([x0, 0]);
  return [x0, y0, x1, Math.max(y1, 2)];
}

function propsSvg(anim, vb) {
  const items = [];
  if (!anim.noFloor) items.push(`<line x1="${vb[0] - 20}" x2="${vb[0] + vb[2] + 20}" y1="0.6" y2="0.6" stroke="${C.floor}" stroke-width="1.2"/>`);
  for (const p of anim.props || []) {
    if (p.type === 'box') items.push(`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.r ?? 1.5}" fill="${C.prop}" stroke="${C.propEdge}" stroke-width=".8"/>`);
    if (p.type === 'bar') items.push(`<line x1="${p.x1}" x2="${p.x2}" y1="${p.y}" y2="${p.y}" stroke="${C.propEdge}" stroke-width="2.4" stroke-linecap="round"/>`);
    if (p.type === 'pad') items.push(`<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${C.prop}" stroke-width="7" stroke-linecap="round"/><line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${C.propEdge}" stroke-width=".8" stroke-linecap="round" opacity=".6"/>`);
    if (p.type === 'post') items.push(`<rect x="${p.x - 1.5}" y="${p.y}" width="3" height="${-p.y}" fill="${C.propEdge}"/>`);
  }
  if (anim.rope) items.push(`<circle cx="${anim.rope[0]}" cy="${anim.rope[1]}" r="2" fill="${C.propEdge}"/>`);
  return items.join('');
}

/** Build the SVG for an animation; returns { svg, update(time) }. */
export function createDemo(anim, { label = '' } = {}) {
  const b = bbox(anim);
  const pad = 4;
  let [x0, y0, x1, y1] = [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad];
  // keep a consistent 4:3 frame so every exercise sits in the same box
  const w = x1 - x0, h = y1 - y0;
  const targetR = 4 / 3;
  if (w / h < targetR) { const nw = h * targetR; x0 -= (nw - w) / 2; x1 = x0 + nw; }
  else { const nh = w / targetR; y0 -= nh - h; }
  const vb = [x0, y0, x1 - x0, y1 - y0];
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', vb.map((v) => v.toFixed(1)).join(' '));
  svg.setAttribute('class', 'demo-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  svg.innerHTML = `${propsSvg(anim, vb)}
    <path data-p="rope" fill="none" stroke="${C.rope}" stroke-width=".9" stroke-dasharray="2 1.5"/>
    <path data-p="armF" fill="none" stroke="${anim.view === 'front' ? C.farFront : C.far}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path data-p="legF" fill="none" stroke="${anim.view === 'front' ? C.farFront : C.far}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <g data-p="dbF"></g>
    <path data-p="torso" fill="${C.torso}" stroke="${C.torso}" stroke-width="${anim.view === 'front' ? 5 : 11}" stroke-linecap="round" stroke-linejoin="round"/>
    <path data-p="neck" fill="none" stroke="${C.torso}" stroke-width="4.5" stroke-linecap="round"/>
    <circle data-p="head" r="${L.head}" fill="${C.near}"/>
    <path data-p="legN" fill="none" stroke="${C.near}" stroke-width="6.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle data-p="plate" r="8.5" fill="none" stroke="${C.db}" stroke-width="2.6" opacity="0"/>
    <circle data-p="kb" r="4.2" fill="${C.db}" opacity="0"/>
    <path data-p="armN" fill="none" stroke="${C.near}" stroke-width="4.8" stroke-linecap="round" stroke-linejoin="round"/>
    <g data-p="db"></g>`;
  const el = {};
  svg.querySelectorAll('[data-p]').forEach((n) => { el[n.dataset.p] = n; });
  const update = (time) => {
    const { pose } = poseAt(anim, time);
    const { parts } = frameParts(anim, pose);
    for (const k of ['armF', 'legF', 'torso', 'neck', 'legN', 'armN']) el[k].setAttribute('d', parts[k] || '');
    el.rope.setAttribute('d', parts.rope || '');
    el.head.setAttribute('cx', parts.head[0].toFixed(2));
    el.head.setAttribute('cy', parts.head[1].toFixed(2));
    const dbHtml = (d) => `<path d="${d.plates}" fill="${C.db}"/><path d="${d.handle}" stroke="${C.db}" stroke-width="2" stroke-linecap="round"/>`;
    const near = parts.dbs.length > 1 ? parts.dbs.slice(1) : parts.dbs;
    el.dbF.innerHTML = parts.dbs.length > 1 ? dbHtml(parts.dbs[0]) : '';
    el.db.innerHTML = near.map(dbHtml).join('');
    if (parts.plateAt) { el.plate.setAttribute('cx', parts.plateAt[0]); el.plate.setAttribute('cy', parts.plateAt[1]); el.plate.setAttribute('opacity', 1); }
    if (parts.kb) { el.kb.setAttribute('cx', parts.kb[0]); el.kb.setAttribute('cy', parts.kb[1]); el.kb.setAttribute('opacity', 1); }
  };
  return { svg, update, total: (anim._tl || timeline(anim)).total };
}

/* ───────────── player: mounts every .demo[data-demo] element ───────────── */
const players = new Set();
const lastTime = new Map(); // demo id → time, so re-renders continue smoothly instead of restarting
let rafId = null;
const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let io = null;

function loop(now) {
  rafId = null;
  let any = false;
  for (const p of players) {
    if (!p.host.isConnected) { players.delete(p); io?.unobserve(p.host); continue; }
    if (p.playing && p.visible) {
      p.t += Math.min(0.1, (now - (p.last || now)) / 1000);
      p.update(p.t);
      lastTime.set(p.id, p.t);
      any = true;
    }
    p.last = now;
  }
  if (any) rafId = requestAnimationFrame(loop);
}

function kick() {
  if (rafId == null) rafId = requestAnimationFrame(loop);
}

export function mountDemos(root, getAnim) {
  if (typeof IntersectionObserver !== 'undefined' && !io) {
    io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const p = e.target._demo;
        if (p) { p.visible = e.isIntersecting; p.last = performance.now(); }
      }
      kick();
    });
  }
  root.querySelectorAll('.demo[data-demo]:not([data-ready])').forEach((host) => {
    const anim = getAnim(host.dataset.demo);
    host.dataset.ready = '1';
    if (!anim) { host.remove(); return; }
    const d = createDemo(anim, { label: host.dataset.label || 'Exercise demonstration' });
    host.prepend(d.svg);
    const id = host.dataset.demo;
    const t0 = lastTime.get(id) ?? 0;
    const p = { id, host, update: d.update, t: t0, playing: !reduceMotion, visible: true, last: 0 };
    d.update(reduceMotion ? d.total * 0.35 : t0);
    host._demo = p;
    players.add(p);
    io?.observe(host);
    const btn = host.querySelector('.demo-toggle');
    const sync = () => {
      host.classList.toggle('is-paused', !p.playing);
      if (btn) btn.setAttribute('aria-label', p.playing ? 'Pause demonstration' : 'Play demonstration');
    };
    host.addEventListener('click', (e) => {
      if (host.dataset.tap === 'open') return; // let the parent action handle it
      e.stopPropagation();
      p.playing = !p.playing;
      p.last = performance.now();
      sync();
      kick();
    });
    sync();
  });
  kick();
}

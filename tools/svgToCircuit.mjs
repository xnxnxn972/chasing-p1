/**
 * Convert a circuit SVG into normalised points for Track Recall.
 *
 *   node tools/svgToCircuit.mjs <file.svg> <id> [points]
 *
 * WHY THIS REPLACED TRACING BY EYE: estimating pixel positions off a raster
 * image could not reach the fidelity these silhouettes need, and three passes
 * at it produced shapes that were the right topology and visibly the wrong
 * proportions. An SVG carries the actual path, so this is exact.
 *
 * Handles the commands circuit paths actually use — M L H V C S Q T Z, in
 * both cases — and flattens the curves by sampling. Arcs (A) are not
 * supported; no circuit map seen so far uses them, and it would fail loudly
 * rather than quietly draw the wrong thing.
 */

import { readFileSync } from 'node:fs';

const [, , file, id, countArg] = process.argv;
if (!file || !id) {
  console.error('usage: node tools/svgToCircuit.mjs <file.svg> <id> [points]');
  process.exit(1);
}
const TARGET = Number(countArg) || 72;

const svg = readFileSync(file, 'utf8');

/** Every path in the file; the circuit is the longest one. */
const paths = [...svg.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
if (!paths.length) {
  console.error('no <path d="..."> found');
  process.exit(1);
}
const d = paths.reduce((a, b) => (b.length > a.length ? b : a));

// ---- parse -----------------------------------------------------------------
const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
let i = 0;
const num = () => Number(tokens[i++]);

const pts = [];
let cx = 0;
let cy = 0;
let startX = 0;
let startY = 0;
let prevCtrl = null;
let cmd = '';

const push = (x, y) => {
  const last = pts[pts.length - 1];
  if (!last || Math.hypot(last[0] - x, last[1] - y) > 1e-9) pts.push([x, y]);
};

/** Flatten a cubic by sampling. 24 steps is smooth at these scales. */
function cubic(x1, y1, x2, y2, x3, y3, x4, y4) {
  for (let s = 1; s <= 24; s++) {
    const t = s / 24;
    const u = 1 - t;
    push(
      u * u * u * x1 + 3 * u * u * t * x2 + 3 * u * t * t * x3 + t * t * t * x4,
      u * u * u * y1 + 3 * u * u * t * y2 + 3 * u * t * t * y3 + t * t * t * y4
    );
  }
}

while (i < tokens.length) {
  if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
  const rel = cmd === cmd.toLowerCase();
  const C = cmd.toUpperCase();
  const ox = rel ? cx : 0;
  const oy = rel ? cy : 0;

  if (C === 'M') {
    cx = num() + ox;
    cy = num() + oy;
    push(cx, cy);
    startX = cx;
    startY = cy;
    cmd = rel ? 'l' : 'L'; // subsequent pairs are implicit linetos
    prevCtrl = null;
  } else if (C === 'L') {
    cx = num() + ox;
    cy = num() + oy;
    push(cx, cy);
    prevCtrl = null;
  } else if (C === 'H') {
    cx = num() + ox;
    push(cx, cy);
    prevCtrl = null;
  } else if (C === 'V') {
    cy = num() + oy;
    push(cx, cy);
    prevCtrl = null;
  } else if (C === 'C' || C === 'S') {
    let x2;
    let y2;
    if (C === 'C') {
      x2 = num() + ox;
      y2 = num() + oy;
    } else {
      // Smooth: first control is the reflection of the previous one.
      x2 = prevCtrl ? 2 * cx - prevCtrl[0] : cx;
      y2 = prevCtrl ? 2 * cy - prevCtrl[1] : cy;
    }
    const x3 = num() + ox;
    const y3 = num() + oy;
    const x4 = num() + ox;
    const y4 = num() + oy;
    cubic(cx, cy, x2, y2, x3, y3, x4, y4);
    prevCtrl = [x3, y3];
    cx = x4;
    cy = y4;
  } else if (C === 'Q' || C === 'T') {
    let qx;
    let qy;
    if (C === 'Q') {
      qx = num() + ox;
      qy = num() + oy;
    } else {
      qx = prevCtrl ? 2 * cx - prevCtrl[0] : cx;
      qy = prevCtrl ? 2 * cy - prevCtrl[1] : cy;
    }
    const x4 = num() + ox;
    const y4 = num() + oy;
    // A quadratic is a cubic with the control point weighted two thirds.
    cubic(cx, cy, cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy),
      x4 + (2 / 3) * (qx - x4), y4 + (2 / 3) * (qy - y4), x4, y4);
    prevCtrl = [qx, qy];
    cx = x4;
    cy = y4;
  } else if (C === 'Z') {
    push(startX, startY);
    cx = startX;
    cy = startY;
    prevCtrl = null;
  } else if (C === 'A') {
    console.error('arc command (A) not supported; add it or re-export the path');
    process.exit(1);
  } else {
    console.error(`unknown command "${cmd}"`);
    process.exit(1);
  }
}

// ---- resample evenly by arc length ----------------------------------------
const seg = [];
let total = 0;
for (let k = 0; k < pts.length - 1; k++) {
  const len = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
  seg.push(len);
  total += len;
}

const even = [];
const step = total / TARGET;
let acc = 0;
let k = 0;
for (let n = 0; n < TARGET; n++) {
  const target = n * step;
  while (k < seg.length - 1 && acc + seg[k] < target) {
    acc += seg[k];
    k++;
  }
  const t = seg[k] > 0 ? (target - acc) / seg[k] : 0;
  even.push([
    pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t,
    pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t
  ]);
}

// ---- normalise, preserving aspect ------------------------------------------
const xs = even.map((p) => p[0]);
const ys = even.map((p) => p[1]);
const minX = Math.min(...xs);
const minY = Math.min(...ys);
const w = Math.max(...xs) - minX;
const h = Math.max(...ys) - minY;
const s = 94 / Math.max(w, h);
const ox2 = (100 - w * s) / 2;
const oy2 = (100 - h * s) / 2;
const box = even.map((p) => [
  Math.round(((p[0] - minX) * s + ox2) * 10) / 10,
  Math.round(((p[1] - minY) * s + oy2) * 10) / 10
]);

console.error(`${id}: ${paths.length} path(s), ${pts.length} flattened -> ${box.length} points, aspect ${(w / h).toFixed(2)}`);
console.log(`  ${id}: [`);
for (let n = 0; n < box.length; n += 5) {
  console.log('    ' + box.slice(n, n + 5).map((p) => `[${p[0]}, ${p[1]}]`).join(', ') + ',');
}
console.log('  ],');

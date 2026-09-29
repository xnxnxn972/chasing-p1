/**
 * Build circuits.ts from the circuit SVGs.
 *
 *   node tools/buildCircuits.mjs > src/minigames/TrackRecall/circuits.ts
 *
 * WHY SVG AND NOT TRACING: three passes of reading pixel positions off raster
 * maps produced shapes with the right topology and visibly wrong proportions.
 * Iconic silhouettes do not survive that. An SVG carries the real path, so
 * this is exact.
 *
 * The game animates a lap from the start line in the racing direction, so
 * each outline is also ROTATED to begin at its start/finish and ORIENTED to
 * run the right way round. The SVG says nothing about either — Monza's path
 * happens to begin at a corner nowhere near the grid — so both come from the
 * table below.
 */

import { readFileSync } from 'node:fs';

const DIR = 'C:/Users/yaniv/Downloads';

/**
 * `start` is a fraction of the outline's bounding box, not a coordinate: the
 * nearest point on the path to it becomes index 0.
 *
 * `clockwise` is how the circuit is actually raced, viewed north-up. Five of
 * these run clockwise; Interlagos is the odd one out and runs anti-clockwise,
 * which is exactly the sort of thing this game should be testing.
 */
const VENUES = [
  { id: 'monza', file: 'RaceCircuitAutodromaDiMonza.svg', name: 'Monza', country: 'Italy',
    start: [0.74, 0.98], clockwise: true,
    fact: 'The fastest circuit on the calendar, and mostly long straights joined by three big stops.' },

  { id: 'monaco', file: 'RaceCircuitMonaco.svg', name: 'Monaco', country: 'Monaco',
    start: [0.20, 0.86], clockwise: true,
    fact: 'Barely three and a bit kilometres of public road, and the slowest corner in Formula 1 is in the middle of it.' },

  /**
   * `rotate` squares the outline up with how the circuit is actually printed.
   *
   * These SVGs are drawn geographically, north-up. Published circuit maps are
   * not: they are turned to sit flat in a landscape frame. Suzuka and
   * Interlagos ship portrait and are conventionally shown landscape, and a
   * circuit on its side is a different silhouette to anyone trying to
   * recognise one. Angles picked by rendering candidates against the
   * reference maps.
   */
  /**
   * Suzuka is the one figure-of-eight, and the only one of these files that
   * needs help. It also carries the PIT LANE in grey at 4px and two short
   * black service stubs; `stroke` drops the grey, and taking the longest
   * remaining path drops the stubs. Without either the lap comes out with a
   * spur down the pit lane.
   *
   * What is left is the whole lap as ONE already-closed path, crossover
   * included, which is why this file works where the earlier two-loop one
   * had to be chained and came out misshapen.
   *
   * Verified by walking the path: it starts at the top-left end of the main
   * straight and runs right, the pit lane sits alongside it, and the lap
   * crosses itself once, at 45% and again at 86% - the Degner-to-hairpin
   * section over the back straight. `start` puts the grid a third of the way
   * along that straight, which is where the line actually is.
   */
  { id: 'suzuka', file: 'Suzuka_Circuit_2013_001.svg', name: 'Suzuka', country: 'Japan',
    stroke: '#000000', start: [0.70, 0.00], clockwise: true,
    fact: 'The only figure-of-eight on the calendar: the back straight crosses the first sector on a bridge.' },

  { id: 'spa', file: 'RaceCircuitSpa.svg', name: 'Spa-Francorchamps', country: 'Belgium',
    start: [0.06, 0.92], clockwise: true,
    fact: 'Seven kilometres through a forest, and Eau Rouge climbs more than a four-storey building.' },

  { id: 'silverstone', file: 'RaceCircuitSilverstone.svg', name: 'Silverstone', country: 'United Kingdom',
    start: [0.58, 0.94], clockwise: true,
    fact: 'Maggotts and Becketts is a sequence of direction changes taken at around 300 km/h.' },

  { id: 'interlagos', file: 'RaceCircuitInterlagos.svg', name: 'Interlagos', country: 'Brazil',
    start: [0.40, 0.06], clockwise: false, rotate: 60,
    fact: 'One of the few run anti-clockwise, and the whole lap climbs and falls across a natural bowl.' }
];

const TARGET = 80;

/** Flatten one path's `d` into a polyline. */
function parsePath(d) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  let i = 0;
  const num = () => Number(tokens[i++]);
  const pts = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let prev = null;
  let cmd = '';

  const push = (x, y) => {
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(last[0] - x, last[1] - y) > 1e-9) pts.push([x, y]);
  };
  const cubic = (x1, y1, x2, y2, x3, y3, x4, y4) => {
    for (let s = 1; s <= 24; s++) {
      const t = s / 24;
      const u = 1 - t;
      push(
        u * u * u * x1 + 3 * u * u * t * x2 + 3 * u * t * t * x3 + t * t * t * x4,
        u * u * u * y1 + 3 * u * u * t * y2 + 3 * u * t * t * y3 + t * t * t * y4
      );
    }
  };

  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? cx : 0;
    const oy = rel ? cy : 0;

    if (C === 'M') {
      cx = num() + ox; cy = num() + oy; push(cx, cy); sx = cx; sy = cy;
      cmd = rel ? 'l' : 'L'; prev = null;
    } else if (C === 'L') {
      cx = num() + ox; cy = num() + oy; push(cx, cy); prev = null;
    } else if (C === 'H') {
      cx = num() + ox; push(cx, cy); prev = null;
    } else if (C === 'V') {
      cy = num() + oy; push(cx, cy); prev = null;
    } else if (C === 'C' || C === 'S') {
      let x2; let y2;
      if (C === 'C') { x2 = num() + ox; y2 = num() + oy; }
      else { x2 = prev ? 2 * cx - prev[0] : cx; y2 = prev ? 2 * cy - prev[1] : cy; }
      const x3 = num() + ox; const y3 = num() + oy;
      const x4 = num() + ox; const y4 = num() + oy;
      cubic(cx, cy, x2, y2, x3, y3, x4, y4);
      prev = [x3, y3]; cx = x4; cy = y4;
    } else if (C === 'Q' || C === 'T') {
      let qx; let qy;
      if (C === 'Q') { qx = num() + ox; qy = num() + oy; }
      else { qx = prev ? 2 * cx - prev[0] : cx; qy = prev ? 2 * cy - prev[1] : cy; }
      const x4 = num() + ox; const y4 = num() + oy;
      cubic(cx, cy, cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy),
        x4 + (2 / 3) * (qx - x4), y4 + (2 / 3) * (qy - y4), x4, y4);
      prev = [qx, qy]; cx = x4; cy = y4;
    } else if (C === 'Z') {
      push(sx, sy); cx = sx; cy = sy; prev = null;
    } else if (C === 'A') {
      throw new Error('arc command (A) not supported');
    } else {
      throw new Error(`unknown path command "${cmd}"`);
    }
  }
  return pts;
}

/**
 * Chain several paths into one loop.
 *
 * Suzuka needs this: a figure-of-eight cannot be one stroke without the
 * crossover becoming a real vertex, so it ships as two paths that have to be
 * joined at whichever pair of ends actually meet.
 */
function chain(pieces) {
  let out = pieces.shift();
  while (pieces.length) {
    const tail = out[out.length - 1];
    const head = out[0];
    let best = null;
    for (let k = 0; k < pieces.length; k++) {
      const p = pieces[k];
      const a = p[0];
      const b = p[p.length - 1];
      const cands = [
        { d: Math.hypot(tail[0] - a[0], tail[1] - a[1]), k, seq: p, append: true },
        { d: Math.hypot(tail[0] - b[0], tail[1] - b[1]), k, seq: [...p].reverse(), append: true },
        { d: Math.hypot(head[0] - b[0], head[1] - b[1]), k, seq: p, append: false },
        { d: Math.hypot(head[0] - a[0], head[1] - a[1]), k, seq: [...p].reverse(), append: false }
      ];
      for (const c of cands) if (!best || c.d < best.d) best = c;
    }
    pieces.splice(best.k, 1);
    out = best.append ? out.concat(best.seq) : best.seq.concat(out);
  }
  return out;
}

/** Even samples by arc length around the closed loop. */
function resample(pts, n) {
  const loop = [...pts, pts[0]];
  const seg = [];
  let total = 0;
  for (let k = 0; k < loop.length - 1; k++) {
    const d = Math.hypot(loop[k + 1][0] - loop[k][0], loop[k + 1][1] - loop[k][1]);
    seg.push(d);
    total += d;
  }
  const out = [];
  const step = total / n;
  let acc = 0;
  let k = 0;
  for (let i = 0; i < n; i++) {
    const t = i * step;
    while (k < seg.length - 1 && acc + seg[k] < t) { acc += seg[k]; k++; }
    const f = seg[k] > 0 ? (t - acc) / seg[k] : 0;
    out.push([
      loop[k][0] + (loop[k + 1][0] - loop[k][0]) * f,
      loop[k][1] + (loop[k + 1][1] - loop[k][1]) * f
    ]);
  }
  return out;
}

/** Fit into a 0-100 box, preserving aspect ratio and centring. */
function fit(pts) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX;
  const h = Math.max(...ys) - minY;
  const s = 94 / Math.max(w, h);
  const ox = (100 - w * s) / 2;
  const oy = (100 - h * s) / 2;
  return pts.map((p) => [(p[0] - minX) * s + ox, (p[1] - minY) * s + oy]);
}

/** Shoelace. In a y-DOWN frame a positive result means clockwise on screen. */
function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

let out = `/**
 * TRACK RECALL — the circuits.
 *
 * GENERATED FROM THE OFFICIAL CIRCUIT SVGs, so the shapes are exact rather
 * than traced: earlier attempts drawn from memory and read off raster maps
 * both produced silhouettes that were recognisably wrong, which for circuits
 * this famous is the same as useless.
 *
 * Each loop STARTS AT THE START/FINISH LINE and runs in the direction the
 * circuit is actually raced, because the game animates a lap before asking
 * the player to reproduce it. The SVG carries neither of those, so both are
 * set in tools/buildCircuits.mjs.
 *
 * Coordinates are a 0-100 box with y running DOWN, matching canvas axes, with
 * aspect ratio preserved — most of these are markedly landscape and squaring
 * one up is enough on its own to make it unrecognisable.
 *
 * Do not edit by hand. Regenerate:
 *   node tools/buildCircuits.mjs > src/minigames/TrackRecall/circuits.ts
 */

export interface Circuit {
  id: string;
  name: string;
  country: string;
  /** Closed loop, 0-100, y down, starting at the start/finish line. */
  points: [number, number][];
  /** True when the circuit is raced clockwise as drawn. */
  clockwise: boolean;
  /** One line shown with the result, so a play teaches something. */
  fact: string;
}

export const CIRCUITS: Circuit[] = [
`;

const report = [];

for (const v of VENUES) {
  const svg = readFileSync(`${DIR}/${v.file}`, 'utf8');
  let tags = [...svg.matchAll(/<path\b[^>]*>/g)].map((m) => m[0]);
  // Some files ship the pit lane, or marker stubs, alongside the circuit.
  // Filtering on the track's own stroke colour is the only reliable way to
  // tell them apart.
  if (v.stroke) tags = tags.filter((t) => t.includes(`stroke="${v.stroke}"`));
  const ds = tags.map((t) => t.match(/\sd="([^"]+)"/)?.[1]).filter(Boolean);
  if (!ds.length) throw new Error(`${v.id}: no <path d>`);

  const pieces = ds.map(parsePath).filter((p) => p.length > 1);
  // An already-closed path IS the lap. Prefer it over chaining, which would
  // otherwise splice on whatever short marker stubs sit beside it.
  const longest = pieces.reduce((a, b) => (b.length > a.length ? b : a));
  const isClosed =
    Math.hypot(
      longest[0][0] - longest[longest.length - 1][0],
      longest[0][1] - longest[longest.length - 1][1]
    ) < 2;
  let pts = isClosed ? longest : pieces.length > 1 ? chain(pieces) : pieces[0];
  if (v.rotate) {
    const r = (v.rotate * Math.PI) / 180;
    const c = Math.cos(r);
    const s2 = Math.sin(r);
    pts = pts.map(([x, y]) => [x * c - y * s2, x * s2 + y * c]);
  }
  pts = fit(resample(pts, TARGET));

  // Orient. A figure-of-eight has near-zero signed area because its lobes
  // cancel, so it cannot be oriented this way and is left as drawn.
  const area = signedArea(pts);
  const span = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
  const eight = Math.abs(area) < span * span * 0.06;
  if (!eight && (area > 0) !== v.clockwise) pts.reverse();

  // Rotate so the start/finish line is index 0.
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const tx = Math.min(...xs) + v.start[0] * (Math.max(...xs) - Math.min(...xs));
  const ty = Math.min(...ys) + v.start[1] * (Math.max(...ys) - Math.min(...ys));
  let si = 0;
  let sd = Infinity;
  pts.forEach((p, i) => {
    const d = Math.hypot(p[0] - tx, p[1] - ty);
    if (d < sd) { sd = d; si = i; }
  });
  pts = [...pts.slice(si), ...pts.slice(0, si)];

  const rounded = pts.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
  report.push(`${v.id}: ${ds.length} path(s), ${eight ? 'figure-8, orientation left as drawn' : ((area > 0) === v.clockwise ? 'already ' : 'reversed to ') + (v.clockwise ? 'clockwise' : 'anti-clockwise')}, start at [${rounded[0]}]`);

  out += `  {\n    id: '${v.id}',\n    name: '${v.name}',\n    country: '${v.country}',\n`;
  out += `    clockwise: ${v.clockwise},\n    fact: '${v.fact.replace(/'/g, "\\'")}',\n    points: [\n`;
  for (let n = 0; n < rounded.length; n += 5) {
    out += '      ' + rounded.slice(n, n + 5).map((p) => `[${p[0]}, ${p[1]}]`).join(', ') + ',\n';
  }
  out = out.slice(0, -2) + '\n    ]\n  }' + (v === VENUES[VENUES.length - 1] ? '\n' : ',\n');
}

out += `];

export const circuitById = (id: string) => CIRCUITS.find((c) => c.id === id);
`;

process.stdout.write(out);
for (const line of report) console.error('  ' + line);

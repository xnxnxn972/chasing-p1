/**
 * TRACK RECALL — comparing a drawing to a circuit.
 *
 * WHAT IS BEING MEASURED, AND WHAT IS DELIBERATELY IGNORED.
 *
 * The question is "do you remember the shape", not "can you reproduce the
 * coordinates". So before anything is compared, both loops are stripped of
 * everything that is not shape:
 *
 *   - WHERE it was drawn      -> centroid moved to the origin
 *   - HOW BIG                 -> scaled to unit RMS radius
 *   - HOW FAST / how many
 *     points the pointer
 *     happened to emit        -> resampled to a fixed count by arc length
 *   - WHERE THEY STARTED      -> every circular offset is tried
 *   - WHICH WAY ROUND         -> both directions are tried
 *   - SMALL TILT              -> rotation is solved for, then clamped
 *
 * Arc-length resampling is the quiet one that matters most. A pointer emits
 * events by time, not by distance, so a slowly-drawn corner arrives as a dense
 * clump of points and a quick straight as three. Comparing raw samples would
 * score how evenly somebody moves their finger.
 *
 * Rotation is solved but CLAMPED, not free. Allowing any rotation would give
 * full marks for drawing Monza sideways, and the player was shown which way up
 * it goes. A few degrees of slop is sloppiness; ninety is a different memory.
 */

export type Pt = [number, number];

/** Points compared per shape. 64 is plenty for a silhouette and stays cheap. */
export const SAMPLES = 64;

/** How much tilt is forgiven, radians. */
export const MAX_ROT = (28 * Math.PI) / 180;

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/**
 * Walk the loop and drop a point every equal step of distance, so the samples
 * describe the path rather than the drawing speed.
 */
export function resample(points: Pt[], n = SAMPLES): Pt[] {
  const pts = dedupe(points);
  if (pts.length < 2) return new Array(n).fill(pts[0] ?? [0, 0]);

  // Treat it as a closed loop: a circuit is one, and a player who stops short
  // of their own start should not be punished for the gap.
  const loop = [...pts, pts[0]];
  const seg: number[] = [];
  let total = 0;
  for (let i = 0; i < loop.length - 1; i++) {
    const d = dist(loop[i], loop[i + 1]);
    seg.push(d);
    total += d;
  }
  if (total === 0) return new Array(n).fill(loop[0]);

  const out: Pt[] = [];
  const step = total / n;
  let i = 0;
  let along = 0; // distance consumed inside segment i
  for (let k = 0; k < n; k++) {
    let target = k * step;
    // Advance to the segment containing `target`.
    let acc = 0;
    for (let j = 0; j < seg.length; j++) {
      if (acc + seg[j] >= target || j === seg.length - 1) {
        i = j;
        along = target - acc;
        break;
      }
      acc += seg[j];
    }
    const t = seg[i] > 0 ? along / seg[i] : 0;
    out.push([
      loop[i][0] + (loop[i + 1][0] - loop[i][0]) * t,
      loop[i][1] + (loop[i + 1][1] - loop[i][1]) * t
    ]);
  }
  return out;
}

/** Consecutive identical points carry no shape and break the segment maths. */
function dedupe(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || dist(last, p) > 1e-6) out.push(p);
  }
  return out;
}

/** Centre on the origin and scale to unit RMS radius. */
export function normalise(points: Pt[]): Pt[] {
  const n = points.length;
  if (!n) return points;
  let cx = 0;
  let cy = 0;
  for (const [x, y] of points) {
    cx += x;
    cy += y;
  }
  cx /= n;
  cy /= n;
  let sum = 0;
  for (const [x, y] of points) sum += (x - cx) ** 2 + (y - cy) ** 2;
  const rms = Math.sqrt(sum / n) || 1;
  return points.map(([x, y]) => [(x - cx) / rms, (y - cy) / rms] as Pt);
}

/**
 * Mean point-to-point distance after the best allowed alignment.
 *
 * Zero is identical. Two unrelated shapes normalised this way land somewhere
 * around 1, because unit RMS radius means the average point sits about one
 * unit from the middle of its own shape.
 */
export function shapeDistance(a: Pt[], b: Pt[]): number {
  const A = normalise(resample(a));
  const B = normalise(resample(b));
  const n = SAMPLES;
  let best = Infinity;

  for (const dir of [1, -1] as const) {
    for (let shift = 0; shift < n; shift++) {
      // Optimal rotation in closed form, then clamped: the angle that lines
      // two point sets up is atan2 of the summed cross and dot products.
      let cross = 0;
      let dot = 0;
      for (let i = 0; i < n; i++) {
        const src = A[idx(i, shift, dir, n)];
        const dst = B[i];
        cross += src[0] * dst[1] - src[1] * dst[0];
        dot += src[0] * dst[0] + src[1] * dst[1];
      }
      let theta = Math.atan2(cross, dot);
      if (theta > MAX_ROT) theta = MAX_ROT;
      if (theta < -MAX_ROT) theta = -MAX_ROT;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      let sum = 0;
      for (let i = 0; i < n; i++) {
        const [x, y] = A[idx(i, shift, dir, n)];
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        sum += Math.hypot(rx - B[i][0], ry - B[i][1]);
      }
      const mean = sum / n;
      if (mean < best) best = mean;
    }
  }
  return best;
}

const idx = (i: number, shift: number, dir: 1 | -1, n: number) =>
  ((dir === 1 ? i + shift : shift - i) % n + n) % n;

/**
 * Distance to a percentage.
 *
 * FORGIVING ON PURPOSE. The brief asks that a squiggly but recognisably
 * Suzuka-shaped drawing scores well, so the curve is generous in the middle
 * and only collapses once the shape has stopped being the same shape.
 * Calibrated against the real circuits rather than guessed: the constants
 * below put a clean trace near 100, a shaky one in the eighties, and one
 * circuit drawn when a different one was asked for in the low tens.
 */
export function scoreFromDistance(d: number): number {
  const raw = 100 * Math.exp(-2.6 * Math.max(0, d - 0.06));
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function matchScore(drawing: Pt[], circuit: Pt[]): number {
  if (drawing.length < 4) return 0;
  return scoreFromDistance(shapeDistance(drawing, circuit));
}

export interface Rating {
  label: string;
  note: string;
  good: boolean;
}

export function ratingFor(score: number, circuitName: string): Rating {
  if (score >= 95) {
    return { label: 'Circuit master', note: `You could walk ${circuitName} in the dark.`, good: true };
  }
  if (score >= 80) {
    return { label: 'Track expert', note: `You clearly know your way around ${circuitName}.`, good: true };
  }
  if (score >= 60) {
    return { label: 'Solid memory', note: 'The shape is right. The details drifted.', good: true };
  }
  if (score >= 40) {
    return { label: 'Need another track walk', note: 'Something of it is there, but not much.', good: false };
  }
  return { label: "Are you sure you've raced here?", note: 'That is a different circuit.', good: false };
}

/**
 * Qualifying awarded in career mode.
 *
 * Deliberately tiny, and on the same scale as the Lights Out boost. Driver
 * stats run 0-100 and a whole season of development moves them by a few
 * points, so anything worth +5 would make a minigame a better way to build a
 * driver than racing, which is the opposite of the point.
 *
 * The thresholds are higher than the rating bands look, because the score is
 * forgiving by design: a shaky but recognisable trace already scores in the
 * eighties. +2 needs a drawing that is genuinely the right shape. If this
 * ever needs retuning, retune it here: nothing else knows the numbers.
 */
export function boostFor(score: number): number {
  if (score >= 90) return 2;
  if (score >= 70) return 1;
  return 0;
}

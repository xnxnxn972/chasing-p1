/**
 * BRAKE POINT — the helicopter view.
 *
 * WHY THIS REPLACED THE COCKPIT VIEW.
 *
 * A perspective view turns distance into vertical compression near the
 * horizon, and reading that back out as "how far away is the corner" needs
 * scenery this canvas has no room for. On a phone the corner was a speck, then
 * it was on top of you, and nothing in between told you how much road was
 * left. Two rounds of "too hard" were really "I cannot see what I am judging".
 *
 * From above, distance is just distance: the gap between the car and the
 * corner is a gap on the screen, in pixels, shrinking at a rate you can watch.
 * The braking boards are beside the track where you can count them off, and
 * the corner is visibly a corner rather than a stripe across the road.
 *
 * The tension has to come from somewhere else, so it comes from the scroll
 * rate and from the corner being tight enough to look unsurvivable at speed.
 */

import { apexMs, type Corner } from './brakeLogic';

/**
 * How much road is visible ahead of the car.
 *
 * Long on purpose. The corner has to be on screen well before the braking
 * point or there is no moment of watching it come — at 190m it appeared barely
 * half a second before you had to act, which is a jump scare rather than a
 * decision. At 260m it arrives about two and a half seconds before the 100
 * board, which is the anticipation the whole game is made of.
 */
const VIEW_M = 260;

/**
 * Lateral grip used to draw the corner's radius, m/s².
 *
 * About 4g, which is the right order for a modern F1 car. It is only used for
 * drawing, but it is worth deriving rather than picking: it means the hairpin
 * LOOKS like a hairpin and the fast right looks like something you could take
 * flat, so the picture tells you what the corner is before the label does.
 */
const LATERAL = 40;

/**
 * ONLY DISTANCE ALONG THE TRACK IS TO SCALE.
 *
 * The width is a fixed, readable number of pixels instead, because the two
 * requirements fight: a long view makes the metre-scale small, and a
 * to-scale track then becomes a thread. Longitudinal distance is the thing
 * being judged, so that stays honest; width is just a road to see.
 */
const trackHalfPx = (W: number) => Math.max(13, W * 0.075);

export interface ViewState {
  distance: number;
  speed: number;
  braking: boolean;
  /** Where the brakes actually went on, for the trail. 0 when not yet. */
  brakeAtM: number;
}

export function drawTrack(canvas: HTMLCanvasElement | null, corner: Corner, v: ViewState) {
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (!cssW || !cssH) return;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const W = cssW;
  const H = cssH;
  const carY = H * 0.82;
  const pxPerM = carY / VIEW_M;
  // Right of centre: the corner turns left, so the exit needs the room.
  const cx = W * 0.6;
  const halfW = trackHalfPx(W);

  /** Screen y for a point `m` metres ahead of the car. */
  const ahead = (m: number) => carY - m * pxPerM;

  const cornerY = ahead(v.distance);
  // Radius from the apex speed the corner can actually be taken at, so a
  // hairpin looks like a hairpin. Floored so a slow corner cannot ask for a
  // radius narrower than the track it is drawn on.
  const radius = Math.max(
    halfW * 2.2,
    ((apexMs(corner) * apexMs(corner)) / LATERAL) * pxPerM
  );

  ctx.fillStyle = '#080b0f';
  ctx.fillRect(0, 0, W, H);

  // ---- run-off, then track -------------------------------------------------
  // Drawn as one stroked path: straight up to the corner, then a left-hand arc
  // of the radius the apex speed implies.
  const layTrack = () => {
    ctx.beginPath();
    ctx.moveTo(cx, H + 40);
    ctx.lineTo(cx, cornerY);
    ctx.arc(cx - radius, cornerY, radius, 0, -Math.PI / 2, true);
  };

  layTrack();
  ctx.strokeStyle = '#11161b';
  ctx.lineWidth = halfW * 2 + 26;
  ctx.lineCap = 'butt';
  ctx.stroke();

  layTrack();
  ctx.strokeStyle = '#272e36';
  ctx.lineWidth = halfW * 2;
  ctx.stroke();

  // ---- the brake trail: where you actually got on the pedal ---------------
  if (v.brakeAtM > 0) {
    const from = ahead(v.brakeAtM);
    const to = Math.max(cornerY, carY);
    if (from > cornerY) {
      ctx.beginPath();
      ctx.moveTo(cx, Math.min(from, H));
      ctx.lineTo(cx, Math.max(to, cornerY));
      ctx.strokeStyle = 'rgba(210,31,31,0.55)';
      ctx.lineWidth = halfW * 1.5;
      ctx.stroke();
    }
  }

  // ---- edge lines ----------------------------------------------------------
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * halfW, H + 40);
    ctx.lineTo(cx + side * halfW, cornerY);
    ctx.arc(cx - radius, cornerY, radius + side * halfW, 0, -Math.PI / 2, true);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // ---- centre dashes, tied to distance travelled --------------------------
  const travelled = corner.runUpM - v.distance;
  const gap = 12;
  const phase = travelled % gap;
  for (let i = 0; i < Math.ceil(VIEW_M / gap) + 2; i++) {
    const m = i * gap + (gap - phase);
    if (m > v.distance) break; // dashes stop at the corner
    const y0 = ahead(m);
    const y1 = ahead(m + 5);
    if (y0 < -20) break;
    ctx.beginPath();
    ctx.moveTo(cx, y0);
    ctx.lineTo(cx, y1);
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // ---- the corner: kerbs on the apex, and a gravel trap to fall into ------
  drawApex(ctx, cx, cornerY, radius, halfW);

  // ---- braking boards ------------------------------------------------------
  for (const board of [150, 100, 50]) {
    const m = v.distance - board;
    if (m < -6 || m > VIEW_M + 10) continue;
    drawBoard(ctx, cx + halfW, ahead(m), String(board), halfW);
  }

  // ---- speed streaks, so the scroll rate reads as speed -------------------
  const streaks = 7;
  for (let i = 0; i < streaks; i++) {
    const m = ((travelled * 1.6 + i * 34) % 190) + 4;
    const y = ahead(m);
    if (y < 0 || y > H) continue;
    const alpha = Math.min(0.28, (v.speed / 80) * 0.28);
    for (const x of [cx - halfW - 16, cx + halfW + 16]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 22);
      ctx.strokeStyle = `rgba(200,255,0,${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  drawCar(ctx, cx, carY, halfW, v.braking);
}

/** Red and white kerbing on the inside of the turn, plus gravel beyond it. */
function drawApex(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cornerY: number,
  radius: number,
  halfW: number
) {
  const inner = radius - halfW;
  if (inner <= 2) return;

  // Gravel on the outside of the corner, which is where being late puts you.
  ctx.beginPath();
  ctx.arc(cx - radius, cornerY, radius + halfW, 0, -Math.PI / 2, true);
  ctx.arc(cx - radius, cornerY, radius + halfW + 34, -Math.PI / 2, 0, false);
  ctx.closePath();
  ctx.fillStyle = 'rgba(120,96,60,0.18)';
  ctx.fill();

  const seg = 9;
  for (let i = 0; i < seg; i++) {
    const a0 = -(Math.PI / 2) * (i / seg);
    const a1 = -(Math.PI / 2) * ((i + 1) / seg);
    ctx.beginPath();
    ctx.arc(cx - radius, cornerY, inner, a0, a1, true);
    ctx.strokeStyle = i % 2 ? '#f1f1f1' : '#d21f1f';
    ctx.lineWidth = Math.max(3, halfW * 0.22);
    ctx.stroke();
  }
}

/**
 * A braking board beside the track.
 *
 * NOT lime. The first version put an accent-coloured line across the corner
 * and it became the brightest thing on screen, so it read as "press now".
 * Anything that looks like an instruction has to be removed from a game whose
 * whole point is that nobody tells you when.
 */
function drawBoard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  halfW: number
) {
  const h = Math.max(15, halfW * 0.85);
  const w = h * 1.35;
  ctx.fillStyle = '#05070a';
  ctx.fillRect(x + 6, y - h / 2 - 1.5, w + 3, h + 3);
  ctx.fillStyle = '#e9edf1';
  ctx.fillRect(x + 7.5, y - h / 2, w, h);
  ctx.fillStyle = '#05070a';
  ctx.font = `700 ${Math.max(9, h * 0.66)}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 7.5 + w / 2, y + 1);
}

function drawCar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  halfW: number,
  braking: boolean
) {
  const wid = halfW * 0.95;
  const len = wid * 2.5;

  ctx.save();
  ctx.translate(cx, cy);

  // Tyres
  ctx.fillStyle = '#0c0f13';
  const ty = len * 0.3;
  const tw = wid * 0.32;
  const th = len * 0.2;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      ctx.fillRect(sx * (wid / 2) - (sx > 0 ? 0 : tw), sy * ty - th / 2, tw, th);
    }
  }

  // Body
  ctx.fillStyle = braking ? '#e0e6ea' : '#c8ff00';
  ctx.beginPath();
  ctx.moveTo(0, -len / 2);
  ctx.lineTo(wid * 0.33, -len * 0.1);
  ctx.lineTo(wid * 0.33, len * 0.42);
  ctx.lineTo(-wid * 0.33, len * 0.42);
  ctx.lineTo(-wid * 0.33, -len * 0.1);
  ctx.closePath();
  ctx.fill();

  // Rear wing, and the brake light that lives on it
  ctx.fillStyle = braking ? '#ff2b2b' : '#2a3038';
  ctx.fillRect(-wid * 0.46, len * 0.4, wid * 0.92, Math.max(3, len * 0.1));
  if (braking) {
    ctx.shadowColor = '#ff2b2b';
    ctx.shadowBlur = 14;
    ctx.fillRect(-wid * 0.46, len * 0.4, wid * 0.92, Math.max(3, len * 0.1));
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

/**
 * The shareable card for a Lights Out time.
 *
 * STANDALONE ONLY. Inside a career the grid start is a ten-second beat in
 * somebody's story and a share button there would invite them to leave it. On
 * its own page the time IS the whole thing, and a time is the kind of number
 * people want to put in front of a friend.
 *
 * Drawn with the primitives from the career card rather than its own set, so
 * the two look like they came from the same place, and handed to the platform
 * through the same `handOff` so there is one implementation of the part that
 * can silently turn a share into a download.
 */

import {
  BODY,
  DISPLAY,
  FAINT,
  INK,
  LIME,
  LINE,
  MONO,
  TEXT,
  ensureFonts,
  handOff,
  rule,
  shareHost,
  tracked,
  type ShareTrace
} from '../../components/shareCard';
import { formatTime, type Rating } from './gameLogic';

/** Slightly brighter than FAINT, for the benchmark line. */
const DIMMED = '#8b95a2';

/** Square rather than the career card's portrait: there is one number on it. */
const W = 1080;
const H = 1080;

export interface TimeShare {
  ms: number;
  rating: Rating;
  /** The player's best, when this run was not it. Omitted when it is. */
  best?: number;
}

/**
 * Where the minigame lives, tagged so arrivals from a shared time are
 * distinguishable from every other no-referrer visit. A link pasted into
 * WhatsApp carries no referrer at all, so without the tag these are invisible.
 */
export function minigameUrl(): string {
  if (typeof location === 'undefined') return 'https://playchasingp1.com/minigames/lights-out/';
  const base = `${location.origin}${location.pathname}`.replace(/index\.html$/, '');
  return `${base}?s=share_lightsout`;
}

export async function renderTimeCard(data: TimeShare): Promise<Blob> {
  await ensureFonts();

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  const bloom = ctx.createRadialGradient(W / 2, -140, 0, W / 2, -140, 820);
  bloom.addColorStop(0, 'rgba(200,255,0,0.16)');
  bloom.addColorStop(1, 'rgba(200,255,0,0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, W, 620);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // ---- eyebrow -------------------------------------------------------------
  ctx.fillStyle = LIME;
  ctx.font = `600 30px ${DISPLAY}`;
  tracked(ctx, 'LIGHTS OUT', W / 2, 132, 10);

  ctx.fillStyle = FAINT;
  ctx.font = `600 24px ${DISPLAY}`;
  tracked(ctx, 'F1 REACTION TEST', W / 2, 178, 8);

  rule(ctx, 220);

  // ---- the gantry ----------------------------------------------------------
  // LIT, not dark. Strictly the time was measured from the instant they went
  // out, so the accurate frame is five dark circles — but five dark circles
  // are not a picture of anything. The five red lights are the image everyone
  // recognises as a Formula 1 start, and on a card seen as a thumbnail in a
  // chat that recognition is the entire job.
  const r = 46;
  const gap = 40;
  const cy = 330;
  const totalW = 5 * (r * 2) + 4 * gap;
  let cx = (W - totalW) / 2 + r;
  for (let i = 0; i < 5; i++) {
    // Glow first, underneath, so the lamps sit on top of their own bloom.
    const glow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.9);
    glow.addColorStop(0, 'rgba(255,40,40,0.42)');
    glow.addColorStop(1, 'rgba(255,40,40,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.9, 0, Math.PI * 2);
    ctx.fill();

    // The lamp, lit off-centre like the CSS version so it reads as a bulb
    // rather than a flat disc.
    const lamp = ctx.createRadialGradient(cx - r * 0.24, cy - r * 0.32, r * 0.1, cx, cy, r);
    lamp.addColorStop(0, '#ff6b6b');
    lamp.addColorStop(0.62, '#d40000');
    lamp.addColorStop(1, '#7a0000');
    ctx.fillStyle = lamp;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff4d4d';
    ctx.lineWidth = 2;
    ctx.stroke();

    cx += r * 2 + gap;
  }

  // ---- the number ----------------------------------------------------------
  const time = formatTime(data.ms);
  ctx.fillStyle = LIME;
  ctx.font = `700 210px ${MONO}`;
  // Sized down only if a freak time is wide enough to touch the edges.
  let size = 210;
  while (size > 90 && ctx.measureText(time).width > W - 140) {
    size -= 6;
    ctx.font = `700 ${size}px ${MONO}`;
  }
  ctx.fillText(time, W / 2, 560);

  ctx.fillStyle = TEXT;
  ctx.font = `700 52px ${DISPLAY}`;
  tracked(ctx, data.rating.label.toUpperCase(), W / 2, 646, 8);

  ctx.fillStyle = FAINT;
  ctx.font = `400 30px ${BODY}`;
  ctx.fillText(data.rating.note, W / 2, 704);

  rule(ctx, 766);

  // ---- context -------------------------------------------------------------
  // An F1 start is the only benchmark worth printing: it is what makes the
  // number mean something to somebody who has never taken the test.
  ctx.fillStyle = DIMMED;
  ctx.font = `400 30px ${BODY}`;
  ctx.fillText('A Formula 1 start is around 0.200s', W / 2, 828);

  if (data.best !== undefined && data.best !== data.ms) {
    ctx.fillStyle = FAINT;
    ctx.font = `500 28px ${MONO}`;
    ctx.fillText(`personal best ${formatTime(data.best)}`, W / 2, 882);
  }

  // ---- footer --------------------------------------------------------------
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H - 132.5);
  ctx.lineTo(W, H - 132.5);
  ctx.stroke();

  ctx.fillStyle = TEXT;
  ctx.font = `600 30px ${DISPLAY}`;
  tracked(ctx, 'BEAT IT AT', W / 2, H - 82, 8);

  ctx.fillStyle = LIME;
  ctx.font = `700 34px ${MONO}`;
  tracked(ctx, `${shareHost()}/MINIGAMES`, W / 2, H - 36, 4);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('render failed'))), 'image/png');
  });
}


/**
 * Build the PNG ahead of the click, for the same reason the career card does:
 * navigator.share() needs the click to still be live, and a canvas draw spends
 * it. The measured cost of getting this wrong was a third of Android shares
 * silently becoming file saves.
 */
export async function prepareTimeCard(data: TimeShare): Promise<{ file: File; renderMs: number }> {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const blob = await renderTimeCard(data);
  const file = new File([blob], `lights-out-${formatTime(data.ms).replace('.', '-')}.png`, {
    type: 'image/png'
  });
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return { file, renderMs: Math.round(t1 - t0) };
}

export async function shareTimeCard(
  data: TimeShare,
  prepared?: { file: File; renderMs: number }
): Promise<ShareTrace> {
  let ready: { file: File; renderMs: number };
  try {
    ready = prepared ?? (await prepareTimeCard(data));
  } catch {
    return { result: 'failed', path: 'download', renderMs: 0, sheetMs: 0 };
  }
  return handOff(
    ready.file,
    `${formatTime(data.ms)} — ${data.rating.label}`,
    `I reacted in ${formatTime(data.ms)} on the F1 start lights. ${data.rating.label}.

Beat it: ${minigameUrl()}`,
    prepared ? 0 : ready.renderMs
  );
}

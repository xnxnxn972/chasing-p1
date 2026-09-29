/**
 * The shareable card for a Track Recall attempt.
 *
 * STANDALONE ONLY, for the same reason as Lights Out: inside a career the
 * circuit is one beat in somebody's story, and a share button there invites
 * them to leave it.
 *
 * WHAT MAKES THIS ONE WORTH SHARING IS THE PICTURE, NOT THE NUMBER. A Lights
 * Out card is a reaction time and the time is the whole story. Here the score
 * on its own says nothing — 62% could be a wobbly Monaco or a Spa with the
 * bus stop in the wrong place. The two shapes side by side are the joke, so
 * they get the middle of the card and the percentage sits underneath them.
 *
 * Each shape is fitted to its own panel, exactly as the result screen does it,
 * so the card agrees with the screen the player just looked at. Position and
 * size are the things the score already ignores; a good drawing in the wrong
 * corner should not look worse here than it scored.
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
import type { Circuit } from './circuits';
import type { Pt, Rating } from './recallScore';

/** Square: this is a picture, and a square thumbnail crops in no chat app. */
const W = 1080;
const H = 1080;
const PAD = 76;

export interface RecallShare {
  circuit: Circuit;
  /** The player's line, one entry per pen-down. */
  strokes: Pt[][];
  score: number;
  rating: Rating;
  /** The player's best, when this run was not it. Omitted when it is. */
  best?: number;
}

/**
 * Where the minigame lives, tagged so arrivals from a shared card are
 * distinguishable from every other no-referrer visit. A link pasted into
 * WhatsApp carries no referrer at all, so without the tag these are invisible.
 */
export function minigameUrl(): string {
  if (typeof location === 'undefined') return 'https://playchasingp1.com/minigames/track-recall/';
  const base = `${location.origin}${location.pathname}`.replace(/index\.html$/, '');
  return `${base}?s=share_trackrecall`;
}

export async function renderRecallCard(data: RecallShare): Promise<Blob> {
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
  tracked(ctx, 'TRACK RECALL', W / 2, 118, 10);

  ctx.fillStyle = FAINT;
  ctx.font = `600 24px ${DISPLAY}`;
  tracked(ctx, 'F1 CIRCUIT MEMORY TEST', W / 2, 162, 8);

  rule(ctx, 200);

  // ---- what they were asked to draw ----------------------------------------
  ctx.fillStyle = TEXT;
  ctx.font = `700 60px ${DISPLAY}`;
  tracked(ctx, data.circuit.name.toUpperCase(), W / 2, 272, 4);

  // Monaco's country is Monaco, and "Monaco - Monaco" reads like a bug.
  const where = data.circuit.country === data.circuit.name ? '' : `${data.circuit.country} · `;
  ctx.fillStyle = FAINT;
  ctx.font = `400 27px ${BODY}`;
  ctx.fillText(`${where}from memory, in ten seconds`, W / 2, 312);

  // ---- the two shapes ------------------------------------------------------
  const top = 344;
  const boxH = 300;
  const boxW = (W - PAD * 2 - 28) / 2;
  panel(ctx, PAD, top, boxW, boxH, [data.circuit.points], LIME, 'The circuit', true);
  panel(ctx, W - PAD - boxW, top, boxW, boxH, data.strokes, TEXT, 'What they drew', false);

  rule(ctx, top + boxH + 42);

  // ---- the number ----------------------------------------------------------
  // Under the shapes, not above them: the picture is the reason anyone looks
  // twice, and the score is the caption on it.
  const y = 772;
  ctx.font = `700 132px ${MONO}`;
  const num = String(data.score);
  const numW = ctx.measureText(num).width;
  ctx.font = `700 54px ${MONO}`;
  const pctW = ctx.measureText('%').width;
  const left = (W - (numW + 10 + pctW)) / 2;

  ctx.textAlign = 'left';
  ctx.fillStyle = data.rating.good ? LIME : '#ff9e3d';
  ctx.font = `700 132px ${MONO}`;
  ctx.fillText(num, left, y);
  ctx.fillStyle = FAINT;
  ctx.font = `700 54px ${MONO}`;
  ctx.fillText('%', left + numW + 10, y);
  ctx.textAlign = 'center';

  // "Are you sure you've raced here?" is twice the length of "Track expert",
  // and letter-spacing makes it wider still, so it is measured rather than
  // trusted to fit.
  const label = data.rating.label.toUpperCase();
  ctx.fillStyle = data.rating.good ? TEXT : '#ff9e3d';
  let labelSize = 46;
  const labelWidth = () => [...label].reduce((t, ch) => t + ctx.measureText(ch).width + 7, -7);
  ctx.font = `700 ${labelSize}px ${DISPLAY}`;
  while (labelSize > 26 && labelWidth() > W - PAD * 2) {
    labelSize -= 2;
    ctx.font = `700 ${labelSize}px ${DISPLAY}`;
  }
  tracked(ctx, label, W / 2, y + 62, 7);

  ctx.fillStyle = FAINT;
  ctx.font = `400 28px ${BODY}`;
  ctx.fillText(data.rating.note, W / 2, y + 108);

  if (data.best !== undefined && data.best !== data.score) {
    ctx.fillStyle = FAINT;
    ctx.font = `500 26px ${MONO}`;
    ctx.fillText(`personal best ${data.best}%`, W / 2, y + 152);
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
  tracked(ctx, 'DRAW IT YOURSELF AT', W / 2, H - 82, 8);

  ctx.fillStyle = LIME;
  ctx.font = `700 34px ${MONO}`;
  tracked(ctx, `${shareHost()}/MINIGAMES`, W / 2, H - 36, 4);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('render failed'))), 'image/png');
  });
}

/**
 * One shape in a bordered box with a caption.
 *
 * Takes STROKES rather than a flat list of points, so a drawing made in three
 * separate pen-downs is not handed a straight line joining wherever the pen
 * lifted to wherever it landed next. The circuit comes through as a single
 * closed stroke.
 *
 * All strokes share one fit, or a small correction in the corner would be
 * blown up to the size of the lap.
 */
function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  strokes: Pt[][],
  colour: string,
  label: string,
  close: boolean
) {
  ctx.save();

  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  ctx.font = `600 24px ${DISPLAY}`;
  ctx.fillStyle = 'rgba(139,149,162,0.9)';
  ctx.textAlign = 'center';
  tracked(ctx, label.toUpperCase(), x + w / 2, y + h - 26, 5);

  const all = strokes.flat();
  if (all.length >= 2) {
    const xs = all.map((p) => p[0]);
    const ys = all.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const pw = Math.max(1e-6, Math.max(...xs) - minX);
    const ph = Math.max(1e-6, Math.max(...ys) - minY);
    const inner = h - 66;
    const s = Math.min((w * 0.88) / pw, (inner * 0.9) / ph);
    const ox = x + (w - pw * s) / 2;
    const oy = y + 14 + (inner - ph * s) / 2;
    for (const stroke of strokes) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      stroke.forEach((p, i) => {
        const px = ox + (p[0] - minX) * s;
        const py = oy + (p[1] - minY) * s;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      if (close) ctx.closePath();
      ctx.strokeStyle = colour;
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = 'rgba(91,100,114,0.9)';
    ctx.font = `400 26px ${BODY}`;
    ctx.fillText('nothing drawn', x + w / 2, y + h / 2);
  }

  ctx.restore();
}

/**
 * Build the PNG ahead of the click, for the same reason the career card does:
 * navigator.share() needs the click to still be live, and a canvas draw spends
 * it. The measured cost of getting this wrong was a third of Android shares
 * silently becoming file saves.
 */
export async function prepareRecallCard(
  data: RecallShare
): Promise<{ file: File; renderMs: number }> {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const blob = await renderRecallCard(data);
  const file = new File([blob], `track-recall-${data.circuit.id}-${data.score}.png`, {
    type: 'image/png'
  });
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return { file, renderMs: Math.round(t1 - t0) };
}

export async function shareRecallCard(
  data: RecallShare,
  prepared?: { file: File; renderMs: number }
): Promise<ShareTrace> {
  let ready: { file: File; renderMs: number };
  try {
    ready = prepared ?? (await prepareRecallCard(data));
  } catch {
    return { result: 'failed', path: 'download', renderMs: 0, sheetMs: 0 };
  }
  return handOff(
    ready.file,
    `${data.circuit.name} from memory — ${data.score}%`,
    `I drew ${data.circuit.name} from memory and got ${data.score}%. ${data.rating.label}.

Your turn: ${minigameUrl()}`,
    prepared ? 0 : ready.renderMs
  );
}

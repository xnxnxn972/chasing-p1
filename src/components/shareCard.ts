import type { CareerTotals, GameState } from '../game/types';
import { careerScore, careerTitle, careerVerdict, computeTotals, scorePercentile } from '../game/careerVerdict';

/**
 * Renders the career as a PNG and hands it to the platform's share sheet.
 *
 * The card is drawn on a canvas rather than screenshotted from the DOM so it is
 * a fixed 1080x1350 whatever the viewport was, and so it can be composed for
 * sharing — portrait, big numbers, readable as a thumbnail.
 */

const W = 1080;
const H = 1350;
const PAD = 76;

const INK = '#05070a';
const LIME = '#c8ff00';
const TEXT = '#f3f6f8';
const DIM = '#8b95a2';
const FAINT = '#5b6472';
const LINE = '#232a33';

const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif';
const BODY = '"Twemoji Country Flags", Inter, system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

/** Shrink a font size until the text fits the given width. */
function fitSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  start: number,
  font: (size: number) => string,
  min = 20
): number {
  let size = start;
  while (size > min) {
    ctx.font = font(size);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Compact money for the card — the app's formatter, without the euro padding. */
function formatMoneyShort(millions: number): string {
  if (millions >= 1000) return `€${(millions / 1000).toFixed(1)}B`;
  if (millions >= 1) return `€${Math.round(millions)}M`;
  return `€${Math.round(millions * 1000)}K`;
}

function rule(ctx: CanvasRenderingContext2D, y: number, colour = LINE) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y + 0.5);
  ctx.lineTo(W - PAD, y + 0.5);
  ctx.stroke();
}

function tracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: 'left' | 'center' = 'center'
) {
  const chars = [...text];
  const width = chars.reduce((w, c) => w + ctx.measureText(c).width + spacing, -spacing);
  let cursor = align === 'center' ? x - width / 2 : x;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const c of chars) {
    ctx.fillText(c, cursor, y);
    cursor += ctx.measureText(c).width + spacing;
  }
  ctx.textAlign = prev;
}

/** The P1 monogram, drawn from the same geometry as the in-app mark. */
function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, height: number) {
  const scale = height / 72;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.transform(1, 0, -Math.tan((12 * Math.PI) / 180), 1, 0, 0);

  const split = ctx.createLinearGradient(0, 72, 84, 0);
  split.addColorStop(0, LIME);
  split.addColorStop(0.46, LIME);
  split.addColorStop(0.4601, '#ffffff');
  split.addColorStop(1, '#ffffff');

  // P, with the counter punched out by the even-odd rule.
  const p = new Path2D('M0,0 H48 V42 H18 V72 H0 Z M18,12 H36 V30 H18 Z');
  ctx.fillStyle = split;
  ctx.fill(p, 'evenodd');

  ctx.fillStyle = LIME;
  ctx.fill(new Path2D('M84,0 V72 H66 V16 H54 L66,0 Z'));
  ctx.restore();
}

async function ensureFonts() {
  if (!document.fonts) return;
  const faces = [
    `700 64px ${DISPLAY}`,
    `600 28px ${DISPLAY}`,
    `700 64px ${MONO}`,
    `500 24px ${MONO}`,
    `400 30px ${BODY}`
  ];
  try {
    await Promise.all(faces.map((f) => document.fonts.load(f)));
    await document.fonts.ready;
  } catch {
    // Fall back to whatever is available rather than blocking the share.
  }
}

export interface ShareData {
  title: string;
  name: string;
  flag: string;
  number: number;
  years: string;
  retiredAt: number;
  peakOverall: number;
  teamPath: string[];
  totals: CareerTotals;
  score: number;
  percentile: string;
  verdict: string;
  earnings: number;
}

export function shareDataFor(state: GameState): ShareData {
  const totals = computeTotals(state);
  const f1 = state.history.filter((h) => h.series === 'F1' && !h.reserveYear);
  const teamPath: string[] = [];
  for (const s of f1) if (teamPath[teamPath.length - 1] !== s.teamName) teamPath.push(s.teamName);
  const peakOverall = state.history.reduce((max, h) => Math.max(max, h.driverOverallEnd), 0);
  const firstYear = state.history[0]?.year ?? state.year;
  const lastYear = state.history[state.history.length - 1]?.year ?? state.year;
  const score = careerScore(state, totals);

  return {
    title: careerTitle(state, totals),
    name: state.player.name,
    flag: state.player.flag,
    number: state.player.number,
    years: `${firstYear}–${lastYear}`,
    retiredAt: state.player.retiredAge ?? state.player.age,
    peakOverall,
    teamPath,
    totals,
    score,
    percentile: scorePercentile(score),
    verdict: careerVerdict(state, totals),
    earnings: state.player.careerEarnings
  };
}

export async function renderShareCard(data: ShareData): Promise<Blob> {
  await ensureFonts();

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');

  // Ground, with the same lime bloom the app uses.
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  const bloom = ctx.createRadialGradient(W / 2, -160, 0, W / 2, -160, 900);
  bloom.addColorStop(0, 'rgba(200,255,0,0.16)');
  bloom.addColorStop(1, 'rgba(200,255,0,0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, W, 700);

  ctx.fillStyle = LIME;
  ctx.fillRect(0, 0, W, 5);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';

  let y = 150;
  drawMark(ctx, W / 2 - 44, y - 62, 78);

  y += 66;
  ctx.fillStyle = DIM;
  ctx.font = `600 25px ${DISPLAY}`;
  tracked(ctx, 'CHASING P1', W / 2, y, 8);

  y += 34;
  rule(ctx, y);

  // Career title, shrunk to fit on one line.
  y += 96;
  const titleSize = fitSize(ctx, data.title, W - PAD * 2, 92, (s) => `italic 700 ${s}px ${DISPLAY}`);
  ctx.font = `italic 700 ${titleSize}px ${DISPLAY}`;
  ctx.fillStyle = LIME;
  ctx.fillText(data.title, W / 2, y);

  y += 62;
  const who = `${data.flag} ${data.name}  #${data.number}`;
  const whoSize = fitSize(ctx, who, W - PAD * 2, 46, (s) => `600 ${s}px ${BODY}`);
  ctx.font = `600 ${whoSize}px ${BODY}`;
  ctx.fillStyle = TEXT;
  ctx.fillText(who, W / 2, y);

  y += 44;
  ctx.font = `500 24px ${MONO}`;
  ctx.fillStyle = FAINT;
  ctx.fillText(
    `${data.years}  ·  RETIRED AT ${data.retiredAt}  ·  PEAK OVR ${data.peakOverall}`,
    W / 2,
    y
  );

  // Headline numbers.
  y += 78;
  const cells: [number, string][] = [
    [data.totals.f1Starts, 'Grands Prix'],
    [data.totals.f1Wins, 'Wins'],
    [data.totals.f1Podiums, 'Podiums'],
    [data.totals.f1Poles, 'Poles'],
    [data.totals.titles, 'Titles']
  ];
  const cellW = (W - PAD * 2) / cells.length;
  cells.forEach(([value, label], i) => {
    const cx = PAD + cellW * i + cellW / 2;
    ctx.font = `700 62px ${MONO}`;
    ctx.fillStyle = label === 'Titles' && value > 0 ? LIME : TEXT;
    ctx.fillText(String(value), cx, y);
    ctx.font = `600 18px ${DISPLAY}`;
    ctx.fillStyle = FAINT;
    tracked(ctx, label.toUpperCase(), cx, y + 32, 4);
  });

  // Teams.
  y += 108;
  ctx.font = `600 27px ${DISPLAY}`;
  ctx.fillStyle = DIM;
  const path = data.teamPath.join('  →  ').toUpperCase() || 'NEVER REACHED FORMULA 1';
  const pathSize = fitSize(ctx, path, W - PAD * 2, 27, (s) => `600 ${s}px ${DISPLAY}`, 15);
  ctx.font = `600 ${pathSize}px ${DISPLAY}`;
  tracked(ctx, path, W / 2, y, 3);

  y += 44;
  rule(ctx, y);

  // Verdict.
  y += 62;
  ctx.font = `400 30px ${BODY}`;
  ctx.fillStyle = TEXT;
  const lines = wrap(ctx, data.verdict, W - PAD * 2 - 40).slice(0, 5);
  for (const line of lines) {
    ctx.fillText(line, W / 2, y);
    y += 43;
  }

  // Secondary totals, which also stop the lower third looking empty.
  y += 26;
  ctx.font = `600 22px ${DISPLAY}`;
  ctx.fillStyle = FAINT;
  const teamsLabel = data.teamPath.length === 1 ? 'F1 TEAM' : 'F1 TEAMS';
  tracked(
    ctx,
    `${formatMoneyShort(data.earnings)} EARNED  ·  ${data.teamPath.length} ${teamsLabel}  ·  ${data.totals.juniorTitles} JUNIOR ${data.totals.juniorTitles === 1 ? 'TITLE' : 'TITLES'}`,
    W / 2,
    y,
    5
  );

  // Score.
  y = Math.max(y + 150, H - 240);
  rule(ctx, y - 70);
  ctx.font = `700 88px ${MONO}`;
  ctx.fillStyle = LIME;
  ctx.fillText(data.score.toLocaleString(), W / 2, y);

  y += 40;
  ctx.font = `600 24px ${DISPLAY}`;
  ctx.fillStyle = DIM;
  tracked(ctx, `CAREER SCORE  ·  ${data.percentile}`, W / 2, y, 6);

  ctx.font = `600 21px ${DISPLAY}`;
  ctx.fillStyle = FAINT;
  tracked(ctx, 'ONE CAREER. ONE GOAL.', W / 2, H - 62, 7);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('render failed'))), 'image/png');
  });
}

/**
 * Where this copy of the game lives, for the share text. Derived rather than
 * hardcoded so it stays right if the game ever moves; query and hash are
 * dropped so a cache-busted visit does not share a cache-busted link.
 */
export function gameUrl(): string {
  if (typeof location === 'undefined') return '';
  return `${location.origin}${location.pathname}`.replace(/index\.html$/, '');
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled' | 'failed';

/**
 * Hand the card to the OS share sheet where that exists (Chrome and Edge on
 * Windows and Android, Safari on iOS), and fall back to saving the PNG.
 */
export async function shareCareerCard(data: ShareData): Promise<ShareResult> {
  let blob: Blob;
  try {
    blob = await renderShareCard(data);
  } catch {
    return 'failed';
  }

  const safeName = data.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'driver';
  const filename = `chasing-p1-${safeName.toLowerCase()}.png`;
  const file = new File([blob], filename, { type: 'image/png' });

  const nav = navigator as Navigator & { canShare?: (d: ShareData_) => boolean };
  type ShareData_ = { files?: File[]; title?: string; text?: string };

  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      // The link goes inside `text` rather than in `url`: when a file is
      // attached most targets keep the text and drop everything else, and
      // passing both duplicates the link on the ones that do keep it.
      const headline = `${data.title}. ${
        data.totals.titles > 0 ? `${data.totals.titles}× World Champion, ` : ''
      }${data.totals.f1Wins} wins.`;
      await nav.share({
        files: [file],
        title: `${data.title} — ${data.name}`,
        text: `${headline}

Play Chasing P1: ${gameUrl()}`
      });
      return 'shared';
    } catch (err) {
      // The user closing the sheet is a normal outcome, not an error.
      if ((err as Error)?.name === 'AbortError') return 'cancelled';
      // Anything else: fall through and save the file instead.
    }
  }

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

/** True when the platform can take an image into a native share sheet. */
export function canShareImages(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean };
  if (!nav.canShare) return false;
  try {
    const probe = new File([new Blob([''], { type: 'image/png' })], 'probe.png', { type: 'image/png' });
    return nav.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { CIRCUITS, type Circuit } from './circuits';
import { matchScore, ratingFor, type Pt } from './recallScore';
import './trackRecall.css';

type Phase = 'ready' | 'study' | 'lap' | 'draw' | 'result';

const STUDY_MS = 5000;
const DRAW_MS = 10000;
/** One lap of the animated trace. Long enough to follow, short enough to sit through. */
const LAP_MS = 2600;

/**
 * TRACK RECALL
 *
 * Study the circuit for five seconds, watch a lap traced from the start line
 * in the racing direction, then ten seconds to draw it from memory.
 *
 * THE ANIMATED LAP IS NOT DECORATION. Without it the game asks "can you copy
 * a shape", which is a drawing test. With it the question becomes "do you
 * know where the lap starts and which way it goes", which is the thing a
 * driver actually carries in their head — and it is why Interlagos running
 * anti-clockwise is worth having in the pool.
 *
 * The circuit is always named. The challenge is reproducing Suzuka, not
 * working out that it was Suzuka.
 */
export function TrackRecall({
  mode,
  onComplete
}: {
  mode: 'career' | 'standalone';
  onComplete?: (score: number) => void;
}) {
  const [circuit, setCircuit] = useState<Circuit>(() => pick());
  const [phase, setPhase] = useState<Phase>('ready');
  const [remaining, setRemaining] = useState(0);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  /**
   * Whether anything has been drawn yet.
   *
   * State, not a ref, even though the strokes themselves are a ref: the Done
   * button's enabled-ness depends on it, and a ref mutation does not
   * re-render. Without this the button was disabled for the whole round and
   * only the ten-second timer ever ended it.
   */
  const [hasInk, setHasInk] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokes = useRef<Pt[][]>([]);
  const drawing = useRef(false);
  const raf = useRef<number | null>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (mode !== 'standalone') return;
    try {
      const raw = window.localStorage.getItem('cp1.trackRecall.best');
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n) && n > 0) setBest(n);
    } catch {
      // Private window or blocked storage: a missing best is not an error.
    }
  }, [mode]);

  // ---- rendering -----------------------------------------------------------
  const paint = useCallback(
    (opts: { outline?: boolean; lapT?: number; ink?: boolean; ghost?: boolean; compare?: boolean }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#070b0f';
      ctx.fillRect(0, 0, w, h);

      const s = Math.min(w, h) / 100;
      const ox = (w - 100 * s) / 2;
      const oy = (h - 100 * s) / 2;
      const P = (p: Pt): Pt => [ox + p[0] * s, oy + p[1] * s];

      /**
       * The result: the real circuit beside what they drew.
       *
       * Side by side rather than overlaid. Superimposing the two looks like
       * a correctness check and buries whichever line is underneath; two
       * panels let you see what you actually remembered, which is the part
       * worth looking at.
       *
       * Each is fitted to its own half, so a good drawing at the wrong size
       * or in the wrong corner still lines up visually — the same things the
       * score already ignores.
       */
      if (opts.compare) {
        const ink = strokes.current.flat();
        panel(ctx, 0, 0, w / 2, h, circuit.points, '#c8ff00', 'The circuit');
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(w / 2 + 0.5, h * 0.12);
        ctx.lineTo(w / 2 + 0.5, h * 0.88);
        ctx.stroke();
        panel(ctx, w / 2, 0, w / 2, h, ink, '#f3f6f8', 'Yours', false);
        return;
      }

      if (opts.ghost) {
        trace(ctx, circuit.points.map(P), 'rgba(200,255,0,0.28)', 2.5);
      }
      if (opts.outline) {
        trace(ctx, circuit.points.map(P), '#c8ff00', 3);
        dot(ctx, P(circuit.points[0]), '#fff', 4);
      }
      if (opts.lapT !== undefined) {
        // Faint whole lap underneath, bright leading edge on top, so the
        // direction of travel is unmistakable rather than inferred.
        trace(ctx, circuit.points.map(P), 'rgba(200,255,0,0.16)', 3);
        const n = circuit.points.length;
        const upto = Math.max(2, Math.round(opts.lapT * n));
        trace(ctx, circuit.points.slice(0, upto).map(P), '#c8ff00', 3.4, false);
        dot(ctx, P(circuit.points[Math.min(upto, n) - 1]), '#fff', 4.5);
      }
      if (opts.ink) {
        for (const stroke of strokes.current) {
          if (stroke.length < 2) continue;
          trace(ctx, stroke.map(P), '#f3f6f8', 3, false);
        }
      }
    },
    [circuit]
  );

  // Redraw when idle so the canvas is never a blank default-sized buffer.
  useEffect(() => {
    if (phase === 'ready') paint({ outline: false });
    if (phase === 'study') paint({ outline: true });
    if (phase === 'draw') paint({ ink: true });
    if (phase === 'result') paint({ compare: true });
  }, [phase, paint]);

  // ---- the run -------------------------------------------------------------
  const start = useCallback(() => {
    clearTimers();
    strokes.current = [];
    setHasInk(false);
    setScore(0);
    setPhase('study');
    setRemaining(Math.ceil(STUDY_MS / 1000));

    for (let s = 1; s <= STUDY_MS / 1000; s++) {
      timers.current.push(
        window.setTimeout(() => setRemaining(Math.ceil(STUDY_MS / 1000) - s), s * 1000)
      );
    }

    timers.current.push(
      window.setTimeout(() => {
        setPhase('lap');
        const t0 = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - t0) / LAP_MS);
          paint({ lapT: t });
          if (t < 1) raf.current = requestAnimationFrame(step);
        };
        raf.current = requestAnimationFrame(step);
      }, STUDY_MS)
    );

    timers.current.push(
      window.setTimeout(() => {
        if (raf.current !== null) cancelAnimationFrame(raf.current);
        raf.current = null;
        setPhase('draw');
        setRemaining(Math.ceil(DRAW_MS / 1000));
        for (let s = 1; s <= DRAW_MS / 1000; s++) {
          timers.current.push(
            window.setTimeout(() => setRemaining(Math.ceil(DRAW_MS / 1000) - s), s * 1000)
          );
        }
        timers.current.push(window.setTimeout(() => finish(), DRAW_MS));
      }, STUDY_MS + LAP_MS + 400)
    );
    // `finish` is stable for the life of a run; re-adding it here would
    // restart the timers on every stroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimers, paint]);

  const finish = useCallback(() => {
    clearTimers();
    drawing.current = false;
    const all = strokes.current.flat();
    const s = matchScore(all, circuit.points);
    setScore(s);
    setPhase('result');
    if (mode === 'standalone' && (best === null || s > best)) {
      setBest(s);
      try {
        window.localStorage.setItem('cp1.trackRecall.best', String(s));
      } catch {
        // Not remembering a best is not worth failing over.
      }
    }
    onComplete?.(s);
  }, [best, circuit, clearTimers, mode, onComplete]);

  const again = useCallback(
    (newCircuit: boolean) => {
      clearTimers();
      strokes.current = [];
      setHasInk(false);
      if (newCircuit) setCircuit(pick(circuit.id));
      setPhase('ready');
    },
    [circuit.id, clearTimers]
  );

  // ---- drawing input -------------------------------------------------------
  const toLocal = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    const s = Math.min(r.width, r.height) / 100;
    const ox = (r.width - 100 * s) / 2;
    const oy = (r.height - 100 * s) / 2;
    return [(e.clientX - r.left - ox) / s, (e.clientY - r.top - oy) / s];
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== 'draw') return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    strokes.current.push([toLocal(e)]);
    setHasInk(true);
    paint({ ink: true });
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || phase !== 'draw') return;
    strokes.current[strokes.current.length - 1].push(toLocal(e));
    paint({ ink: true });
  };
  const up = () => {
    drawing.current = false;
  };

  const rating = ratingFor(score, circuit.name);

  return (
    <div className={`tr tr-${phase}`}>
      <div className="tr-head">
        <span className="tr-title">Track Recall</span>
        <span className="tr-sub">
          {circuit.name} · {circuit.country}
        </span>
      </div>

      <div className="tr-stage">
        <canvas
          ref={canvasRef}
          className="tr-canvas"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />

        {phase === 'ready' ? (
          <div className="tr-overlay">
            <span className="tr-big">{circuit.name}</span>
            <span className="tr-note">
              Five seconds to study it, then one lap from the start line. Then you draw it.
            </span>
          </div>
        ) : null}

        {phase === 'study' ? (
          <div className="tr-badge">Memorise · {remaining}</div>
        ) : null}

        {phase === 'lap' ? (
          <div className="tr-badge">
            {circuit.clockwise ? 'Clockwise' : 'Anti-clockwise'} from the start line
          </div>
        ) : null}

        {phase === 'draw' ? (
          <div className={`tr-badge${remaining <= 3 ? ' urgent' : ''}`}>
            Draw it · {remaining}
          </div>
        ) : null}

        {phase === 'draw' && !hasInk ? (
          <div className="tr-hint-mid">Draw {circuit.name} from memory</div>
        ) : null}

      </div>

      {/* Under the comparison, not over it: the whole point of the result is
          seeing the two shapes, and an overlay would cover them. */}
      {phase === 'result' ? (
        <div className="tr-result">
          <div className="tr-result-top">
            <span className="tr-score">
              {score}
              <small>%</small>
            </span>
            <span className={`tr-rating${rating.good ? ' good' : ''}`}>{rating.label}</span>
          </div>
          <span className="tr-note">{rating.note}</span>
          <span className="tr-fact">{circuit.fact}</span>
        </div>
      ) : null}

      <div className="tr-foot">
        {phase === 'ready' ? (
          <button type="button" className="tr-btn" onClick={start}>
            Show me
          </button>
        ) : null}

        {phase === 'draw' ? (
          <button type="button" className="tr-btn" onClick={finish} disabled={!hasInk}>
            Done
          </button>
        ) : null}

        {phase === 'result' && mode === 'standalone' ? (
          <>
            <button type="button" className="tr-btn" onClick={() => again(false)}>
              Same circuit
            </button>
            <button type="button" className="tr-btn tr-btn-ghost" onClick={() => again(true)}>
              Another circuit
            </button>
          </>
        ) : null}

        {mode === 'standalone' && best !== null ? (
          <span className="tr-best">Best {best}%</span>
        ) : null}

        {phase === 'ready' ? (
          <span className="tr-hint">One attempt. The clock does not stop.</span>
        ) : null}
      </div>
    </div>
  );
}

/** A circuit other than the one just played, so "another" always changes it. */
function pick(not?: string): Circuit {
  const pool = not ? CIRCUITS.filter((c) => c.id !== not) : CIRCUITS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * One half of the comparison: a loop fitted to its box with a caption.
 *
 * The drawing is NOT closed, because the player's line is whatever they drew
 * and joining its ends would invent a stroke they did not make.
 */
function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pts: Pt[],
  colour: string,
  label: string,
  close = true
) {
  ctx.save();
  ctx.font = '600 11px "Barlow Condensed", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(153,163,175,0.85)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(label.toUpperCase(), x + w / 2, y + h - 14);

  if (pts.length >= 2) {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const pw = Math.max(1e-6, Math.max(...xs) - minX);
    const ph = Math.max(1e-6, Math.max(...ys) - minY);
    const pad = 0.16;
    const s = Math.min((w * (1 - pad)) / pw, (h * (1 - pad) - 22) / ph);
    const ox = x + (w - pw * s) / 2;
    const oy = y + (h - 22 - ph * s) / 2;
    trace(ctx, pts.map((p) => [ox + (p[0] - minX) * s, oy + (p[1] - minY) * s] as Pt), colour, 2.6, close);
  } else {
    ctx.fillStyle = 'rgba(84,93,105,0.9)';
    ctx.font = '400 12px Inter, system-ui, sans-serif';
    ctx.fillText('nothing drawn', x + w / 2, y + h / 2);
  }
  ctx.restore();
}

function trace(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  colour: string,
  width: number,
  close = true
) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, p: Pt, colour: string, r: number) {
  ctx.beginPath();
  ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
  ctx.fillStyle = colour;
  ctx.fill();
}

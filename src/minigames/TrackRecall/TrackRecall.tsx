import { useCallback, useEffect, useRef, useState } from 'react';
import { CIRCUITS, type Circuit } from './circuits';
import { boostFor, matchScore, ratingFor, type Pt } from './recallScore';
import { prepareRecallCard, shareRecallCard, type RecallShare } from './shareRecall';
import { trackExtra, trackShare } from '../../game/telemetry';
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
 *
 * One component, two contexts, as Lights Out does it:
 *
 *   mode="career"      one attempt, no retry, no share, hands back a
 *                      Qualifying boost. A "try again" here would turn a beat
 *                      in somebody's career into an arcade they never leave.
 *   mode="standalone"  retry forever, keeps a personal best, offers the card.
 */
export function TrackRecall({
  mode,
  onComplete,
  onExit
}: {
  mode: 'career' | 'standalone';
  onComplete?: (score: number) => void;
  /** Career only: leave the game. Standalone has its own replay buttons. */
  onExit?: () => void;
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
  const [sharing, setSharing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokes = useRef<Pt[][]>([]);
  const drawing = useRef(false);
  const raf = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  /**
   * The finished PNG, built the moment the round ends rather than when the
   * button is pressed. navigator.share() needs the click still to be live,
   * and a canvas draw spends it: the measured cost of getting this wrong was
   * a third of Android shares turning into silent file saves.
   */
  const prepared = useRef<{ file: File; renderMs: number } | null>(null);
  /** What the card shows, frozen at the end of the round. Null when there is nothing to share. */
  const shareable = useRef<RecallShare | null>(null);

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

      const { s, ox, oy } = view(w, h, circuit);
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
        panel(ctx, 0, 0, w / 2, h, [circuit.points], '#c8ff00', 'The circuit');
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(w / 2 + 0.5, h * 0.12);
        ctx.lineTo(w / 2 + 0.5, h * 0.88);
        ctx.stroke();
        panel(ctx, w / 2, 0, w / 2, h, strokes.current, '#f3f6f8', 'Yours', false);
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
        // Through the ref, not the closure. `start` is memoised, so the
        // `finish` it captured is the one from the render that created it —
        // which on first load is the render before the stored personal best
        // has been read, and that version happily overwrote a 100% best with
        // whatever the round scored.
        timers.current.push(window.setTimeout(() => finishRef.current(), DRAW_MS));
      }, STUDY_MS + LAP_MS + 400)
    );
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
    /**
     * Pre-render the share card.
     *
     * NO SCORE GATE, unlike Lights Out. There the number is a verdict on the
     * player and offering to broadcast a bad one is a taunt. Here the card is
     * two pictures, and a Monaco that came out like a sock is the funniest
     * thing this game produces — people want to send that. The only thing
     * worth withholding is a card with an empty panel on it.
     */
    prepared.current = null;
    shareable.current = null;
    if (mode === 'standalone' && strokes.current.some((k) => k.length >= 2)) {
      const payload: RecallShare = {
        circuit,
        // Copied, because the next round empties the live array and the
        // result screen is still showing this one.
        strokes: strokes.current.map((k) => [...k]),
        score: s,
        rating: ratingFor(s, circuit.name),
        best: best !== null && best > s ? best : undefined
      };
      shareable.current = payload;
      void prepareRecallCard(payload)
        .then((p) => {
          prepared.current = p;
        })
        .catch(() => {
          // No card: the button still works, it just renders on demand.
        });
    }

    onComplete?.(s);
  }, [best, circuit, clearTimers, mode, onComplete]);

  /** Always the current `finish`, for the draw timer to call. */
  const finishRef = useRef(finish);
  finishRef.current = finish;

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
    const r = e.currentTarget.getBoundingClientRect();
    const { s, ox, oy } = view(r.width, r.height, circuit);
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

          {/* What it was worth. Only in a career: standalone has no stats to
              move, and the percentage is already the result there. */}
          {mode === 'career' ? (
            boostFor(score) > 0 ? (
              <span className="tr-boost">
                +{boostFor(score)} Qualifying — you know where this lap goes
              </span>
            ) : (
              <span className="tr-boost tr-boost-zero">No bonus this time</span>
            )
          ) : null}

          {/*
            With the result, not down in the footer with the replay buttons.
            It was there first, and on a phone three buttons plus the personal
            best do not fit one row, so it wrapped underneath two lime buttons
            that read as "the buttons" and went unnoticed.

            Standalone only: inside a career this is one beat in somebody's
            story, and a share button there invites them to leave it.
          */}
          {mode === 'standalone' && hasInk ? (
            <button
              type="button"
              className="tr-share"
              disabled={sharing}
              onClick={async () => {
                const payload = shareable.current;
                if (sharing || !payload) return;
                setSharing(true);
                try {
                  // Whatever finish() managed to build. Passing nothing makes
                  // shareRecallCard render on demand, which is the slow path
                  // this is all arranged to avoid.
                  const trace = await shareRecallCard(payload, prepared.current ?? undefined);
                  trackShare(trace.result);
                  trackExtra('share_game', 'track-recall');
                  trackExtra('share_path', trace.path);
                  trackExtra('share_circuit', payload.circuit.id);
                  trackExtra('share_score', payload.score);
                  trackExtra('share_render_ms', trace.renderMs);
                  trackExtra('share_sheet_ms', trace.sheetMs);
                } finally {
                  setSharing(false);
                }
              }}
            >
              {sharing ? 'Sharing…' : 'Share both drawings'}
            </button>
          ) : null}
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

        {phase === 'result' && mode === 'career' ? (
          <button type="button" className="tr-btn" onClick={() => onExit?.()}>
            Continue career →
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
          <span className="tr-hint">
            {mode === 'career'
              ? 'One attempt. The clock does not stop.'
              : 'The clock does not stop. Play as often as you like.'}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Canvas mapping for the 0-100 circuit space.
 *
 * Scaled to the CIRCUIT'S OWN bounding box rather than the 0-100 box, because
 * every one of these is markedly landscape and sits in a band across the
 * middle of that box. Fitting the box instead left a third of a wide stage
 * empty and shrank the circuit to match — which mattered most for Suzuka,
 * where the figure-of-eight crossing is the whole point and was collapsing
 * into a smudge.
 *
 * paint() and toLocal() must agree on this, or a drawn line lands somewhere
 * other than under the finger.
 */
function view(w: number, h: number, c: Circuit) {
  const xs = c.points.map((p) => p[0]);
  const ys = c.points.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const bw = Math.max(...xs) - x0;
  const bh = Math.max(...ys) - y0;
  const s = Math.min((w * 0.92) / bw, (h * 0.92) / bh);
  return { s, ox: (w - bw * s) / 2 - x0 * s, oy: (h - bh * s) / 2 - y0 * s };
}

/**
 * A circuit other than the one just played, so "another" always changes it.
 *
 * `?circuit=suzuka` pins the first one, which is the only way to look at a
 * particular shape without reloading until it comes up.
 */
function pick(not?: string): Circuit {
  if (!not && typeof window !== 'undefined') {
    const want = new URLSearchParams(window.location.search).get('circuit');
    const forced = want && CIRCUITS.find((c) => c.id === want);
    if (forced) return forced;
  }
  const pool = not ? CIRCUITS.filter((c) => c.id !== not) : CIRCUITS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * One half of the comparison: a loop fitted to its box with a caption.
 *
 * The drawing is NOT closed, because the player's line is whatever they drew
 * and joining its ends would invent a stroke they did not make. Strokes are
 * kept apart for the same reason: a drawing made in three pen-downs should
 * not gain two straight lines joining wherever the pen lifted to wherever it
 * came back down. They share one fit, or a small correction in the corner
 * would be blown up to the size of the lap.
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
  close = true
) {
  const pts = strokes.flat();
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
    for (const stroke of strokes) {
      if (stroke.length < 2) continue;
      trace(ctx, stroke.map((p) => [ox + (p[0] - minX) * s, oy + (p[1] - minY) * s] as Pt), colour, 2.6, close);
    }
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

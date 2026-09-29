import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CORNERS,
  apexMs,
  entryMs,
  errorPhrase,
  metres,
  releasePenalty,
  scoreBraking,
  speedAfterBraking,
  totalScore,
  type Corner,
  type Verdict
} from './brakeLogic';
import './brakePoint.css';

type Phase = 'ready' | 'rolling' | 'braking' | 'turning' | 'result' | 'summary';

interface Round {
  corner: Corner;
  verdict: Verdict;
  releaseNote: string;
  finalScore: number;
}

/**
 * BRAKE POINT
 *
 * Four to eight seconds of a corner arriving too fast, and one decision.
 *
 * NO TARGET IS SHOWN BEFORE THE ATTEMPT. That is the whole design. A green
 * zone or a timing bar turns this into a rhythm game played against a marker;
 * the boards at 150, 100 and 50 are the only references, which is what a
 * driver actually has. The ideal point is revealed afterwards, next to yours,
 * because "I can go later than that" is the thought that starts the next run.
 *
 * PRESS AND HOLD. Press is the brake going on, hold is staying on it, release
 * is turning in. Two things get measured rather than one, and the pedal is a
 * thing you are doing rather than a thing you tapped.
 *
 * The simulation is driven from a wall clock inside the animation frame, not
 * from frame counts, so a slow phone gets the same physics as a fast one — it
 * just sees fewer pictures of it.
 */
export function BrakePoint({
  mode,
  rounds = CORNERS.length,
  onComplete
}: {
  mode: 'career' | 'standalone';
  /** Career gets one corner. Standalone gets all three. */
  rounds?: number;
  onComplete?: (scores: number[]) => void;
}) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [roundIndex, setRoundIndex] = useState(0);
  const [history, setHistory] = useState<Round[]>([]);
  const [hud, setHud] = useState({ kmh: 0, distance: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef<number | null>(null);

  // The whole simulation, kept in a ref. React state at 60fps would re-render
  // the tree every frame for numbers only the canvas and one readout need.
  const sim = useRef({
    distance: 0,
    speed: 0,
    braking: false,
    brakeAtM: 0,
    releaseSpeed: 0,
    last: 0,
    /** One attempt scores once. Reaching the corner and letting go can race. */
    settled: false
  });

  const corner = CORNERS[Math.min(roundIndex, CORNERS.length - 1)];
  const isLast = roundIndex >= rounds - 1;

  const stop = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  /**
   * Keep the canvas correct when nothing is running.
   *
   * A canvas without a width attribute is 300x150 whatever CSS says, and this
   * one was only ever sized inside the animation frame — so before the first
   * Go, and after any rotation or window resize, the track was a stretched
   * 300x150 buffer scaled up to fill the box. Drawing the starting frame here
   * means the corner is sitting there waiting before the run begins, which is
   * also a better invitation than an empty rectangle.
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const paintIdle = () => {
      if (raf.current !== null) return; // a run is drawing its own frames
      draw(canvas, corner, corner.runUpM, false);
    };
    paintIdle();
    const ro = new ResizeObserver(paintIdle);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [corner, phase]);

  // ---- the result of one attempt -------------------------------------------
  const settle = useCallback(
    (brakeAtM: number, releaseSpeed: number) => {
      if (sim.current.settled) return;
      sim.current.settled = true;
      const verdict = scoreBraking(corner, brakeAtM);
      const rel = releasePenalty(corner, releaseSpeed);
      const finalScore = Math.max(0, verdict.score - rel.penalty);
      setHistory((h) => [...h, { corner, verdict, releaseNote: rel.note, finalScore }]);
      setPhase('result');
    },
    [corner]
  );

  // ---- the loop -------------------------------------------------------------
  const frame = useCallback(
    (now: number) => {
      const s = sim.current;
      const dt = Math.min(0.05, (now - s.last) / 1000) || 0;
      s.last = now;

      if (s.braking) {
        s.speed = speedAfterBraking(s.speed, dt);
        // Sitting on the pedal past the point of usefulness ends the attempt.
        // Without this, braking early and never letting go means crawling the
        // last stretch at walking pace for several seconds with nothing left
        // to decide — a dead run the player has to sit through rather than a
        // result. Below 60% of the speed the corner can be taken at, the entry
        // is already thrown away, so the run is scored as it stands.
        if (s.speed <= apexMs(corner) * 0.6) {
          s.braking = false;
          stop();
          settle(s.brakeAtM, s.speed);
          return;
        }
      }
      s.distance -= s.speed * dt;

      if (s.distance <= 0) {
        s.distance = 0;
        s.braking = false;
        stop();
        // Arriving still on the brakes is not a failure — it is what braking
        // at the ideal point DOES, because the ideal point is the distance
        // that brings you to apex speed exactly at the corner. Only a run
        // where the pedal was never touched scores as never having braked.
        settle(s.brakeAtM > 0 ? s.brakeAtM : 0, s.speed);
        return;
      }

      setHud({ kmh: Math.round(s.speed * 3.6), distance: s.distance });
      draw(canvasRef.current, corner, s.distance, s.braking);
      raf.current = requestAnimationFrame(frame);
    },
    [corner, settle, stop]
  );

  const start = useCallback(() => {
    const s = sim.current;
    s.distance = corner.runUpM;
    s.speed = entryMs(corner);
    s.braking = false;
    s.brakeAtM = 0;
    s.releaseSpeed = 0;
    s.settled = false;
    s.last = performance.now();
    setHud({ kmh: Math.round(s.speed * 3.6), distance: s.distance });
    setPhase('rolling');
    stop();
    raf.current = requestAnimationFrame(frame);
  }, [corner, frame, stop]);

  // ---- input ---------------------------------------------------------------
  // Refs, not `phase`, for the same reason Lights Out uses them: state lands a
  // frame late and this is measured in metres travelled per millisecond.
  const pressBrake = useCallback(() => {
    const s = sim.current;
    if (s.braking || raf.current === null) return;
    s.braking = true;
    s.brakeAtM = s.distance;
    setPhase('braking');
  }, []);

  const releaseBrake = useCallback(() => {
    const s = sim.current;
    if (!s.braking || raf.current === null) return;
    s.braking = false;
    s.releaseSpeed = s.speed;
    stop();
    setPhase('turning');
    // A beat of the corner arriving before the verdict, so the result lands on
    // the end of the moment rather than interrupting it.
    window.setTimeout(() => settle(s.brakeAtM, s.releaseSpeed), 650);
  }, [settle, stop]);

  const nextRound = useCallback(() => {
    if (isLast) {
      const scores = history.map((h) => h.finalScore);
      setPhase('summary');
      onComplete?.(scores);
      return;
    }
    setRoundIndex((i) => i + 1);
    setPhase('ready');
  }, [history, isLast, onComplete]);

  const restart = useCallback(() => {
    setHistory([]);
    setRoundIndex(0);
    setPhase('ready');
  }, []);

  const last = history[history.length - 1];
  const armed = phase === 'rolling' || phase === 'braking';

  return (
    <div className={`bp bp-${phase}`}>
      <div className="bp-head">
        <span className="bp-title">Brake Point</span>
        <span className="bp-sub">
          {mode === 'career'
            ? 'One corner'
            : `Corner ${Math.min(roundIndex + 1, rounds)} of ${rounds} · ${corner.label}`}
        </span>
      </div>

      <div className="bp-stage">
        <canvas ref={canvasRef} className="bp-canvas" />

        {/* Only while there is something to read it against. Left up behind a
            result, the last speed shows through the overlay and reads as part
            of the score. */}
        {armed || phase === 'turning' ? (
          <div className="bp-hud">
            <span className="bp-kmh">
              {hud.kmh}
              <small>KM/H</small>
            </span>
            <span className="bp-corner-name">{corner.name}</span>
          </div>
        ) : null}

        {phase === 'ready' ? (
          <div className="bp-overlay">
            <span className="bp-overlay-name">{corner.name}</span>
            <span className="bp-overlay-note">{corner.note}</span>
            <span className="bp-overlay-hint">
              No target, no marker. The boards are all you get.
            </span>
          </div>
        ) : null}

        {phase === 'turning' ? <div className="bp-overlay bp-turning">Turning in…</div> : null}

        {phase === 'result' && last ? (
          <div className="bp-overlay bp-result">
            <span className="bp-result-m">{metres(last.verdict.brakeAtM)}</span>
            <span className="bp-result-delta">{errorPhrase(last.verdict.errorM)}</span>
            <span className={`bp-result-band bp-band-${last.verdict.band}`}>
              {last.verdict.label}
            </span>
            <span className="bp-result-note">{last.verdict.note}</span>
            {last.releaseNote ? <span className="bp-result-note">{last.releaseNote}</span> : null}

            <BrakeDiagram verdict={last.verdict} corner={last.corner} />

            <span className="bp-result-lost">
              {last.verdict.lostS >= 0.005 ? `You gave away ${last.verdict.lostS.toFixed(2)}s` : 'No time lost'}
            </span>
            <span className="bp-result-score">
              {last.finalScore}
              <small>/100</small>
            </span>
          </div>
        ) : null}

        {phase === 'summary' ? (
          <div className="bp-overlay bp-summary">
            <span className="bp-overlay-name">Braking score</span>
            <span className="bp-result-m">{totalScore(history.map((h) => h.finalScore))}</span>
            <span className="bp-result-note">
              Average error{' '}
              {(
                history.reduce((a, h) => a + Math.abs(h.verdict.errorM), 0) / (history.length || 1)
              ).toFixed(1)}
              m
            </span>
            <div className="bp-summary-rows">
              {history.map((h, i) => (
                <div className="bp-summary-row" key={h.corner.id + i}>
                  <span>{h.corner.label}</span>
                  <span className="bp-summary-mid">{errorPhrase(h.verdict.errorM)}</span>
                  <span className="bp-summary-score">{h.finalScore}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* The pedal. Full width and tall, because on a phone the thing being
          tested must not also be a test of where your thumb is. */}
      <button
        type="button"
        className="bp-pedal"
        disabled={phase === 'ready' || phase === 'turning' || phase === 'result' || phase === 'summary'}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          pressBrake();
        }}
        onPointerUp={releaseBrake}
        onPointerCancel={releaseBrake}
        onKeyDown={(e) => {
          if (e.key !== ' ' && e.key !== 'Enter') return;
          e.preventDefault();
          if (e.repeat) return;
          pressBrake();
        }}
        onKeyUp={(e) => {
          if (e.key !== ' ' && e.key !== 'Enter') return;
          e.preventDefault();
          releaseBrake();
        }}
        onBlur={releaseBrake}
      >
        {phase === 'braking' ? 'BRAKING — release to turn in' : 'HOLD TO BRAKE'}
      </button>

      <div className="bp-foot">
        {phase === 'ready' ? (
          <button type="button" className="bp-btn" onClick={start}>
            {roundIndex === 0 && history.length === 0 ? 'Go' : 'Next corner'}
          </button>
        ) : null}

        {phase === 'result' ? (
          <button type="button" className="bp-btn" onClick={nextRound}>
            {isLast ? 'See score' : 'Next corner'}
          </button>
        ) : null}

        {phase === 'summary' && mode === 'standalone' ? (
          <button type="button" className="bp-btn" onClick={restart}>
            Run it again
          </button>
        ) : null}

        {phase === 'ready' ? (
          <span className="bp-hint">
            Hold the pedal down as late as you dare, then let go to turn in.
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Your point against the ideal one, on a strip of the braking zone.
 *
 * Shown only after the attempt. It is the part that makes somebody press Go
 * again: seeing thirteen metres of unused road is a more persuasive argument
 * than any number.
 */
function BrakeDiagram({ verdict, corner }: { verdict: Verdict; corner: Corner }) {
  const span = Math.max(verdict.brakeAtM, verdict.idealM) * 1.15 + 10;
  const pos = (m: number) => `${100 - (m / span) * 100}%`;
  const late = verdict.errorM < 0;
  return (
    <div className="bp-diagram" aria-hidden="true">
      <div className="bp-diagram-track">
        <span className="bp-diagram-ideal" style={{ left: pos(verdict.idealM) }} />
        <span
          className={`bp-diagram-you${late ? ' late' : ''}`}
          style={{ left: pos(verdict.brakeAtM) }}
        />
      </div>
      <div className="bp-diagram-key">
        <span>
          <i className="bp-key-you" /> you {metres(verdict.brakeAtM)}
        </span>
        <span>
          <i className="bp-key-ideal" /> ideal {metres(verdict.idealM)}
        </span>
        <span className="bp-diagram-corner">{corner.name}</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * The view.
 *
 * A pinhole projection rather than anything clever: a point `z` metres ahead
 * and `x` metres to the side lands at (f·x/z, horizon + f·h/z). That is enough
 * for a road to rush at you convincingly, and it keeps the braking boards
 * growing at the rate real ones would, which is the only cue the player has.
 *
 * DELIBERATELY EXAGGERATED IN TWO PLACES. Real braking boards are about 1.5m
 * tall, which on a phone-sized canvas at 100m is four pixels and unreadable —
 * the one reference the game gives you cannot be the thing you cannot see. And
 * real posts are further apart than these. Both are scaled for a screen this
 * size; everything that is measured stays honest.
 * ------------------------------------------------------------------------- */

const CAM_H = 1.15; // eye height, metres
const ROAD_HALF = 7; // metres
const BOARD_H = 3.6; // metres, exaggerated for legibility
const NEAR = 1.2; // metres; low enough that the road reaches the bottom edge

function draw(canvas: HTMLCanvasElement | null, corner: Corner, distance: number, braking: boolean) {
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
  // Braking pitches the nose down, which lifts the horizon. A few pixels, and
  // the only confirmation the pedal did anything.
  const horizon = H * 0.38 + (braking ? H * 0.04 : 0);
  const f = H * 1.25;
  const cx = W / 2;

  const px = (z: number, x: number) => cx + (f * x) / z + bend(z, distance);
  const py = (z: number) => horizon + (f * CAM_H) / z;

  // ---- sky and ground ------------------------------------------------------
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#070c12');
  sky.addColorStop(1, '#1b2836');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon + 1);

  const ground = ctx.createLinearGradient(0, horizon, 0, H);
  ground.addColorStop(0, '#0e1319');
  ground.addColorStop(1, '#070a0e');
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, W, H - horizon);

  const far = Math.min(distance + 90, 460);
  const stepFor = (z: number) => (z < 20 ? 1 : z < 80 ? 3 : 8);

  // ---- road ----------------------------------------------------------------
  ctx.beginPath();
  for (let z = NEAR; z <= far; z += stepFor(z)) ctx.lineTo(px(z, -ROAD_HALF), py(z));
  for (let z = far; z >= NEAR; z -= stepFor(z)) ctx.lineTo(px(z, ROAD_HALF), py(z));
  ctx.closePath();
  const tarmac = ctx.createLinearGradient(0, horizon, 0, H);
  tarmac.addColorStop(0, '#2b333c');
  tarmac.addColorStop(1, '#161b21');
  ctx.fillStyle = tarmac;
  ctx.fill();

  // ---- white edge lines ----------------------------------------------------
  for (const side of [-1, 1]) {
    ctx.beginPath();
    for (let z = NEAR; z <= far; z += stepFor(z)) ctx.lineTo(px(z, side * (ROAD_HALF - 0.4)), py(z));
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // ---- centre dashes, anchored to world position ---------------------------
  // Tied to distance travelled rather than to frames, so they stream at the
  // speed the car is actually doing instead of the speed the phone can draw.
  const travelled = corner.runUpM - distance;
  const spacing = 16;
  const phase = travelled % spacing;
  for (let i = 0; i < 40; i++) {
    const z0 = i * spacing + (spacing - phase);
    if (z0 < NEAR || z0 > far) continue;
    const z1 = z0 + 6;
    ctx.beginPath();
    ctx.moveTo(px(z0, 0), py(z0));
    ctx.lineTo(px(Math.min(z1, far), 0), py(Math.min(z1, far)));
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = Math.max(1.5, 40 / z0);
    ctx.stroke();
  }

  // ---- barrier posts: the strongest speed cue there is ---------------------
  const postGap = 12;
  const postPhase = travelled % postGap;
  for (let i = 0; i < 44; i++) {
    const z = i * postGap + (postGap - postPhase);
    if (z < NEAR || z > far) continue;
    const h = (f * 1.0) / z;
    if (h < 1.5) continue;
    for (const side of [-1, 1]) {
      const x = px(z, side * (ROAD_HALF + 1.6));
      const yb = py(z);
      ctx.fillStyle = i % 2 ? '#39424c' : '#5b6874';
      ctx.fillRect(x - Math.max(1, h * 0.12), yb - h, Math.max(1.5, h * 0.24), h);
    }
  }

  // ---- braking boards ------------------------------------------------------
  for (const board of [150, 100, 50]) {
    const z = distance - board;
    if (z < NEAR || z > far) continue;
    drawBoard(ctx, px, py, f, z, String(board));
  }

  // ---- the corner ----------------------------------------------------------
  if (distance > NEAR && distance < far) {
    const z = distance;
    const yk = py(z);
    const lx = px(z, -ROAD_HALF);
    const rx = px(z, ROAD_HALF);
    const kerbH = Math.max(3, (f * 0.35) / z);
    const seg = 10;
    for (let i = 0; i < seg; i++) {
      ctx.fillStyle = i % 2 ? '#f1f1f1' : '#d21f1f';
      const x0 = lx + ((rx - lx) * i) / seg;
      const x1 = lx + ((rx - lx) * (i + 1)) / seg;
      ctx.fillRect(x0, yk - kerbH, x1 - x0 + 1, kerbH);
    }
    // A wall behind it, so the corner reads as somewhere you must slow for
    // rather than a stripe painted on the road.
    const wallH = Math.max(4, (f * 1.6) / z);
    ctx.fillStyle = 'rgba(18,23,29,0.92)';
    ctx.fillRect(lx - 40, yk - kerbH - wallH, rx - lx + 80, wallH);
    ctx.fillStyle = '#c8ff00';
    ctx.fillRect(lx - 40, yk - kerbH - wallH, rx - lx + 80, Math.max(1.5, wallH * 0.07));
  }
}

/** The road swings away after the corner, so there is something to turn into. */
function bend(z: number, distance: number): number {
  if (z <= distance) return 0;
  const past = z - distance;
  return -Math.min(420, past * past * 0.05);
}

function drawBoard(
  ctx: CanvasRenderingContext2D,
  px: (z: number, x: number) => number,
  py: (z: number) => number,
  f: number,
  z: number,
  text: string
) {
  const h = (f * BOARD_H) / z;
  if (h < 4) return;
  const w = h * 0.72;
  const groundY = py(z);
  const x = px(z, ROAD_HALF + 2.4) - w / 2;
  const panelH = h * 0.62;
  const postH = h * 0.38;
  const y = groundY - h;

  // Post
  ctx.fillStyle = '#4a545f';
  ctx.fillRect(x + w / 2 - Math.max(1, w * 0.05), groundY - postH, Math.max(2, w * 0.1), postH);

  // Panel
  ctx.fillStyle = '#05070a';
  ctx.fillRect(x - 1.5, y - 1.5, w + 3, panelH + 3);
  ctx.fillStyle = '#f3f6f8';
  ctx.fillRect(x, y, w, panelH);

  ctx.fillStyle = '#05070a';
  ctx.font = `700 ${Math.max(6, panelH * 0.62)}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + panelH / 2 + panelH * 0.03);
}

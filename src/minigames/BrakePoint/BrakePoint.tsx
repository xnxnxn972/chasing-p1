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
import { drawTrack } from './view';
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
      drawTrack(canvas, corner, {
        distance: corner.runUpM,
        speed: entryMs(corner),
        braking: false,
        brakeAtM: 0
      });
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
      drawTrack(canvasRef.current, corner, {
        distance: s.distance,
        speed: s.speed,
        braking: s.braking,
        brakeAtM: s.brakeAtM
      });
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
            {/* Teaches the technique without naming the answer. "No target,
                no marker" was accurate and useless: it told the player what
                they did not have instead of what to do with what they did. */}
            <span className="bp-overlay-hint">
              The boards count down to the corner. Pick one and brake at it.
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

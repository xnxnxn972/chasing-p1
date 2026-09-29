import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HOLD_MIN_MS,
  LIGHT_COUNT,
  LIGHT_STEP_MS,
  formatTime,
  holdMs,
  jumpStart,
  resultFor,
  type Result
} from './gameLogic';
import './lightsOut.css';

type Phase = 'ready' | 'lighting' | 'holding' | 'out' | 'done';

/**
 * LIGHTS OUT
 *
 * One component, two contexts, as agreed:
 *
 *   mode="career"      one attempt, no retry, hands back a Racecraft boost.
 *                      A "play again" here would turn a ten-second beat in
 *                      somebody's career into an arcade they never leave.
 *   mode="standalone"  retry forever, keeps a personal best.
 *
 * TIMING. The clock is `performance.now()` taken in the event handler, not
 * React state. State updates are batched and can land a frame or more after
 * the event, which at 60fps is 16ms of invented reaction time — roughly the
 * difference between two of the rating bands. The lights-out instant is
 * likewise stamped in the timeout that clears them, before any render.
 *
 * INPUT. Pointer, keyboard and touch all route through one handler. The
 * surface is a real <button> so that the space bar, which is what anyone will
 * reach for, works without a keydown listener on the document.
 */
export function LightsOut({
  mode,
  onComplete,
  onExit
}: {
  mode: 'career' | 'standalone';
  onComplete?: (result: Result) => void;
  /** Standalone only: leave the game. Career mode has no way out but playing. */
  onExit?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [lit, setLit] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [best, setBest] = useState<number | null>(null);

  // Wall-clock instant the lights went out, and whether a round is in progress.
  //
  // BOTH ARE REFS, AND THE INPUT HANDLER READS ONLY THESE — never `phase`.
  // React state lands on the next render, which is up to a frame behind the
  // timeout that actually put the lights out. Classifying a tap by `phase`
  // therefore calls a genuinely fast reaction a jump start whenever the render
  // has not caught up, which on a mid-range phone is most of them. Refs are
  // written synchronously inside the timeout, so the handler always sees the
  // true state of the grid. `phase` still drives what is drawn; it just does
  // not decide what happened.
  const outAt = useRef<number | null>(null);
  const running = useRef(false);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // Personal best, standalone only. Career mode is one attempt, so there is
  // nothing to beat and showing a best would imply otherwise.
  useEffect(() => {
    if (mode !== 'standalone') return;
    try {
      const raw = window.localStorage.getItem('cp1.lightsOut.best');
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n) && n > 0) setBest(n);
    } catch {
      // Private window or blocked storage. A missing best is not an error.
    }
  }, [mode]);

  const start = useCallback(() => {
    clearTimers();
    setResult(null);
    setLit(0);
    setPhase('lighting');
    outAt.current = null;
    running.current = true;

    for (let i = 1; i <= LIGHT_COUNT; i += 1) {
      timers.current.push(
        window.setTimeout(() => {
          setLit(i);
          if (i === LIGHT_COUNT) setPhase('holding');
        }, i * LIGHT_STEP_MS)
      );
    }

    timers.current.push(
      window.setTimeout(() => {
        // Stamped here, in the timeout that puts the lights out, so the
        // measured time cannot include React's render of that change.
        outAt.current = performance.now();
        setLit(0);
        setPhase('out');
      }, LIGHT_COUNT * LIGHT_STEP_MS + holdMs())
    );
  }, [clearTimers]);

  const finish = useCallback(
    (r: Result) => {
      clearTimers();
      running.current = false;
      setResult(r);
      setPhase('done');
      if (mode === 'standalone' && r.ms !== null && (best === null || r.ms < best)) {
        setBest(r.ms);
        try {
          window.localStorage.setItem('cp1.lightsOut.best', String(r.ms));
        } catch {
          // Not being able to remember a best time is not worth failing over.
        }
      }
      onComplete?.(r);
    },
    [best, clearTimers, mode, onComplete]
  );

  const press = useCallback(() => {
    // Read the clock FIRST. Anything done before this — a branch, a state
    // read — is time charged to the player's reaction.
    const now = performance.now();

    // No round in progress: this is a start. Covers both the first play and,
    // in standalone mode, tapping the surface again after a result. In career
    // mode the surface is disabled once done, so this cannot restart a career
    // attempt.
    if (!running.current) {
      start();
      return;
    }
    // Round running but the lights are still on.
    if (outAt.current === null) {
      finish(jumpStart());
      return;
    }
    finish(resultFor(Math.round(now - outAt.current), mode));
  }, [finish, mode, start]);

  const armed = phase === 'lighting' || phase === 'holding' || phase === 'out';
  const canReplay = mode === 'standalone';

  return (
    <div className={`lo lo-${phase}`} data-mode={mode}>
      <div className="lo-head">
        <span className="lo-title">Lights Out</span>
        <span className="lo-sub">{mode === 'career' ? 'One attempt' : 'Reaction test'}</span>
      </div>

      <div className="lo-gantry" aria-hidden="true">
        {Array.from({ length: LIGHT_COUNT }, (_, i) => (
          <span key={i} className={`lo-light${i < lit ? ' on' : ''}`} />
        ))}
      </div>

      <button
        type="button"
        className="lo-surface"
        onPointerDown={press}
        onKeyDown={(e) => {
          // Space and Enter would otherwise fire click on key-UP, which adds
          // the time the key was held to the reaction.
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            press();
          }
        }}
        disabled={phase === 'done' && !canReplay}
      >
        {phase === 'ready' ? <span className="lo-cue">Tap to start</span> : null}
        {phase === 'lighting' ? <span className="lo-cue dim">Wait…</span> : null}
        {phase === 'holding' ? <span className="lo-cue dim">Wait…</span> : null}
        {phase === 'out' ? <span className="lo-cue go">GO</span> : null}
        {phase === 'done' && result ? (
          <span className="lo-out">
            <span className="lo-time">{result.ms === null ? '—' : formatTime(result.ms)}</span>
            <span className={`lo-band lo-band-${result.rating.band}`}>{result.rating.label}</span>
            {result.rating.note ? <span className="lo-note">{result.rating.note}</span> : null}
            {result.boost > 0 ? (
              <span className="lo-boost">+{result.boost} Racecraft for your next race</span>
            ) : null}
            {mode === 'career' && result.boost === 0 ? (
              <span className="lo-boost lo-boost-zero">No bonus this time</span>
            ) : null}
          </span>
        ) : null}
      </button>

      <div className="lo-foot">
        {phase === 'done' && mode === 'career' ? (
          <button type="button" className="lo-btn" onClick={() => onExit?.()}>
            Continue career →
          </button>
        ) : null}

        {phase === 'done' && canReplay ? (
          <button type="button" className="lo-btn" onClick={start}>
            Try again
          </button>
        ) : null}

        {mode === 'standalone' && best !== null ? (
          <span className="lo-best">Best {formatTime(best)}</span>
        ) : null}

        {!armed && phase !== 'done' ? (
          <span className="lo-hint">
            Five lights, then they go out. Tap the moment they do. Going early is a jump start.
          </span>
        ) : null}

        {phase === 'out' || phase === 'holding' || phase === 'lighting' ? (
          <span className="lo-hint">
            Hold. The lights go out between {HOLD_MIN_MS / 1000}s and 3s after the fifth.
          </span>
        ) : null}
      </div>
    </div>
  );
}

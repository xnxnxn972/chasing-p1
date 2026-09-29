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
 * THE MECHANIC IS HOLD-AND-RELEASE. The player holds the clutch while the
 * lights come on and lets go when they go out, because that is what a driver
 * actually does: already in first at pre-start revs, dropping the clutch to
 * its bite point. Releasing while the lights are still on is a jump start,
 * which means anticipation is caught by the rules of the game rather than by
 * a special case.
 *
 * TIMING. The clock is `performance.now()` taken in the event handler, not
 * React state. State updates are batched and can land a frame or more after
 * the event, which at 60fps is 16ms of invented reaction time — roughly the
 * difference between two of the rating bands. The lights-out instant is
 * likewise stamped in the timeout that clears them, before any render.
 *
 * INPUT. The surface is a real <button>, so the space bar works without a
 * document listener. Pointer capture is taken on press: a finger that slides
 * off the button mid-hold must still deliver its release here, or letting go
 * would never be seen and the round would hang.
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

  /** Back to the grid, clutch out, nothing running. */
  const reset = useCallback(() => {
    clearTimers();
    running.current = false;
    outAt.current = null;
    setResult(null);
    setLit(0);
    setPhase('ready');
  }, [clearTimers]);

  /**
   * Clutch in. Starts the sequence; the lights do not begin until the player
   * is actually holding, so nobody can set off the countdown and then get
   * their finger ready at leisure.
   */
  const pressDown = useCallback(() => {
    if (running.current) return; // already holding; key repeat lands here
    start();
  }, [start]);

  /**
   * Clutch out. This is the measured event.
   *
   * Reads the clock before anything else: a branch or a state read taken
   * first is time charged to the player's reaction. Decides from refs only,
   * never from `phase`, for the reason given where those refs are declared.
   */
  const release = useCallback(() => {
    const now = performance.now();
    if (!running.current) return; // not holding: nothing to release
    if (outAt.current === null) {
      finish(jumpStart()); // let go while the lights were still on
      return;
    }
    finish(resultFor(Math.round(now - outAt.current), mode));
  }, [finish, mode]);

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
        onPointerDown={(e) => {
          // Keep receiving this pointer even if the finger slides off the
          // button. Without capture, a release outside the element never
          // reaches us and the round hangs with the clutch still in.
          e.currentTarget.setPointerCapture?.(e.pointerId);
          pressDown();
        }}
        onPointerUp={release}
        // A cancelled pointer — a system gesture, a call arriving — is a
        // release as far as the car is concerned. Better to score it than to
        // leave the player holding a button that is no longer listening.
        onPointerCancel={release}
        onKeyDown={(e) => {
          if (e.key !== ' ' && e.key !== 'Enter') return;
          // Holding a key fires keydown repeatedly; only the first is a press.
          if (e.repeat) {
            e.preventDefault();
            return;
          }
          // Space would otherwise also fire click on key-up and double-handle.
          e.preventDefault();
          pressDown();
        }}
        onKeyUp={(e) => {
          if (e.key !== ' ' && e.key !== 'Enter') return;
          e.preventDefault();
          release();
        }}
        // Losing focus mid-hold (alt-tab) can swallow the keyup, which would
        // leave the round running for ever.
        onBlur={release}
        disabled={phase === 'done' && !canReplay}
      >
        {phase === 'ready' ? <span className="lo-cue">Hold the clutch</span> : null}
        {phase === 'lighting' ? <span className="lo-cue dim">Hold…</span> : null}
        {phase === 'holding' ? <span className="lo-cue dim">Hold…</span> : null}
        {phase === 'out' ? <span className="lo-cue go">RELEASE</span> : null}
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
          // Resets to 'ready' rather than starting a round: the next round has
          // to begin with the player pressing and holding, or they would be
          // counted as having jumped a start they never began.
          <button type="button" className="lo-btn" onClick={reset}>
            Try again
          </button>
        ) : null}

        {mode === 'standalone' && best !== null ? (
          <span className="lo-best">Best {formatTime(best)}</span>
        ) : null}

        {!armed && phase !== 'done' ? (
          <span className="lo-hint">
            Press and hold. Five lights come on. Let go the instant they go out. Letting go
            early is a jump start.
          </span>
        ) : null}

        {armed ? (
          <span className="lo-hint">
            Keep holding. They go out between {HOLD_MIN_MS / 1000}s and 3s after the fifth
            light.
          </span>
        ) : null}
      </div>
    </div>
  );
}

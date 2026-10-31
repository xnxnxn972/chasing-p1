import { useEffect, useMemo, useRef, useState } from 'react';
import type { InPlayFace, PendingRedFlag } from '../game/types';
import { DecisionCard } from './StepCard';

/**
 * The board a red flag arrives on.
 *
 * It rolls through everything this career has left in play and stops on one.
 * What it stops on is an ordinary decision card, which is why this component
 * hands straight over to DecisionCard rather than reimplementing any of it.
 *
 * The suspense is the point and the length is the cost of it, so: one fixed
 * 2.4s for every red flag, no first-time-longer, and a tap anywhere snaps it
 * home. Two a career means a long sitting spends about twenty seconds here.
 */
const SPIN_MS = 2400;
const SNAP_MS = 180;
const PASSES = 5;
/** Rows visible in the window. The result sits in the middle one. */
const WINDOW_ROWS = 3;

/**
 * The one the board goes past last, so the player sees what they nearly got.
 *
 * The oldest trick a slot machine has, and it only earns a place here
 * because everything on this board is genuinely in play: the near miss
 * really could have landed. A career with nothing else in play gets no near
 * miss rather than a fabricated one.
 */
function nearMiss(inPlay: InPlayFace[], result: InPlayFace): InPlayFace | null {
  const others = inPlay.filter((f) => f.name !== result.name);
  if (others.length === 0) return null;
  const rank = (f: InPlayFace) =>
    f.group === 'The way up' ? 3 : f.group === 'The reckoning' ? 2 : 1;
  return others.reduce((a, b) => (rank(b) > rank(a) ? b : a));
}

function shuffle<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function RedFlagBoard({
  step,
  onChoose
}: {
  step: PendingRedFlag;
  onChoose: (optionId: string) => void;
}) {
  const [landed, setLanded] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const anim = useRef<Animation | null>(null);

  const result: InPlayFace = useMemo(
    () => ({ name: step.decision.title, group: step.decision.tag }),
    [step.decision.title, step.decision.tag]
  );

  /** The strip, with the result at a known index so the travel is known. */
  const { rows, resultIndex } = useMemo(() => {
    const out: InPlayFace[] = [];
    for (let p = 0; p < PASSES; p++) out.push(...shuffle(step.inPlay));
    const near = nearMiss(step.inPlay, result);
    if (near) out.push(near);
    const index = out.length;
    out.push(result);
    // The rows under the payline must not repeat what just landed: the same
    // name twice, one above the other, reads as a rendering fault.
    const tail = shuffle(step.inPlay).filter((f) => f.name !== result.name);
    out.push(...tail.slice(0, WINDOW_ROWS - 1));
    return { rows: out, resultIndex: index };
  }, [step.inPlay, result]);

  useEffect(() => {
    const strip = stripRef.current;
    const first = strip?.firstElementChild as HTMLElement | null;
    if (!strip || !first) return;

    const rowH = first.getBoundingClientRect().height;
    const dist = (resultIndex - 1) * rowH;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      strip.style.transform = `translate3d(0,${-dist}px,0)`;
      const t = window.setTimeout(() => setLanded(true), 220);
      return () => window.clearTimeout(t);
    }

    // Fast roll, long deceleration from about halfway — the only window the
    // near miss can be read in — then a 0.28-row overshoot that resolves
    // exactly on the last frame, so the stop reads as something arriving
    // rather than a value being assigned. Blur is scaled to how fast the
    // strip is actually travelling, so a longer roll is calmer and not just
    // slower. Transform and filter only, which holds up on a phone.
    const frames: Keyframe[] = [];
    const N = 72;
    const peak = Math.max(0.6, Math.min(6, ((3.4 * dist) / SPIN_MS) * 16.7 / 20));
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const eased = 1 - Math.pow(1 - t, 3.4);
      const u = Math.min(1, Math.max(0, (t - 0.8) / 0.2));
      const over = Math.sin(Math.PI * u) * 0.28 * rowH;
      frames.push({
        transform: `translate3d(0,${-(eased * dist) - over}px,0)`,
        filter: `blur(${(peak * Math.pow(1 - t, 1.25)).toFixed(2)}px)`,
        offset: t
      });
    }

    const a = strip.animate(frames, { duration: SPIN_MS, easing: 'linear', fill: 'forwards' });
    anim.current = a;
    a.onfinish = () => {
      anim.current = null;
      setLanded(true);
      if (navigator.vibrate) {
        try {
          navigator.vibrate(12);
        } catch {
          /* a phone that will not buzz is not a problem worth handling */
        }
      }
    };
    return () => {
      a.onfinish = null;
      a.cancel();
      anim.current = null;
    };
  }, [resultIndex, rows]);

  /** Tap anywhere to bring it home early. The valve for the tenth one. */
  const skip = () => {
    const a = anim.current;
    const strip = stripRef.current;
    if (!a || !strip) return;
    a.onfinish = null;
    const current = getComputedStyle(strip).transform;
    const end = (a.effect as KeyframeEffect).getKeyframes().slice(-1)[0].transform as string;
    a.cancel();
    anim.current = null;
    strip.style.transform = current;
    const snap = strip.animate(
      [
        { transform: current, filter: 'blur(2px)' },
        { transform: end, filter: 'blur(0px)' }
      ],
      { duration: SNAP_MS, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'forwards' }
    );
    snap.onfinish = () => setLanded(true);
  };

  return (
    <>
      <section className="panel panel-pad redflag" aria-live="polite">
        <div className="redflag-head">{landed ? step.decision.tag : 'Red flag · stand by'}</div>
        <div
          className={`redflag-window${landed ? ' is-landed' : ''}`}
          onClick={skip}
          role="presentation"
        >
          <div className="redflag-strip" ref={stripRef}>
            {rows.map((face, i) => (
              <div
                key={`${face.name}-${i}`}
                className={`redflag-row${i === resultIndex ? ' is-result' : ''}`}
              >
                <div className="redflag-name">{face.name}</div>
                <div className="redflag-group">{face.group}</div>
              </div>
            ))}
          </div>
          <div className="redflag-payline" />
        </div>
        <div className={`redflag-skip${landed ? '' : ' is-live'}`}>
          {landed ? '' : 'Tap to skip'}
        </div>
      </section>

      {landed ? <DecisionCard step={step.decision} onChoose={onChoose} /> : null}
    </>
  );
}

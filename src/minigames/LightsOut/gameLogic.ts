/**
 * LIGHTS OUT — the logic, with no React in it.
 *
 * Five red lights come on a second apart, hold for an unpredictable moment,
 * then go out together. The clock starts when they go out.
 *
 * Everything here is pure so the interesting parts can be tested without
 * rendering anything: the component owns timers and DOM, this file owns what
 * counts as a jump start, what a time is worth, and what it is called.
 */

/** Five lights, one per second, as on the gantry. */
export const LIGHT_COUNT = 5;
export const LIGHT_STEP_MS = 1000;

/**
 * How long the lights stay on before going out. In Formula 1 the delay is at
 * the starter's discretion within roughly 0.2 to 3 seconds, and that range is
 * the whole game: short enough that you cannot relax, long enough that you
 * cannot count.
 */
export const HOLD_MIN_MS = 200;
export const HOLD_MAX_MS = 3000;

/**
 * The FIA treats anything under 0.1s as a jump start, on the grounds that no
 * human reacts that fast — a driver who appears to has anticipated, not
 * reacted. Borrowing the real threshold means the cheat is caught by the same
 * rule that catches it on a real grid, rather than by a number picked here.
 */
export const JUMP_THRESHOLD_MS = 100;

export type Band = 'jump' | 'lightning' | 'great' | 'good' | 'slow' | 'asleep';

export interface Rating {
  band: Band;
  /** Shown large, under the time. */
  label: string;
  /** One line of context. Empty when the label says enough. */
  note: string;
}

export interface Result {
  /** Milliseconds from lights out to input. Null when they went too early. */
  ms: number | null;
  jumpStart: boolean;
  rating: Rating;
  /** Racecraft added in career mode. Always 0 outside it. */
  boost: number;
}

/**
 * A jumped start is its own outcome, not a very bad time. `early` covers both
 * ways of getting it wrong: acting while the lights are still coming on, and
 * acting so soon after they go out that it cannot have been a reaction.
 */
export function jumpStart(): Result {
  return {
    ms: null,
    jumpStart: true,
    rating: {
      band: 'jump',
      label: 'Jump start',
      note: 'You went before the lights did. On a real grid that is a five-second penalty.'
    },
    boost: 0
  };
}

/**
 * Bands are set against real reaction times rather than to make the player
 * feel good. An alert human is around 0.20–0.25s, F1 drivers cluster near
 * 0.2s, and anything under 0.15s off a genuine reaction is exceptional.
 */
export function rate(ms: number): Rating {
  if (ms < JUMP_THRESHOLD_MS) {
    return { band: 'jump', label: 'Jump start', note: 'Nobody reacts that fast. You guessed.' };
  }
  if (ms < 200) {
    return { band: 'lightning', label: 'Lightning', note: 'Quicker than most of the grid.' };
  }
  if (ms < 250) {
    return { band: 'great', label: 'Great start', note: 'Front-row reactions.' };
  }
  if (ms < 320) {
    return { band: 'good', label: 'Good start', note: 'You held your position.' };
  }
  if (ms < 450) {
    return { band: 'slow', label: 'Slow getaway', note: 'Two cars came past before turn one.' };
  }
  return { band: 'asleep', label: 'Asleep', note: 'The pack is gone.' };
}

/**
 * Racecraft awarded in career mode.
 *
 * Deliberately tiny. Driver stats run 0–100 and a whole season of development
 * moves them by a few points, so a start worth +5 would make the minigame a
 * better way to build a driver than racing, which is the opposite of the point.
 * The ceiling is +2, it is reachable only under 0.2s, and most plays are worth
 * nothing at all. If this ever needs retuning, retune it here: nothing else
 * knows the numbers.
 */
export function boostFor(band: Band): number {
  switch (band) {
    case 'lightning':
      return 2;
    case 'great':
    case 'good':
      return 1;
    default:
      return 0;
  }
}

export function resultFor(ms: number, mode: 'career' | 'standalone'): Result {
  const rating = rate(ms);
  if (rating.band === 'jump') return jumpStart();
  return {
    ms,
    jumpStart: false,
    rating,
    boost: mode === 'career' ? boostFor(rating.band) : 0
  };
}

/** Hold length for one round. Takes the generator so a test can pin it. */
export function holdMs(random: () => number = Math.random): number {
  return HOLD_MIN_MS + Math.floor(random() * (HOLD_MAX_MS - HOLD_MIN_MS + 1));
}

/** 213 -> "0.213s". Always three decimals, because a start time is read that way. */
export function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(3)}s`;
}

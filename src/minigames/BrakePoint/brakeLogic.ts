/**
 * BRAKE POINT — the physics and the scoring, with no React and no canvas.
 *
 * THE IDEAL BRAKING POINT IS NOT A MAGIC NUMBER. It falls out of the same
 * equation a real engineer would use: the distance needed to shed the speed
 * you are carrying at the deceleration the car can actually produce.
 *
 *     d = (v0² - vc²) / 2a
 *
 * That matters because it means the three corners do not need hand-tuned
 * targets, and because changing a corner's entry speed moves its braking
 * point correctly and for the right reason. It is also what will make wet
 * running work later: drop `a` and every ideal point moves earlier on its own.
 *
 * Everything here is pure, so the interesting part — how greedy you can be
 * before it bites — can be tested without drawing anything.
 */

/**
 * Deceleration under full braking, m/s².
 *
 * 20 m/s², about 2g. This is the one number in the file that is a playability
 * choice rather than a physical one, and it is worth saying so plainly: real
 * Formula 1 brakes harder than this. Peak bite is nearer 4-5g and a sustained
 * zone is nearer 2.6g.
 *
 * It went 3.3 -> 2.65 -> 2.0 over two rounds of playtesting, because a softer
 * car is the cheapest way to buy the player time: less deceleration means the
 * braking point is further out AND the pedal is down for longer, so turning in
 * becomes a moment you arrive at instead of one you have to catch. Everything
 * else in this file stays honest; this is the dial that was traded.
 */
export const DECEL = 20;

const KMH = 1 / 3.6;

export interface Corner {
  id: string;
  name: string;
  /** What the player is told they are approaching. */
  label: string;
  /** Entry speed, km/h. */
  entryKmh: number;
  /** The speed the corner can actually be taken at, km/h. */
  apexKmh: number;
  /** How far from the corner the run starts, metres. */
  runUpM: number;
  note: string;
}

/**
 * Three corners, all of which brake at the 100 board.
 *
 * THIS IS THE FIX FOR "TOO HARD", AND IT IS NOT A TOLERANCE CHANGE.
 *
 * The braking point used to be 114m on the chicane, with boards at 150, 100
 * and 50 — so the player had to judge a third of the way through the 150-to-100
 * gap, which is crossed in about six tenths of a second. There was no reference
 * AT the point they were being asked to find. Real drivers do not interpolate
 * between boards at 250km/h; they pick a marker and brake at it, and that is
 * the whole technique.
 *
 * So the entry speeds are now chosen so that (v0² - vc²) / 2a comes out at 100
 * metres for all three corners. The physics is untouched — the speeds were
 * solved backwards from it — and the player gets a reference they can actually
 * aim at. The result screen revealing "ideal 100m" teaches it in one attempt.
 *
 * The corners stay different because the braking PHASE differs: 2.2s of pedal
 * at the chicane against 1.7s at the fast right, where the apex speed is high
 * and the window to release into is much narrower.
 */
export const CORNERS: Corner[] = [
  {
    id: 'chicane',
    name: 'Turn 1',
    label: 'Chicane',
    entryKmh: 243,
    apexKmh: 85,
    runUpM: 430,
    note: 'A long, heavy stop. Everything happens slowly enough to think about it.'
  },
  {
    id: 'hairpin',
    name: 'Turn 6',
    label: 'Hairpin',
    entryKmh: 253,
    apexKmh: 110,
    runUpM: 440,
    note: 'Same reference, less time on the pedal.'
  },
  {
    id: 'fast',
    name: 'Turn 9',
    label: 'Fast right',
    entryKmh: 273,
    apexKmh: 150,
    runUpM: 460,
    note: 'Quickest of the three, and the smallest window to turn into.'
  }
];

export const entryMs = (c: Corner) => c.entryKmh * KMH;
export const apexMs = (c: Corner) => c.apexKmh * KMH;

/** Metres before the corner at which braking must begin. */
export function idealBrakePoint(c: Corner): number {
  const v0 = entryMs(c);
  const vc = apexMs(c);
  return (v0 * v0 - vc * vc) / (2 * DECEL);
}

/** Speed after braking for `seconds`, never below a walking pace. */
export function speedAfterBraking(v0: number, seconds: number): number {
  return Math.max(8, v0 - DECEL * seconds);
}

export type Band = 'early' | 'safe' | 'good' | 'limit' | 'lockup' | 'off';

export interface Verdict {
  /** Distance from the corner when the brakes went on, metres. */
  brakeAtM: number;
  idealM: number;
  /** Positive braked too early, negative braked too late. */
  errorM: number;
  /** The same error in seconds, which is what the bands are actually set in. */
  errorS: number;
  band: Band;
  label: string;
  note: string;
  /** Out of 100. */
  score: number;
  /** Seconds given away against a perfect entry. */
  lostS: number;
}

/**
 * TOLERANCES ARE IN SECONDS, NOT METRES.
 *
 * The first version banded on metres and was unplayable: gravel began four
 * metres late, which at 88 m/s is 45 milliseconds. Nobody judges a rushing
 * scene to 45ms — visual judgement lags further behind than that on its own —
 * so gravel was not a punishment for greed, it was the default outcome, and
 * every single run ended in it.
 *
 * Metres also made the three corners wildly unequal. A player's error is a
 * TIME error, and converting it at entry speed means the same hesitation costs
 * more metres the faster you are going — so the fast corner, with the shortest
 * zone, was demanding a precision it had never asked for. Setting the bands in
 * seconds and letting each corner convert them to its own metres makes all
 * three ask the same thing of the player.
 *
 * The windows are deliberately generous. Being on the limit should feel like
 * nerve, not like winning a coin toss.
 */
export const LIMIT_S = 0.25; // either side: on the limit
export const GOOD_S = 0.55; // early: tidy
export const SAFE_S = 1.2; // early: safe and slow
export const LOCKUP_S = 0.65; // later than this and the corner is gone

/**
 * Score the braking point.
 *
 * STILL ASYMMETRIC, because that asymmetry is the whole game: early is safe
 * and mediocre, late is quick right up until it is catastrophic. But both
 * slopes are now in time, and late is about three times as steep as early
 * rather than sixteen times. Creeping later still pays in ones and costs in
 * tens; it no longer costs everything for a mistake shorter than a blink.
 */
export function scoreBraking(c: Corner, brakeAtM: number): Verdict {
  const idealM = idealBrakePoint(c);
  const errorM = brakeAtM - idealM;
  const errorS = errorM / entryMs(c);
  const early = errorS >= 0;

  const raw = early ? 99 - 62 * (errorS / SAFE_S) : lateScore(Math.abs(errorS));
  const score = Math.max(0, Math.min(99, Math.round(raw)));

  // Early loss is exact: you reach apex speed short of the corner and crawl
  // the rest of the way, giving away the difference between covering those
  // metres at apex speed and covering them flat out.
  // Late loss is not a physics result but a consequence — a locked front and a
  // wide exit — so it is charged against the overshoot instead.
  const lostS = early ? errorM * (1 / apexMs(c) - 1 / entryMs(c)) : Math.abs(errorM) * 0.016;

  const { band, label, note } = bandFor(errorS);
  return { brakeAtM, idealM, errorM, errorS, band, label, note, score, lostS };
}

/**
 * The late side of the curve, bent to agree with the words next to it.
 *
 * A single straight line put an "on the limit" run on 71 and a "Gravel" one
 * on 46, so the label and the number were arguing with each other. This one
 * passes through the band edges instead: the far edge of on-the-limit is 80,
 * the far edge of a lock-up is 35, and it reaches nothing shortly after the
 * corner is gone.
 */
function lateScore(lateS: number): number {
  if (lateS <= LIMIT_S) return 99 - (19 * lateS) / LIMIT_S;
  if (lateS <= LOCKUP_S) return 80 - (45 * (lateS - LIMIT_S)) / (LOCKUP_S - LIMIT_S);
  return 35 - (35 * (lateS - LOCKUP_S)) / 0.45;
}

function bandFor(errorS: number): { band: Band; label: string; note: string } {
  if (errorS < -LOCKUP_S) {
    return {
      band: 'off',
      label: 'Gravel',
      note: 'Far too late. You were a passenger from the moment you touched the pedal.'
    };
  }
  if (errorS < -LIMIT_S) {
    return { band: 'lockup', label: 'Lock-up', note: 'The front locked and you ran wide. Greedy.' };
  }
  if (errorS < LIMIT_S) {
    return { band: 'limit', label: 'On the limit', note: 'That is where the good ones brake.' };
  }
  if (errorS < GOOD_S) {
    return { band: 'good', label: 'Good', note: 'Tidy. There is still a little left in it.' };
  }
  if (errorS < SAFE_S) {
    return {
      band: 'safe',
      label: 'Safe',
      note: 'Never going to hurt you, never going to beat anyone.'
    };
  }
  return {
    band: 'early',
    label: 'Way early',
    note: 'You braked for a corner that was still a long way off.'
  };
}

/**
 * The release, which is the trail-braking half.
 *
 * Judged on the speed the car is doing when the pedal comes up: let go while
 * still carrying too much and the car washes wide, sit on the pedal past apex
 * speed and you have thrown away time in a straight line.
 *
 * Capped, and small next to the braking point. The brake point is the thing
 * being tested; the release is here so that holding the pedal is an action
 * rather than a formality.
 */
export const MAX_RELEASE_PENALTY = 12;

/**
 * How far off apex speed the release can be before it costs anything, m/s.
 *
 * Widened from 2 to 8 along with everything else. At 2 m/s the dead zone was
 * about a tenth of a second of pedal, so a run with a perfectly good braking
 * point was still losing points for a release nobody could have placed better.
 */
export const RELEASE_SLACK = 8;

export function releasePenalty(
  c: Corner,
  speedAtRelease: number
): { penalty: number; note: string } {
  const vc = apexMs(c);
  const diff = speedAtRelease - vc;
  if (diff > RELEASE_SLACK) {
    const penalty = Math.min(MAX_RELEASE_PENALTY, Math.round((diff - RELEASE_SLACK) * 1.1));
    return {
      penalty,
      note: penalty > 0 ? 'Off the brakes early, still carrying speed into the corner.' : ''
    };
  }
  if (diff < -RELEASE_SLACK) {
    const penalty = Math.min(MAX_RELEASE_PENALTY, Math.round(Math.abs(diff + RELEASE_SLACK) * 0.8));
    return {
      penalty,
      note: penalty > 0 ? 'Stayed on the pedal too long and killed the entry.' : ''
    };
  }
  return { penalty: 0, note: '' };
}

/** 0-100 across a set of rounds, rounded once at the end. */
export function totalScore(scores: number[]): number {
  if (!scores.length) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export const metres = (m: number) => `${Math.round(m)}m`;

/** "3m late" / "1m from perfect" / "12m early", as the result screen says it. */
export function errorPhrase(errorM: number): string {
  const n = Math.round(Math.abs(errorM));
  if (n === 0) return 'perfect';
  if (errorM < 0) return `${n}m late`;
  if (n <= 3) return `${n}m from perfect`;
  return `${n}m early`;
}

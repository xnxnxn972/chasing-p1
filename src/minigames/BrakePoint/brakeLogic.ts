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
 * 32 m/s² is about 3.3g. Modern F1 peaks higher than that on initial bite,
 * around 4-5g, but peak is not what governs a whole braking zone: the car
 * cannot hold peak once it starts bleeding speed and downforce with it. 3.3g
 * as a constant lands the Monza-style zone at 113m, which is the right order
 * for that corner, so it is the honest simplification rather than the
 * flattering one.
 */
export const DECEL = 32;

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
 * Three corners, in the order the brief asked for: a big obvious stop, then a
 * hairpin, then a fast corner where the whole braking zone is short enough
 * that being three metres greedy is most of your margin.
 */
export const CORNERS: Corner[] = [
  {
    id: 'chicane',
    name: 'Turn 1',
    label: 'Chicane',
    entryKmh: 318,
    apexKmh: 85,
    runUpM: 330,
    note: 'The longest braking zone on the calendar. Everything happens slowly enough to think.'
  },
  {
    id: 'hairpin',
    name: 'Turn 6',
    label: 'Hairpin',
    entryKmh: 285,
    apexKmh: 110,
    runUpM: 280,
    note: 'Less speed to shed, so less room to be wrong in.'
  },
  {
    id: 'fast',
    name: 'Turn 9',
    label: 'Fast right',
    entryKmh: 275,
    apexKmh: 180,
    runUpM: 240,
    note: 'Barely a braking zone at all. A few metres is the whole margin.'
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
  band: Band;
  label: string;
  note: string;
  /** Out of 100. */
  score: number;
  /** Seconds given away against a perfect entry. */
  lostS: number;
}

/**
 * Score the braking point.
 *
 * DELIBERATELY ASYMMETRIC, because that asymmetry is the whole game. Braking
 * early is safe and mediocre and costs you slowly: a metre early is worth
 * about a point and a quarter. Braking late is worth about nineteen and a half
 * points a metre, so three metres of greed takes a 99 to a 41.
 *
 * The anchors are the ones in the brief — 20m early is 74, 7m early is ~91,
 * on the money is 99, 3m late is 41 — and the two slopes are set to hit them.
 * A player who is nudging their braking point later run by run gets rewarded
 * in single points and punished in tens, which is what makes the last few
 * metres feel like a decision rather than an adjustment.
 */
export function scoreBraking(c: Corner, brakeAtM: number): Verdict {
  const idealM = idealBrakePoint(c);
  const errorM = brakeAtM - idealM;
  const early = errorM >= 0;

  const raw = early ? 99 - errorM * 1.25 : 99 - Math.abs(errorM) * 19.5;
  const score = Math.max(0, Math.min(99, Math.round(raw)));

  // Early loss is exact: you reach the apex speed short of the corner and
  // crawl the rest of the way, so you give away the difference between doing
  // those metres at apex speed and doing them flat out.
  // Late loss is not a physics result but a consequence — a locked front and
  // a wide exit — so it is charged per metre of overshoot instead.
  const lostS = early
    ? errorM * (1 / apexMs(c) - 1 / entryMs(c))
    : Math.abs(errorM) * 0.04;

  const { band, label, note } = bandFor(errorM);
  return { brakeAtM, idealM, errorM, band, label, note, score, lostS };
}

function bandFor(errorM: number): { band: Band; label: string; note: string } {
  if (errorM < -4) {
    return { band: 'off', label: 'Gravel', note: 'Far too late. You were a passenger from the moment you touched the pedal.' };
  }
  if (errorM < -1) {
    return { band: 'lockup', label: 'Lock-up', note: 'The front locked and you ran wide. Greedy.' };
  }
  if (errorM < 4) {
    return { band: 'limit', label: 'On the limit', note: 'That is where the good ones brake.' };
  }
  if (errorM < 15) {
    return { band: 'good', label: 'Good', note: 'Tidy. There is still a little left in it.' };
  }
  if (errorM < 35) {
    return { band: 'safe', label: 'Safe', note: 'Never going to hurt you, never going to beat anyone.' };
  }
  return { band: 'early', label: 'Way early', note: 'You braked for a corner that was still a long way off.' };
}

/**
 * The release, which is the trail-braking half.
 *
 * Judged on the speed the car is doing when the pedal comes up: let go while
 * still carrying too much and the car washes wide, sit on the pedal past the
 * apex speed and you have simply thrown away time in a straight line.
 *
 * Capped, and small next to the braking point. This is V1 and the brake point
 * is the thing being tested; the release is here so that holding the pedal is
 * a real action rather than a formality.
 */
export const MAX_RELEASE_PENALTY = 18;

export function releasePenalty(c: Corner, speedAtRelease: number): { penalty: number; note: string } {
  const vc = apexMs(c);
  const diff = speedAtRelease - vc;
  if (diff > 2) {
    const penalty = Math.min(MAX_RELEASE_PENALTY, Math.round((diff - 2) * 2.2));
    return { penalty, note: penalty > 0 ? 'Off the brakes too early, still carrying speed.' : '' };
  }
  if (diff < -2) {
    const penalty = Math.min(MAX_RELEASE_PENALTY, Math.round(Math.abs(diff + 2) * 1.4));
    return { penalty, note: penalty > 0 ? 'Stayed on the pedal too long and killed the entry.' : '' };
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
  if (n <= 2) return `${n}m from perfect`;
  return `${n}m early`;
}

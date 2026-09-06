import type { DriverStats, DrivingStyle } from './types';
import { Rng, clamp } from './random';

export const OVR_WEIGHTS: Record<keyof DriverStats, number> = {
  pace: 0.25,
  racecraft: 0.2,
  qualifying: 0.15,
  consistency: 0.15,
  technical: 0.15,
  fitness: 0.1
};

export const STAT_KEYS: (keyof DriverStats)[] = [
  'pace',
  'qualifying',
  'racecraft',
  'consistency',
  'technical',
  'fitness'
];

export const STAT_LABELS: Record<keyof DriverStats, string> = {
  pace: 'Pace',
  qualifying: 'Qualifying',
  racecraft: 'Racecraft',
  consistency: 'Consistency',
  technical: 'Technical',
  fitness: 'Fitness'
};

export function overallOf(stats: DriverStats): number {
  let total = 0;
  for (const key of STAT_KEYS) total += stats[key] * OVR_WEIGHTS[key];
  return Math.round(total);
}

/**
 * How far above/below the driver's overall potential each attribute can climb.
 * This is what actually makes the three archetypes feel different fifteen
 * seasons later, not the small starting-stat bump.
 */
const STYLE_CEILING: Record<DrivingStyle, Partial<Record<keyof DriverStats, number>>> = {
  speed: { pace: 6, qualifying: 5, racecraft: 1, consistency: -6, technical: -4, fitness: -1 },
  technical: { technical: 7, consistency: 6, pace: -4, qualifying: -1, racecraft: -3, fitness: -1 },
  physical: { racecraft: 7, fitness: 7, consistency: 2, qualifying: -5, technical: -4, pace: -1 }
};

const STYLE_START: Record<DrivingStyle, Partial<Record<keyof DriverStats, number>>> = {
  speed: { pace: 8, qualifying: 6, consistency: -5, technical: -3 },
  technical: { technical: 9, consistency: 5, pace: -4, racecraft: -2 },
  physical: { racecraft: 8, fitness: 8, qualifying: -4, technical: -3 }
};

export const STYLE_LABELS: Record<DrivingStyle, string> = {
  speed: 'Speed',
  technical: 'Technical',
  physical: 'Physical'
};

export function styleCeiling(style: DrivingStyle, key: keyof DriverStats): number {
  return STYLE_CEILING[style][key] ?? 0;
}

/** Starting attributes for a 16-year-old. */
export function createStartingStats(style: DrivingStyle, rng: Rng): DriverStats {
  const stats = {} as DriverStats;
  for (const key of STAT_KEYS) {
    const base = rng.range(40, 50) + (STYLE_START[style][key] ?? 0);
    stats[key] = clamp(Math.round(base + rng.gauss(0, 2)), 25, 70);
  }
  return stats;
}

/**
 * Season-to-season development. Young drivers close the gap to their hidden
 * potential fast; from the early thirties individual attributes start moving
 * in different directions, which is what produces the veteran career.
 */
function growthFactor(age: number): number {
  if (age <= 19) return 0.3;
  if (age <= 23) return 0.24;
  if (age <= 28) return 0.15;
  if (age <= 32) return 0.07;
  return 0;
}

/** Per-attribute annual drift once the driver is past his peak. */
function declineRate(key: keyof DriverStats, age: number): number {
  const past = age - 32;
  if (past <= 0) return 0;
  const ramp = Math.min(1 + (past - 1) * 0.25, 2.6);
  switch (key) {
    case 'pace':
      return -1.5 * ramp;
    case 'qualifying':
      return -1.1 * ramp;
    case 'fitness':
      return -1.3 * ramp;
    case 'racecraft':
      return -0.15 * ramp;
    case 'consistency':
      return age <= 38 ? 0.4 : -0.5 * ramp;
    case 'technical':
      return age <= 40 ? 0.5 : -0.3 * ramp;
  }
}

export interface DevelopmentInput {
  stats: DriverStats;
  age: number;
  potential: number;
  style: DrivingStyle;
  /** 0-100. Junior team quality, or F1 team development. */
  environment: number;
  /** -1..+1. How well the season went relative to expectations. */
  seasonQuality: number;
  /** Extra multiplier from decisions (training camps, burnout, ...). */
  modifier?: number;
}

export function developStats(input: DevelopmentInput, rng: Rng): DriverStats {
  const { stats, age, potential, style, environment, seasonQuality } = input;
  const modifier = input.modifier ?? 1;
  const factor = growthFactor(age);
  const quality = clamp(0.6 + environment / 160 + seasonQuality * 0.25, 0.3, 1.5) * modifier;

  const next = {} as DriverStats;
  for (const key of STAT_KEYS) {
    const ceiling = potential + styleCeiling(style, key);
    let value = stats[key];

    if (factor > 0) {
      const gap = ceiling - value;
      // Attributes above their ceiling stagnate rather than snap back.
      const gain = gap > 0 ? factor * gap * quality * rng.range(0.6, 1.35) : rng.range(-0.4, 0.4);
      value += gain;
    }

    value += declineRate(key, age) * rng.range(0.7, 1.3);
    next[key] = clamp(Math.round(value * 10) / 10, 20, 99);
  }
  return next;
}

export const AGE_PHASES: { from: number; to: number; label: string }[] = [
  { from: 16, to: 19, label: 'Very rapid development' },
  { from: 20, to: 23, label: 'Rapid development' },
  { from: 24, to: 28, label: 'Prime development' },
  { from: 29, to: 32, label: 'Peak' },
  { from: 33, to: 35, label: 'Plateau' },
  { from: 36, to: 38, label: 'Mild decline' },
  { from: 39, to: 41, label: 'Significant decline' },
  { from: 42, to: 45, label: 'Extreme longevity' }
];

export function agePhaseLabel(age: number): string {
  for (const phase of AGE_PHASES) {
    if (age >= phase.from && age <= phase.to) return phase.label;
  }
  return age < 16 ? 'Junior' : 'Extreme longevity';
}

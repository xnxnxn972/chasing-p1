import type { F1TeamId, Team } from './types';
import { F1_TEAM_IDS } from '../data/f1Teams';
import { Rng, clamp } from './random';

/**
 * Team identity is fixed; team PERFORMANCE is part of the simulation.
 * Ferrari is always Ferrari, but Ferrari is not always fast — otherwise there
 * would always be an obvious correct team and every career would be the same.
 */

export interface RegulationShift {
  year: number;
  title: string;
  blurb: string;
  /** Hidden until the season is run. */
  effects: Record<string, number>;
}

const REG_TITLES: { title: string; blurb: string }[] = [
  {
    title: 'NEW REGULATIONS',
    blurb: 'Formula 1 introduces a major aerodynamic overhaul. Nobody knows who has nailed it.'
  },
  {
    title: 'POWER UNIT RESET',
    blurb: 'A new power unit formula lands. Some engine departments have been working on it for years.'
  },
  {
    title: 'CHASSIS RULE CHANGE',
    blurb: 'Ground effect limits are rewritten. The pecking order is about to be redrawn.'
  },
  {
    title: 'COST CAP TIGHTENED',
    blurb: 'The budget cap drops again. The big teams lose some of their advantage.'
  },
  {
    title: 'TYRE SUPPLIER CHANGE',
    blurb: 'A new tyre construction arrives. Every team starts its correlation work from zero.'
  }
];

/** Regulation resets, roughly every 4-6 seasons across a career. */
export function planRegulationYears(startYear: number, rng: Rng): number[] {
  const years: number[] = [];
  let year = startYear + rng.int(3, 5);
  while (year < startYear + 32) {
    years.push(year);
    year += rng.int(4, 6);
  }
  return years;
}

export function buildRegulationShift(
  year: number,
  teams: Record<string, Team>,
  rng: Rng
): RegulationShift {
  const flavour = rng.pick(REG_TITLES);
  const effects: Record<string, number> = {};
  for (const id of F1_TEAM_IDS) {
    const team = teams[id];
    // Strong technical departments are more likely — not guaranteed — to nail it.
    const skill = (team.development - 72) / 18;
    effects[id] = Math.round(clamp(rng.gauss(skill, 6), -14, 15));
  }
  return { year, title: flavour.title, blurb: flavour.blurb, effects };
}

export interface TeamEvolutionOptions {
  regulation?: RegulationShift;
}

/**
 * Move every F1 team's pace on by one season. Development pushes teams up,
 * random drift adds noise, and a gentle pull toward the midfield stops any
 * team running away to 100 forever.
 */
export function evolveTeams(
  teams: Record<string, Team>,
  rng: Rng,
  options: TeamEvolutionOptions = {}
): void {
  for (const id of F1_TEAM_IDS) {
    const team = teams[id];
    const developmentEffect = ((team.development - 66) / 34) * 2.0;
    const drift = rng.gauss(0, 2.6);
    // Mean reversion: dominance decays, backmarkers eventually recover.
    const regression = (70 - team.carPerformance) * 0.085;
    const regChange = options.regulation ? options.regulation.effects[id] ?? 0 : 0;

    team.carPerformance = clamp(
      team.carPerformance + developmentEffect + drift + regression + regChange,
      36,
      100
    );

    // Supporting attributes drift far more slowly.
    // Technical departments regress too — no team stays excellent forever.
    team.development = clamp(team.development + (72 - team.development) * 0.06 + rng.gauss(0, 2.2), 40, 100);
    team.reliability = clamp(team.reliability + rng.gauss(0, 1.8), 62, 97);
    team.stability = clamp(team.stability + rng.gauss(0, 2.2), 30, 96);

    // Prestige and expectation follow results, with a long lag.
    const paceGap = team.carPerformance - 70;
    team.prestige = clamp(team.prestige + paceGap * 0.05 + rng.gauss(0, 0.8), 35, 100);
    team.championshipExpectation = clamp(
      team.championshipExpectation * 0.85 + team.carPerformance * 0.15 + rng.gauss(0, 2),
      35,
      100
    );
    team.pressure = clamp(team.pressure * 0.9 + team.championshipExpectation * 0.1, 35, 100);
  }
}

/** Ranked pace order — engine-side only, never shown raw to the player. */
export function paceOrder(teams: Record<string, Team>): F1TeamId[] {
  return [...F1_TEAM_IDS].sort((a, b) => teams[b].carPerformance - teams[a].carPerformance);
}

/**
 * The player-facing view of a car. Deliberately fuzzy: the game must not
 * become spreadsheet optimisation, and teams themselves are often wrong.
 */
export function carEstimate(
  team: Team,
  teams: Record<string, Team>,
  rng: Rng
): { label: string; stars: number } {
  const order = paceOrder(teams);
  const rank = order.indexOf(team.id as F1TeamId);
  // Scouting error: the estimate can be a place or two off in either direction.
  const perceived = clamp(rank + Math.round(rng.gauss(0, 1.15)), 0, order.length - 1);

  if (perceived <= 1) return { label: 'CHAMPIONSHIP CONTENDER', stars: 5 };
  if (perceived <= 3) return { label: 'RACE WINNER', stars: 4 };
  if (perceived <= 5) return { label: 'REGULAR PODIUM THREAT', stars: 3 };
  if (perceived <= 7) return { label: 'SOLID POINTS SCORER', stars: 2 };
  return { label: 'BACK OF THE GRID', stars: 1 };
}

export function expectationLabel(team: Team): string {
  if (team.championshipExpectation >= 88) return 'Championship';
  if (team.championshipExpectation >= 72) return 'Regular podiums';
  if (team.championshipExpectation >= 58) return 'Best of the rest';
  if (team.championshipExpectation >= 46) return 'Points every weekend';
  return 'Beat your team-mate';
}

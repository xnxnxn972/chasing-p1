import type { ConstructorRow, Series, StandingRow } from './types';
import { Rng, clamp } from './random';

/**
 * A career simulator, not a race simulator. We do run every race — it is cheap
 * and it is the only honest way to get wins, poles and DNFs out of a
 * distribution rather than out of a formula — but the player never sees them.
 */

export interface Entrant {
  driverId: string;
  name: string;
  flag: string;
  teamId: string;
  teamName: string;
  colour: string;
  overall: number;
  qualifying: number;
  racecraft: number;
  consistency: number;
  fitness: number;
  carPerformance: number;
  reliability: number;
  /** -10..+10 momentum going into the season. */
  form: number;
  isPlayer: boolean;
}

export interface SeasonSimOutput {
  standings: StandingRow[];
  constructors: ConstructorRow[];
  races: number;
  /** Position -> driverId, per race. Used only for headline generation. */
  winners: string[];
}

const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

interface SeriesModel {
  carWeight: number;
  driverWeight: number;
  formWeight: number;
  qualiNoise: number;
  raceNoise: number;
  /** How much starting position carries into the result. */
  gridWeight: number;
}

const MODELS: Record<Series, SeriesModel> = {
  // Junior formulae run near-identical machinery: the driver is the story.
  F4: { carWeight: 0.32, driverWeight: 0.63, formWeight: 0.05, qualiNoise: 3.4, raceNoise: 4.6, gridWeight: 0.4 },
  F3: { carWeight: 0.35, driverWeight: 0.6, formWeight: 0.05, qualiNoise: 3.2, raceNoise: 4.4, gridWeight: 0.42 },
  F2: { carWeight: 0.38, driverWeight: 0.57, formWeight: 0.05, qualiNoise: 3.0, raceNoise: 4.2, gridWeight: 0.45 },
  // Formula 1: the car decides. A 94 driver must not win in the slowest car.
  F1: { carWeight: 0.55, driverWeight: 0.32, formWeight: 0.05, qualiNoise: 3.6, raceNoise: 5.8, gridWeight: 0.45 }
};

interface Tally {
  points: number;
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps: number;
  dnfs: number;
}

function dnfProbability(e: Entrant, chaos: number): number {
  const mechanical = (100 - e.reliability) / 100 * 0.075;
  const driverError = Math.max(0, 62 - e.consistency) / 100 * 0.055 * (1 + chaos);
  return clamp(mechanical + driverError, 0.005, 0.3);
}

export function simulateSeason(
  entrants: Entrant[],
  series: Series,
  races: number,
  rng: Rng
): SeasonSimOutput {
  const model = MODELS[series];
  const tallies = new Map<string, Tally>();
  for (const e of entrants) {
    tallies.set(e.driverId, { points: 0, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, dnfs: 0 });
  }

  const baseOf = (e: Entrant) =>
    model.carWeight * e.carPerformance +
    model.driverWeight * e.overall +
    model.formWeight * (50 + e.form * 3);

  const winners: string[] = [];

  for (let race = 0; race < races; race++) {
    // Roughly one weekend in six is wet, chaotic or a street-circuit lottery.
    const chaotic = rng.chance(0.17);
    const chaos = chaotic ? 1 : 0;
    const qualiNoise = model.qualiNoise * (chaotic ? 1.5 : 1);
    const raceNoise = model.raceNoise * (chaotic ? 1.8 : 1);

    const grid = entrants
      .map((e) => ({
        e,
        score:
          baseOf(e) +
          (e.qualifying - 50) * 0.11 +
          rng.gauss(0, qualiNoise)
      }))
      .sort((a, b) => b.score - a.score);

    tallies.get(grid[0].e.driverId)!.poles++;

    const mid = grid.length / 2;
    const classified: { e: Entrant; score: number }[] = [];
    const retired: Entrant[] = [];

    grid.forEach((row, gridIndex) => {
      const e = row.e;
      if (rng.chance(dnfProbability(e, chaos))) {
        retired.push(e);
        tallies.get(e.driverId)!.dnfs++;
        return;
      }
      // Wheel-to-wheel racers and fit drivers gain in the messy races.
      const craft = (e.racecraft - 50) * (0.1 + chaos * 0.07);
      const stamina = (e.fitness - 50) * (0.03 + chaos * 0.04);
      const gridBonus = (mid - gridIndex) * model.gridWeight;
      classified.push({
        e,
        score: baseOf(e) + craft + stamina + gridBonus + rng.gauss(0, raceNoise)
      });
    });

    classified.sort((a, b) => b.score - a.score);

    classified.forEach((row, position) => {
      const t = tallies.get(row.e.driverId)!;
      if (position < POINTS.length) t.points += POINTS[position];
      if (position === 0) t.wins++;
      if (position < 3) t.podiums++;
    });

    if (classified.length > 0) {
      winners.push(classified[0].e.driverId);
      // Fastest lap tends to fall to a quick car near the front, not always P1.
      const contenders = classified.slice(0, Math.min(8, classified.length));
      const fl = rng.pickWeighted(contenders, (row) => Math.max(1, row.score - classified[Math.min(9, classified.length - 1)].score + 2));
      tallies.get(fl.e.driverId)!.fastestLaps++;
    }
  }

  const standings: StandingRow[] = entrants
    .map((e) => {
      const t = tallies.get(e.driverId)!;
      return {
        driverId: e.driverId,
        name: e.name,
        flag: e.flag,
        teamId: e.teamId,
        teamName: e.teamName,
        points: t.points,
        wins: t.wins,
        podiums: t.podiums,
        poles: t.poles,
        fastestLaps: t.fastestLaps,
        dnfs: t.dnfs,
        isPlayer: e.isPlayer
      };
    })
    .sort((a, b) => b.points - a.points || b.wins - a.wins || b.podiums - a.podiums);

  const byTeam = new Map<string, ConstructorRow>();
  for (const e of entrants) {
    const row = standings.find((s) => s.driverId === e.driverId)!;
    const existing = byTeam.get(e.teamId);
    if (existing) existing.points += row.points;
    else
      byTeam.set(e.teamId, {
        teamId: e.teamId,
        teamName: e.teamName,
        points: row.points,
        colour: e.colour
      });
  }

  const constructors = [...byTeam.values()].sort((a, b) => b.points - a.points);

  return { standings, constructors, races, winners };
}

export function positionOf(standings: StandingRow[], driverId: string): number {
  return standings.findIndex((s) => s.driverId === driverId) + 1;
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

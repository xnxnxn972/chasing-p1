import type { DriverStats, DrivingStyle, F1TeamId, GameState, Series, SimDriver, Team } from './types';
import { NATIONALITIES } from '../data/nationalities';
import { F1_TEAM_IDS } from '../data/f1Teams';
import { Rng, clamp } from './random';
import { STAT_KEYS, developStats, overallOf, styleCeiling } from './driverDevelopment';

/**
 * A lightweight Formula 1 world that keeps living while the player drives.
 * Drivers improve, decline, change teams, retire, and win championships the
 * player never took part in — that continuity is what makes rivals matter.
 */

const STYLES: DrivingStyle[] = ['speed', 'technical', 'physical'];

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

export function randomIdentity(rng: Rng): { name: string; nationality: string; flag: string } {
  const nat = rng.pickWeighted(NATIONALITIES, (n) => n.weight);
  const name = `${rng.pick(nat.firstNames)} ${rng.pick(nat.lastNames)}`;
  return { name, nationality: nat.code, flag: nat.flag };
}

function statsFromOverall(overall: number, style: DrivingStyle, rng: Rng): DriverStats {
  const stats = {} as DriverStats;
  for (const key of STAT_KEYS) {
    stats[key] = clamp(
      Math.round(overall + styleCeiling(style, key) * 0.7 + rng.gauss(0, 3.5)),
      20,
      99
    );
  }
  return stats;
}

export function createSimDriver(
  rng: Rng,
  opts: { age: number; overall: number; potential?: number; series: Series | 'none' }
): SimDriver {
  const identity = randomIdentity(rng);
  const style = rng.pick(STYLES);
  const potential =
    opts.potential ??
    clamp(Math.round(opts.overall + rng.range(2, 22) - (opts.age - 18) * 0.9), opts.overall, 95);
  const stats = statsFromOverall(opts.overall, style, rng);
  return {
    id: nextId('drv'),
    name: identity.name,
    nationality: identity.nationality,
    flag: identity.flag,
    age: opts.age,
    style,
    stats,
    overall: overallOf(stats),
    potential,
    reputation: clamp(Math.round(opts.overall * 0.8 + rng.gauss(0, 8)), 20, 99),
    series: opts.series,
    titles: 0,
    wins: 0,
    podiums: 0,
    poles: 0,
    starts: 0,
    clashes: 0,
    form: 0
  };
}

/**
 * Build the starting world: 22 F1 drivers spread across the grid by team
 * quality, plus a junior pool the player will race against on the way up.
 */
export function buildWorld(
  teams: Record<string, Team>,
  rng: Rng
): { drivers: Record<string, SimDriver>; seats: Record<F1TeamId, [string | undefined, string | undefined]> } {
  const drivers: Record<string, SimDriver> = {};
  const seats = {} as Record<F1TeamId, [string | undefined, string | undefined]>;

  const byPace = [...F1_TEAM_IDS].sort((a, b) => teams[b].carPerformance - teams[a].carPerformance);

  byPace.forEach((teamId, rank) => {
    const pair: [string | undefined, string | undefined] = [undefined, undefined];
    for (let seat = 0; seat < 2; seat++) {
      // Fast teams get the strong, established drivers; the back of the grid
      // is where young and journeyman drivers live.
      const quality = 90 - rank * 1.6 - seat * 2.5 + rng.gauss(0, 2.5);
      const age = rng.int(20, 37);
      const driver = createSimDriver(rng, {
        age,
        overall: clamp(Math.round(quality), 66, 95),
        series: 'F1'
      });
      driver.teamId = teamId;
      // Established drivers carry a plausible back-story.
      driver.starts = Math.max(0, (age - 20) * 22 + rng.int(-15, 15));
      driver.wins = Math.max(0, Math.round((driver.overall - 84) * (age - 20) * 0.35 + rng.gauss(0, 2)));
      driver.podiums = driver.wins + Math.max(0, Math.round(driver.wins * rng.range(1.2, 2.6)));
      driver.poles = Math.max(0, Math.round(driver.wins * rng.range(0.5, 1.3)));
      driver.titles = driver.wins >= 25 && rng.chance(0.55) ? rng.int(1, 3) : 0;
      drivers[driver.id] = driver;
      pair[seat] = driver.id;
    }
    seats[teamId] = pair;
  });

  // Junior pool — the player's peers, and the next generation of F1 rookies.
  for (const series of ['F2', 'F3', 'F4'] as Series[]) {
    const baseAge = series === 'F2' ? 20 : series === 'F3' ? 18 : 16;
    const baseOvr = series === 'F2' ? 73 : series === 'F3' ? 61 : 49;
    for (let i = 0; i < 6; i++) {
      const d = createSimDriver(rng, {
        age: baseAge + rng.int(0, 2),
        overall: clamp(Math.round(baseOvr + rng.gauss(0, 5)), 35, 82),
        series
      });
      drivers[d.id] = d;
    }
  }

  return { drivers, seats };
}

function retirementChance(driver: SimDriver, hasSeat: boolean): number {
  const { age } = driver;
  if (age < 31) return hasSeat ? 0 : age > 26 ? 0.25 : 0.05;
  if (!hasSeat) return 0.6;
  if (age <= 33) return 0.06;
  if (age <= 35) return 0.14;
  if (age <= 38) return 0.3;
  if (age <= 41) return 0.5;
  return 0.7;
}

/** One season of ageing, development and decline for every AI driver. */
export function progressAiDrivers(state: GameState, rng: Rng): SimDriver[] {
  const retired: SimDriver[] = [];
  for (const driver of Object.values(state.drivers)) {
    if (driver.series === 'retired') continue;
    driver.age += 1;
    const team = driver.teamId ? state.teams[driver.teamId] : undefined;
    driver.stats = developStats(
      {
        stats: driver.stats,
        age: driver.age,
        potential: driver.potential,
        style: driver.style,
        environment: team ? (team.series === 'F1' ? team.development : team.juniorDevelopment) : 55,
        // A driver in a quick car has a good season and develops like it —
        // the same loop the player benefits from, so the top of the field
        // keeps pace instead of being left behind.
        seasonQuality: clamp((team ? team.carPerformance - 70 : 0) / 22, -1, 1) * 0.8 + rng.range(-0.3, 0.3)
      },
      rng
    );
    driver.overall = overallOf(driver.stats);
    driver.form *= 0.5;

    if (rng.chance(retirementChance(driver, Boolean(driver.teamId)))) {
      retired.push(driver);
      driver.series = 'retired';
      driver.teamId = undefined;
    }
  }

  // Clear retired drivers out of their seats.
  for (const teamId of F1_TEAM_IDS) {
    const pair = state.seats[teamId];
    for (let i = 0; i < 2; i++) {
      const id = pair[i];
      if (id && state.drivers[id] && state.drivers[id].series === 'retired') pair[i] = undefined;
    }
  }

  return retired;
}

/** How attractive a driver is to a team shopping for a seat. */
export function marketValueOf(driver: SimDriver): number {
  const youth = clamp(28 - driver.age, -8, 8);
  const upside = clamp(driver.potential - driver.overall, 0, 20) * 0.4;
  return driver.overall + driver.reputation * 0.14 + youth * 0.5 + upside + driver.titles * 2.5;
}

/**
 * Teams drop drivers, then fill every empty seat. Better teams choose first,
 * so the grid sorts itself roughly by ability with plenty of noise.
 */
export interface MarketOptions {
  /** Team the player is contracted to; its seat is untouchable. */
  lockedTeamId?: F1TeamId;
  /**
   * The player's market value when he is out of contract. Teams weigh him
   * against the drivers actually available, and hold a seat open when he is the
   * better option — which is what makes a Formula 1 seat something to earn.
   */
  playerValue?: number;
  /** The player's raw ability, used as a floor for holding a seat open. */
  playerAbility?: number;
}

export function runDriverMarket(state: GameState, rng: Rng, options: MarketOptions = {}): void {
  const { lockedTeamId, playerValue, playerAbility } = options;
  let seatsHeldOpen = 0;
  const teamsByPrestige = [...F1_TEAM_IDS].sort(
    (a, b) =>
      state.teams[b].prestige + state.teams[b].carPerformance -
      (state.teams[a].prestige + state.teams[a].carPerformance)
  );

  // 1. Underperformers lose their drives.
  for (const teamId of F1_TEAM_IDS) {
    const pair = state.seats[teamId];
    const team = state.teams[teamId];
    for (let i = 0; i < 2; i++) {
      const id = pair[i];
      if (!id || id === 'player') continue;
      if (teamId === lockedTeamId && id === 'player') continue;
      const driver = state.drivers[id];
      if (!driver) {
        pair[i] = undefined;
        continue;
      }
      const bar = 62 + team.championshipExpectation * 0.22;
      const shortfall = bar - driver.overall;
      const dropChance = clamp(shortfall * 0.06 + (driver.age > 36 ? 0.12 : 0), 0.02, 0.55);
      if (rng.chance(dropChance)) {
        pair[i] = undefined;
        driver.teamId = undefined;
        driver.series = 'none';
      }
    }
  }

  // 2. Anyone without a seat is on the market, along with the junior pool.
  const available = () =>
    Object.values(state.drivers)
      .filter((d) => d.series !== 'retired' && !d.teamId && !d.isPlayer)
      .sort((a, b) => marketValueOf(b) - marketValueOf(a));

  for (const teamId of teamsByPrestige) {
    const pair = state.seats[teamId];
    for (let i = 0; i < 2; i++) {
      if (pair[i]) continue;
      const pool = available();
      // A thin market leaves the seat genuinely open — which is exactly the
      // vacancy a driver coming out of F2 needs. It is filled with a generated
      // rookie later only if the player does not take it.
      const team = state.teams[teamId];
      const qualified = pool.filter((d) => d.overall >= 70);
      if (qualified.length === 0) continue;
      if (team.prestige < 76 && marketValueOf(qualified[0]) < team.prestige * 0.35 + 52) continue;
      // The player is in this market too. A team holds a seat open for him only
      // when he is clearly the better bet — two or three vacancies a year, which
      // is what makes a Formula 1 seat something to win rather than to reach.
      if (
        playerValue !== undefined &&
        playerAbility !== undefined &&
        playerAbility >= 76 &&
        seatsHeldOpen < 2 &&
        playerValue > marketValueOf(qualified[0]) + 2
      ) {
        seatsHeldOpen++;
        continue;
      }
      // Top teams take the best available; midfield teams gamble more.
      const window = team.prestige > 78 ? 3 : 6;
      const pick = rng.pickWeighted(qualified.slice(0, window), (d) => marketValueOf(d));
      pick.teamId = teamId;
      pick.series = 'F1';
      pair[i] = pick.id;
    }
  }

  // 3. Restock the junior ranks so there is always a next generation.
  const juniors = Object.values(state.drivers).filter(
    (d) => d.series === 'F2' || d.series === 'F3' || d.series === 'F4'
  );
  for (let i = juniors.length; i < 14; i++) {
    const series: Series = rng.pick(['F4', 'F3', 'F2']);
    const baseOvr = series === 'F2' ? 73 : series === 'F3' ? 61 : 49;
    const d = createSimDriver(rng, {
      age: series === 'F2' ? rng.int(19, 21) : series === 'F3' ? rng.int(17, 19) : rng.int(16, 17),
      overall: clamp(Math.round(baseOvr + rng.gauss(0, 5)), 35, 82),
      series
    });
    state.drivers[d.id] = d;
  }
}

/** The AI driver the game currently treats as the player's headline rival. */
export function pickRival(state: GameState): SimDriver | undefined {
  const playerOvr = state.player.overall;
  const candidates = Object.values(state.drivers).filter(
    (d) => d.series === 'F1' && d.teamId && Math.abs(d.age - state.player.age) <= 7
  );
  if (candidates.length === 0) return undefined;
  return candidates.sort(
    (a, b) =>
      Math.abs(b.overall - playerOvr) * -1 + b.titles * 2 - (Math.abs(a.overall - playerOvr) * -1 + a.titles * 2)
  )[0];
}

/** The player's current team-mate, if they have an F1 seat. */
export function teammateOf(state: GameState): SimDriver | undefined {
  const teamId = state.player.teamId as F1TeamId;
  const pair = state.seats[teamId];
  if (!pair) return undefined;
  const otherId = pair[0] === 'player' ? pair[1] : pair[0];
  return otherId ? state.drivers[otherId] : undefined;
}

import type {
  ContractOffer,
  ContractRole,
  F1TeamId,
  GameState,
  SeasonResult,
  Series,
  Team
} from './types';
import { F1_TEAM_IDS } from '../data/f1Teams';
import { juniorTeamsFor } from '../data/juniorTeams';
import { Rng, clamp } from './random';
import { carEstimate, expectationLabel } from './teamDevelopment';

/**
 * Who wants the player, on what terms. Interest is a soft score — a spectacular
 * season can put an 82-rated driver in a Ferrari, and a poor reputation can
 * keep an 89-rated driver out of one.
 */

export const ROLE_LABELS: Record<ContractRole, string> = {
  rookie: 'Rookie',
  number_two: 'Clear number two',
  equal: 'Equal status',
  team_leader: 'Team leader'
};

function lastSeasons(state: GameState, n: number): SeasonResult[] {
  return state.history.slice(-n);
}

/** -1..+1 — how the recent seasons actually went, relative to the machinery. */
export function recentFormScore(state: GameState): number {
  const recent = lastSeasons(state, 3);
  if (recent.length === 0) return 0;
  let total = 0;
  for (const s of recent) {
    const fieldSize = s.series === 'F1' ? 22 : 20;
    const positionScore = 1 - (s.championshipPosition - 1) / (fieldSize - 1);
    total += positionScore * 2 - 1;
  }
  return clamp(total / recent.length, -1, 1);
}

/**
 * How teams rate the player, expressed ON THE SAME SCALE AS DRIVER OVERALL so
 * it can be compared directly against the drivers already in the seats. Ability
 * is the bulk of it; results, reputation, youth and upside move it by ~10.
 */
export function playerAppeal(state: GameState): number {
  const p = state.player;
  const form = recentFormScore(state);
  const upside = clamp(p.potential - p.overall, 0, 20);
  const youth = clamp(30 - p.age, -12, 12);
  // The bonus is deliberately capped: results and youth get a driver looked at,
  // they do not turn an 85 into a 97 on paper.
  // From the early thirties a team is buying declining years, and prices them
  // in on top of whatever the driver's rating has already lost.
  const agePenalty = p.age > 31 ? (p.age - 31) * 1.6 : 0;
  const bonus =
    (p.career.reputation - 50) * 0.1 +
    form * 4 +
    upside * 0.22 +
    youth * 0.15 +
    (p.career.marketability - 50) * 0.03 -
    agePenalty;
  return p.overall + clamp(bonus, -28, 5);
}

/**
 * What a team thinks the player would actually DO in the car, as opposed to how
 * attractive the signing is. Used when weighing him against a driver already in
 * the seat, where reputation and marketing count for far less.
 */
export function playerAbility(state: GameState): number {
  const p = state.player;
  const form = recentFormScore(state);
  return p.overall + clamp((p.career.reputation - 50) * 0.05 + form * 2.5, -6, 3);
}

/** The player expressed on the same scale the AI driver market uses. */
export function playerMarketValue(state: GameState): number {
  const p = state.player;
  const youth = clamp(28 - p.age, -16, 8);
  const upside = clamp(p.potential - p.overall, 0, 20) * 0.4;
  return playerAbility(state) + p.career.reputation * 0.14 + youth * 0.5 + upside;
}

function interestBar(state: GameState, team: Team): number {
  const relationship = state.relationships[team.id as F1TeamId] ?? 0;
  // An OVR-scale number: the rating a team demands of its drivers. The band is
  // deliberately narrow — around 78 at the back of the grid, 89 at Ferrari —
  // because every Formula 1 driver is already one of the best two dozen alive.
  return (
    62 +
    team.prestige * 0.14 +
    team.carPerformance * 0.1 +
    team.championshipExpectation * 0.04 -
    relationship * 0.05
  );
}

function salaryFor(team: Team, appeal: number, role: ContractRole, rng: Rng): number {
  // Junior drivers are not paid — they (or their backers) pay for the seat.
  // Career earnings therefore only start when Formula 1 does.
  if (team.series !== 'F1') return 0;
  const skillFactor = clamp((appeal - 62) / 32, 0.05, 1.35);
  const roleFactor =
    role === 'team_leader' ? 1.2 : role === 'equal' ? 1 : role === 'number_two' ? 0.72 : 0.4;
  const raw = (team.salaryPower / 100) * skillFactor * roleFactor * 42 * rng.range(0.85, 1.15);
  return Math.max(1, Math.round(raw));
}

function roleFor(state: GameState, team: Team, appeal: number, rng: Rng): ContractRole {
  const teamStanding = team.prestige + team.championshipExpectation;
  const isFirstF1 = !state.history.some((h) => h.series === 'F1');
  if (isFirstF1) return 'rookie';
  // The bigger the team, the harder equal status is to get.
  const leverage = appeal - teamStanding * 0.47 + rng.gauss(0, 4);
  if (leverage > 12) return 'team_leader';
  if (leverage > -2) return 'equal';
  return 'number_two';
}

function pitchFor(team: Team, role: ContractRole, stars: number): string {
  if (role === 'team_leader')
    return `${team.name} will build the team around you.`;
  if (role === 'number_two')
    return `${team.name} want you alongside their established lead driver — and they have been clear about the order.`;
  if (role === 'rookie')
    return `${team.name} are prepared to hand you your Formula 1 debut.`;
  return stars >= 4
    ? `${team.name} believe you are ready to fight for the World Championship.`
    : `${team.name} want a driver who can drag this car further up the grid.`;
}

function contractLength(team: Team, age: number, rng: Rng): number {
  if (age >= 38) return 1;
  if (age >= 34) return rng.int(1, 2);
  if (team.series !== 'F1') return 1;
  return rng.int(1, 3);
}

/** Which F1 teams would take the player for next season. */
export function f1Interest(state: GameState, rng: Rng): F1TeamId[] {
  const appeal = playerAppeal(state);
  const ability = playerAbility(state);
  const out: F1TeamId[] = [];
  for (const teamId of F1_TEAM_IDS) {
    const team = state.teams[teamId];
    const pair = state.seats[teamId];
    const hasFreeSeat = pair.some((s) => !s || s === 'player');
    const weakestOther = pair
      .filter((s): s is string => Boolean(s) && s !== 'player')
      .map((s) => state.drivers[s])
      .filter(Boolean)
      .sort((a, b) => a.overall - b.overall)[0];
    const bar = interestBar(state, team);
    // A team only moves a driver aside if that driver is genuinely below what
    // the team demands. Two drivers who are doing the job means there is no
    // seat, however good you are — which is what stops a great driver simply
    // walking into whichever car is fastest, year after year.
    const canDisplace = weakestOther
      ? weakestOther.overall < bar - 1 && ability > weakestOther.overall + 6
      : false;
    if (!hasFreeSeat && !canDisplace) continue;
    if (appeal + rng.gauss(0, 4.5) > bar + (hasFreeSeat ? 0 : 6)) out.push(teamId);
  }
  return out;
}

export function makeF1Offer(state: GameState, teamId: F1TeamId, rng: Rng): ContractOffer {
  const team = state.teams[teamId];
  const appeal = playerAppeal(state);
  const role = roleFor(state, team, appeal, rng);
  const estimate = carEstimate(team, state.teams, rng);
  return {
    id: `offer_${teamId}_${state.year}`,
    teamId,
    teamName: team.name,
    colour: team.colour,
    series: 'F1',
    salary: salaryFor(team, appeal, role, rng),
    seasons: contractLength(team, state.player.age, rng),
    role,
    performanceClause: team.pressure > 80 && rng.chance(0.5),
    carEstimate: estimate.label,
    carStars: estimate.stars,
    expectation: expectationLabel(team),
    pitch: pitchFor(team, role, estimate.stars)
  };
}

export function makeJuniorOffer(
  state: GameState,
  team: Team,
  rng: Rng,
  quality: 'top' | 'mid' | 'low'
): ContractOffer {
  const stars = quality === 'top' ? 5 : quality === 'mid' ? 3 : 2;
  return {
    id: `offer_${team.id}_${state.year}`,
    teamId: team.id,
    teamName: team.name,
    colour: '#8892a4',
    series: team.series,
    salary: salaryFor(team, playerAppeal(state), 'rookie', rng),
    seasons: 1,
    role: 'equal',
    performanceClause: false,
    carEstimate:
      quality === 'top'
        ? 'TITLE-WINNING TEAM'
        : quality === 'mid'
          ? 'SOLID FRONT-RUNNER'
          : 'MIDFIELD OUTFIT',
    carStars: stars,
    expectation: quality === 'top' ? 'Win the championship' : quality === 'mid' ? 'Top five' : 'Show raw pace',
    pitch:
      quality === 'top'
        ? `${team.name} run the strongest car in ${team.series}. Nothing but a title will do.`
        : `${team.name} will give you a full season of racing in ${team.series}.`
  };
}

/**
 * Junior seats are earned by results: win and the best team calls, struggle and
 * you are choosing between whoever will still have you.
 */
export function juniorOffersFor(state: GameState, series: Series, rng: Rng): ContractOffer[] {
  const teams = juniorTeamsFor(series);
  const form = recentFormScore(state);
  const rating = clamp((state.player.overall - 40) / 45 + form * 0.35 + rng.gauss(0, 0.1), 0, 1);

  const sorted = [...teams].sort((a, b) => b.carPerformance - a.carPerformance);
  const bestIndex = Math.round((1 - rating) * (sorted.length - 2));
  const picks = [sorted[clamp(bestIndex, 0, sorted.length - 1)], sorted[clamp(bestIndex + 1, 0, sorted.length - 1)]];

  return picks
    .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
    .map((t, i) =>
      makeJuniorOffer(state, state.teams[t.id] ?? t, rng, i === 0 ? (rating > 0.66 ? 'top' : 'mid') : 'low')
    );
}

export function makeReserveOffer(state: GameState, teamId: F1TeamId): ContractOffer {
  const team = state.teams[teamId];
  return {
    id: `reserve_${teamId}_${state.year}`,
    teamId,
    teamName: team.name,
    colour: team.colour,
    series: 'F1',
    salary: Math.max(1, Math.round(team.salaryPower / 22)),
    seasons: 1,
    role: 'rookie',
    performanceClause: false,
    carEstimate: 'NO RACE SEAT',
    carStars: 0,
    expectation: 'Be ready if the call comes',
    pitch: `${team.name} will take you on as reserve driver. Simulator work, Friday practice, and a seat if someone gets hurt.`,
    isReserve: true
  };
}

/**
 * Headline market value in € millions — roughly two to three times what a top
 * team would pay the driver, which is how the figure is quoted in the paddock.
 */
export function estimatedMarketValue(state: GameState): number {
  const value = (playerAppeal(state) - 72) * 3.2 + state.player.career.marketability * 0.2;
  return Math.max(0.2, Math.round(value));
}

export function formatMoney(millions: number): string {
  if (millions >= 1000) return `€${(millions / 1000).toFixed(millions >= 10000 ? 0 : 1)}B`;
  if (millions >= 10) return `€${Math.round(millions)}M`;
  if (millions >= 1) return `€${millions.toFixed(1)}M`;
  return `€${Math.round(millions * 1000)}k`;
}

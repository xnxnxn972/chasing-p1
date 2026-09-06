import type {
  Achievement,
  ConstructorRow,
  Contract,
  ContractOffer,
  DrivingStyle,
  F1TeamId,
  GameState,
  PendingStep,
  SeasonReport,
  SeasonResult,
  Series,
  StandingRow,
  Team
} from './types';
import { F1_TEAM_IDS, freshF1Teams } from '../data/f1Teams';
import { RACES_PER_SEASON, freshJuniorTeams, juniorTeamsFor } from '../data/juniorTeams';
import { NATIONALITY_BY_CODE } from '../data/nationalities';
import { Rng, clamp } from './random';
import { createStartingStats, developStats, overallOf } from './driverDevelopment';
import {
  buildWorld,
  createSimDriver,
  pickRival,
  progressAiDrivers,
  resetIdCounter,
  runDriverMarket,
  teammateOf
} from './driverMarket';
import { buildRegulationShift, evolveTeams, paceOrder, planRegulationYears } from './teamDevelopment';
import type { Entrant } from './seasonSimulator';
import { ordinal, simulateSeason } from './seasonSimulator';
import {
  f1Interest,
  juniorOffersFor,
  makeF1Offer,
  makeReserveOffer,
  playerAbility,
  playerAppeal,
  playerMarketValue,
  recentFormScore
} from './contractEngine';
import { applyDecision, nextDecision, resetDecisionCache } from './decisionEngine';
import { checkAchievements } from './achievementEngine';

export const START_YEAR = 2026;
export const MAX_AGE = 45;

export interface CareerSetup {
  name: string;
  number: number;
  nationality: string;
  style: DrivingStyle;
  seed: string;
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export function createCareer(setup: CareerSetup): GameState {
  resetIdCounter();
  resetDecisionCache();
  const rng = new Rng(setup.seed);
  const teams: Record<string, Team> = { ...freshF1Teams(), ...freshJuniorTeams() };
  const world = buildWorld(teams, rng);
  const nat = NATIONALITY_BY_CODE[setup.nationality] ?? NATIONALITY_BY_CODE.GB;

  const stats = createStartingStats(setup.style, rng);
  const relationships = {} as Record<F1TeamId, number>;
  for (const id of F1_TEAM_IDS) relationships[id] = 0;

  const state: GameState = {
    seed: setup.seed,
    year: START_YEAR,
    cursor: 'contract',
    rngState: rng.snapshot(),
    player: {
      name: setup.name,
      number: setup.number,
      nationality: nat.code,
      flag: nat.flag,
      style: setup.style,
      age: 16,
      stats,
      overall: overallOf(stats),
      // Hidden, and skewed: most sixteen-year-olds top out short of a Formula 1
      // seat, and a few are generational. Two identical setups are not the
      // same driver.
      potential: Math.round(clamp(72 + Math.pow(rng.next(), 1.5) * 27, 72, 97)),
      form: 0,
      career: { reputation: 12, marketability: 8, teamRelationship: 50, wealth: 0 },
      series: 'F4',
      teamId: '',
      contract: { teamId: '', startYear: START_YEAR, seasons: 0, salary: 0, role: 'rookie' },
      reserveSeasons: 0,
      careerEarnings: 0
    },
    teams,
    drivers: world.drivers,
    seats: world.seats,
    history: [],
    achievements: [],
    relationships,
    firedEvents: [],
    decisionBudget: 1,
    decisionsUsed: 0,
    pending: null,
    log: [],
    retirementOffered: false,
    retireRequested: false,
    regulationYears: planRegulationYears(START_YEAR, rng),
    joinPaceRank: {},
    finished: false
  };

  openSeason(state, rng);
  state.rngState = rng.snapshot();
  return step(state);
}

// ---------------------------------------------------------------------------
// Public transitions
// ---------------------------------------------------------------------------

export function chooseDecisionOption(state: GameState, optionId: string): GameState {
  const next = clone(state);
  const pending = next.pending;
  if (!pending || pending.kind !== 'decision') return next;
  const rng = new Rng(next.rngState);
  const note = applyDecision(next, rng, pending.eventId, optionId);
  next.decisionsUsed += 1;
  next.rngState = rng.snapshot();
  next.pending = null;
  if (note) next.log.push(note);
  const outcome: PendingStep = {
    kind: 'news',
    tag: pending.tag,
    title: pending.title,
    body: note || 'The season moves on.',
    continueLabel: 'CONTINUE'
  };
  next.pending = outcome;
  next.cursor = advanceCursor(next.cursor);
  return next;
}

export function chooseOffer(state: GameState, offerId: string): GameState {
  const next = clone(state);
  const pending = next.pending;
  if (!pending || pending.kind !== 'offers') return next;
  const offer = pending.offers.find((o) => o.id === offerId);
  if (!offer) return next;
  signOffer(next, offer);
  next.pending = null;
  next.cursor = 'preseason';
  return step(next);
}

/** Turn every offer down and take the year out. */
export function declineOffers(state: GameState): GameState {
  const next = clone(state);
  const rng = new Rng(next.rngState);
  next.pending = null;

  if (next.player.age >= 30 || next.player.series === 'F1') {
    return retire(next, 'You turned down what was on the table. Nothing better arrived.');
  }
  // A young driver sits out a season and loses ground.
  next.player.teamId = '';
  next.player.contract = { teamId: '', startYear: next.year, seasons: 0, salary: 0, role: 'rookie' };
  next.player.form = clamp(next.player.form - 3, -10, 10);
  next.player.career.reputation = clamp(next.player.career.reputation - 6, 0, 100);
  next.rngState = rng.snapshot();
  next.pending = {
    kind: 'news',
    tag: 'NO DRIVE',
    title: `${next.year} — NO SEAT`,
    body: 'You spend the season on the sidelines, doing simulator work and watching drivers you have beaten race on television.',
    continueLabel: 'CONTINUE'
  };
  next.cursor = 'advance';
  return next;
}

export function continueStep(state: GameState): GameState {
  const next = clone(state);
  next.pending = null;
  if (next.cursor === 'retired') {
    next.finished = true;
    return next;
  }
  return step(next);
}

export function retireNow(state: GameState): GameState {
  return retire(clone(state), 'You call it a career.');
}

// ---------------------------------------------------------------------------
// The season machine
// ---------------------------------------------------------------------------

function advanceCursor(cursor: GameState['cursor']): GameState['cursor'] {
  switch (cursor) {
    case 'contract':
      return 'preseason';
    case 'preseason':
      return 'midseason';
    case 'midseason':
      return 'race';
    case 'race':
      return 'offseason';
    case 'offseason':
      return 'advance';
    case 'advance':
      return 'contract';
    default:
      return 'retired';
  }
}

/**
 * A season asks for one decision, and only sometimes two. Three separate coin
 * flips used to average north of two a year, which made a career a long series
 * of small prompts rather than a short series of real ones.
 */
function canDecide(state: GameState): boolean {
  return state.decisionsUsed < state.decisionBudget;
}

function openSeason(state: GameState, rng: Rng): void {
  state.decisionBudget = rng.chance(0.3) ? 2 : 1;
  state.decisionsUsed = 0;
}

/** Run stages until one produces something for the player to look at. */
function step(state: GameState): GameState {
  let guard = 0;
  while (!state.pending && state.cursor !== 'retired' && guard++ < 40) {
    const rng = new Rng(state.rngState);
    switch (state.cursor) {
      case 'contract': {
        const produced = contractStage(state, rng);
        if (!produced) state.cursor = 'preseason';
        break;
      }
      case 'preseason': {
        if (canDecide(state) && rng.chance(0.45)) {
          state.pending = nextDecision(state, rng, 'preseason');
        }
        if (!state.pending) state.cursor = 'midseason';
        break;
      }
      case 'midseason': {
        if (canDecide(state) && rng.chance(0.6)) {
          state.pending = nextDecision(state, rng, 'midseason');
        }
        if (!state.pending) state.cursor = 'race';
        break;
      }
      case 'race': {
        raceStage(state, rng);
        state.cursor = 'offseason';
        break;
      }
      case 'offseason': {
        if (canDecide(state) && rng.chance(0.5)) {
          state.pending = nextDecision(state, rng, 'offseason');
        }
        if (!state.pending) state.cursor = 'advance';
        break;
      }
      case 'advance': {
        advanceStage(state, rng);
        break;
      }
    }
    state.rngState = rng.snapshot();
  }
  return state;
}

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

/** True when the stage produced a pending step. */
function contractStage(state: GameState, rng: Rng): boolean {
  if (state.player.contract.seasons > 0 && state.player.teamId) {
    // Under contract: nothing to decide, but the seat is still registered.
    claimSeat(state);
    return false;
  }

  const offers = buildOffers(state, rng);
  if (offers.length === 0) {
    retire(
      state,
      state.player.series === 'F1'
        ? 'The phone stops ringing. There is no seat for next season, and there will not be one the year after.'
        : 'The money runs out and the calls stop. The ladder ends here.'
    );
    return true;
  }

  const inF1 = offers.some((o) => o.series === 'F1' && !o.isReserve);
  state.pending = {
    kind: 'offers',
    tag: state.history.length === 0 ? 'YOUR FIRST SEAT' : 'THE MARKET',
    title:
      offers.length > 1
        ? inF1
          ? 'TEAMS WANT YOU'
          : 'WHERE DO YOU RACE?'
        : 'ONE OFFER ON THE TABLE',
    body: offerBlurb(state, offers),
    offers,
    canDecline: state.history.length > 0,
    declineLabel: state.player.age >= 30 || state.player.series === 'F1' ? 'RETIRE INSTEAD' : 'TURN THEM ALL DOWN'
  };
  return true;
}

function raceStage(state: GameState, rng: Rng): void {
  const report = state.reserveTeamId ? runReserveSeason(state) : runSeason(state, rng);
  state.history.push(report.result);
  state.player.careerEarnings += report.result.salary;
  state.player.career.wealth += report.result.salary * 0.55;

  // Development happens on the back of the season just run.
  const before = state.player.overall;
  const team = state.teams[state.player.teamId];
  const environment = team
    ? team.series === 'F1'
      ? team.development
      : team.juniorDevelopment
    : 55;
  state.player.stats = developStats(
    {
      stats: state.player.stats,
      age: state.player.age,
      potential: state.player.potential,
      style: state.player.style,
      environment,
      seasonQuality: seasonQuality(report.result)
    },
    rng
  );
  state.player.overall = overallOf(state.player.stats);
  report.result.driverOverallStart = before;
  report.result.driverOverallEnd = state.player.overall;

  const unlocked: Achievement[] = checkAchievements(state, report.result);
  state.player.contract.seasons = Math.max(0, state.player.contract.seasons - 1);

  state.pending = {
    kind: 'result',
    report,
    newAchievements: unlocked,
    notes: seasonNotes(state, report)
  };
}

function advanceStage(state: GameState, rng: Rng): void {
  state.player.age += 1;
  state.year += 1;

  if (state.retireRequested) {
    retire(state, 'You announced it, and you meant it.');
    return;
  }
  if (state.player.age > MAX_AGE) {
    retire(state, 'Forty-five. Nobody does this for longer.');
    return;
  }

  // The world moves on whether or not the player is in it.
  progressAiDrivers(state, rng);
  const regulation = state.regulationYears.includes(state.year)
    ? buildRegulationShift(state.year, state.teams, rng)
    : undefined;
  evolveTeams(state.teams, rng, { regulation });
  releaseSeatIfExpired(state);
  const underContract = state.player.contract.seasons > 0;
  runDriverMarket(state, rng, {
    lockedTeamId: underContract ? (state.player.teamId as F1TeamId) : undefined,
    playerValue: underContract ? undefined : playerMarketValue(state),
    playerAbility: underContract ? undefined : playerAbility(state)
  });
  const rival = pickRival(state);
  state.rivalId = rival?.id;
  state.player.form = state.player.form * 0.5;

  state.cursor = 'contract';
  openSeason(state, rng);

  if (regulation) {
    state.pending = {
      kind: 'news',
      tag: 'REGULATIONS',
      title: regulation.title,
      body: `${regulation.blurb} Nobody will know who got it right until the cars run in February.`,
      continueLabel: 'CONTINUE'
    };
  }
}

// ---------------------------------------------------------------------------
// Season simulation glue
// ---------------------------------------------------------------------------

function playerEntrant(state: GameState, team: Team): Entrant {
  const p = state.player;
  return {
    driverId: 'player',
    name: p.name,
    flag: p.flag,
    teamId: team.id,
    teamName: team.name,
    colour: team.colour,
    overall: p.overall,
    qualifying: p.stats.qualifying,
    racecraft: p.stats.racecraft,
    consistency: p.stats.consistency,
    fitness: p.stats.fitness,
    carPerformance: team.carPerformance,
    reliability: team.reliability,
    form: p.form,
    isPlayer: true
  };
}

function f1Field(state: GameState): Entrant[] {
  const entrants: Entrant[] = [];
  for (const teamId of F1_TEAM_IDS) {
    const team = state.teams[teamId];
    for (const seatDriverId of state.seats[teamId]) {
      // Vacancies the market deliberately left open are filled at the last
      // moment — after the player has had their chance at them.
      if (!seatDriverId) continue;
      if (seatDriverId === 'player') {
        entrants.push(playerEntrant(state, team));
        continue;
      }
      const d = state.drivers[seatDriverId];
      if (!d) continue;
      entrants.push({
        driverId: d.id,
        name: d.name,
        flag: d.flag,
        teamId,
        teamName: team.name,
        colour: team.colour,
        overall: d.overall,
        qualifying: d.stats.qualifying,
        racecraft: d.stats.racecraft,
        consistency: d.stats.consistency,
        fitness: d.stats.fitness,
        carPerformance: team.carPerformance,
        reliability: team.reliability,
        form: 0,
        isPlayer: false
      });
    }
  }
  return entrants;
}

/**
 * Junior fields mix the persistent junior drivers (so rivals carry up the
 * ladder with the player) with one-season fill so the grid is always full.
 */
function juniorField(state: GameState, series: Series, rng: Rng): Entrant[] {
  const teams = juniorTeamsFor(series)
    .map((t) => state.teams[t.id] ?? t)
    .sort((a, b) => b.carPerformance - a.carPerformance);
  const playerTeam = state.teams[state.player.teamId];
  const entrants: Entrant[] = [playerEntrant(state, playerTeam)];

  const persistent = Object.values(state.drivers).filter((d) => d.series === series).slice(0, 6);
  const baseOvr = series === 'F2' ? 68 : series === 'F3' ? 58 : 48;
  const fieldSize = 20;

  for (let i = entrants.length; i < fieldSize; i++) {
    const team = teams[i % teams.length];
    const persistentDriver = persistent[i - 1];
    if (persistentDriver) {
      entrants.push({
        driverId: persistentDriver.id,
        name: persistentDriver.name,
        flag: persistentDriver.flag,
        teamId: team.id,
        teamName: team.name,
        colour: '#8892a4',
        overall: persistentDriver.overall,
        qualifying: persistentDriver.stats.qualifying,
        racecraft: persistentDriver.stats.racecraft,
        consistency: persistentDriver.stats.consistency,
        fitness: persistentDriver.stats.fitness,
        carPerformance: team.carPerformance,
        reliability: team.reliability,
        form: 0,
        isPlayer: false
      });
      continue;
    }
    const filler = createSimDriver(rng, {
      age: rng.int(16, 22),
      overall: clamp(Math.round(baseOvr + rng.gauss(0, 6)), 32, 84),
      series
    });
    entrants.push({
      driverId: filler.id,
      name: filler.name,
      flag: filler.flag,
      teamId: team.id,
      teamName: team.name,
      colour: '#8892a4',
      overall: filler.overall,
      qualifying: filler.stats.qualifying,
      racecraft: filler.stats.racecraft,
      consistency: filler.stats.consistency,
      fitness: filler.stats.fitness,
      carPerformance: team.carPerformance,
      reliability: team.reliability,
      form: 0,
      isPlayer: false
    });
  }
  return entrants;
}

function fillVacantSeats(state: GameState, rng: Rng): void {
  for (const teamId of F1_TEAM_IDS) {
    const pair = state.seats[teamId];
    for (let i = 0; i < 2; i++) {
      if (pair[i]) continue;
      const team = state.teams[teamId];
      const rookie = createSimDriver(rng, {
        age: rng.int(18, 22),
        overall: clamp(Math.round(68 + team.prestige * 0.18 + rng.gauss(0, 3.5)), 72, 90),
        series: 'F1'
      });
      rookie.teamId = teamId;
      state.drivers[rookie.id] = rookie;
      pair[i] = rookie.id;
    }
  }
}

function runSeason(state: GameState, rng: Rng): SeasonReport {
  const series = state.player.series;
  if (series === 'F1') fillVacantSeats(state, rng);
  const races = RACES_PER_SEASON[series];
  const entrants = series === 'F1' ? f1Field(state) : juniorField(state, series, rng);
  const sim = simulateSeason(entrants, series, races, rng);

  const row = sim.standings.find((s) => s.isPlayer)!;
  const position = sim.standings.findIndex((s) => s.isPlayer) + 1;
  const team = state.teams[state.player.teamId];
  const teamPosition = sim.constructors.findIndex((c) => c.teamId === team.id) + 1;
  const champion = sim.standings[0];

  if (series === 'F1') updateAiCareers(state, sim.standings, races);

  const result: SeasonResult = {
    year: state.year,
    age: state.player.age,
    series,
    teamId: team.id,
    teamName: team.name,
    driverOverallStart: state.player.overall,
    driverOverallEnd: state.player.overall,
    races,
    wins: row.wins,
    podiums: row.podiums,
    poles: row.poles,
    fastestLaps: row.fastestLaps,
    dnfs: row.dnfs,
    points: row.points,
    championshipPosition: position,
    teamChampionshipPosition: teamPosition,
    champion: champion.name,
    salary: state.player.contract.salary
  };

  return {
    result,
    standings: sim.standings,
    constructors: sim.constructors,
    headlines: buildHeadlines(state, sim.standings, sim.constructors, result)
  };
}

function runReserveSeason(state: GameState): SeasonReport {
  const team = state.teams[state.reserveTeamId!];
  const result: SeasonResult = {
    year: state.year,
    age: state.player.age,
    series: 'F1',
    teamId: team.id,
    teamName: team.name,
    driverOverallStart: state.player.overall,
    driverOverallEnd: state.player.overall,
    races: 0,
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    dnfs: 0,
    points: 0,
    championshipPosition: 0,
    champion: undefined,
    salary: state.player.contract.salary,
    reserveYear: true
  };
  state.player.reserveSeasons += 1;
  return {
    result,
    standings: [],
    constructors: [],
    headlines: [
      `A season of simulator work and Friday practice for ${team.name}. Twenty-two other drivers raced.`
    ]
  };
}

function updateAiCareers(state: GameState, standings: StandingRow[], races: number): void {
  standings.forEach((row, index) => {
    if (row.isPlayer) return;
    const d = state.drivers[row.driverId];
    if (!d) return;
    d.starts += races;
    d.wins += row.wins;
    d.podiums += row.podiums;
    d.poles += row.poles;
    if (index === 0) d.titles += 1;
    d.reputation = clamp(
      d.reputation + (index < 3 ? 4 : index < 10 ? 1 : -2),
      10,
      99
    );
  });
}

function seasonQuality(result: SeasonResult): number {
  if (result.reserveYear) return -0.2;
  const fieldSize = result.series === 'F1' ? 22 : 20;
  return clamp(1 - ((result.championshipPosition - 1) / (fieldSize - 1)) * 2, -1, 1);
}

function buildHeadlines(
  state: GameState,
  standings: StandingRow[],
  constructors: ConstructorRow[],
  result: SeasonResult
): string[] {
  const out: string[] = [];
  const champ = standings[0];
  const player = standings.find((s) => s.isPlayer)!;
  const label = result.series === 'F1' ? "Drivers' Championship" : `${result.series} title`;

  if (champ.isPlayer) out.push(`You are the ${result.year} ${label} winner.`);
  else out.push(`${champ.name} wins the ${result.year} ${label} for ${champ.teamName}.`);

  if (result.series === 'F1' && constructors.length > 0) {
    const cons = constructors[0];
    if (cons.teamId === result.teamId && !champ.isPlayer)
      out.push(`${cons.teamName} win the Constructors' Championship — from the other side of the garage.`);
    else out.push(`${cons.teamName} win the Constructors' Championship.`);
  }

  const mate = teammateOf(state);
  if (mate && result.series === 'F1') {
    const mateRow = standings.find((s) => s.driverId === mate.id);
    if (mateRow) {
      const mateIndex = standings.indexOf(mateRow);
      const playerIndex = standings.indexOf(player);
      out.push(
        playerIndex < mateIndex
          ? `You finished ahead of ${mate.name} — ${ordinal(playerIndex + 1)} to ${ordinal(mateIndex + 1)}.`
          : `${mate.name} finished ahead of you — ${ordinal(mateIndex + 1)} to ${ordinal(playerIndex + 1)}.`
      );
    }
  }
  return out;
}

function seasonNotes(state: GameState, report: SeasonReport): string[] {
  const notes: string[] = [];
  const r = report.result;
  if (r.reserveYear) return notes;

  // Reputation is a Formula 1 currency. Twenty wins in F4 is a nice line in a
  // press release; one Grand Prix win is worth more than all of them.
  const weight = r.series === 'F1' ? 1 : r.series === 'F2' ? 0.35 : r.series === 'F3' ? 0.22 : 0.12;
  const addRep = (amount: number) => {
    state.player.career.reputation = clamp(state.player.career.reputation + amount, 0, 100);
  };
  const addMarket = (amount: number) => {
    state.player.career.marketability = clamp(state.player.career.marketability + amount, 0, 100);
  };

  if (r.championshipPosition === 1 && r.series === 'F1') {
    notes.push('World Champion.');
    addRep(15);
    addMarket(15);
  } else if (r.wins > 0) {
    addRep(Math.min(9, r.wins * weight * 1.6));
    addMarket(Math.min(8, r.wins * weight * 1.3));
  } else if (r.podiums > 0) {
    addRep(3 * weight);
  } else if (r.series === 'F1' && r.points === 0) {
    addRep(-5);
  } else if (r.series !== 'F1' && r.championshipPosition > 10) {
    addRep(-2);
  }

  if (r.championshipPosition === 1 && r.series !== 'F1') {
    addRep(r.series === 'F2' ? 9 : r.series === 'F3' ? 6 : 3);
    notes.push(`${r.series} Champion.`);
  }

  const teamId = r.teamId as F1TeamId;
  if (teamId in state.relationships) {
    const delta = r.championshipPosition <= 3 ? 8 : r.points > 0 ? 3 : -4;
    state.relationships[teamId] = clamp(state.relationships[teamId] + delta, -100, 100);
  }
  state.player.form = clamp(seasonQuality(r) * 6, -10, 10);
  return notes;
}

// ---------------------------------------------------------------------------
// Contracts and seats
// ---------------------------------------------------------------------------

/**
 * The next rung, which has to be earned. Nobody is promoted for turning up:
 * a driver who cannot finish near the front stays where he is, and the junior
 * ladder is where most careers quietly end.
 */
function ladderTarget(state: GameState): Series {
  const series = state.player.series;
  const last = state.history[state.history.length - 1];
  if (!last) return 'F4';
  if (series === 'F4') return last.championshipPosition <= 6 ? 'F3' : 'F4';
  if (series === 'F3') return last.championshipPosition <= 5 ? 'F2' : 'F3';
  return series;
}

/** True when the junior career has stalled and the funding has gone. */
function ladderExhausted(state: GameState): boolean {
  const series = state.player.series;
  const seasonsHere = state.history.filter((h) => h.series === series).length;
  if (seasonsHere >= 3 && ladderTarget(state) === series) return true;
  if (state.player.age >= 21 && series === 'F4') return true;
  if (state.player.age >= 23 && series === 'F3') return true;
  // Six years of junior racing without a Formula 1 seat is the whole answer.
  if (state.history.filter((h) => h.series !== 'F1').length >= 6) return true;
  return false;
}

function buildOffers(state: GameState, rng: Rng): ContractOffer[] {
  const offers: ContractOffer[] = [];
  const hasBeenF1 = state.history.some((h) => h.series === 'F1');

  // Formula 1 is reached from F2, or by an F3 champion good enough to skip it.
  const last = state.history[state.history.length - 1];
  const f3Prodigy =
    state.player.series === 'F3' &&
    last?.championshipPosition === 1 &&
    state.player.overall > 76;
  if (state.player.series === 'F2' || hasBeenF1 || f3Prodigy) {
    const interested = f1Interest(state, rng);
    for (const teamId of interested.slice(0, 3)) offers.push(makeF1Offer(state, teamId, rng));
  }

  if (offers.length === 0 && (state.player.series === 'F2' || hasBeenF1)) {
    // No race seat: a reserve role keeps a career alive for a year.
    const appeal = playerAppeal(state);
    const reserveTeam = [...F1_TEAM_IDS]
      .sort((a, b) => (state.relationships[b] ?? 0) - (state.relationships[a] ?? 0))
      .find((id) => appeal + (state.relationships[id] ?? 0) * 0.1 > 66);
    // Reserve is a young driver's way in, not an old driver's waiting room. A
    // veteran with no race seat is out of the sport, which is what actually
    // ends most careers.
    if (reserveTeam && state.player.age <= 27) offers.push(makeReserveOffer(state, reserveTeam));
  }

  // The junior ladder stays open while the player is young enough and is still
  // moving up it. Once neither is true, there is nothing left to sign.
  if (!hasBeenF1 && state.player.age <= 26 && !ladderExhausted(state)) {
    const target = ladderTarget(state);
    offers.push(...juniorOffersFor(state, target, rng));
  } else if (offers.length === 0 && hasBeenF1 && state.player.age <= 27) {
    offers.push(...juniorOffersFor(state, 'F2', rng));
  }

  return offers.slice(0, 4);
}

function offerBlurb(state: GameState, offers: ContractOffer[]): string {
  if (state.history.length === 0) {
    return 'Two Formula 4 teams have space for you next season. Your family can afford one year of this. Choose carefully.';
  }
  const f1 = offers.filter((o) => o.series === 'F1' && !o.isReserve);
  if (f1.length >= 2) return 'Your manager has more than one Formula 1 contract on the table. Only one of them can be right.';
  if (f1.length === 1) return `${f1[0].teamName} want you in Formula 1.`;
  if (offers.some((o) => o.isReserve)) return 'No team has offered you a race seat. This is what is left.';
  const form = recentFormScore(state);
  return form > 0.3
    ? 'After that season, the phone has been busy.'
    : 'The offers on the table are what your last season earned you.';
}

function signOffer(state: GameState, offer: ContractOffer): void {
  const team = state.teams[offer.teamId];
  releaseSeat(state);

  state.player.series = offer.series;
  state.player.teamId = offer.teamId;
  state.reserveTeamId = offer.isReserve ? (offer.teamId as F1TeamId) : undefined;
  const contract: Contract = {
    teamId: offer.teamId,
    startYear: state.year,
    seasons: offer.seasons,
    salary: offer.salary,
    role: offer.role,
    performanceClause: offer.performanceClause
  };
  state.player.contract = contract;
  state.player.career.teamRelationship = 55;

  if (offer.series === 'F1' && !offer.isReserve) {
    const rank = paceOrder(state.teams).indexOf(offer.teamId as F1TeamId) + 1;
    state.joinPaceRank[offer.teamId] = rank;
    claimSeat(state);
    if (offer.teamId in state.relationships) {
      state.relationships[offer.teamId as F1TeamId] = clamp(
        state.relationships[offer.teamId as F1TeamId] + 15,
        -100,
        100
      );
    }
    // Rejecting the others is remembered.
    const pending = state.pending;
    if (pending && pending.kind === 'offers') {
      for (const other of pending.offers) {
        if (other.id === offer.id) continue;
        if (other.series !== 'F1' || other.isReserve) continue;
        if (other.teamId in state.relationships) {
          state.relationships[other.teamId as F1TeamId] = clamp(
            state.relationships[other.teamId as F1TeamId] - 8,
            -100,
            100
          );
        }
      }
    }
  }
  if (team && team.series === 'F1' && !offer.isReserve) state.player.reserveSeasons = 0;
}

/** Put the player into one of the two seats at their F1 team. */
function claimSeat(state: GameState): void {
  if (state.player.series !== 'F1' || state.reserveTeamId) return;
  const teamId = state.player.teamId as F1TeamId;
  const pair = state.seats[teamId];
  if (!pair) return;
  if (pair.includes('player')) return;
  // Displace the weaker of the two incumbents.
  const occupants = pair
    .map((id, index) => ({ id, index }))
    .filter((o): o is { id: string; index: number } => Boolean(o.id));
  if (occupants.length < 2) {
    pair[pair[0] ? 1 : 0] = 'player';
    return;
  }
  const weakest = occupants.sort(
    (a, b) => (state.drivers[a.id]?.overall ?? 0) - (state.drivers[b.id]?.overall ?? 0)
  )[0];
  const displaced = state.drivers[weakest.id];
  if (displaced) {
    displaced.teamId = undefined;
    displaced.series = 'none';
  }
  pair[weakest.index] = 'player';
}

function releaseSeat(state: GameState): void {
  for (const teamId of F1_TEAM_IDS) {
    const pair = state.seats[teamId];
    for (let i = 0; i < 2; i++) if (pair[i] === 'player') pair[i] = undefined;
  }
}

function releaseSeatIfExpired(state: GameState): void {
  if (state.player.contract.seasons <= 0) releaseSeat(state);
}

// ---------------------------------------------------------------------------
// Retirement
// ---------------------------------------------------------------------------

function retire(state: GameState, reason: string): GameState {
  state.player.retiredAge = state.player.age;
  state.cursor = 'retired';
  checkAchievements(state);
  state.pending = {
    kind: 'news',
    tag: 'RETIREMENT',
    title: 'THAT IS THE CAREER',
    body: reason,
    continueLabel: 'SEE YOUR CAREER'
  };
  return state;
}

function clone(state: GameState): GameState {
  return structuredClone(state);
}

export { ordinal };

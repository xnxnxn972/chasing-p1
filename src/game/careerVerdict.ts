import type { CareerTotals, GameState, SeasonResult } from './types';

/** Totals across the whole career, junior seasons included. */
export function computeTotals(state: GameState): CareerTotals {
  const totals: CareerTotals = {
    starts: 0,
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    titles: 0,
    f1Starts: 0,
    f1Wins: 0,
    f1Podiums: 0,
    f1Poles: 0,
    f1FastestLaps: 0,
    juniorTitles: 0
  };
  for (const s of state.history) {
    if (s.reserveYear) continue;
    totals.starts += s.races;
    totals.wins += s.wins;
    totals.podiums += s.podiums;
    totals.poles += s.poles;
    totals.fastestLaps += s.fastestLaps;
    totals.points += s.points;
    if (s.series === 'F1') {
      totals.f1Starts += s.races;
      totals.f1Wins += s.wins;
      totals.f1Podiums += s.podiums;
      totals.f1Poles += s.poles;
      totals.f1FastestLaps += s.fastestLaps;
      if (s.championshipPosition === 1) totals.titles++;
    } else if (s.championshipPosition === 1) {
      totals.juniorTitles++;
    }
  }
  return totals;
}

export function careerScore(state: GameState, totals: CareerTotals): number {
  const achievementsScore = state.achievements.reduce((sum, a) => sum + a.score, 0);
  return Math.round(
    totals.titles * 1500 +
      totals.f1Wins * 60 +
      totals.f1Podiums * 15 +
      totals.f1Poles * 12 +
      totals.f1FastestLaps * 4 +
      totals.f1Starts * 1 +
      totals.juniorTitles * 120 +
      achievementsScore
  );
}

/**
 * Where this score sits among real careers.
 *
 * The first version of this was guesswork written before anyone had played:
 * it called 12,000 points "TOP 0.1%" when 17% of finished careers clear that,
 * and 5,000 "TOP 8%" when it is really top 30%. Anyone sharing a card was
 * telling their friends something untrue by two orders of magnitude.
 *
 * These tiers are measured from 1,574 finished careers. They will drift as the
 * population grows and as the game changes; re-derive them from the session log
 * rather than adjusting them by feel.
 */
export function scorePercentile(score: number): string {
  const tiers: [number, string][] = [
    [43168, 'TOP 0.1%'],
    [32885, 'TOP 1%'],
    [26995, 'TOP 3%'],
    [20922, 'TOP 8%'],
    [13665, 'TOP 15%'],
    [5126, 'TOP 30%'],
    [816, 'TOP 55%'],
    [88, 'TOP 80%']
  ];
  for (const [threshold, label] of tiers) if (score >= threshold) return label;
  return 'TOP 99%';
}

function f1Seasons(state: GameState): SeasonResult[] {
  return state.history.filter((h) => h.series === 'F1' && !h.reserveYear);
}

function peakOverall(state: GameState): number {
  return state.history.reduce((max, h) => Math.max(max, h.driverOverallEnd), 0);
}

/** DNFs as a share of starts — the difference between bad luck and chaos. */
function dnfRate(seasons: SeasonResult[]): number {
  const starts = seasons.reduce((n, s) => n + s.races, 0);
  if (starts === 0) return 0;
  return seasons.reduce((n, s) => n + s.dnfs, 0) / starts;
}

/**
 * Seasons where the driver finished well above the car underneath him.
 * Driver and constructor standings are different lengths — roughly two drivers
 * per team — so a team's championship position is doubled to get the placing an
 * ordinary driver in that car would have managed.
 */
function seasonsAboveTheCar(seasons: SeasonResult[]): number {
  return seasons.filter((s) => {
    if (!s.teamChampionshipPosition) return false;
    const parForTheCar = s.teamChampionshipPosition * 2 - 1;
    return parForTheCar - s.championshipPosition >= 4;
  }).length;
}

/**
 * A season written off, immediately followed by a genuine front-running one.
 * The first cut of this asked only for "a podium the year after a bad season",
 * which fired for a quarter of all careers and buried every other verdict —
 * a comeback has to be rare to mean anything, so both ends are strict.
 */
function hasComeback(seasons: SeasonResult[]): boolean {
  for (let i = 1; i < seasons.length; i++) {
    if (seasons[i - 1].championshipPosition >= 15 && seasons[i].championshipPosition <= 5) return true;
  }
  return false;
}

export function careerTitle(state: GameState, totals: CareerTotals): string {
  const seasons = f1Seasons(state);
  const teamsUsed = new Set(seasons.map((s) => s.teamId));
  const titleSeasons = seasons.filter((s) => s.championshipPosition === 1);
  const firstTitle = titleSeasons[0];
  const firstWinIndex = seasons.findIndex((s) => s.wins > 0);
  const firstWin = firstWinIndex >= 0 ? seasons[firstWinIndex] : undefined;
  const runnerUps = seasons.filter((s) => s.championshipPosition === 2).length;
  const peak = peakOverall(state);
  const lastAge = seasons[seasons.length - 1]?.age ?? 0;
  const reserveYears = state.history.filter((h) => h.reserveYear).length;
  const f1Points = seasons.reduce((n, s) => n + s.points, 0);
  const dnfs = dnfRate(seasons);

  // ---- champions -----------------------------------------------------------
  if (totals.titles >= 5 && totals.f1Wins >= 70) return 'THE GOAT';
  if (totals.titles >= 2 && state.player.style === 'technical') return 'THE PROFESSOR';
  if (firstTitle && firstTitle.age <= 23) return 'THE PRODIGY';
  if (totals.titles >= 1 && teamsUsed.size === 1) return 'THE ONE-TEAM LEGEND';
  if (titleSeasons.some((s) => (state.joinPaceRank[s.teamId] ?? 0) > 5)) return 'THE REBUILD MASTER';
  // Written off entirely, and only THEN champion — a bad year after the titles
  // is a decline, not a resurrection.
  if (
    firstTitle &&
    seasons.some((s) => s.championshipPosition >= 16 && s.year < firstTitle.year)
  ) {
    return 'THE RESURRECTION';
  }
  if (titleSeasons.some((s) => s.teamId === 'ferrari')) return 'THE TIFOSI HERO';
  if (totals.titles >= 1 && teamsUsed.size >= 4) return 'THE MERCENARY';
  if (totals.titles >= 1) return 'THE CHAMPION';

  // ---- no title, but a story ----------------------------------------------
  // Everything below here exists because most careers end without a
  // championship, and a summary screen with nothing to say about them is a
  // summary screen nobody shares.
  if (runnerUps >= 3) return 'THE HEARTBREAKER';
  if (runnerUps >= 2) return 'THE NEARLY MAN';
  if (totals.f1Podiums >= 8 && totals.f1Wins === 0) return 'THE BRIDESMAID';
  if (hasComeback(seasons)) return 'THE PHOENIX';
  if (firstWin && firstWinIndex >= 8) return 'THE LONG WAIT';
  if (firstWin && firstWin.age >= 30) return 'THE LATE BLOOMER';
  if (totals.f1Wins === 1 && seasons.length >= 8) return 'THE ONE-HIT WONDER';
  if (seasonsAboveTheCar(seasons) >= 3) return 'THE GIANT KILLER';
  // Thresholds measured, not guessed: across 500 simulated careers the DNF rate
  // runs 0.000–0.042 with a median of 0.010, so 0.18 (the first cut) was
  // unreachable and 0.03 is genuinely the top few per cent.
  if (totals.f1Starts >= 60 && dnfs >= 0.03) return 'THE WRECKING BALL';
  // The other tail, and the only unambiguous version of it: never once retired.
  if (totals.f1Starts >= 100 && dnfs === 0) return 'THE METRONOME';
  if (state.player.style === 'physical' && totals.f1Wins >= 6) return 'THE RAINMASTER';
  if (peak >= 90 && totals.f1Wins === 0) return 'THE WHAT-IF';
  if (totals.f1Starts >= 40 && f1Points === 0) return 'THE ETERNAL ROOKIE';
  if (lastAge >= 40) return 'THE LIFER';
  // Longevity is about the age you were still racing at, not the start count:
  // with a 24-race calendar, 250 starts is only eleven ordinary seasons.
  if (seasons.length >= 10 && lastAge >= 37) return 'THE SURVIVOR';
  if (teamsUsed.size === 1 && seasons.length >= 9) return 'THE STANDARD BEARER';
  if (teamsUsed.size >= 5) return 'THE TEAM HOPPER';
  if (teamsUsed.size === 1 && seasons.length >= 6) return 'THE LOYALIST';
  if (reserveYears >= 3 && seasons.length >= 4) return 'THE UNDERSTUDY';
  // Genuinely the reserve who barely got a drive — two full race seasons is a
  // short career, not a super-sub.
  if (reserveYears > 0 && seasons.length <= 1) return 'THE SUPER-SUB';
  if (totals.f1Starts > 0) return 'THE JOURNEYMAN';
  return 'THE WHAT-IF';
}

export function careerVerdict(state: GameState, totals: CareerTotals): string {
  const seasons = f1Seasons(state);
  const teamNames: string[] = [];
  for (const s of seasons) if (!teamNames.includes(s.teamName)) teamNames.push(s.teamName);
  const firstTeam = teamNames[0];
  const lastTeam = teamNames[teamNames.length - 1];
  const peak = peakOverall(state);
  const seasonCount = seasons.length;
  const runnerUps = seasons.filter((s) => s.championshipPosition === 2).length;

  if (totals.f1Starts === 0) {
    const best = state.history.reduce(
      (b, h) => (h.championshipPosition < b ? h.championshipPosition : b),
      99
    );
    return `You never made it to Formula 1. ${state.history.length} seasons on the junior ladder, a best championship finish of ${best === 99 ? 'nowhere' : `P${best}`}, and a peak rating of ${peak}. Thousands of drivers have exactly this career, and almost nobody hears about them.`;
  }

  if (totals.titles >= 4) {
    return `${totals.titles} World Championships. ${totals.f1Wins} victories. You arrived at ${firstTeam} as a promising young driver and left the sport as one of the greatest to have driven in it.`;
  }
  if (totals.titles >= 2) {
    return `Two decades, ${totals.titles} World Championships and ${totals.f1Wins} Grand Prix wins across ${teamNames.length} team${teamNames.length === 1 ? '' : 's'}. You were the driver of your generation, and the record book will say so long after everyone has stopped arguing about it.`;
  }
  if (totals.titles === 1) {
    const titleSeason = seasons.find((s) => s.championshipPosition === 1)!;
    return `One World Championship, won at ${titleSeason.age} with ${titleSeason.teamName}, and ${totals.f1Wins} Grand Prix victories. You got the only thing that really counts, and nobody can ever take the year off you.`;
  }
  if (runnerUps >= 2) {
    return `${runnerUps} times a championship runner-up and ${totals.f1Wins} race wins. You had the pace to become World Champion. You just never found yourself in the right car at the right time.`;
  }
  if (totals.f1Wins >= 8) {
    return `${seasonCount} seasons, ${totals.f1Wins} wins and ${totals.f1Podiums} podiums without a title. A brilliant, frustrating career — and a late revival at ${lastTeam} that made you one of Formula 1's great survivors.`;
  }
  if (totals.f1Wins > 0) {
    return `${seasonCount} seasons in Formula 1, ${totals.f1Wins} win${totals.f1Wins === 1 ? '' : 's'} and ${totals.f1Podiums} podiums. You never got a championship-winning car, but you won a Grand Prix, and there is a very short list of people who can say that.`;
  }
  if (totals.f1Podiums > 0) {
    return `${seasonCount} seasons of Formula 1 without a victory, but ${totals.f1Podiums} podium${totals.f1Podiums === 1 ? '' : 's'} and ${totals.f1Starts} starts. You spent your career in the midfield and became one of the most respected drivers on the grid.`;
  }
  return `${seasonCount} season${seasonCount === 1 ? '' : 's'} and ${totals.f1Starts} Grand Prix starts. You reached Formula 1 — which is the part almost nobody manages — and the machinery never once let you show what you actually were.`;
}

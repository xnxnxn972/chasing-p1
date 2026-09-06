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
 * A rough population percentile. Not a real leaderboard yet — the shape is here
 * so a daily-seed mode can drop a real distribution in later.
 */
export function scorePercentile(score: number): string {
  const tiers: [number, string][] = [
    [12000, 'TOP 0.1%'],
    [9000, 'TOP 1%'],
    [7000, 'TOP 3%'],
    [5000, 'TOP 8%'],
    [3200, 'TOP 15%'],
    [1800, 'TOP 30%'],
    [800, 'TOP 55%'],
    [200, 'TOP 80%']
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

export function careerTitle(state: GameState, totals: CareerTotals): string {
  const seasons = f1Seasons(state);
  const teamsUsed = new Set(seasons.map((s) => s.teamId));
  const titleSeasons = seasons.filter((s) => s.championshipPosition === 1);
  const firstTitle = titleSeasons[0];
  const firstWin = seasons.find((s) => s.wins > 0);
  const runnerUps = seasons.filter((s) => s.championshipPosition === 2).length;
  const peak = peakOverall(state);

  if (totals.titles >= 5 && totals.f1Wins >= 70) return 'THE GOAT';
  if (totals.titles >= 2 && state.player.style === 'technical') return 'THE PROFESSOR';
  if (firstTitle && firstTitle.age <= 23) return 'THE PRODIGY';
  if (totals.titles >= 1 && teamsUsed.size === 1) return 'THE ONE-TEAM LEGEND';
  if (titleSeasons.some((s) => (state.joinPaceRank[s.teamId] ?? 0) > 5)) return 'THE REBUILD MASTER';
  if (titleSeasons.some((s) => s.teamId === 'ferrari')) return 'THE TIFOSI HERO';
  if (totals.titles >= 1 && teamsUsed.size >= 4) return 'THE MERCENARY';
  if (totals.titles >= 1) return 'THE CHAMPION';

  if (runnerUps >= 2) return 'THE NEARLY MAN';
  if (firstWin && firstWin.age >= 30) return 'THE LATE BLOOMER';
  if (state.player.style === 'physical' && totals.f1Wins >= 6) return 'THE RAINMASTER';
  if (peak >= 90 && totals.f1Wins === 0) return 'THE WHAT-IF';
  // Longevity is about the age you were still racing at, not the start count:
  // with a 24-race calendar, 250 starts is only eleven ordinary seasons.
  if (seasons.length >= 10 && (seasons[seasons.length - 1]?.age ?? 0) >= 37) return 'THE SURVIVOR';
  if (teamsUsed.size >= 5) return 'THE TEAM HOPPER';
  if (teamsUsed.size === 1 && seasons.length >= 6) return 'THE LOYALIST';
  // Genuinely the reserve who barely got a drive — two full race seasons is a
  // short career, not a super-sub.
  if (state.history.some((h) => h.reserveYear) && seasons.length <= 1) return 'THE SUPER-SUB';
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

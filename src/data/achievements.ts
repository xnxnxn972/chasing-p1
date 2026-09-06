import type { CareerTotals, GameState, SeasonResult } from '../game/types';

export interface AchievementContext {
  state: GameState;
  totals: CareerTotals;
  season?: SeasonResult;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  score: number;
  check: (ctx: AchievementContext) => boolean;
}

const f1Seasons = (s: GameState) => s.history.filter((h) => h.series === 'F1' && !h.reserveYear);
const titles = (s: GameState) => f1Seasons(s).filter((h) => h.championshipPosition === 1);

function titleWith(state: GameState, teamId: string): boolean {
  return titles(state).some((h) => h.teamId === teamId);
}

function consecutiveTitles(state: GameState): number {
  const seasons = f1Seasons(state);
  let best = 0;
  let run = 0;
  for (const s of seasons) {
    if (s.championshipPosition === 1) {
      run++;
      best = Math.max(best, run);
    } else run = 0;
  }
  return best;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_point',
    name: 'FIRST POINT',
    description: 'Score a Formula 1 point.',
    score: 40,
    check: ({ state }) => f1Seasons(state).some((h) => h.points > 0)
  },
  {
    id: 'first_podium',
    name: 'FIRST PODIUM',
    description: 'Finish on a Formula 1 podium.',
    score: 90,
    check: ({ totals }) => totals.f1Podiums > 0
  },
  {
    id: 'first_pole',
    name: 'FRONT ROW OF ONE',
    description: 'Take a Formula 1 pole position.',
    score: 110,
    check: ({ totals }) => totals.f1Poles > 0
  },
  {
    id: 'gp_winner',
    name: 'GRAND PRIX WINNER',
    description: 'Win your first Grand Prix.',
    score: 220,
    check: ({ totals }) => totals.f1Wins > 0
  },
  {
    id: 'world_champion',
    name: 'WORLD CHAMPION',
    description: "Win the Drivers' Championship.",
    score: 600,
    check: ({ state }) => titles(state).length > 0
  },
  {
    id: 'back_to_back',
    name: 'BACK TO BACK',
    description: 'Win consecutive titles.',
    score: 450,
    check: ({ state }) => consecutiveTitles(state) >= 2
  },
  {
    id: 'triple_crown',
    name: 'TRIPLE CROWN',
    description: 'Win three championships.',
    score: 700,
    check: ({ state }) => titles(state).length >= 3
  },
  {
    id: 'dynasty',
    name: 'DYNASTY',
    description: 'Win five championships.',
    score: 900,
    check: ({ state }) => titles(state).length >= 5
  },
  {
    id: 'tifosi_hero',
    name: 'TIFOSI HERO',
    description: 'Win a championship with Ferrari.',
    score: 300,
    check: ({ state }) => titleWith(state, 'ferrari')
  },
  {
    id: 'silver_arrow',
    name: 'SILVER ARROW',
    description: 'Win a title with Mercedes.',
    score: 300,
    check: ({ state }) => titleWith(state, 'mercedes')
  },
  {
    id: 'papaya_king',
    name: 'PAPAYA KING',
    description: 'Win a title with McLaren.',
    score: 300,
    check: ({ state }) => titleWith(state, 'mclaren')
  },
  {
    id: 'the_rebuild',
    name: 'THE REBUILD',
    description: 'Win a championship with a team that was outside the top five when you joined.',
    score: 500,
    check: ({ state }) =>
      titles(state).some((h) => (state.joinPaceRank[h.teamId] ?? 0) > 5)
  },
  {
    id: 'junior_champion',
    name: 'LADDER CLIMBER',
    description: 'Win a junior championship on the way up.',
    score: 80,
    check: ({ state }) =>
      state.history.some((h) => h.series !== 'F1' && h.championshipPosition === 1)
  },
  {
    id: 'clean_sweep',
    name: 'CLEAN SWEEP',
    description: 'Win F3 and F2 titles in consecutive seasons.',
    score: 160,
    check: ({ state }) => {
      const h = state.history;
      for (let i = 1; i < h.length; i++) {
        if (
          h[i - 1].series === 'F3' &&
          h[i - 1].championshipPosition === 1 &&
          h[i].series === 'F2' &&
          h[i].championshipPosition === 1
        )
          return true;
      }
      return false;
    }
  },
  {
    id: 'teenage_debut',
    name: 'TEENAGE DEBUT',
    description: 'Start a Grand Prix before your twentieth birthday.',
    score: 120,
    check: ({ state }) => f1Seasons(state).some((h) => h.age <= 19)
  },
  {
    id: 'centurion',
    name: 'CENTURION',
    description: 'Make 100 Grand Prix starts.',
    score: 130,
    check: ({ totals }) => totals.f1Starts >= 100
  },
  {
    id: 'triple_century',
    name: 'THREE HUNDRED',
    description: 'Make 300 Grand Prix starts.',
    score: 260,
    check: ({ totals }) => totals.f1Starts >= 300
  },
  {
    id: 'perfect_season',
    name: 'PERFECT STORM',
    description: 'Win ten or more races in a single season.',
    score: 340,
    check: ({ state }) => f1Seasons(state).some((h) => h.wins >= 10)
  },
  {
    id: 'giant_killer',
    name: 'GIANT KILLER',
    description: 'Win a Grand Prix for a team outside the top six.',
    score: 280,
    check: ({ state }) =>
      f1Seasons(state).some((h) => h.wins > 0 && (h.teamChampionshipPosition ?? 1) > 6)
  },
  {
    id: 'one_team',
    name: 'ONE-TEAM MAN',
    description: 'Spend ten Formula 1 seasons with a single team.',
    score: 200,
    check: ({ state }) => {
      const counts = new Map<string, number>();
      for (const h of f1Seasons(state)) counts.set(h.teamId, (counts.get(h.teamId) ?? 0) + 1);
      return [...counts.values()].some((n) => n >= 10);
    }
  },
  {
    id: 'globetrotter',
    name: 'THE MERCENARY',
    description: 'Race for five different Formula 1 teams.',
    score: 150,
    check: ({ state }) => new Set(f1Seasons(state).map((h) => h.teamId)).size >= 5
  },
  {
    id: 'late_bloomer',
    name: 'LATE BLOOMER',
    description: 'Win your first Grand Prix at 30 or older.',
    score: 180,
    check: ({ state }) => {
      const first = f1Seasons(state).find((h) => h.wins > 0);
      return Boolean(first && first.age >= 30);
    }
  },
  {
    id: 'veteran',
    name: 'THE SURVIVOR',
    description: 'Still on the Formula 1 grid at 40.',
    score: 190,
    check: ({ state }) => f1Seasons(state).some((h) => h.age >= 40)
  },
  {
    id: 'rich',
    name: 'THE PORTFOLIO',
    description: 'Earn more than €300M across your career.',
    score: 120,
    check: ({ state }) => state.player.careerEarnings >= 300
  }
];

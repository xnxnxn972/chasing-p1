import type { Achievement, GameState, SeasonResult } from './types';
import { ACHIEVEMENTS } from '../data/achievements';
import { computeTotals } from './careerVerdict';

/** Returns only the achievements unlocked by the season that just finished. */
export function checkAchievements(state: GameState, season?: SeasonResult): Achievement[] {
  const totals = computeTotals(state);
  const owned = new Set(state.achievements.map((a) => a.id));
  const unlocked: Achievement[] = [];

  for (const def of ACHIEVEMENTS) {
    if (owned.has(def.id)) continue;
    if (!def.check({ state, totals, season })) continue;
    const achievement: Achievement = {
      id: def.id,
      name: def.name,
      description: def.description,
      score: def.score,
      year: state.year
    };
    state.achievements.push(achievement);
    unlocked.push(achievement);
  }
  return unlocked;
}

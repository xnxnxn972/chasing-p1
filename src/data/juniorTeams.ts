import type { Series, Team } from '../game/types';

/**
 * Fictional junior teams. V1 keeps the ladder invented so the only authentic
 * names in the game are the ones that matter emotionally — the F1 grid.
 * `carPerformance` here is team quality within its own series, on the same
 * 0-100 scale, so the season simulator needs no special cases.
 */
function junior(
  id: string,
  name: string,
  series: Series,
  carPerformance: number,
  juniorDevelopment: number,
  prestige: number,
  salaryPower: number
): Team {
  return {
    id,
    name,
    shortName: name.slice(0, 3).toUpperCase(),
    series,
    colour: '#8892a4',
    carPerformance,
    development: carPerformance,
    prestige,
    stability: 70,
    pressure: Math.round(prestige * 0.8),
    salaryPower,
    juniorDevelopment,
    driverOpportunity: 70,
    championshipExpectation: prestige,
    reliability: 82,
    carProfile: {
      stability: 70,
      tyreManagement: 70,
      straightLineSpeed: 70,
      aeroSensitivity: 70,
      developmentPotential: 70
    }
  };
}

export const JUNIOR_TEAMS: Team[] = [
  // ---- F4 ----
  junior('f4_arden', 'Arden Junior', 'F4', 82, 84, 78, 6),
  junior('f4_veloce', 'Veloce Academy', 'F4', 76, 78, 70, 5),
  junior('f4_hitline', 'Hitline Motorsport', 'F4', 70, 72, 62, 4),
  junior('f4_crestone', 'Crestone Racing', 'F4', 64, 66, 55, 4),
  junior('f4_northgate', 'Northgate Junior', 'F4', 57, 58, 46, 3),
  junior('f4_bluebridge', 'Bluebridge Racing', 'F4', 50, 52, 38, 3),

  // ---- F3 ----
  junior('f3_apex', 'Apex Motorsport', 'F3', 85, 86, 82, 10),
  junior('f3_meridian', 'Meridian Racing', 'F3', 79, 80, 74, 9),
  junior('f3_kestrel', 'Kestrel GP', 'F3', 72, 74, 66, 8),
  junior('f3_valeo', 'Valeo Junior Team', 'F3', 65, 66, 58, 7),
  junior('f3_okonkwo', 'Okonkwo Racing', 'F3', 58, 60, 50, 6),
  junior('f3_starline', 'Starline Motorsport', 'F3', 51, 54, 42, 5),

  // ---- F2 ----
  junior('f2_apex', 'Apex Motorsport', 'F2', 87, 88, 86, 22),
  junior('f2_meridian', 'Meridian Racing', 'F2', 80, 82, 78, 20),
  junior('f2_kestrel', 'Kestrel GP', 'F2', 74, 76, 70, 18),
  junior('f2_lansdale', 'Lansdale Racing', 'F2', 67, 68, 62, 16),
  junior('f2_okonkwo', 'Okonkwo Racing', 'F2', 60, 62, 54, 14),
  junior('f2_starline', 'Starline Motorsport', 'F2', 53, 55, 46, 12)
];

export function juniorTeamsFor(series: Series): Team[] {
  return JUNIOR_TEAMS.filter((t) => t.series === series);
}

export function freshJuniorTeams(): Record<string, Team> {
  const out: Record<string, Team> = {};
  for (const t of JUNIOR_TEAMS) out[t.id] = { ...t, carProfile: { ...t.carProfile } };
  return out;
}

/** Races per season by series — used for every stat the player sees. */
export const RACES_PER_SEASON: Record<Series, number> = {
  F4: 18,
  F3: 20,
  F2: 24,
  F1: 24
};

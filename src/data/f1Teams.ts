import type { F1TeamId, Team } from '../game/types';

/**
 * The 2026 Formula 1 grid — 11 teams, 22 seats.
 *
 * Identity (name, colour, id) is fixed forever. Every number below is a
 * STARTING VALUE for the simulation, not a claim about the real team: from
 * 2027 onwards `teamDevelopment` moves carPerformance around and the order
 * changes completely. Nothing in the engine may branch on a team id.
 */
export const F1_TEAM_IDS: F1TeamId[] = [
  'mclaren',
  'mercedes',
  'ferrari',
  'red_bull',
  'racing_bulls',
  'williams',
  'aston_martin',
  'haas',
  'alpine',
  'audi',
  'cadillac'
];

function team(
  id: F1TeamId,
  name: string,
  shortName: string,
  colour: string,
  carPerformance: number,
  development: number,
  prestige: number,
  stability: number,
  pressure: number,
  salaryPower: number,
  juniorDevelopment: number,
  driverOpportunity: number,
  championshipExpectation: number,
  reliability: number,
  carProfile: Team['carProfile']
): Team {
  return {
    id,
    name,
    shortName,
    series: 'F1',
    colour,
    carPerformance,
    development,
    prestige,
    stability,
    pressure,
    salaryPower,
    juniorDevelopment,
    driverOpportunity,
    championshipExpectation,
    reliability,
    carProfile
  };
}

export const F1_TEAMS: Record<F1TeamId, Team> = {
  mclaren: team(
    'mclaren', 'McLaren', 'MCL', '#FF8000',
    92, 88, 88, 84, 84, 86, 78, 64, 95, 93,
    { stability: 82, tyreManagement: 88, straightLineSpeed: 74, aeroSensitivity: 60, developmentPotential: 86 }
  ),
  mercedes: team(
    'mercedes', 'Mercedes', 'MER', '#00D7B6',
    88, 90, 94, 88, 86, 92, 80, 62, 92, 94,
    { stability: 86, tyreManagement: 72, straightLineSpeed: 88, aeroSensitivity: 66, developmentPotential: 88 }
  ),
  ferrari: team(
    'ferrari', 'Ferrari', 'FER', '#E8002D',
    88, 91, 100, 72, 100, 95, 84, 60, 100, 90,
    { stability: 70, tyreManagement: 78, straightLineSpeed: 84, aeroSensitivity: 78, developmentPotential: 84 }
  ),
  red_bull: team(
    'red_bull', 'Red Bull Racing', 'RBR', '#3671C6',
    86, 89, 92, 68, 96, 90, 92, 52, 96, 89,
    { stability: 58, tyreManagement: 80, straightLineSpeed: 82, aeroSensitivity: 90, developmentPotential: 90 }
  ),
  racing_bulls: team(
    'racing_bulls', 'Racing Bulls', 'RB', '#6692FF',
    72, 74, 60, 66, 62, 56, 90, 90, 52, 88,
    { stability: 68, tyreManagement: 66, straightLineSpeed: 76, aeroSensitivity: 72, developmentPotential: 70 }
  ),
  williams: team(
    'williams', 'Williams', 'WIL', '#64C4FF',
    74, 78, 78, 74, 64, 62, 64, 78, 60, 86,
    { stability: 76, tyreManagement: 62, straightLineSpeed: 90, aeroSensitivity: 58, developmentPotential: 78 }
  ),
  aston_martin: team(
    'aston_martin', 'Aston Martin', 'AMR', '#229971',
    76, 84, 70, 66, 80, 88, 60, 64, 76, 87,
    { stability: 74, tyreManagement: 70, straightLineSpeed: 70, aeroSensitivity: 82, developmentPotential: 88 }
  ),
  haas: team(
    'haas', 'Haas', 'HAA', '#B6BABD',
    68, 64, 52, 64, 54, 50, 46, 84, 46, 84,
    { stability: 72, tyreManagement: 54, straightLineSpeed: 80, aeroSensitivity: 62, developmentPotential: 56 }
  ),
  alpine: team(
    'alpine', 'Alpine', 'ALP', '#0093CC',
    66, 70, 68, 50, 74, 70, 76, 72, 58, 82,
    { stability: 64, tyreManagement: 68, straightLineSpeed: 66, aeroSensitivity: 70, developmentPotential: 72 }
  ),
  audi: team(
    'audi', 'Audi', 'AUD', '#CC0000',
    70, 88, 80, 76, 78, 90, 68, 74, 78, 85,
    { stability: 80, tyreManagement: 74, straightLineSpeed: 72, aeroSensitivity: 68, developmentPotential: 94 }
  ),
  cadillac: team(
    'cadillac', 'Cadillac', 'CAD', '#D4A94F',
    60, 72, 72, 72, 62, 94, 50, 88, 50, 80,
    { stability: 78, tyreManagement: 60, straightLineSpeed: 68, aeroSensitivity: 56, developmentPotential: 86 }
  )
};

/** Teams that run a junior academy the player can be signed to. */
export const ACADEMY_TEAM_IDS: F1TeamId[] = [
  'ferrari',
  'red_bull',
  'mercedes',
  'mclaren',
  'alpine',
  'williams'
];

export function freshF1Teams(): Record<string, Team> {
  const out: Record<string, Team> = {};
  for (const id of F1_TEAM_IDS) {
    out[id] = { ...F1_TEAMS[id], carProfile: { ...F1_TEAMS[id].carProfile } };
  }
  return out;
}

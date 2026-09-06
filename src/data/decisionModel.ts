import type {
  DriverStats,
  F1TeamId,
  GameState,
  OutcomeTone,
  SeasonResult,
  SimDriver
} from '../game/types';
import { Rng, clamp } from '../game/random';
import { overallOf, styleCeiling } from '../game/driverDevelopment';

/**
 * The shape of a decision, and the effect helpers every event uses.
 *
 * An option is either CERTAIN — one effect, stated plainly — or a GAMBLE with
 * two or three weighted outcomes. The odds shown to the player are the same
 * numbers the engine rolls against, so the card can never lie about the risk.
 */

export type DecisionPhase = 'preseason' | 'midseason' | 'offseason';

export interface DecisionContext {
  state: GameState;
  rng: Rng;
  teammate?: SimDriver;
  rival?: SimDriver;
  lastSeason?: SeasonResult;
}

export interface DecisionOutcomeDef {
  id: string;
  /** Relative weight. Normalised to whole percentages for display. */
  chance: number;
  /** Concrete and short — "Pace +2 · Reputation +3". */
  effect: string;
  /** One clause of colour, shown under the effect. */
  detail?: string;
  tone: OutcomeTone;
  apply: (ctx: DecisionContext) => string;
}

export interface DecisionOptionDef {
  id: string;
  label: string;
  detail?: string;
  /** Certain option: state the effect and apply it. */
  effect?: string;
  apply?: (ctx: DecisionContext) => string;
  /** Gamble: every outcome is shown, with its odds, before choosing. */
  outcomes?: DecisionOutcomeDef[];
}

export interface DecisionEvent {
  id: string;
  phase: DecisionPhase;
  tag: string;
  weight: number;
  once?: boolean;
  when: (ctx: DecisionContext) => boolean;
  build: (ctx: DecisionContext) => { title: string; body: string; options: DecisionOptionDef[] };
}

/** Normalise an option's outcomes into whole percentages that sum to 100. */
export function outcomePercentages(outcomes: DecisionOutcomeDef[]): number[] {
  const total = outcomes.reduce((sum, o) => sum + Math.max(0, o.chance), 0);
  if (total <= 0) return outcomes.map(() => Math.round(100 / outcomes.length));
  const raw = outcomes.map((o) => (Math.max(0, o.chance) / total) * 100);
  const rounded = raw.map((v) => Math.round(v));
  // Push any rounding drift onto the largest slice so the column always reads 100.
  const drift = 100 - rounded.reduce((a, b) => a + b, 0);
  if (drift !== 0) {
    let biggest = 0;
    for (let i = 1; i < rounded.length; i++) if (rounded[i] > rounded[biggest]) biggest = i;
    rounded[biggest] += drift;
  }
  return rounded;
}

/** Every option, certain or not, resolved to a uniform list of outcomes. */
export function optionOutcomes(option: DecisionOptionDef): DecisionOutcomeDef[] {
  if (option.outcomes && option.outcomes.length > 0) return option.outcomes;
  return [
    {
      id: 'certain',
      chance: 1,
      effect: option.effect ?? 'The season moves on.',
      tone: 'neutral',
      apply: option.apply ?? (() => '')
    }
  ];
}

// ---------------------------------------------------------------------------
// Effect helpers
// ---------------------------------------------------------------------------

export function stat(state: GameState, key: keyof DriverStats, amount: number): void {
  const current = state.player.stats[key];
  let next = current + amount;
  if (amount > 0) {
    // Decisions shape WHICH attributes grow and how fast they get there, but
    // they cannot lift a driver past the ceiling his hidden potential sets.
    // Without this, one decision a season compounds into a 98 for anybody.
    const ceiling = state.player.potential + styleCeiling(state.player.style, key) + 3;
    next = Math.min(next, Math.max(current, ceiling));
  }
  state.player.stats[key] = clamp(Math.round(next * 10) / 10, 20, 99);
  state.player.overall = overallOf(state.player.stats);
}

export function stats(state: GameState, changes: Partial<Record<keyof DriverStats, number>>): void {
  for (const [key, amount] of Object.entries(changes)) {
    stat(state, key as keyof DriverStats, amount as number);
  }
}

export function rep(state: GameState, amount: number): void {
  state.player.career.reputation = clamp(state.player.career.reputation + amount, 0, 100);
}

export function market(state: GameState, amount: number): void {
  state.player.career.marketability = clamp(state.player.career.marketability + amount, 0, 100);
}

export function bond(state: GameState, amount: number): void {
  state.player.career.teamRelationship = clamp(state.player.career.teamRelationship + amount, 0, 100);
}

export function rel(state: GameState, teamId: string, amount: number): void {
  if (!(teamId in state.relationships)) return;
  const id = teamId as F1TeamId;
  state.relationships[id] = clamp(state.relationships[id] + amount, -100, 100);
}

export function potential(state: GameState, amount: number): void {
  state.player.potential = clamp(state.player.potential + amount, 40, 99);
}

export function form(state: GameState, amount: number): void {
  state.player.form = clamp(state.player.form + amount, -10, 10);
}

export function money(state: GameState, millions: number): void {
  state.player.career.wealth = Math.max(0, state.player.career.wealth + millions);
  if (millions > 0) state.player.careerEarnings += millions;
}

export function carPace(state: GameState, teamId: string, amount: number): void {
  const team = state.teams[teamId];
  if (!team) return;
  team.carPerformance = clamp(team.carPerformance + amount, 36, 100);
}

// ---------------------------------------------------------------------------
// Condition helpers
// ---------------------------------------------------------------------------

export const isJunior = (ctx: DecisionContext) => ctx.state.player.series !== 'F1';
export const isF1 = (ctx: DecisionContext) =>
  ctx.state.player.series === 'F1' && !ctx.state.reserveTeamId;
export const currentTeam = (ctx: DecisionContext) => ctx.state.teams[ctx.state.player.teamId];

export function f1Seasons(state: GameState): number {
  return state.history.filter((h) => h.series === 'F1' && !h.reserveYear).length;
}

export function seasonsWithCurrentTeam(state: GameState): number {
  let count = 0;
  for (let i = state.history.length - 1; i >= 0; i--) {
    if (state.history[i].teamId === state.player.teamId) count++;
    else break;
  }
  return count;
}

export function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

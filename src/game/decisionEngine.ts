import type { GameState, OutcomeView, PendingDecision, RollInfo } from './types';
import type { DecisionContext, DecisionEvent, DecisionOptionDef, DecisionPhase } from '../data/decisions';
import { DECISION_EVENTS } from '../data/decisions';
import { optionOutcomes, outcomePercentages } from '../data/decisionModel';
import { Rng } from './random';
import { pickRival, teammateOf } from './driverMarket';

/** Everything a decision needs to know about the world it is firing into. */
export function decisionContext(state: GameState, rng: Rng): DecisionContext {
  return {
    state,
    rng,
    teammate: state.player.series === 'F1' ? teammateOf(state) : undefined,
    rival: state.rivalId ? state.drivers[state.rivalId] : pickRival(state),
    lastSeason: state.history[state.history.length - 1]
  };
}

/**
 * Built options are cached rather than rebuilt at apply time: a `build` may draw
 * random numbers (a sponsor's fee, which team is calling), and the player must
 * get exactly the deal that was on the card they read.
 */
const builtOptions = new Map<string, DecisionOptionDef[]>();

function eligible(state: GameState, ctx: DecisionContext, phase: DecisionPhase): DecisionEvent[] {
  return DECISION_EVENTS.filter((event) => {
    if (event.phase !== phase) return false;
    if (event.once && state.firedEvents.includes(event.id)) return false;
    // Never repeat an event while it is still fresh in the player's memory.
    if (state.firedEvents.slice(-4).includes(event.id)) return false;
    try {
      return event.when(ctx);
    } catch {
      return false;
    }
  });
}

/** The player-facing view of one option: its odds, spelled out. */
function optionView(option: DecisionOptionDef) {
  const outcomes = optionOutcomes(option);
  const percents = outcomePercentages(outcomes);
  const views: OutcomeView[] = outcomes.map((o, i) => ({
    id: o.id,
    percent: percents[i],
    effect: o.effect,
    detail: o.detail,
    tone: o.tone
  }));
  return {
    id: option.id,
    label: option.label,
    detail: option.detail,
    certain: outcomes.length === 1,
    outcomes: views
  };
}

/**
 * Choose the next decision for a phase, or null when nothing fits. Events the
 * player has never seen are weighted well above repeats.
 */
export function nextDecision(
  state: GameState,
  rng: Rng,
  phase: DecisionPhase
): PendingDecision | null {
  const ctx = decisionContext(state, rng);
  const pool = eligible(state, ctx, phase);
  if (pool.length === 0) return null;

  const event = rng.pickWeighted(pool, (e) =>
    e.weight * (state.firedEvents.includes(e.id) ? 0.4 : 1)
  );
  const built = event.build(ctx);
  builtOptions.set(event.id, built.options);

  return {
    kind: 'decision',
    eventId: event.id,
    tag: event.tag,
    title: built.title,
    body: built.body,
    options: built.options.map(optionView)
  };
}

/**
 * Apply the chosen option. The outcome is drawn against exactly the weights the
 * player was shown, and returned alongside the narration so the UI can play the
 * reveal before saying which one landed.
 */
export function applyDecision(
  state: GameState,
  rng: Rng,
  eventId: string,
  optionId: string
): { note: string; roll?: RollInfo } {
  const options = builtOptions.get(eventId);
  const option = options?.find((o) => o.id === optionId);
  state.firedEvents.push(eventId);
  if (!option) return { note: '' };
  builtOptions.delete(eventId);

  const outcomes = optionOutcomes(option);
  const ctx = decisionContext(state, rng);
  const chosen =
    outcomes.length === 1 ? outcomes[0] : rng.pickWeighted(outcomes, (o) => Math.max(0, o.chance));
  const note = chosen.apply(ctx);

  if (outcomes.length === 1) return { note };

  const view = optionView(option);
  return {
    note,
    roll: { optionLabel: option.label, outcomes: view.outcomes, resultId: chosen.id }
  };
}

export function resetDecisionCache(): void {
  builtOptions.clear();
}

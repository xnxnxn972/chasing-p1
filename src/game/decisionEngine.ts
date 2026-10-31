import type {
  GameState,
  InPlayFace,
  OutcomeView,
  PendingDecision,
  PendingRedFlag,
  RollInfo
} from './types';
import type { DecisionContext, DecisionEvent, DecisionOptionDef, DecisionPhase } from '../data/decisions';
import { DECISION_EVENTS } from '../data/decisions';
import { RED_FLAG_EVENTS, isCollectable } from '../data/redFlags';
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
): { note: string; roll?: RollInfo; taken?: TakenOption } {
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

  // Only a red flag fills these in, and only the retirement screen reads them.
  const taken: TakenOption = {
    pastTense: option.pastTense,
    fork: option.fork,
    leaves: [...(option.leaves ?? []), ...(chosen.leaves ?? [])],
    aftermath: chosen.aftermath
  };

  if (outcomes.length === 1) return { note, taken };

  const view = optionView(option);
  return {
    note,
    taken,
    roll: { optionLabel: option.label, outcomes: view.outcomes, resultId: chosen.id }
  };
}

/** What the chosen option left behind, for the thread drawn at retirement. */
export interface TakenOption {
  pastTense?: string;
  fork?: string;
  leaves: string[];
  aftermath?: string;
}

/**
 * Everything this career has genuinely left in play, which is both the pool
 * a red flag draws from and the list the board rolls through.
 *
 * The two are the same list on purpose. A board that rolls past situations
 * that could never have landed is a lie, and the near miss — the whole
 * reason the moment has any tension — only works if what went by was real.
 */
export function redFlagPool(state: GameState, rng: Rng) {
  const ctx = decisionContext(state, rng);
  return RED_FLAG_EVENTS.filter((event) => {
    if (state.firedEvents.includes(event.id)) return false;
    try {
      return event.when(ctx);
    } catch {
      return false;
    }
  });
}

/**
 * A red flag, or null when this career has left nothing in play yet.
 *
 * The collector is preferred when it is eligible: a card that exists to come
 * back for an earlier choice is wasted if it loses a coin flip to a wet race.
 */
export function nextRedFlag(state: GameState, rng: Rng): PendingRedFlag | null {
  const pool = redFlagPool(state, rng);
  if (pool.length === 0) return null;

  // The reckoning is preferred only when there is genuinely something for
  // it to come back for. At one red flag a career that never happens, so it
  // takes its turn with everything else rather than crowding them out.
  const collecting = (state.redFlagLog ?? []).some((r) => isCollectable(r.tags));
  const collectors = collecting ? pool.filter((e) => e.tag === 'The reckoning') : [];
  const event = collectors.length > 0 ? collectors[0] : rng.pick(pool);

  const ctx = decisionContext(state, rng);
  const built = event.build(ctx);
  builtOptions.set(event.id, built.options);

  const inPlay: InPlayFace[] = pool.map((e) => ({
    name: e.build === event.build ? built.title : faceName(e, ctx),
    group: e.tag
  }));

  return {
    kind: 'redflag',
    inPlay,
    decision: {
      kind: 'decision',
      eventId: event.id,
      tag: event.tag,
      title: built.title,
      body: built.body,
      options: built.options.map(optionView)
    }
  };
}

/**
 * The name of a situation that did NOT land, for the board to roll past.
 *
 * Built rather than hard-coded so the board can never show a name the card
 * would not have used. The options are thrown away: building a card costs a
 * few random draws, and the ones not taken must not move the career on, so
 * the throwaway build runs on a forked generator.
 */
function faceName(event: DecisionEvent, ctx: DecisionContext): string {
  try {
    return event.build({ ...ctx, rng: ctx.rng.fork(event.id) }).title;
  } catch {
    return event.tag;
  }
}

export function resetDecisionCache(): void {
  builtOptions.clear();
}

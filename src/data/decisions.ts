import type { DecisionEvent } from './decisionModel';
import { JUNIOR_EVENTS } from './decisionsJunior';
import { F1_EVENTS } from './decisionsF1';
import { LATE_EVENTS } from './decisionsLate';

/**
 * Decisions are the game. Each season fires roughly one of these; every option
 * either states a certain effect or lays out weighted outcomes with the odds
 * the engine will actually roll against.
 */
export const DECISION_EVENTS: DecisionEvent[] = [
  ...JUNIOR_EVENTS,
  ...F1_EVENTS,
  ...LATE_EVENTS
];

export type {
  DecisionContext,
  DecisionEvent,
  DecisionOptionDef,
  DecisionOutcomeDef,
  DecisionPhase
} from './decisionModel';

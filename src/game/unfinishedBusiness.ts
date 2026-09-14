import type { CareerTotals, GameState, SeasonResult } from './types';
import { computeTotals } from './careerVerdict';

/**
 * UNFINISHED BUSINESS
 *
 * A career ends and the game has nothing left to ask of you. That is the whole
 * problem: reaching the top is an exit, not a cliffhanger, and the players who
 * climb highest are the ones least likely to play again.
 *
 * So every career now ends by naming one thing you did NOT do, and carries it
 * into the next career as a stated ambition. It costs nothing to the player who
 * wants to stop, and it gives the player who nearly stopped a reason not to.
 *
 * The ladder below is ordered from "you were close" to "you have done almost
 * everything", and the FIRST unmet rung is the one offered. That matters: a
 * driver who never left Formula 4 is asked to reach Formula 1, not to win ten
 * races in a season. The ask has to look possible from where they are standing.
 */

export interface Ambition {
  id: string;
  /** Imperative, short enough to sit in a header. */
  label: string;
  /** What the last career failed to do, said plainly. */
  missed: string;
  /** Shown when they pull it off. */
  done: string;
  met: (state: GameState, totals: CareerTotals) => boolean;
}

function f1Seasons(state: GameState): SeasonResult[] {
  return state.history.filter((h) => h.series === 'F1' && !h.reserveYear);
}

export const AMBITIONS: Ambition[] = [
  {
    id: 'reach_f1',
    label: 'Reach Formula 1',
    missed: 'You never got a Formula 1 seat.',
    done: 'You got there. That is the part almost nobody manages.',
    met: (_s, t) => t.f1Starts > 0
  },
  {
    id: 'score_a_point',
    label: 'Score a championship point',
    missed: 'You raced in Formula 1 and never scored.',
    done: 'You got on the board.',
    met: (s) => f1Seasons(s).reduce((n, x) => n + x.points, 0) > 0
  },
  {
    id: 'first_podium',
    label: 'Stand on a podium',
    missed: 'You never finished in the top three.',
    done: 'A podium. Champagne and everything.',
    met: (_s, t) => t.f1Podiums > 0
  },
  {
    id: 'first_win',
    label: 'Win a Grand Prix',
    missed: 'You never won a race.',
    done: 'You won a Grand Prix. There is a very short list of people who can say that.',
    met: (_s, t) => t.f1Wins > 0
  },
  {
    id: 'first_title',
    label: 'Win the World Championship',
    missed: 'You never won the championship.',
    done: 'World Champion. Nobody can take the year off you.',
    met: (_s, t) => t.titles > 0
  },
  {
    id: 'back_to_back',
    label: 'Win two championships in a row',
    missed: 'You were champion, but never twice running.',
    done: 'Back-to-back. The hardest repeat in the sport.',
    met: (s) => {
      const seasons = f1Seasons(s);
      return seasons.some((x, i) => i > 0 && x.championshipPosition === 1 && seasons[i - 1].championshipPosition === 1);
    }
  },
  {
    id: 'underdog_title',
    label: 'Win a title with a team nobody rates',
    missed: 'Every championship you won came in a car that was already quick.',
    done: 'Champion in a car that had no business winning anything.',
    met: (s) =>
      f1Seasons(s).some(
        (x) => x.championshipPosition === 1 && (s.joinPaceRank[x.teamId] ?? 0) > 5
      )
  },
  {
    id: 'ferrari_win',
    label: 'Win a Grand Prix for Ferrari',
    missed: 'You never won in red.',
    done: 'A win for Ferrari. The tifosi will remember you for it.',
    met: (s) => f1Seasons(s).some((x) => x.teamId === 'ferrari' && x.wins > 0)
  },
  {
    id: 'big_season',
    label: 'Win ten races in a single season',
    missed: 'Your best season never reached ten wins.',
    done: 'Ten wins in one year. A season people will argue about for decades.',
    met: (s) => f1Seasons(s).some((x) => x.wins >= 10)
  },
  {
    id: 'race_at_forty',
    label: 'Still be racing at forty',
    missed: 'You retired before forty, like almost everyone does.',
    done: 'Forty years old and still on the grid.',
    met: (s) => f1Seasons(s).some((x) => x.age >= 40)
  }
];

export function ambitionById(id: string | undefined): Ambition | undefined {
  if (!id) return undefined;
  return AMBITIONS.find((a) => a.id === id);
}

/**
 * The next thing to chase: the first rung this career did not clear. Returns
 * undefined only for a career that has done literally everything on the ladder,
 * where the honest answer is that there is nothing left to ask.
 */
export function nextAmbition(state: GameState, totals?: CareerTotals): Ambition | undefined {
  const t = totals ?? computeTotals(state);
  return AMBITIONS.find((a) => !a.met(state, t));
}

/** Did the career just played deliver what the previous one set out to do? */
export function ambitionOutcome(
  state: GameState,
  totals?: CareerTotals
): { ambition: Ambition; met: boolean } | undefined {
  const ambition = ambitionById(state.ambitionId);
  if (!ambition) return undefined;
  return { ambition, met: ambition.met(state, totals ?? computeTotals(state)) };
}

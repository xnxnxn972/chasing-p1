import type {
  DriverStats,
  F1TeamId,
  GameState,
  SeasonResult,
  SimDriver
} from '../game/types';
import { Rng, clamp } from '../game/random';
import { overallOf } from '../game/driverDevelopment';
import { ACADEMY_TEAM_IDS } from './f1Teams';
import { formatMoney } from '../game/contractEngine';

/**
 * Decisions are the game. Each season fires one to three of these; every option
 * moves attributes, potential, reputation, money or a team relationship, and
 * returns the line of narration the player reads afterwards.
 */

export type DecisionPhase = 'preseason' | 'midseason' | 'offseason';

export interface DecisionContext {
  state: GameState;
  rng: Rng;
  teammate?: SimDriver;
  rival?: SimDriver;
  lastSeason?: SeasonResult;
}

export interface DecisionOptionDef {
  id: string;
  label: string;
  detail?: string;
  pros?: string[];
  cons?: string[];
  apply: (ctx: DecisionContext) => string;
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

// ---------------------------------------------------------------------------
// Effect helpers
// ---------------------------------------------------------------------------

function stat(state: GameState, key: keyof DriverStats, amount: number): void {
  state.player.stats[key] = clamp(Math.round((state.player.stats[key] + amount) * 10) / 10, 20, 99);
  state.player.overall = overallOf(state.player.stats);
}

function stats(state: GameState, changes: Partial<Record<keyof DriverStats, number>>): void {
  for (const [key, amount] of Object.entries(changes)) {
    stat(state, key as keyof DriverStats, amount as number);
  }
}

function rep(state: GameState, amount: number): void {
  state.player.career.reputation = clamp(state.player.career.reputation + amount, 0, 100);
}

function market(state: GameState, amount: number): void {
  state.player.career.marketability = clamp(state.player.career.marketability + amount, 0, 100);
}

function bond(state: GameState, amount: number): void {
  state.player.career.teamRelationship = clamp(state.player.career.teamRelationship + amount, 0, 100);
}

function rel(state: GameState, teamId: string, amount: number): void {
  if (!(teamId in state.relationships)) return;
  const id = teamId as F1TeamId;
  state.relationships[id] = clamp(state.relationships[id] + amount, -100, 100);
}

function potential(state: GameState, amount: number): void {
  state.player.potential = clamp(state.player.potential + amount, 40, 99);
}

function form(state: GameState, amount: number): void {
  state.player.form = clamp(state.player.form + amount, -10, 10);
}

function money(state: GameState, millions: number): void {
  state.player.career.wealth = Math.max(0, state.player.career.wealth + millions);
  if (millions > 0) state.player.careerEarnings += millions;
}

const isJunior = (ctx: DecisionContext) => ctx.state.player.series !== 'F1';
const isF1 = (ctx: DecisionContext) => ctx.state.player.series === 'F1' && !ctx.state.reserveTeamId;
const currentTeam = (ctx: DecisionContext) => ctx.state.teams[ctx.state.player.teamId];

function f1Seasons(state: GameState): number {
  return state.history.filter((h) => h.series === 'F1' && !h.reserveYear).length;
}

function seasonsWithCurrentTeam(state: GameState): number {
  let count = 0;
  for (let i = state.history.length - 1; i >= 0; i--) {
    if (state.history[i].teamId === state.player.teamId) count++;
    else break;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Junior career
// ---------------------------------------------------------------------------

const JUNIOR_EVENTS: DecisionEvent[] = [
  {
    id: 'junior_school',
    phase: 'preseason',
    tag: 'LIFE',
    weight: 10,
    once: true,
    when: (ctx) => isJunior(ctx) && ctx.state.player.age <= 18,
    build: (ctx) => ({
      title: 'SCHOOL OR THE CAR',
      body: `You are ${ctx.state.player.age}. The team has offered a full winter testing programme, but it clashes with your final school year. Your parents have an opinion. So does your engineer.`,
      options: [
        {
          id: 'test',
          label: 'DROP OUT AND TEST',
          detail: 'Every day in the car. No safety net.',
          pros: ['Faster development', 'Team notices the commitment'],
          cons: ['Nothing to fall back on'],
          apply: ({ state }) => {
            stats(state, { pace: 2.5, qualifying: 2, technical: 1.5 });
            potential(state, 1);
            rep(state, 3);
            return 'You spend the winter at test tracks in the rain. By March you are half a second quicker than you were in November.';
          }
        },
        {
          id: 'school',
          label: 'FINISH SCHOOL',
          detail: 'Race weekends only.',
          pros: ['Perspective and maturity', 'Stronger technical grounding'],
          cons: ['Less time in the car'],
          apply: ({ state }) => {
            stats(state, { technical: 2.5, consistency: 2 });
            market(state, 4);
            return 'You sit your exams and race at weekends. You arrive at each round underprepared but you learn to think your way through a session.';
          }
        }
      ]
    })
  },
  {
    id: 'junior_sponsor',
    phase: 'preseason',
    tag: 'MONEY',
    weight: 8,
    when: (ctx) => isJunior(ctx),
    build: (ctx) => {
      const amount = ctx.rng.range(0.4, 1.4);
      return {
        title: 'A SPONSOR CALLS',
        body: `A regional energy drink brand will put ${formatMoney(amount)} behind you for the season. They want twenty content days, a rebrand of your helmet, and your face on a billboard outside your home town.`,
        options: [
          {
            id: 'take',
            label: 'TAKE THE DEAL',
            pros: ['Funds the season', 'Builds your public profile'],
            cons: ['Twenty days out of the car'],
            apply: ({ state }) => {
              money(state, amount);
              market(state, 9);
              stats(state, { pace: -0.6, fitness: -0.5 });
              return `You shoot content in a wind tunnel wearing sunglasses. It pays for the season, and suddenly people outside the paddock know your name.`;
            }
          },
          {
            id: 'refuse',
            label: 'STAY FOCUSED',
            pros: ['All your time goes into driving'],
            cons: ['Money stays tight'],
            apply: ({ state }) => {
              stats(state, { pace: 1.2, consistency: 1 });
              return 'You turn it down. Your manager is furious. Your lap times are not.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'academy_invite',
    phase: 'offseason',
    tag: 'ACADEMY',
    weight: 14,
    when: (ctx) =>
      isJunior(ctx) &&
      !ctx.state.player.academyTeamId &&
      ctx.state.player.age <= 21 &&
      ctx.state.player.overall >= 55,
    build: (ctx) => {
      const teamId = ctx.rng.pickWeighted(
        ACADEMY_TEAM_IDS,
        (id) => ctx.state.teams[id].juniorDevelopment + (ctx.state.relationships[id] ?? 0) * 0.3
      );
      const team = ctx.state.teams[teamId];
      return {
        title: `${team.name.toUpperCase()} WANTS YOU`,
        body: `${team.name} has offered you a place in its junior programme. It is the fastest route to a Formula 1 seat that exists — and the fastest route out of the sport if you underperform.`,
        options: [
          {
            id: 'join',
            label: `JOIN ${team.shortName}`,
            detail: 'Faster route toward F1.',
            pros: ['Simulator and factory access', 'A real path to a seat', 'Reputation'],
            cons: ['Very high pressure', 'Less career control'],
            apply: ({ state }) => {
              state.player.academyTeamId = teamId;
              rel(state, teamId, 35);
              rep(state, 8);
              stats(state, { technical: 2, consistency: 1.5 });
              potential(state, team.juniorDevelopment > 82 ? 2 : 1);
              return `You sign. Your first simulator session at the factory runs until two in the morning and nobody thinks that is unusual.`;
            }
          },
          {
            id: 'independent',
            label: 'STAY INDEPENDENT',
            detail: 'Freedom, and nobody to answer to.',
            pros: ['Complete career control', 'No political ceiling'],
            cons: ['Less F1 access'],
            apply: ({ state }) => {
              rel(state, teamId, -12);
              stats(state, { pace: 1, racecraft: 1 });
              market(state, 3);
              return `You thank them and stay independent. Your manager tells you that door does not always open twice.`;
            }
          }
        ]
      };
    }
  },
  {
    id: 'junior_coach',
    phase: 'midseason',
    tag: 'DEVELOPMENT',
    weight: 7,
    when: (ctx) => isJunior(ctx),
    build: () => ({
      title: 'THE DRIVER COACH',
      body: 'A retired Grand Prix driver has offered to work with you for the rest of the season. He is expensive, blunt, and everything he says about your braking is correct.',
      options: [
        {
          id: 'hire',
          label: 'HIRE HIM',
          pros: ['Sharp technical gains', 'Fixes bad habits early'],
          cons: ['Costs money you barely have'],
          apply: ({ state }) => {
            money(state, -0.4);
            stats(state, { technical: 2, consistency: 2, qualifying: 1.5 });
            potential(state, 1);
            return 'He watches three onboards and tells you that you have been braking too early into every long corner for two years. He is right.';
          }
        },
        {
          id: 'alone',
          label: 'FIGURE IT OUT YOURSELF',
          pros: ['Keeps your money', 'Trusts your own instinct'],
          cons: ['Bad habits harden'],
          apply: ({ state }) => {
            stats(state, { pace: 1, racecraft: 1 });
            return 'You work it out yourself, slowly, one weekend at a time.';
          }
        }
      ]
    })
  },
  {
    id: 'junior_clash',
    phase: 'midseason',
    tag: 'POLITICS',
    weight: 8,
    when: (ctx) => isJunior(ctx),
    build: () => ({
      title: 'YOUR TEAM-MATE PUT YOU IN THE WALL',
      body: 'Turn four, lap one, running second and third. Your team-mate took your front wing off and finished on the podium while you walked back to the pits. The team have said nothing.',
      options: [
        {
          id: 'public',
          label: 'SAY IT ON CAMERA',
          pros: ['The paddock knows you will not be pushed around'],
          cons: ['The team will not forget it'],
          apply: ({ state }) => {
            rep(state, 4);
            market(state, 6);
            bond(state, -14);
            form(state, -1);
            return 'You say exactly what happened into a live microphone. It travels a long way. Your team manager stops making eye contact.';
          }
        },
        {
          id: 'private',
          label: 'HANDLE IT IN THE DEBRIEF',
          pros: ['Team trust', 'Seen as professional'],
          cons: ['Nothing publicly changes'],
          apply: ({ state }) => {
            bond(state, 10);
            stats(state, { consistency: 1 });
            return 'You keep it in the room. The engineers notice. So, quietly, does your team-mate.';
          }
        },
        {
          id: 'revenge',
          label: 'SETTLE IT ON TRACK',
          pros: ['Racecraft', 'Nobody tries it twice'],
          cons: ['Risk of another retirement'],
          apply: ({ state, rng }) => {
            stats(state, { racecraft: 2.5, consistency: -1 });
            if (rng.chance(0.5)) {
              rep(state, 5);
              return 'Three rounds later you leave him no room at all at the same corner. He lifts. The message lands.';
            }
            form(state, -2);
            rep(state, -3);
            return 'Three rounds later you go for the same move. Neither of you lifts, and both of you retire.';
          }
        }
      ]
    })
  },
  {
    id: 'junior_step_up',
    phase: 'offseason',
    tag: 'CAREER',
    weight: 9,
    when: (ctx) =>
      isJunior(ctx) &&
      ctx.state.player.series !== 'F2' &&
      (ctx.lastSeason?.championshipPosition ?? 99) <= 4,
    build: (ctx) => ({
      title: 'SKIP A RUNG?',
      body: `You finished ${ctx.lastSeason?.championshipPosition ?? 3}${ordinalSuffix(ctx.lastSeason?.championshipPosition ?? 3)} in ${ctx.state.player.series}. A team one level above has offered you a seat a year early. Your engineer thinks you need another season here.`,
      options: [
        {
          id: 'jump',
          label: 'GO UP EARLY',
          pros: ['A year closer to Formula 1', 'Racing stronger drivers'],
          cons: ['Risk of a chastening season'],
          apply: ({ state, rng }) => {
            rep(state, 6);
            if (rng.chance(0.55)) {
              potential(state, 2);
              stats(state, { pace: 1.5, racecraft: 1.5 });
              return 'You go up, and you cope. Everything about the way you drive gets sharper against faster drivers.';
            }
            stats(state, { consistency: -1.5 });
            form(state, -2);
            return 'You go up and spend the first half of the season out of your depth. It is a hard year.';
          }
        },
        {
          id: 'stay',
          label: 'ONE MORE YEAR HERE',
          pros: ['Dominate the level', 'Build unshakeable confidence'],
          cons: ['A year of your career'],
          apply: ({ state }) => {
            stats(state, { consistency: 2, qualifying: 1.5 });
            form(state, 2);
            return 'You stay, and you spend a season being the driver everyone else is measured against.';
          }
        }
      ]
    })
  },
  {
    id: 'junior_f1_test',
    phase: 'midseason',
    tag: 'OPPORTUNITY',
    weight: 12,
    when: (ctx) => ctx.state.player.series === 'F2' || (isJunior(ctx) && ctx.state.player.overall > 68),
    build: (ctx) => {
      const teamId = ctx.state.player.academyTeamId
        ? ctx.state.player.academyTeamId
        : ctx.rng.pickWeighted(ACADEMY_TEAM_IDS, (id) => ctx.state.teams[id].driverOpportunity);
      const team = ctx.state.teams[teamId];
      return {
        title: 'A FORMULA 1 TEST',
        body: `${team.name} have offered you a young driver test. It falls the week before the most important round of your season, and you would arrive at that round having done no preparation at all.`,
        options: [
          {
            id: 'test',
            label: 'TAKE THE TEST',
            pros: ['First taste of an F1 car', 'Serious relationship gain'],
            cons: ['Your championship weekend suffers'],
            apply: ({ state }) => {
              rel(state, teamId, 18);
              rep(state, 7);
              stats(state, { technical: 1.5, pace: 1 });
              form(state, -1.5);
              return `You do 96 laps. The downforce takes your breath away, literally, for the first ten. ${team.name} keep the data and say very little.`;
            }
          },
          {
            id: 'focus',
            label: 'FOCUS ON YOUR SEASON',
            pros: ['Championship first'],
            cons: ['A Formula 1 team notices the refusal'],
            apply: ({ state }) => {
              rel(state, teamId, -8);
              form(state, 2);
              return 'You tell them the championship comes first. Some people in that motorhome respect it. Some do not.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'junior_fitness',
    phase: 'preseason',
    tag: 'PREPARATION',
    weight: 6,
    when: (ctx) => isJunior(ctx) || f1Seasons(ctx.state) <= 2,
    build: () => ({
      title: 'WINTER',
      body: 'Ten weeks with nothing in the calendar. Your trainer has written a brutal programme. Your friends are going away for a month.',
      options: [
        {
          id: 'train',
          label: 'DO THE PROGRAMME',
          pros: ['Fitness', 'Late-race strength'],
          cons: ['A joyless winter'],
          apply: ({ state }) => {
            stats(state, { fitness: 3, consistency: 1 });
            return 'You come back with a neck that no longer gives up in the last ten laps.';
          }
        },
        {
          id: 'rest',
          label: 'ACTUALLY REST',
          pros: ['Mental freshness', 'A life outside the car'],
          cons: ['Physically behind the others'],
          apply: ({ state }) => {
            form(state, 2);
            stats(state, { fitness: -0.5, pace: 0.8 });
            return 'You disappear for a month and come back genuinely wanting to drive again.';
          }
        }
      ]
    })
  }
];

// ---------------------------------------------------------------------------
// Formula 1
// ---------------------------------------------------------------------------

const F1_EVENTS: DecisionEvent[] = [
  {
    id: 'team_orders',
    phase: 'midseason',
    tag: 'TEAM ORDERS',
    weight: 12,
    when: (ctx) => isF1(ctx) && Boolean(ctx.teammate),
    build: (ctx) => {
      const mate = ctx.teammate!;
      const team = currentTeam(ctx);
      return {
        title: 'LET HIM THROUGH',
        body: `You are running ahead of ${mate.name} with eleven laps left. He is in the championship fight and you are not. The radio call comes: hold position is not what they said.`,
        options: [
          {
            id: 'obey',
            label: 'LET HIM PAST',
            pros: ['Team relationship', 'Seen as a professional'],
            cons: ['You gave away a result'],
            apply: ({ state }) => {
              bond(state, 16);
              rel(state, team.id, 12);
              rep(state, -2);
              return `You move over on the back straight. ${mate.name} does not thank you on the radio. The team principal does, twice, in the debrief.`;
            }
          },
          {
            id: 'refuse',
            label: 'IGNORE THE CALL',
            pros: ['The paddock sees a racer', 'You keep the result'],
            cons: ['Serious damage inside the team'],
            apply: ({ state }) => {
              bond(state, -22);
              rel(state, team.id, -18);
              rep(state, 7);
              market(state, 8);
              return `You turn the radio volume down and keep the position. It is the lead item on every broadcast for a week.`;
            }
          },
          {
            id: 'negotiate',
            label: 'ASK WHAT YOU GET FOR IT',
            pros: ['Leverage for next season'],
            cons: ['They will remember you priced it'],
            apply: ({ state, rng }) => {
              if (rng.chance(0.5)) {
                bond(state, 6);
                rel(state, team.id, 6);
                money(state, 2);
                return 'You move over — and the following week your manager signs a bonus schedule that did not exist before.';
              }
              bond(state, -8);
              return 'You ask the question on an open channel. They give you nothing, and you move over anyway.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'dev_direction',
    phase: 'midseason',
    tag: 'DEVELOPMENT',
    weight: 9,
    when: (ctx) => isF1(ctx),
    build: (ctx) => {
      const team = currentTeam(ctx);
      return {
        title: 'THE UPGRADE ARGUMENT',
        body: `${team.name} can chase one development direction for the rest of the year. You want a more stable rear end. Your team-mate wants front-end bite. The aero group is split and the team principal wants a decision from the drivers.`,
        options: [
          {
            id: 'mine',
            label: 'PUSH YOUR DIRECTION',
            pros: ['A car built around you'],
            cons: ['If it fails, it is your failure'],
            apply: ({ state, rng }) => {
              stats(state, { technical: 1.5 });
              if (rng.chance(0.62)) {
                form(state, 3);
                bond(state, 10);
                rel(state, team.id, 8);
                return 'The upgrade works. From the summer break onwards the car does exactly what you ask of it.';
              }
              form(state, -3);
              bond(state, -12);
              return 'The upgrade does not work. You spend four months driving a car that everyone knows you asked for.';
            }
          },
          {
            id: 'his',
            label: 'BACK YOUR TEAM-MATE',
            pros: ['Political goodwill', 'Team unity'],
            cons: ['A car built for someone else'],
            apply: ({ state }) => {
              bond(state, 14);
              rel(state, team.id, 6);
              stats(state, { technical: 1, consistency: 1 });
              form(state, -1);
              return 'You back his direction publicly. The car gets faster and slightly harder for you to drive.';
            }
          },
          {
            id: 'stay_out',
            label: 'LET THE ENGINEERS DECIDE',
            pros: ['No blame either way'],
            cons: ['You gave up your influence'],
            apply: ({ state }) => {
              stats(state, { technical: 0.5 });
              return 'You tell them it is their call. It is a defensible answer and nobody is inspired by it.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'principal_criticism',
    phase: 'midseason',
    tag: 'REPUTATION',
    weight: 8,
    when: (ctx) => isF1(ctx) && ctx.state.player.career.teamRelationship < 62,
    build: (ctx) => {
      const team = currentTeam(ctx);
      return {
        title: 'PUBLICLY CRITICISED',
        body: `Your team principal has told a broadcaster that ${team.name} "expect considerably more" from your side of the garage. Your phone has not stopped. There is a press conference in two hours.`,
        options: [
          {
            id: 'fire_back',
            label: 'ANSWER IN PUBLIC',
            pros: ['You defend yourself'],
            cons: ['An open war with your own team'],
            apply: ({ state }) => {
              rep(state, 3);
              market(state, 7);
              bond(state, -18);
              rel(state, team.id, -14);
              return 'You point out, on camera, which of the two cars has finished every race this season. It is quotable. It is not forgiven.';
            }
          },
          {
            id: 'absorb',
            label: 'TAKE IT ON THE CHIN',
            pros: ['Team relationship recovers'],
            cons: ['The narrative sticks to you'],
            apply: ({ state }) => {
              bond(state, 12);
              rep(state, -4);
              form(state, 1);
              return 'You say he is right and that you will be better. Half the paddock thinks you are a professional. The other half thinks you are finished.';
            }
          },
          {
            id: 'answer_on_track',
            label: 'SAY NOTHING AND DRIVE',
            pros: ['Everything rides on results'],
            cons: ['A quiet driver is easy to replace'],
            apply: ({ state, rng }) => {
              form(state, 2.5);
              stats(state, { consistency: 1 });
              if (rng.chance(0.5)) {
                rep(state, 5);
                bond(state, 8);
                return 'You refuse to answer the question and out-qualify your team-mate at the next four races. The subject closes itself.';
              }
              return 'You refuse to answer the question and go back to work. The story runs for another month.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'teammate_accusation',
    phase: 'midseason',
    tag: 'RIVALRY',
    weight: 8,
    when: (ctx) => isF1(ctx) && Boolean(ctx.teammate),
    build: (ctx) => ({
      title: 'HE SAYS YOU IGNORED THE CALL',
      body: `${ctx.teammate!.name} has told the press you ignored a team instruction at the last race. You did not. The team has not corrected him.`,
      options: [
        {
          id: 'release_radio',
          label: 'ASK FOR THE RADIO TO BE RELEASED',
          pros: ['The truth, on the record'],
          cons: ['You made the team choose a side'],
          apply: ({ state }) => {
            rep(state, 7);
            bond(state, -10);
            return 'The audio is published. You were right. Nobody in the garage enjoys the week that follows.';
          }
        },
        {
          id: 'let_it_go',
          label: 'LET IT GO',
          pros: ['Keeps the garage calm'],
          cons: ['The accusation stands'],
          apply: ({ state }) => {
            bond(state, 8);
            rep(state, -4);
            return 'You let it stand. It gets repeated for years by people who never checked.';
          }
        }
      ]
    })
  },
  {
    id: 'radical_car',
    phase: 'offseason',
    tag: 'RISK',
    weight: 10,
    when: (ctx) => isF1(ctx),
    build: (ctx) => {
      const team = currentTeam(ctx);
      return {
        title: 'THE RADICAL CAR',
        body: `${team.name} have produced a genuinely radical concept for next year's regulations. In the simulator it is either the fastest car they have ever built or undriveable, depending on which engineer you ask. They want your backing before they commit.`,
        options: [
          {
            id: 'back',
            label: 'BACK THE RADICAL CAR',
            pros: ['Enormous upside', 'The engineers will remember it'],
            cons: ['It might not work at all'],
            apply: ({ state, rng }) => {
              rel(state, team.id, 10);
              const swing = rng.chance(0.5) ? rng.range(4, 9) : -rng.range(3, 8);
              state.teams[team.id].carPerformance = clamp(
                state.teams[team.id].carPerformance + swing,
                36,
                100
              );
              return swing > 0
                ? 'You back it. In February the car is two seconds a lap quicker than anything they have built in a decade.'
                : 'You back it. In February the car will not turn, and there is no time left to build another one.';
            }
          },
          {
            id: 'conservative',
            label: 'DEMAND THE SAFE CAR',
            pros: ['Predictable, developable machinery'],
            cons: ['You will never lead the field with it'],
            apply: ({ state }) => {
              const t = state.teams[team.id];
              t.carPerformance = clamp(t.carPerformance + 1.5, 36, 100);
              t.development = clamp(t.development + 2, 40, 100);
              rel(state, team.id, -4);
              return 'You ask for an evolution of this year’s car. It is a solid, sensible machine, and the aero group quietly resents you for a year.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'sponsor_days',
    phase: 'preseason',
    tag: 'MONEY',
    weight: 7,
    when: (ctx) => isF1(ctx),
    build: (ctx) => {
      const amount = ctx.rng.range(2, 7);
      return {
        title: 'THE COMMERCIAL CALENDAR',
        body: `Your title sponsor wants thirty additional appearance days next season. They will pay ${formatMoney(amount)} personally, on top of your salary.`,
        options: [
          {
            id: 'accept',
            label: 'DO THE DAYS',
            pros: ['Serious money', 'Brand growth'],
            cons: ['Thirty days not spent preparing'],
            apply: ({ state }) => {
              money(state, amount);
              market(state, 10);
              stats(state, { fitness: -1, technical: -0.5 });
              return 'You spend most of your winter in airports and photo studios. The money is real.';
            }
          },
          {
            id: 'refuse',
            label: 'REFUSE',
            pros: ['A full winter of preparation'],
            cons: ['The commercial department is unimpressed'],
            apply: ({ state }) => {
              stats(state, { fitness: 1.5, technical: 1 });
              bond(state, -5);
              return 'You tell them you are a racing driver. The commercial director writes the word "difficult" in an email.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'title_fight_risk',
    phase: 'midseason',
    tag: 'THE MOMENT',
    weight: 14,
    when: (ctx) => isF1(ctx) && ctx.state.player.overall > 78 && currentTeam(ctx).carPerformance > 74,
    build: (ctx) => ({
      title: 'LAST CORNER, LAST LAP',
      body: `${ctx.rival ? ctx.rival.name : 'The championship leader'} is half a car length ahead into the final corner of the race. The gap on the inside is not quite a gap.`,
      options: [
        {
          id: 'send',
          label: 'SEND IT',
          pros: ['Win the race, and the legend'],
          cons: ['Both of you might be in the wall'],
          apply: ({ state, rng }) => {
            stats(state, { racecraft: 1.5 });
            if (rng.chance(0.45)) {
              rep(state, 12);
              market(state, 12);
              form(state, 3);
              return 'You go for the gap. It closes. You are through anyway, wheels locked, smoke everywhere, and the crowd is on its feet.';
            }
            rep(state, -6);
            form(state, -3);
            bond(state, -10);
            return 'You go for the gap. It closes. You take both of you out and spend a fortnight explaining yourself.';
          }
        },
        {
          id: 'settle',
          label: 'TAKE SECOND',
          pros: ['Points, and a car in one piece'],
          cons: ['You will replay it for years'],
          apply: ({ state }) => {
            stats(state, { consistency: 1.5 });
            bond(state, 6);
            rep(state, -1);
            return 'You lift. Second place. The engineers are delighted and you barely speak on the flight home.';
          }
        }
      ]
    })
  },
  {
    id: 'injury_risk',
    phase: 'midseason',
    tag: 'FITNESS',
    weight: 6,
    when: (ctx) => ctx.state.player.age >= 20,
    build: () => ({
      title: 'CRACKED RIBS',
      body: 'A training accident has left you with two cracked ribs eight days before the next round. The doctors will clear you if you insist. Breathing hurts.',
      options: [
        {
          id: 'race',
          label: 'RACE ANYWAY',
          pros: ['Nobody sees your seat empty'],
          cons: ['Weeks of compromised performance'],
          apply: ({ state }) => {
            rep(state, 6);
            bond(state, 8);
            form(state, -2.5);
            stats(state, { fitness: -1.5 });
            return 'You get out of the car after the race and cannot lift your arms. You also finished, which is the entire point.';
          }
        },
        {
          id: 'sit_out',
          label: 'SIT IT OUT',
          pros: ['Full recovery'],
          cons: ['A reserve driver gets your car'],
          apply: ({ state, rng }) => {
            stats(state, { fitness: 1 });
            form(state, 1);
            if (rng.chance(0.35)) {
              bond(state, -8);
              return 'You sit out one round. Your replacement scores points and gives a very good interview afterwards.';
            }
            return 'You sit out one round, heal properly, and come back sharp.';
          }
        }
      ]
    })
  },
  {
    id: 'mentor_rookie',
    phase: 'preseason',
    tag: 'LEADERSHIP',
    weight: 7,
    when: (ctx) => isF1(ctx) && ctx.state.player.age >= 29 && Boolean(ctx.teammate) && (ctx.teammate?.age ?? 99) <= 23,
    build: (ctx) => ({
      title: 'THE KID IN THE OTHER CAR',
      body: `${ctx.teammate!.name} is ${ctx.teammate!.age} and has been given the seat next to yours. He is quick. He is also completely lost, and he keeps asking you questions in the debrief.`,
      options: [
        {
          id: 'help',
          label: 'TEACH HIM EVERYTHING',
          pros: ['The team sees a leader', 'Deep engineering respect'],
          cons: ['You are arming your own replacement'],
          apply: ({ state }) => {
            bond(state, 18);
            rel(state, state.player.teamId, 12);
            rep(state, 5);
            stats(state, { technical: 1.5 });
            return 'You give him your data, your references, your braking markers. Within six races he is within a tenth of you.';
          }
        },
        {
          id: 'withhold',
          label: 'GIVE HIM NOTHING',
          pros: ['Protects your position'],
          cons: ['The garage notices'],
          apply: ({ state }) => {
            bond(state, -10);
            form(state, 1.5);
            return 'You answer his questions with the shortest true sentence available. He works it out alone, eventually, and remembers.';
          }
        }
      ]
    })
  },
  {
    id: 'media_feud',
    phase: 'midseason',
    tag: 'RIVALRY',
    weight: 8,
    when: (ctx) => isF1(ctx) && Boolean(ctx.rival),
    build: (ctx) => ({
      title: `${ctx.rival!.name.toUpperCase()} HAS BEEN TALKING`,
      body: `${ctx.rival!.name} has told a magazine that you are "the most overrated driver of your generation" and that he has never once had to actually race you.`,
      options: [
        {
          id: 'respond',
          label: 'GIVE IT BACK',
          pros: ['The public loves it', 'Enormous marketability'],
          cons: ['You have made it personal'],
          apply: ({ state }) => {
            market(state, 14);
            rep(state, 3);
            form(state, 1);
            if (state.rivalId && state.drivers[state.rivalId]) state.drivers[state.rivalId].clashes += 1;
            return 'Your answer is better than his. It runs on every feed for four days and the next time you meet on track neither of you gives an inch.';
          }
        },
        {
          id: 'ignore',
          label: 'REFUSE TO ENGAGE',
          pros: ['Total professionalism'],
          cons: ['He gets the last word'],
          apply: ({ state }) => {
            rep(state, 4);
            stats(state, { consistency: 1 });
            return 'You say he is entitled to his opinion and change the subject to tyre degradation. It is a masterclass in saying nothing.';
          }
        }
      ]
    })
  },
  {
    id: 'contract_clause',
    phase: 'offseason',
    tag: 'CONTRACT',
    weight: 9,
    when: (ctx) =>
      isF1(ctx) &&
      ctx.state.player.contract.seasons > 0 &&
      currentTeam(ctx).carPerformance < 70 &&
      ctx.state.player.overall > 80,
    build: (ctx) => {
      const team = currentTeam(ctx);
      return {
        title: 'THE RELEASE CLAUSE',
        body: `Your contract with ${team.name} has ${ctx.state.player.contract.seasons} season(s) left, and a clause your manager put in three years ago that nobody expected to use. The car is not good enough. You can walk.`,
        options: [
          {
            id: 'activate',
            label: 'ACTIVATE THE CLAUSE',
            pros: ['Free on the open market'],
            cons: ['No guarantee anyone is waiting', 'Burns the relationship'],
            apply: ({ state }) => {
              state.player.contract.seasons = 0;
              rel(state, team.id, -25);
              bond(state, -25);
              rep(state, 2);
              return `You trigger it. ${team.name} release a two-line statement thanking you for your service.`;
            }
          },
          {
            id: 'honour',
            label: 'HONOUR THE CONTRACT',
            pros: ['Reputation as a driver who keeps his word'],
            cons: ['More seasons in a slow car'],
            apply: ({ state }) => {
              rel(state, team.id, 22);
              bond(state, 18);
              rep(state, 6);
              return 'You stay. The team principal tells the press he has never had a driver like you, and for once he means it.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'loyalty_pay_cut',
    phase: 'offseason',
    tag: 'LOYALTY',
    weight: 8,
    when: (ctx) => isF1(ctx) && seasonsWithCurrentTeam(ctx.state) >= 3,
    build: (ctx) => {
      const team = currentTeam(ctx);
      const cut = Math.max(1, Math.round(ctx.state.player.contract.salary * 0.3));
      return {
        title: 'THEY WANT YOU TO TAKE LESS',
        body: `${team.name} are up against the cost cap. They have asked you to give up ${formatMoney(cut)} a season so the money can go into the aerodynamics department instead.`,
        options: [
          {
            id: 'accept',
            label: 'TAKE THE CUT',
            pros: ['A faster car', 'Permanent goodwill'],
            cons: ['Real money, gone'],
            apply: ({ state }) => {
              state.player.contract.salary = Math.max(1, state.player.contract.salary - cut);
              const t = state.teams[team.id];
              t.carPerformance = clamp(t.carPerformance + 2.5, 36, 100);
              t.development = clamp(t.development + 3, 40, 100);
              rel(state, team.id, 25);
              bond(state, 20);
              return 'You take the cut. Two updates arrive that were not on the plan, and the second one works.';
            }
          },
          {
            id: 'refuse',
            label: 'KEEP YOUR MONEY',
            pros: ['You earned it'],
            cons: ['They will remember at contract time'],
            apply: ({ state }) => {
              rel(state, team.id, -14);
              bond(state, -12);
              return 'You point out that you are not the one who overspent. It is true and it does not help.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'politics_veto',
    phase: 'offseason',
    tag: 'POLITICS',
    weight: 9,
    when: (ctx) => isF1(ctx) && ctx.state.player.career.teamRelationship > 68 && f1Seasons(ctx.state) >= 3,
    build: (ctx) => {
      const team = currentTeam(ctx);
      const target = Object.values(ctx.state.drivers)
        .filter((d) => d.series === 'F1' && d.id !== ctx.teammate?.id)
        .sort((a, b) => b.overall - a.overall)[0];
      return {
        title: 'THEY ARE ASKING YOUR OPINION',
        body: `${team.name} are about to sign ${target ? target.name : 'a highly rated young driver'} into the other car. Because of who you are here, they have asked what you think first. Everyone in the room knows what that question really is.`,
        options: [
          {
            id: 'veto',
            label: 'BLOCK THE SIGNING',
            pros: ['You stay unchallenged'],
            cons: ['A weaker team-mate means a weaker team', 'It will leak'],
            apply: ({ state }) => {
              const t = state.teams[team.id];
              t.carPerformance = clamp(t.carPerformance - 1.5, 36, 100);
              rep(state, -8);
              bond(state, 6);
              market(state, -5);
              return 'They sign someone else. Within a year the story of why is in three books and both paddock podcasts.';
            }
          },
          {
            id: 'welcome',
            label: 'TELL THEM TO SIGN HIM',
            pros: ['A stronger team', 'Nothing to prove'],
            cons: ['You have invited a real fight'],
            apply: ({ state }) => {
              const t = state.teams[team.id];
              t.carPerformance = clamp(t.carPerformance + 2, 36, 100);
              t.development = clamp(t.development + 2, 40, 100);
              rep(state, 8);
              form(state, -1);
              return 'You tell them to sign him, and that you will beat him. The room goes quiet in a way you enjoy.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'brand_business',
    phase: 'offseason',
    tag: 'MONEY',
    weight: 6,
    when: (ctx) => ctx.state.player.career.wealth > 12 && f1Seasons(ctx.state) >= 2,
    build: (ctx) => {
      const stake = Math.min(ctx.state.player.career.wealth * 0.35, 14);
      return {
        title: 'OFF-TRACK',
        body: `A karting circuit and academy has come up for sale near where you grew up. It would take ${formatMoney(stake)} and most of your attention for a winter.`,
        options: [
          {
            id: 'buy',
            label: 'BUY IT',
            pros: ['A life after racing', 'Public affection'],
            cons: ['Money and focus'],
            apply: ({ state, rng }) => {
              money(state, -stake);
              market(state, 12);
              rep(state, 4);
              if (rng.chance(0.6)) {
                money(state, stake * rng.range(1.4, 2.6));
                return 'You buy it, rename it after your first team, and within four years it is producing drivers and money.';
              }
              return 'You buy it. It costs more than you were told, every year, and you would do it again.';
            }
          },
          {
            id: 'decline',
            label: 'STAY FOCUSED ON DRIVING',
            pros: ['Undivided attention'],
            cons: ['Someone else buys it'],
            apply: ({ state }) => {
              form(state, 1.5);
              stats(state, { pace: 0.6 });
              return 'You let it go. There will be time for all of that later, which is what everyone says.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'engineer_change',
    phase: 'preseason',
    tag: 'GARAGE',
    weight: 6,
    when: (ctx) => isF1(ctx) && f1Seasons(ctx.state) >= 2,
    build: () => ({
      title: 'YOUR RACE ENGINEER',
      body: 'You have never quite clicked with your race engineer. There is a younger one on the simulator side who reads a session the way you do. Moving him would cost the team a fight it does not want.',
      options: [
        {
          id: 'demand',
          label: 'DEMAND THE CHANGE',
          pros: ['A voice that understands you'],
          cons: ['You spent political capital on it'],
          apply: ({ state, rng }) => {
            bond(state, -8);
            if (rng.chance(0.72)) {
              stats(state, { qualifying: 2, consistency: 1.5, technical: 1 });
              form(state, 2);
              return 'You get him. Your first qualifying session together is the best of your career.';
            }
            form(state, -1);
            return 'You get him, and it takes most of a season for the two of you to find a rhythm.';
          }
        },
        {
          id: 'stay',
          label: 'MAKE IT WORK',
          pros: ['Garage harmony'],
          cons: ['You keep translating for each other'],
          apply: ({ state }) => {
            bond(state, 10);
            stats(state, { consistency: 0.8 });
            return 'You sit down with him for two hours and agree on a language. It is better. It is not what you wanted.';
          }
        }
      ]
    })
  },
  {
    id: 'home_race',
    phase: 'midseason',
    tag: 'HOME',
    weight: 5,
    when: (ctx) => isF1(ctx),
    build: (ctx) => ({
      title: 'YOUR HOME GRAND PRIX',
      body: `${ctx.state.player.flag} Everyone you have ever met wants a paddock pass. There are 120 requests and a national broadcaster wants you all Thursday.`,
      options: [
        {
          id: 'give',
          label: 'GIVE THEM THE WEEKEND',
          pros: ['A hero at home', 'Marketability'],
          cons: ['No preparation at all'],
          apply: ({ state }) => {
            market(state, 12);
            rep(state, 3);
            form(state, -1.5);
            return 'You sign everything, hug everyone, and arrive at first practice having slept four hours.';
          }
        },
        {
          id: 'lock_down',
          label: 'SHUT IT ALL OUT',
          pros: ['A clean weekend'],
          cons: ['People at home take it badly'],
          apply: ({ state }) => {
            form(state, 2);
            market(state, -6);
            return 'You do the mandatory media and nothing else. It is the best qualifying lap you have driven all year.';
          }
        }
      ]
    })
  },
  {
    id: 'stewards_appeal',
    phase: 'midseason',
    tag: 'STEWARDS',
    weight: 5,
    when: (ctx) => isF1(ctx),
    build: () => ({
      title: 'FIVE-SECOND PENALTY',
      body: 'You have lost a podium to a penalty for a move that has gone unpunished twice this season. The team can appeal, which will take three weeks and irritate the governing body.',
      options: [
        {
          id: 'appeal',
          label: 'APPEAL IT',
          pros: ['Might get the result back'],
          cons: ['The stewards are human'],
          apply: ({ state, rng }) => {
            if (rng.chance(0.4)) {
              rep(state, 6);
              return 'The penalty is overturned. The podium is reinstated in a hotel conference room eighteen days later.';
            }
            rep(state, -3);
            return 'The appeal fails, and you spend the rest of the year being looked at very carefully by race control.';
          }
        },
        {
          id: 'accept',
          label: 'LET IT GO',
          pros: ['Goodwill from officials'],
          cons: ['The result stands'],
          apply: ({ state }) => {
            rep(state, 2);
            form(state, 1);
            return 'You say the stewards have a hard job. Two races later a marginal call goes your way.';
          }
        }
      ]
    })
  },
  {
    id: 'weight_of_expectation',
    phase: 'preseason',
    tag: 'PRESSURE',
    weight: 7,
    when: (ctx) => isF1(ctx) && currentTeam(ctx).pressure > 82 && seasonsWithCurrentTeam(ctx.state) <= 1,
    build: (ctx) => {
      const team = currentTeam(ctx);
      return {
        title: `THE ${team.name.toUpperCase()} PROBLEM`,
        body: `You have driven for ${team.name} for one winter and you already understand the thing everyone tries to explain about this place. Every session is a referendum. There is a way to survive it and a way to be swallowed by it.`,
        options: [
          {
            id: 'embrace',
            label: 'EMBRACE IT',
            pros: ['The crowd is yours', 'Enormous profile'],
            cons: ['Nowhere to hide when it goes wrong'],
            apply: ({ state }) => {
              market(state, 12);
              rep(state, 5);
              form(state, 2);
              stats(state, { consistency: -0.8 });
              return 'You lean into it completely. Two hundred thousand people learn your name and they will not be gentle with it.';
            }
          },
          {
            id: 'insulate',
            label: 'BUILD A WALL AROUND YOURSELF',
            pros: ['Consistency', 'Nothing gets in'],
            cons: ['You will be called cold'],
            apply: ({ state }) => {
              stats(state, { consistency: 2.5, technical: 1 });
              market(state, -6);
              bond(state, 4);
              return 'You stop reading anything. The lap times get metronomic and the press decide you have no personality.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'reserve_call',
    phase: 'midseason',
    tag: 'OPPORTUNITY',
    weight: 20,
    when: (ctx) => Boolean(ctx.state.reserveTeamId),
    build: (ctx) => {
      const team = ctx.state.teams[ctx.state.reserveTeamId!];
      return {
        title: 'THE CALL',
        body: `A race driver at ${team.name} is unwell on Saturday morning. You have never driven this car in anger and qualifying is in four hours.`,
        options: [
          {
            id: 'send',
            label: 'DRIVE IT LIKE YOU STOLE IT',
            pros: ['One chance to be unforgettable'],
            cons: ['One chance to be forgotten'],
            apply: ({ state, rng }) => {
              if (rng.chance(0.5)) {
                rep(state, 14);
                market(state, 10);
                stats(state, { pace: 2, qualifying: 1.5 });
                rel(state, team.id, 20);
                return 'You out-qualify the other car and finish in the points. By Monday three teams have called your manager.';
              }
              rep(state, 2);
              stats(state, { technical: 1 });
              return 'You spin it on lap nine trying to make an impression. The debrief is short.';
            }
          },
          {
            id: 'sensible',
            label: 'BRING IT HOME',
            pros: ['Professional, reliable, safe'],
            cons: ['Nobody remembers safe'],
            apply: ({ state }) => {
              rep(state, 6);
              rel(state, team.id, 12);
              stats(state, { consistency: 1.5, technical: 1 });
              return 'You finish twelfth without a mark on the car. The engineers write "extremely tidy" and it does you more good than you expect.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'retirement_question',
    phase: 'offseason',
    tag: 'THE END',
    weight: 11,
    when: (ctx) => ctx.state.player.age >= 34 && f1Seasons(ctx.state) >= 6,
    build: (ctx) => ({
      title: 'HOW MUCH LONGER?',
      body: `You are ${ctx.state.player.age}. You are still quick on a Saturday and the recovery on a Monday takes three days now. A broadcaster has offered you a contract that begins the moment you stop.`,
      options: [
        {
          id: 'commit',
          label: 'KEEP GOING',
          pros: ['More seasons, more chances'],
          cons: ['The decline is coming either way'],
          apply: ({ state }) => {
            stats(state, { fitness: 1.5, consistency: 1 });
            rep(state, 2);
            return 'You tell them to call back in five years. Then you hire a second trainer.';
          }
        },
        {
          id: 'plan_exit',
          label: 'START PLANNING THE EXIT',
          pros: ['A soft landing', 'Money and a public role'],
          cons: ['The paddock smells it immediately'],
          apply: ({ state }) => {
            money(state, 6);
            market(state, 10);
            form(state, -1.5);
            return 'You sign the media deal quietly. Two team principals hear about it within a week and adjust their plans for you.';
          }
        }
      ]
    })
  }
];

function ordinalSuffix(n: number): string {
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

import { LATE_EVENTS } from './decisionsLate';

export const DECISION_EVENTS: DecisionEvent[] = [...JUNIOR_EVENTS, ...F1_EVENTS, ...LATE_EVENTS];

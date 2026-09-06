import type { GameState } from '../game/types';
import type { DecisionEvent } from './decisionModel';
import {
  bond,
  carPace,
  form,
  isF1,
  market,
  money,
  rel,
  rep,
  stats
} from './decisionModel';

/** Late-career and champion-only decisions. */

function wonTitleLastSeason(state: GameState): boolean {
  const last = state.history[state.history.length - 1];
  return Boolean(last && last.series === 'F1' && last.championshipPosition === 1);
}

export const LATE_EVENTS: DecisionEvent[] = [
  {
    id: 'number_one_plate',
    phase: 'offseason',
    tag: 'Champion',
    weight: 30,
    when: (ctx) => wonTitleLastSeason(ctx.state) && ctx.state.player.number !== 1,
    build: (ctx) => ({
      title: 'The number one',
      body: `You are World Champion. The regulations give you the right to run the number 1 next season instead of your own ${ctx.state.player.number}. Some champions take it. Some think it invites everything you do not need.`,
      options: [
        {
          id: 'take_one',
          label: 'Run the number 1',
          detail: 'The plate every driver wants once.',
          effect: 'Number becomes #1 · Marketability +10 · Reputation +4',
          apply: ({ state }) => {
            state.player.number = 1;
            market(state, 10);
            rep(state, 4);
            return 'The car is unveiled with a single digit on the nose. You look at it for longer than you admit to anyone.';
          }
        },
        {
          id: 'keep',
          label: `Keep #${ctx.state.player.number}`,
          detail: 'The number you have carried since karting.',
          effect: 'Marketability +5 · Form +1',
          apply: ({ state }) => {
            market(state, 5);
            form(state, 1);
            return 'You keep your number. Your engineer says it is the most you thing you have ever done.';
          }
        }
      ]
    })
  },
  {
    id: 'title_defence',
    phase: 'preseason',
    tag: 'Champion',
    weight: 12,
    when: (ctx) => wonTitleLastSeason(ctx.state),
    build: () => ({
      title: 'Defending it',
      body: 'Winning it was the hard part, everyone told you. They were wrong. Twenty-one drivers spent the winter studying your onboards and your team spent it celebrating.',
      options: [
        {
          id: 'harder',
          label: 'Train like you lost',
          effect: 'Fitness +2 · Consistency +1.5 · Form +2',
          apply: ({ state }) => {
            stats(state, { fitness: 2, consistency: 1.5 });
            form(state, 2);
            return 'You are back in the simulator eleven days after the final race. The trophy is still in a box.';
          }
        },
        {
          id: 'enjoy',
          label: 'Enjoy being champion',
          effect: '€5M · Marketability +15 · Form −2',
          apply: ({ state }) => {
            market(state, 15);
            money(state, 5);
            form(state, -2);
            return 'You do the tour, the talk shows and the parade through your home town. February arrives faster than it ever has.';
          }
        }
      ]
    })
  },
  {
    id: 'rebuild_commitment',
    phase: 'offseason',
    tag: 'Rebuild',
    weight: 10,
    when: (ctx) =>
      isF1(ctx) &&
      ctx.state.teams[ctx.state.player.teamId].carPerformance < 72 &&
      ctx.state.player.overall > 76,
    build: (ctx) => {
      const team = ctx.state.teams[ctx.state.player.teamId];
      return {
        title: 'The five-year plan',
        body: `${team.name} have shown you a factory expansion, a wind tunnel and a hiring plan. None of it produces a fast car before you are thirty-something. They want you to say publicly that you are staying to see it through.`,
        options: [
          {
            id: 'commit',
            label: 'Become the face of the project',
            detail: 'Years of your prime, for a legacy if it works.',
            effect: `${team.shortName} development +6 · relationship +30 · Team bond +22`,
            apply: ({ state }) => {
              const t = state.teams[state.player.teamId];
              t.development = Math.min(100, t.development + 6);
              carPace(state, state.player.teamId, 1);
              rel(state, state.player.teamId, 30);
              bond(state, 22);
              rep(state, 5);
              return 'You stand on a stage in front of eight hundred employees and tell them you are not going anywhere. The applause goes on slightly too long.';
            }
          },
          {
            id: 'looking',
            label: 'Let it be known you are looking',
            effect: `${team.shortName} relationship −20 · Team bond −18 · Marketability +8`,
            apply: ({ state }) => {
              rel(state, state.player.teamId, -20);
              bond(state, -18);
              market(state, 8);
              return 'Your manager takes three meetings at a test and does not pretend otherwise. The garage reads it immediately.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'young_gun',
    phase: 'midseason',
    tag: 'Pressure',
    weight: 9,
    when: (ctx) =>
      ctx.state.player.age >= 33 &&
      isF1(ctx) &&
      Boolean(ctx.teammate) &&
      (ctx.teammate?.age ?? 99) <= 24,
    build: (ctx) => ({
      title: 'He is quicker than you',
      body: `${ctx.teammate!.name} is ${ctx.teammate!.age} and has out-qualified you six times in nine rounds. You have driven this circuit twenty times. He has driven it twice.`,
      options: [
        {
          id: 'adapt',
          label: 'Copy his data and rebuild your style',
          detail: 'Unlearn fifteen years of braking technique.',
          outcomes: [
            {
              id: 'takes',
              chance: 60,
              effect: 'Technical +2.5 · Qualifying +2 · Reputation +3',
              detail: 'it hurts, and it works',
              tone: 'good',
              apply: ({ state }) => {
                stats(state, { technical: 2.5, qualifying: 2 });
                rep(state, 3);
                return 'You spend three weeks in the simulator unlearning a braking technique that has worked for fifteen years. It hurts, and it works.';
              }
            },
            {
              id: 'partial',
              chance: 40,
              effect: 'Technical +2.5 · Qualifying +0.5 · Reputation +3',
              detail: 'the Saturday pace never quite comes back',
              tone: 'mixed',
              apply: ({ state }) => {
                stats(state, { technical: 2.5, qualifying: 0.5 });
                rep(state, 3);
                return 'You spend three weeks in the simulator rebuilding your style. Some of it sticks. The Saturday pace never quite comes back.';
              }
            }
          ]
        },
        {
          id: 'sundays',
          label: 'Beat him on Sundays',
          effect: 'Racecraft +2.5 · Consistency +1.5',
          apply: ({ state }) => {
            stats(state, { racecraft: 2.5, consistency: 1.5 });
            return 'You stop worrying about Saturday. He starts ahead of you nine times and finishes ahead of you four.';
          }
        }
      ]
    })
  },
  {
    id: 'wet_gamble',
    phase: 'midseason',
    tag: 'The moment',
    weight: 8,
    when: (ctx) => isF1(ctx),
    build: () => ({
      title: 'It is going to rain',
      body: 'The radar says the rain arrives in nine minutes. The team wants to stay out. You can see the sky from the cockpit and they cannot.',
      options: [
        {
          id: 'gamble',
          label: 'Pit now, on your call',
          detail: 'Two laps of clear advantage if you are right.',
          outcomes: [
            {
              id: 'right',
              chance: 48,
              effect: 'Reputation +10 · Form +3 · Team bond +10',
              detail: 'you drive past the entire field on the pit straight',
              tone: 'good',
              apply: ({ state }) => {
                rep(state, 10);
                form(state, 3);
                bond(state, 10);
                return 'You come in. The rain arrives on the lap you rejoin and you drive past the entire field on the pit straight.';
              }
            },
            {
              id: 'wrong',
              chance: 52,
              effect: 'Form −2 · Team bond −8',
              detail: 'it does not rain for another twenty minutes',
              tone: 'bad',
              apply: ({ state }) => {
                form(state, -2);
                bond(state, -8);
                return 'You come in. It does not rain for another twenty minutes and you finish outside the points.';
              }
            }
          ]
        },
        {
          id: 'trust',
          label: 'Trust the pit wall',
          detail: 'The strategists have the data. You have the sky.',
          outcomes: [
            {
              id: 'held',
              chance: 50,
              effect: 'Team bond +8 · Form +1',
              detail: 'the shower misses the circuit and the strategy holds',
              tone: 'good',
              apply: ({ state }) => {
                bond(state, 8);
                form(state, 1);
                return 'They were right. You stay out, the shower misses the circuit and the strategy holds.';
              }
            },
            {
              id: 'blown',
              chance: 50,
              effect: 'Team bond +8 · Form −1.5',
              detail: 'you take the pit entry three laps late, on slicks',
              tone: 'bad',
              apply: ({ state }) => {
                bond(state, 8);
                form(state, -1.5);
                return 'They were wrong. You take the pit entry three laps later than you should have, on slicks, sideways.';
              }
            }
          ]
        }
      ]
    })
  },
  {
    id: 'final_season',
    phase: 'offseason',
    tag: 'The end',
    weight: 40,
    when: (ctx) => ctx.state.player.age >= 39 && ctx.state.player.series === 'F1',
    build: (ctx) => {
      const team = ctx.state.teams[ctx.state.player.teamId];
      return {
        title: 'One more',
        body: `You are ${ctx.state.player.age}. ${team.name} have offered you one final season. There is a version of this where you go out on your own terms, and a version where you are still here at forty-three being asked whether you have thought about stopping.`,
        options: [
          {
            id: 'one_more',
            label: 'Take one more season',
            effect: 'Reputation +3 · Form +1.5',
            apply: ({ state }) => {
              rep(state, 3);
              form(state, 1.5);
              return 'You sign for one more year. Your trainer doubles the winter programme without being asked.';
            }
          },
          {
            id: 'retire',
            label: 'Announce your retirement',
            detail: 'End the career here, on your terms.',
            effect: 'Career ends · Reputation +6',
            apply: ({ state }) => {
              state.retireRequested = true;
              rep(state, 6);
              return 'You announce it on a Thursday, in a small room, without notes. The paddock stands up.';
            }
          }
        ]
      };
    }
  }
];

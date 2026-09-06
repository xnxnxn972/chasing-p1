import type { DecisionEvent } from './decisions';
import { clamp } from '../game/random';

/**
 * Late-career and champion-only decisions. Split out from `decisions.ts` purely
 * to keep each file readable — the engine treats both lists identically.
 */

function wonTitleLastSeason(state: import('../game/types').GameState): boolean {
  const last = state.history[state.history.length - 1];
  return Boolean(last && last.series === 'F1' && last.championshipPosition === 1);
}

export const LATE_EVENTS: DecisionEvent[] = [
  {
    id: 'number_one_plate',
    phase: 'offseason',
    tag: 'CHAMPION',
    weight: 30,
    when: (ctx) => wonTitleLastSeason(ctx.state) && ctx.state.player.number !== 1,
    build: (ctx) => ({
      title: 'THE NUMBER ONE',
      body: `You are World Champion. The regulations give you the right to run the number 1 next season instead of your own ${ctx.state.player.number}. Some champions take it. Some think it invites everything you do not need.`,
      options: [
        {
          id: 'take_one',
          label: 'RUN THE NUMBER 1',
          detail: 'The plate every driver wants once.',
          pros: ['Nobody can miss what you did'],
          cons: ['A target on the car all season'],
          apply: ({ state }) => {
            state.player.number = 1;
            state.player.career.marketability = clamp(state.player.career.marketability + 10, 0, 100);
            state.player.career.reputation = clamp(state.player.career.reputation + 4, 0, 100);
            return 'The car is unveiled with a single digit on the nose. You look at it for longer than you admit to anyone.';
          }
        },
        {
          id: 'keep',
          label: `KEEP #${ctx.state.player.number}`,
          detail: 'The number you have carried since karting.',
          pros: ['Your identity, not the title', 'Merchandise continuity'],
          cons: ['You gave up the plate'],
          apply: ({ state }) => {
            state.player.career.marketability = clamp(state.player.career.marketability + 5, 0, 100);
            state.player.form = clamp(state.player.form + 1, -10, 10);
            return `You keep your number. Your engineer says it is the most you thing you have ever done.`;
          }
        }
      ]
    })
  },
  {
    id: 'title_defence',
    phase: 'preseason',
    tag: 'CHAMPION',
    weight: 12,
    when: (ctx) => wonTitleLastSeason(ctx.state),
    build: () => ({
      title: 'DEFENDING IT',
      body: 'Winning it was the hard part, everyone told you. They were wrong. Twenty-one drivers spent the winter studying your onboards and your team spent it celebrating.',
      options: [
        {
          id: 'harder',
          label: 'TRAIN LIKE YOU LOST',
          pros: ['Nothing slips'],
          cons: ['You never got to enjoy it'],
          apply: ({ state }) => {
            state.player.stats.fitness = clamp(state.player.stats.fitness + 2, 20, 99);
            state.player.stats.consistency = clamp(state.player.stats.consistency + 1.5, 20, 99);
            state.player.form = clamp(state.player.form + 2, -10, 10);
            return 'You are back in the simulator eleven days after the final race. The trophy is still in a box.';
          }
        },
        {
          id: 'enjoy',
          label: 'ENJOY BEING CHAMPION',
          pros: ['Vast commercial value', 'A winter you remember'],
          cons: ['You start the year behind'],
          apply: ({ state }) => {
            state.player.career.marketability = clamp(state.player.career.marketability + 15, 0, 100);
            state.player.career.wealth += 5;
            state.player.careerEarnings += 5;
            state.player.form = clamp(state.player.form - 2, -10, 10);
            return 'You do the tour, the talk shows and the parade through your home town. February arrives faster than it ever has.';
          }
        }
      ]
    })
  },
  {
    id: 'rebuild_commitment',
    phase: 'offseason',
    tag: 'REBUILD',
    weight: 10,
    when: (ctx) =>
      ctx.state.player.series === 'F1' &&
      !ctx.state.reserveTeamId &&
      ctx.state.teams[ctx.state.player.teamId].carPerformance < 72 &&
      ctx.state.player.overall > 76,
    build: (ctx) => {
      const team = ctx.state.teams[ctx.state.player.teamId];
      return {
        title: 'THE FIVE-YEAR PLAN',
        body: `${team.name} have shown you a factory expansion, a wind tunnel and a hiring plan. None of it produces a fast car before you are thirty-something. They want you to say publicly that you are staying to see it through.`,
        options: [
          {
            id: 'commit',
            label: 'BECOME THE FACE OF THE PROJECT',
            pros: ['Everything gets built around you', 'A legacy if it works'],
            cons: ['Years of your prime in a slow car'],
            apply: ({ state }) => {
              const t = state.teams[state.player.teamId];
              t.development = clamp(t.development + 6, 40, 100);
              t.carPerformance = clamp(t.carPerformance + 1, 36, 100);
              if (state.player.teamId in state.relationships) {
                const id = state.player.teamId as import('../game/types').F1TeamId;
                state.relationships[id] = clamp(state.relationships[id] + 30, -100, 100);
              }
              state.player.career.teamRelationship = clamp(state.player.career.teamRelationship + 22, 0, 100);
              state.player.career.reputation = clamp(state.player.career.reputation + 5, 0, 100);
              return 'You stand on a stage in front of eight hundred employees and tell them you are not going anywhere. The applause goes on slightly too long.';
            }
          },
          {
            id: 'looking',
            label: 'LET IT BE KNOWN YOU ARE LOOKING',
            pros: ['Keeps every door open'],
            cons: ['This team stops investing in you'],
            apply: ({ state }) => {
              if (state.player.teamId in state.relationships) {
                const id = state.player.teamId as import('../game/types').F1TeamId;
                state.relationships[id] = clamp(state.relationships[id] - 20, -100, 100);
              }
              state.player.career.teamRelationship = clamp(state.player.career.teamRelationship - 18, 0, 100);
              state.player.career.marketability = clamp(state.player.career.marketability + 8, 0, 100);
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
    tag: 'PRESSURE',
    weight: 9,
    when: (ctx) =>
      ctx.state.player.age >= 33 &&
      ctx.state.player.series === 'F1' &&
      Boolean(ctx.teammate) &&
      (ctx.teammate?.age ?? 99) <= 24,
    build: (ctx) => ({
      title: 'HE IS QUICKER THAN YOU',
      body: `${ctx.teammate!.name} is ${ctx.teammate!.age} and has out-qualified you six times in nine rounds. You have driven this circuit twenty times. He has driven it twice.`,
      options: [
        {
          id: 'adapt',
          label: 'COPY HIS DATA AND REBUILD YOUR STYLE',
          pros: ['A second career in the same body'],
          cons: ['Admitting it out loud'],
          apply: ({ state, rng }) => {
            state.player.stats.technical = clamp(state.player.stats.technical + 2.5, 20, 99);
            state.player.stats.qualifying = clamp(state.player.stats.qualifying + (rng.chance(0.6) ? 2 : 0.5), 20, 99);
            state.player.career.reputation = clamp(state.player.career.reputation + 3, 0, 100);
            return 'You spend three weeks in the simulator unlearning a braking technique that has worked for fifteen years. It hurts, and it works.';
          }
        },
        {
          id: 'sundays',
          label: 'BEAT HIM ON SUNDAYS',
          pros: ['Racecraft is the last thing to go'],
          cons: ['Starting behind him every week'],
          apply: ({ state }) => {
            state.player.stats.racecraft = clamp(state.player.stats.racecraft + 2.5, 20, 99);
            state.player.stats.consistency = clamp(state.player.stats.consistency + 1.5, 20, 99);
            return 'You stop worrying about Saturday. He starts ahead of you nine times and finishes ahead of you four.';
          }
        }
      ]
    })
  },
  {
    id: 'wet_gamble',
    phase: 'midseason',
    tag: 'THE MOMENT',
    weight: 8,
    when: (ctx) => ctx.state.player.series === 'F1' && !ctx.state.reserveTeamId,
    build: () => ({
      title: 'IT IS GOING TO RAIN',
      body: 'The radar says the rain arrives in nine minutes. The team wants to stay out. You can see the sky from the cockpit and they cannot.',
      options: [
        {
          id: 'gamble',
          label: 'PIT NOW, ON YOUR CALL',
          pros: ['Two laps of clear advantage if you are right'],
          cons: ['A pit stop thrown away if you are wrong'],
          apply: ({ state, rng }) => {
            if (rng.chance(0.48)) {
              state.player.career.reputation = clamp(state.player.career.reputation + 10, 0, 100);
              state.player.form = clamp(state.player.form + 3, -10, 10);
              state.player.career.teamRelationship = clamp(state.player.career.teamRelationship + 10, 0, 100);
              return 'You come in. The rain arrives on the lap you rejoin and you drive past the entire field on the pit straight.';
            }
            state.player.form = clamp(state.player.form - 2, -10, 10);
            state.player.career.teamRelationship = clamp(state.player.career.teamRelationship - 8, 0, 100);
            return 'You come in. It does not rain for another twenty minutes and you finish outside the points.';
          }
        },
        {
          id: 'trust',
          label: 'TRUST THE PIT WALL',
          pros: ['The strategists have the data'],
          cons: ['You knew what you could see'],
          apply: ({ state, rng }) => {
            state.player.career.teamRelationship = clamp(state.player.career.teamRelationship + 8, 0, 100);
            if (rng.chance(0.5)) {
              state.player.form = clamp(state.player.form + 1, -10, 10);
              return 'They were right. You stay out, the shower misses the circuit and the strategy holds.';
            }
            state.player.form = clamp(state.player.form - 1.5, -10, 10);
            return 'They were wrong. You take the pit entry three laps later than you should have, on slicks, sideways.';
          }
        }
      ]
    })
  },
  {
    id: 'final_season',
    phase: 'offseason',
    tag: 'THE END',
    weight: 40,
    when: (ctx) => ctx.state.player.age >= 39 && ctx.state.player.series === 'F1',
    build: (ctx) => {
      const team = ctx.state.teams[ctx.state.player.teamId];
      return {
        title: 'ONE MORE',
        body: `You are ${ctx.state.player.age}. ${team.name} have offered you one final season. There is a version of this where you go out on your own terms, and a version where you are still here at forty-three being asked whether you have thought about stopping.`,
        options: [
          {
            id: 'one_more',
            label: 'TAKE ONE MORE SEASON',
            pros: ['One more chance at everything'],
            cons: ['The decline does not pause for sentiment'],
            apply: ({ state }) => {
              state.player.career.reputation = clamp(state.player.career.reputation + 3, 0, 100);
              state.player.form = clamp(state.player.form + 1.5, -10, 10);
              return 'You sign for one more year. Your trainer doubles the winter programme without being asked.';
            }
          },
          {
            id: 'retire',
            label: 'ANNOUNCE YOUR RETIREMENT',
            detail: 'End the career here, on your terms.',
            pros: ['You choose the ending'],
            cons: ['It is over'],
            apply: ({ state }) => {
              state.retireRequested = true;
              state.player.career.reputation = clamp(state.player.career.reputation + 6, 0, 100);
              return 'You announce it on a Thursday, in a small room, without notes. The paddock stands up.';
            }
          }
        ]
      };
    }
  }
];

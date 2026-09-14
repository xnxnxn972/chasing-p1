import type { DecisionEvent } from './decisionModel';
import { bond, currentTeam, form, isReserve, market, money, potential, rel, rep, stats } from './decisionModel';
import { formatMoney } from '../game/contractEngine';

/**
 * THE RESERVE YEAR
 *
 * A reserve driver is not a Formula 1 driver with fewer races. It is a
 * different job: simulator shifts that make the car quicker for the man sitting
 * in the seat you want, one Friday session a year to prove everything, and a
 * whole season of being ready for a phone call that usually does not come.
 *
 * These exist because `isF1` deliberately excludes a reserve year, which meant
 * almost no card in the game was eligible during one — a reserve winter was a
 * single card and very little else. Roughly half of careers now include a
 * reserve season and a fifth include three, so this arc is common enough to
 * need its own material and short enough never to become a waiting room.
 */
export const RESERVE_EVENTS: DecisionEvent[] = [
  // ---- preseason ----------------------------------------------------------
  {
    id: 'reserve_simulator_role',
    phase: 'preseason',
    tag: 'The factory',
    weight: 11,
    when: (ctx) => isReserve(ctx),
    build: (ctx) => {
      const team = currentTeam(ctx);
      return {
        title: 'You are the development driver now',
        body: `${team.name} want you in the simulator four days a week. The work is real and it matters: every correlation run you do makes the car quicker for the two men who have the seats you want. They will be thanked for the results on Sunday.`,
        options: [
          {
            id: 'commit',
            label: 'Do the work properly',
            detail: 'Make yourself the person they cannot replace.',
            effect: 'Technical +3.5 · Team bond +18 · Form −2 · Fitness −1',
            apply: ({ state }) => {
              stats(state, { technical: 3.5, consistency: 1, fitness: -1 });
              bond(state, 18);
              form(state, -2);
              return 'You do three hundred hours in a box that does not move and know the car better than either race driver by June. The engineering director starts asking for you by name.';
            }
          },
          {
            id: 'protect',
            label: 'Do the minimum and keep driving',
            detail: 'Test days elsewhere, karting, anything with a real steering wheel.',
            effect: 'Pace +2 · Racecraft +1.5 · Team bond −14',
            apply: ({ state }) => {
              stats(state, { pace: 2, racecraft: 1.5 });
              bond(state, -14);
              return 'You turn up for what is contracted and spend the rest of the week actually driving things. Your hands stay sharp. The factory notices your absence and reads it correctly.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'reserve_stay_race_fit',
    phase: 'preseason',
    tag: 'Career',
    weight: 10,
    when: (ctx) => isReserve(ctx),
    build: (ctx) => {
      const fee = ctx.rng.range(0.6, 1.6);
      const team = currentTeam(ctx);
      return {
        title: 'A real championship, somewhere else',
        body: `A sportscar team will pay you ${formatMoney(fee)} to race a full season. It is proper racing against proper drivers and you would start every round. ${team.name} will not release you for the dates that clash, and there are four of them.`,
        options: [
          {
            id: 'race',
            label: 'Go and race',
            detail: 'Be a racing driver again. Miss four Fridays here.',
            effect: `${formatMoney(fee)} · Racecraft +3 · Form +3 · Team bond −20`,
            apply: ({ state }) => {
              money(state, fee);
              stats(state, { racecraft: 3, consistency: 1 });
              form(state, 3);
              bond(state, -20);
              return 'You win two races in a car with a roof and remember what Sundays are for. Your Formula 1 team fill the Friday sessions with somebody more available.';
            }
          },
          {
            id: 'available',
            label: 'Stay available',
            detail: 'Be in the building every weekend, in case.',
            effect: 'Team bond +15 · Technical +1.5 · Racecraft −1.5 · Form −2',
            apply: ({ state }) => {
              bond(state, 15);
              stats(state, { technical: 1.5, racecraft: -1.5 });
              form(state, -2);
              return 'You spend twenty-four weekends in a garage with a headset on and do not drive a racing car in anger all year. You are, however, standing there when they need somebody.';
            }
          }
        ]
      };
    }
  },

  // ---- midseason ----------------------------------------------------------
  {
    id: 'reserve_fp1',
    phase: 'midseason',
    tag: 'The moment',
    weight: 16,
    when: (ctx) => isReserve(ctx),
    build: (ctx) => {
      const team = currentTeam(ctx);
      return {
        title: 'One hour on a Friday morning',
        body: `You get first practice in the race driver's car. Sixty minutes, in front of everybody, on a weekend where the car has to be set up for him by the afternoon. Every lap you use for yourself is one he does not get.`,
        options: [
          {
            id: 'programme',
            label: 'Run their programme',
            detail: 'Aero rake, three constant-speed runs, and hand it back set up.',
            effect: `Technical +2.5 · ${team.shortName} relationship +18 · Reputation −2`,
            apply: ({ state }) => {
              stats(state, { technical: 2.5 });
              bond(state, 18);
              rel(state, state.player.teamId, 18);
              rep(state, -2);
              return 'You do exactly what the sheet says and hand the car back better than you found it. Nobody outside the garage looks at the timing screen twice.';
            }
          },
          {
            id: 'send_it',
            label: 'Put a lap in',
            detail: 'Abandon the run plan in the last ten minutes and show them.',
            outcomes: [
              {
                id: 'quick',
                chance: 55,
                effect: 'Reputation +14 · Marketability +10 · Team bond −12',
                detail: 'you are quicker than him',
                tone: 'good',
                apply: ({ state }) => {
                  rep(state, 14);
                  market(state, 10);
                  bond(state, -12);
                  form(state, 2);
                  return 'You go third quickest with eight minutes left and the pit lane stops what it is doing. Two rival team principals ask who that was, which was the entire point.';
                }
              },
              {
                id: 'scruffy',
                chance: 45,
                effect: 'Reputation −8 · Team bond −16 · Form −2',
                detail: 'cold tyres, and everybody saw',
                tone: 'bad',
                apply: ({ state }) => {
                  rep(state, -8);
                  bond(state, -16);
                  form(state, -2);
                  return 'You go off at turn seven on cold tyres with the whole pit lane watching and cost them forty minutes of his afternoon. It is the only thing anyone remembers about your year.';
                }
              }
            ]
          }
        ]
      };
    }
  },
  {
    id: 'reserve_knows_why',
    phase: 'midseason',
    tag: 'Politics',
    weight: 12,
    when: (ctx) => isReserve(ctx),
    build: () => ({
      title: 'You can see exactly what he is doing wrong',
      body: `You have been in the simulator with this car since January and the race driver has not. He is losing four tenths in the same two corners every weekend and you know precisely why. Telling him fixes his season. Telling him also removes the only argument for replacing him.`,
      options: [
        {
          id: 'tell_him',
          label: 'Tell him',
          detail: 'Fix his weekend. Strengthen the case for keeping him.',
          effect: 'Team bond +20 · Reputation +8 · Technical +1',
          apply: ({ state }) => {
            bond(state, 20);
            rep(state, 8);
            stats(state, { technical: 1 });
            return 'You walk him through it on a laptop on Thursday and he is two tenths better on Saturday. He says so publicly, which is more than he had to do, and the garage does not forget who did that.';
          }
        },
        {
          id: 'say_nothing',
          label: 'Say nothing',
          detail: 'Let the gap speak. It is not your job to close it.',
          outcomes: [
            {
              id: 'seat',
              chance: 40,
              effect: 'Reputation +6 · Team bond −8',
              detail: 'they run out of patience with him',
              tone: 'good',
              apply: ({ state }) => {
                rep(state, 6);
                bond(state, -8);
                potential(state, 1);
                return 'By September the conversation inside the team has changed, and your name is in it. Nobody ever says out loud that you sat on the answer for five months.';
              }
            },
            {
              id: 'nothing',
              chance: 60,
              effect: 'Team bond −12 · Form −1',
              detail: 'he works it out himself',
              tone: 'bad',
              apply: ({ state }) => {
                bond(state, -12);
                form(state, -1);
                return 'He finds it himself in August, with his engineer, and mentions in passing that the simulator data had shown it all year. The room goes quiet in a way you feel.';
              }
            }
          ]
        }
      ]
    })
  },
  {
    id: 'reserve_standby',
    phase: 'midseason',
    tag: 'The call',
    weight: 12,
    when: (ctx) => isReserve(ctx),
    build: () => ({
      title: 'Be ready by Saturday',
      body: 'The race driver has food poisoning and cannot stand up. You have been fitted to the seat, the overalls have your name on them, and your family have booked flights. On Saturday morning he walks into the garage looking grey and says he is driving.',
      options: [
        {
          id: 'accept',
          label: 'Accept it and support him',
          detail: 'Hand back the overalls. Be useful all weekend.',
          effect: 'Team bond +16 · Reputation +5 · Form −3',
          apply: ({ state }) => {
            bond(state, 16);
            rep(state, 5);
            form(state, -3);
            return 'You get changed, put the headset back on, and spend Sunday feeding him tyre numbers. Your parents watch the race from the grandstand seats they paid for.';
          }
        },
        {
          id: 'push',
          label: 'Tell the doctor what you saw',
          detail: 'He could not stand up an hour ago. Somebody should say it.',
          outcomes: [
            {
              id: 'drives',
              chance: 45,
              effect: 'Reputation +9 · Team bond −18 · Form +3',
              detail: 'the doctor stands him down and you race',
              tone: 'good',
              apply: ({ state }) => {
                rep(state, 9);
                bond(state, -18);
                form(state, 3);
                market(state, 8);
                return 'The medical delegate agrees with you and he is stood down. You start eighteenth, finish eleventh, and there is a photograph of you in the car that goes everywhere.';
              }
            },
            {
              id: 'refused',
              chance: 55,
              effect: 'Reputation −6 · Team bond −22 · Form −3',
              detail: 'he is cleared, and he is told who asked',
              tone: 'bad',
              apply: ({ state }) => {
                rep(state, -6);
                bond(state, -22);
                form(state, -3);
                return 'He is cleared to drive, finishes seventh, and somebody tells him before the flight home exactly which of his colleagues went to the doctor.';
              }
            }
          ]
        }
      ]
    })
  },

  // ---- offseason ----------------------------------------------------------
  {
    id: 'reserve_other_seat',
    phase: 'offseason',
    tag: 'Career',
    weight: 14,
    when: (ctx) => isReserve(ctx),
    build: (ctx) => {
      const team = currentTeam(ctx);
      return {
        title: 'A race seat, at the back',
        body: `The slowest team on the grid will give you a real contract and twenty-four starts. ${team.name} will not release you, and they have said — without putting it in writing — that a seat here is close. They said that last year as well.`,
        options: [
          {
            id: 'take_it',
            label: 'Take the race seat',
            detail: 'Be a Formula 1 driver, in a car that cannot score.',
            effect: `Racecraft +2 · Reputation +7 · ${team.shortName} relationship −22`,
            apply: ({ state }) => {
              stats(state, { racecraft: 2, consistency: 1 });
              rep(state, 7);
              rel(state, state.player.teamId, -22);
              bond(state, -22);
              form(state, 2);
              return 'You force the release and sign for a team that has not scored a point in two years. On the first Sunday in March you start a Grand Prix, which is not nothing at all.';
            }
          },
          {
            id: 'wait',
            label: 'Wait another year',
            detail: 'They keep saying it is close. One of these years it will be.',
            effect: `${team.shortName} relationship +20 · Technical +2 · Form −3 · Reputation −5`,
            apply: ({ state }) => {
              rel(state, state.player.teamId, 20);
              bond(state, 20);
              stats(state, { technical: 2 });
              form(state, -3);
              rep(state, -5);
              return 'You stay. The team are genuinely grateful and the paddock quietly reclassifies you from a driver who is waiting to a driver who is a simulator specialist.';
            }
          }
        ]
      };
    }
  }
];

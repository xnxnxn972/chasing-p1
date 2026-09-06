import type { DecisionEvent } from './decisionModel';
import {
  bond,
  form,
  isJunior,
  market,
  money,
  ordinalSuffix,
  potential,
  rel,
  rep,
  stats
} from './decisionModel';
import { ACADEMY_TEAM_IDS } from './f1Teams';
import { formatMoney } from '../game/contractEngine';

/** The junior ladder: where most careers quietly end. */
export const JUNIOR_EVENTS: DecisionEvent[] = [
  {
    id: 'junior_school',
    phase: 'preseason',
    tag: 'Life',
    weight: 10,
    once: true,
    when: (ctx) => isJunior(ctx) && ctx.state.player.age <= 18,
    build: (ctx) => ({
      title: 'School or the car',
      body: `You are ${ctx.state.player.age}. The team has offered a full winter testing programme, but it clashes with your final school year. Your parents have an opinion. So does your engineer.`,
      options: [
        {
          id: 'test',
          label: 'Drop out and test',
          detail: 'Every day in the car. No safety net.',
          effect: 'Pace +2.5 · Qualifying +2 · Potential +1',
          apply: ({ state }) => {
            stats(state, { pace: 2.5, qualifying: 2, technical: 1.5 });
            potential(state, 1);
            rep(state, 3);
            return 'You spend the winter at test tracks in the rain. By March you are half a second quicker than you were in November.';
          }
        },
        {
          id: 'school',
          label: 'Finish school',
          detail: 'Race weekends only.',
          effect: 'Technical +2.5 · Consistency +2 · Marketability +4',
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
    tag: 'Money',
    weight: 8,
    when: (ctx) => isJunior(ctx),
    build: (ctx) => {
      const amount = ctx.rng.range(0.4, 1.4);
      return {
        title: 'A sponsor calls',
        body: `A regional energy drink brand will put ${formatMoney(amount)} behind you for the season. They want twenty content days, a rebrand of your helmet, and your face on a billboard outside your home town.`,
        options: [
          {
            id: 'take',
            label: 'Take the deal',
            effect: `${formatMoney(amount)} · Marketability +9 · Pace −0.6`,
            apply: ({ state }) => {
              money(state, amount);
              market(state, 9);
              stats(state, { pace: -0.6, fitness: -0.5 });
              return 'You shoot content in a wind tunnel wearing sunglasses. It pays for the season, and suddenly people outside the paddock know your name.';
            }
          },
          {
            id: 'refuse',
            label: 'Stay focused',
            effect: 'Pace +1.2 · Consistency +1',
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
    tag: 'Academy',
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
      const strong = team.juniorDevelopment > 82;
      return {
        title: `${team.name} wants you`,
        body: `${team.name} has offered you a place in its junior programme. It is the fastest route to a Formula 1 seat that exists — and the fastest route out of the sport if you underperform.`,
        options: [
          {
            id: 'join',
            label: `Join ${team.shortName}`,
            detail: 'Faster route toward F1. Very high pressure, less control.',
            effect: `${team.shortName} relationship +35 · Reputation +8 · Potential +${strong ? 2 : 1}`,
            apply: ({ state }) => {
              state.player.academyTeamId = teamId;
              rel(state, teamId, 35);
              rep(state, 8);
              stats(state, { technical: 2, consistency: 1.5 });
              potential(state, strong ? 2 : 1);
              return 'You sign. Your first simulator session at the factory runs until two in the morning and nobody thinks that is unusual.';
            }
          },
          {
            id: 'independent',
            label: 'Stay independent',
            detail: 'Complete career control. No political ceiling.',
            effect: `Pace +1 · Racecraft +1 · ${team.shortName} relationship −12`,
            apply: ({ state }) => {
              rel(state, teamId, -12);
              stats(state, { pace: 1, racecraft: 1 });
              market(state, 3);
              return 'You thank them and stay independent. Your manager tells you that door does not always open twice.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'junior_coach',
    phase: 'midseason',
    tag: 'Development',
    weight: 7,
    when: (ctx) => isJunior(ctx),
    build: () => ({
      title: 'The driver coach',
      body: 'A retired Grand Prix driver has offered to work with you for the rest of the season. He is expensive, blunt, and everything he says about your braking is correct.',
      options: [
        {
          id: 'hire',
          label: 'Hire him',
          effect: 'Technical +2 · Consistency +2 · Potential +1 · −€400k',
          apply: ({ state }) => {
            money(state, -0.4);
            stats(state, { technical: 2, consistency: 2, qualifying: 1.5 });
            potential(state, 1);
            return 'He watches three onboards and tells you that you have been braking too early into every long corner for two years. He is right.';
          }
        },
        {
          id: 'alone',
          label: 'Figure it out yourself',
          effect: 'Pace +1 · Racecraft +1',
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
    tag: 'Politics',
    weight: 8,
    when: (ctx) => isJunior(ctx),
    build: () => ({
      title: 'Your team-mate put you in the wall',
      body: 'Turn four, lap one, running second and third. Your team-mate took your front wing off and finished on the podium while you walked back to the pits. The team have said nothing.',
      options: [
        {
          id: 'public',
          label: 'Say it on camera',
          effect: 'Reputation +4 · Marketability +6 · Team bond −14',
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
          label: 'Handle it in the debrief',
          effect: 'Team bond +10 · Consistency +1',
          apply: ({ state }) => {
            bond(state, 10);
            stats(state, { consistency: 1 });
            return 'You keep it in the room. The engineers notice. So, quietly, does your team-mate.';
          }
        },
        {
          id: 'revenge',
          label: 'Settle it on track',
          detail: 'Racecraft either way — but one of you has to lift.',
          outcomes: [
            {
              id: 'lands',
              chance: 50,
              effect: 'Racecraft +2.5 · Reputation +5',
              detail: 'he lifts, and nobody tries it twice',
              tone: 'good',
              apply: ({ state }) => {
                stats(state, { racecraft: 2.5, consistency: -1 });
                rep(state, 5);
                return 'Three rounds later you leave him no room at all at the same corner. He lifts. The message lands.';
              }
            },
            {
              id: 'crash',
              chance: 50,
              effect: 'Racecraft +2.5 · Consistency −1 · Reputation −3',
              detail: 'neither of you lifts',
              tone: 'bad',
              apply: ({ state }) => {
                stats(state, { racecraft: 2.5, consistency: -1 });
                form(state, -2);
                rep(state, -3);
                return 'Three rounds later you go for the same move. Neither of you lifts, and both of you retire.';
              }
            }
          ]
        }
      ]
    })
  },
  {
    id: 'junior_step_up',
    phase: 'offseason',
    tag: 'Career',
    weight: 9,
    when: (ctx) =>
      isJunior(ctx) &&
      ctx.state.player.series !== 'F2' &&
      (ctx.lastSeason?.championshipPosition ?? 99) <= 4,
    build: (ctx) => {
      const pos = ctx.lastSeason?.championshipPosition ?? 3;
      return {
        title: 'Skip a rung?',
        body: `You finished ${pos}${ordinalSuffix(pos)} in ${ctx.state.player.series}. A team one level above has offered you a seat a year early. Your engineer thinks you need another season here.`,
        options: [
          {
            id: 'jump',
            label: 'Go up early',
            detail: 'A year closer to Formula 1, against faster drivers.',
            outcomes: [
              {
                id: 'copes',
                chance: 55,
                effect: 'Potential +2 · Pace +1.5 · Racecraft +1.5',
                detail: 'you cope, and everything sharpens',
                tone: 'good',
                apply: ({ state }) => {
                  rep(state, 6);
                  potential(state, 2);
                  stats(state, { pace: 1.5, racecraft: 1.5 });
                  return 'You go up, and you cope. Everything about the way you drive gets sharper against faster drivers.';
                }
              },
              {
                id: 'drowns',
                chance: 45,
                effect: 'Consistency −1.5 · Form −2',
                detail: 'a chastening season out of your depth',
                tone: 'bad',
                apply: ({ state }) => {
                  rep(state, 6);
                  stats(state, { consistency: -1.5 });
                  form(state, -2);
                  return 'You go up and spend the first half of the season out of your depth. It is a hard year.';
                }
              }
            ]
          },
          {
            id: 'stay',
            label: 'One more year here',
            detail: 'Dominate the level. Build unshakeable confidence.',
            effect: 'Consistency +2 · Qualifying +1.5 · Form +2',
            apply: ({ state }) => {
              stats(state, { consistency: 2, qualifying: 1.5 });
              form(state, 2);
              return 'You stay, and you spend a season being the driver everyone else is measured against.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'junior_f1_test',
    phase: 'midseason',
    tag: 'Opportunity',
    weight: 12,
    when: (ctx) => ctx.state.player.series === 'F2' || (isJunior(ctx) && ctx.state.player.overall > 68),
    build: (ctx) => {
      const teamId = ctx.state.player.academyTeamId
        ? ctx.state.player.academyTeamId
        : ctx.rng.pickWeighted(ACADEMY_TEAM_IDS, (id) => ctx.state.teams[id].driverOpportunity);
      const team = ctx.state.teams[teamId];
      return {
        title: 'A Formula 1 test',
        body: `${team.name} have offered you a young driver test. It falls the week before the most important round of your season, and you would arrive at that round having done no preparation at all.`,
        options: [
          {
            id: 'test',
            label: 'Take the test',
            effect: `${team.shortName} relationship +18 · Reputation +7 · Form −1.5`,
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
            label: 'Focus on your season',
            effect: `Form +2 · ${team.shortName} relationship −8`,
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
    tag: 'Preparation',
    weight: 6,
    when: (ctx) => isJunior(ctx) || ctx.state.history.filter((h) => h.series === 'F1').length <= 2,
    build: () => ({
      title: 'Winter',
      body: 'Ten weeks with nothing in the calendar. Your trainer has written a brutal programme. Your friends are going away for a month.',
      options: [
        {
          id: 'train',
          label: 'Do the programme',
          effect: 'Fitness +3 · Consistency +1',
          apply: ({ state }) => {
            stats(state, { fitness: 3, consistency: 1 });
            return 'You come back with a neck that no longer gives up in the last ten laps.';
          }
        },
        {
          id: 'rest',
          label: 'Actually rest',
          effect: 'Form +2 · Pace +0.8 · Fitness −0.5',
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

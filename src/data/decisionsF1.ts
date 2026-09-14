import type { DecisionEvent } from './decisionModel';
import {
  bond,
  carPace,
  currentTeam,
  f1Seasons,
  form,
  isF1,
  market,
  money,
  potential,
  rel,
  rep,
  seasonsWithCurrentTeam,
  stats
} from './decisionModel';
import { formatMoney } from '../game/contractEngine';

void potential;

/** Formula 1: contracts, politics, loyalty, money, status, risk. */
export const F1_EVENTS: DecisionEvent[] = [
  {
    id: 'team_orders',
    phase: 'midseason',
    tag: 'Team orders',
    weight: 12,
    when: (ctx) => isF1(ctx) && Boolean(ctx.teammate),
    build: (ctx) => {
      const mate = ctx.teammate!;
      const team = currentTeam(ctx);
      return {
        title: 'Let him through',
        body: `You are running ahead of ${mate.name} with eleven laps left. He is in the championship fight and you are not. The radio call comes: hold position is not what they said.`,
        options: [
          {
            id: 'obey',
            label: 'Let him past',
            effect: `Team bond +16 · ${team.shortName} relationship +12 · Reputation −2`,
            apply: ({ state }) => {
              bond(state, 16);
              rel(state, team.id, 12);
              rep(state, -2);
              return `You move over on the back straight. ${mate.name} does not thank you on the radio. The team principal does, twice, in the debrief.`;
            }
          },
          {
            id: 'refuse',
            label: 'Ignore the call',
            effect: `Reputation +7 · Marketability +8 · Team bond −22`,
            apply: ({ state }) => {
              bond(state, -22);
              rel(state, team.id, -18);
              rep(state, 7);
              market(state, 8);
              return 'You turn the radio volume down and keep the position. It is the lead item on every broadcast for a week.';
            }
          },
          {
            id: 'negotiate',
            label: 'Ask what you get for it',
            detail: 'Move over — but price it first.',
            outcomes: [
              {
                id: 'paid',
                chance: 50,
                effect: 'Team bond +6 · €2M bonus',
                detail: 'a bonus schedule that did not exist before',
                tone: 'good',
                apply: ({ state }) => {
                  bond(state, 6);
                  rel(state, state.player.teamId, 6);
                  money(state, 2);
                  return 'You move over — and the following week your manager signs a bonus schedule that did not exist before.';
                }
              },
              {
                id: 'nothing',
                chance: 50,
                effect: 'Team bond −8',
                detail: 'they give you nothing, and you move over anyway',
                tone: 'bad',
                apply: ({ state }) => {
                  bond(state, -8);
                  return 'You ask the question on an open channel. They give you nothing, and you move over anyway.';
                }
              }
            ]
          }
        ]
      };
    }
  },
  {
    id: 'dev_direction',
    phase: 'midseason',
    tag: 'Development',
    weight: 9,
    when: (ctx) => isF1(ctx),
    build: (ctx) => {
      const team = currentTeam(ctx);
      return {
        title: 'The upgrade argument',
        body: `${team.name} can chase one development direction for the rest of the year. You want a more stable rear end. Your team-mate wants front-end bite. The aero group is split and the team principal wants a decision from the drivers.`,
        options: [
          {
            id: 'mine',
            label: 'Push your direction',
            detail: 'A car built around you — if it works.',
            outcomes: [
              {
                id: 'works',
                chance: 62,
                effect: 'Form +3 · Team bond +10 · Technical +1.5',
                detail: 'the car does exactly what you ask of it',
                tone: 'good',
                apply: ({ state }) => {
                  stats(state, { technical: 1.5 });
                  form(state, 3);
                  bond(state, 10);
                  rel(state, state.player.teamId, 8);
                  return 'The upgrade works. From the summer break onwards the car does exactly what you ask of it.';
                }
              },
              {
                id: 'fails',
                chance: 38,
                effect: 'Form −3 · Team bond −12 · Technical +1.5',
                detail: 'four months in a car everyone knows you asked for',
                tone: 'bad',
                apply: ({ state }) => {
                  stats(state, { technical: 1.5 });
                  form(state, -3);
                  bond(state, -12);
                  return 'The upgrade does not work. You spend four months driving a car that everyone knows you asked for.';
                }
              }
            ]
          },
          {
            id: 'his',
            label: 'Back your team-mate',
            effect: 'Team bond +14 · Technical +1 · Form −1',
            apply: ({ state }) => {
              bond(state, 14);
              rel(state, state.player.teamId, 6);
              stats(state, { technical: 1, consistency: 1 });
              form(state, -1);
              return 'You back his direction publicly. The car gets faster and slightly harder for you to drive.';
            }
          },
          {
            id: 'stay_out',
            label: 'Let the engineers decide',
            effect: 'Technical +0.5 · No blame either way',
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
    tag: 'Reputation',
    weight: 8,
    when: (ctx) => isF1(ctx) && ctx.state.player.career.teamRelationship < 62,
    build: (ctx) => {
      const team = currentTeam(ctx);
      return {
        title: 'Publicly criticised',
        body: `Your team principal has told a broadcaster that ${team.name} "expect considerably more" from your side of the garage. Your phone has not stopped. There is a press conference in two hours.`,
        options: [
          {
            id: 'fire_back',
            label: 'Answer in public',
            effect: 'Marketability +7 · Reputation +3 · Team bond −18',
            apply: ({ state }) => {
              rep(state, 3);
              market(state, 7);
              bond(state, -18);
              rel(state, state.player.teamId, -14);
              return 'You point out, on camera, which of the two cars has finished every race this season. It is quotable. It is not forgiven.';
            }
          },
          {
            id: 'absorb',
            label: 'Take it on the chin',
            effect: 'Team bond +12 · Form +1 · Reputation −4',
            apply: ({ state }) => {
              bond(state, 12);
              rep(state, -4);
              form(state, 1);
              return 'You say he is right and that you will be better. Half the paddock thinks you are a professional. The other half thinks you are finished.';
            }
          },
          {
            id: 'answer_on_track',
            label: 'Say nothing and drive',
            detail: 'Everything rides on the next four weekends.',
            outcomes: [
              {
                id: 'silences',
                chance: 50,
                effect: 'Form +2.5 · Reputation +5 · Team bond +8',
                detail: 'you out-qualify him four times and the story closes',
                tone: 'good',
                apply: ({ state }) => {
                  form(state, 2.5);
                  stats(state, { consistency: 1 });
                  rep(state, 5);
                  bond(state, 8);
                  return 'You refuse to answer the question and out-qualify your team-mate at the next four races. The subject closes itself.';
                }
              },
              {
                id: 'runs',
                chance: 50,
                effect: 'Form +2.5 · Consistency +1',
                detail: 'the story runs for another month',
                tone: 'mixed',
                apply: ({ state }) => {
                  form(state, 2.5);
                  stats(state, { consistency: 1 });
                  return 'You refuse to answer the question and go back to work. The story runs for another month.';
                }
              }
            ]
          }
        ]
      };
    }
  },
  {
    id: 'teammate_accusation',
    phase: 'midseason',
    tag: 'Rivalry',
    weight: 8,
    when: (ctx) => isF1(ctx) && Boolean(ctx.teammate),
    build: (ctx) => ({
      title: 'He says you ignored the call',
      body: `${ctx.teammate!.name} has told the press you ignored a team instruction at the last race. You did not. The team has not corrected him.`,
      options: [
        {
          id: 'release_radio',
          label: 'Ask for the radio to be released',
          effect: 'Reputation +7 · Team bond −10',
          apply: ({ state }) => {
            rep(state, 7);
            bond(state, -10);
            return 'The audio is published. You were right. Nobody in the garage enjoys the week that follows.';
          }
        },
        {
          id: 'let_it_go',
          label: 'Let it go',
          effect: 'Team bond +8 · Reputation −4',
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
    tag: 'Risk',
    weight: 10,
    when: (ctx) => isF1(ctx),
    build: (ctx) => {
      const team = currentTeam(ctx);
      return {
        title: 'The radical car',
        body: `${team.name} have produced a genuinely radical concept for next year's regulations. In the simulator it is either the fastest car they have ever built or undriveable, depending on which engineer you ask. They want your backing before they commit.`,
        options: [
          {
            id: 'back',
            label: 'Back the radical car',
            detail: 'Enormous upside. It might not work at all.',
            outcomes: [
              {
                id: 'nails_it',
                chance: 50,
                effect: 'Car pace +4 to +9',
                detail: 'two seconds a lap quicker than anything in a decade',
                tone: 'good',
                apply: ({ state, rng }) => {
                  rel(state, state.player.teamId, 10);
                  carPace(state, state.player.teamId, rng.range(4, 9));
                  return 'You back it. In February the car is two seconds a lap quicker than anything they have built in a decade.';
                }
              },
              {
                id: 'fails',
                chance: 50,
                effect: 'Car pace −3 to −8',
                detail: 'it will not turn, and there is no time to build another',
                tone: 'bad',
                apply: ({ state, rng }) => {
                  rel(state, state.player.teamId, 10);
                  carPace(state, state.player.teamId, -rng.range(3, 8));
                  return 'You back it. In February the car will not turn, and there is no time left to build another one.';
                }
              }
            ]
          },
          {
            id: 'conservative',
            label: 'Demand the safe car',
            effect: `Car pace +1.5 · ${team.shortName} development +2 · relationship −4`,
            apply: ({ state }) => {
              const t = state.teams[state.player.teamId];
              carPace(state, state.player.teamId, 1.5);
              t.development = Math.min(100, t.development + 2);
              rel(state, state.player.teamId, -4);
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
    tag: 'Money',
    weight: 7,
    when: (ctx) => isF1(ctx),
    build: (ctx) => {
      const amount = ctx.rng.range(2, 7);
      return {
        title: 'The commercial calendar',
        body: `Your title sponsor wants thirty additional appearance days next season. They will pay ${formatMoney(amount)} personally, on top of your salary.`,
        options: [
          {
            id: 'accept',
            label: 'Do the days',
            effect: `${formatMoney(amount)} · Marketability +10 · Fitness −1`,
            apply: ({ state }) => {
              money(state, amount);
              market(state, 10);
              stats(state, { fitness: -1, technical: -0.5 });
              return 'You spend most of your winter in airports and photo studios. The money is real.';
            }
          },
          {
            id: 'refuse',
            label: 'Refuse',
            effect: 'Fitness +1.5 · Technical +1 · Team bond −5',
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
    tag: 'The moment',
    weight: 14,
    when: (ctx) => isF1(ctx) && ctx.state.player.overall > 78 && currentTeam(ctx).carPerformance > 74,
    build: (ctx) => ({
      title: 'Last corner, last lap',
      body: `${ctx.rival ? ctx.rival.name : 'The championship leader'} is half a car length ahead into the final corner of the race. The gap on the inside is not quite a gap.`,
      options: [
        {
          id: 'send',
          label: 'Send it',
          detail: 'Win the race, or put both of you in the wall.',
          outcomes: [
            {
              id: 'sticks',
              chance: 45,
              effect: 'Reputation +12 · Marketability +12 · Form +3',
              detail: 'wheels locked, smoke everywhere, and you are through',
              tone: 'good',
              apply: ({ state }) => {
                stats(state, { racecraft: 1.5 });
                rep(state, 12);
                market(state, 12);
                form(state, 3);
                return 'You go for the gap. It closes. You are through anyway, wheels locked, smoke everywhere, and the crowd is on its feet.';
              }
            },
            {
              id: 'crash',
              chance: 55,
              effect: 'Reputation −6 · Form −3 · Team bond −10',
              detail: 'you take you both out and spend a fortnight explaining it',
              tone: 'bad',
              apply: ({ state }) => {
                stats(state, { racecraft: 1.5 });
                rep(state, -6);
                form(state, -3);
                bond(state, -10);
                return 'You go for the gap. It closes. You take both of you out and spend a fortnight explaining yourself.';
              }
            }
          ]
        },
        {
          id: 'settle',
          label: 'Take second',
          effect: 'Consistency +1.5 · Team bond +6 · Reputation −1',
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
    tag: 'Fitness',
    weight: 6,
    when: (ctx) => ctx.state.player.age >= 20,
    build: () => ({
      title: 'Cracked ribs',
      body: 'A training accident has left you with two cracked ribs eight days before the next round. The doctors will clear you if you insist. Breathing hurts.',
      options: [
        {
          id: 'race',
          label: 'Race anyway',
          effect: 'Reputation +6 · Team bond +8 · Form −2.5 · Fitness −1.5',
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
          label: 'Sit it out',
          detail: 'Heal properly. Someone else gets your car.',
          outcomes: [
            {
              id: 'clean',
              chance: 65,
              effect: 'Fitness +1 · Form +1',
              detail: 'you heal properly and come back sharp',
              tone: 'good',
              apply: ({ state }) => {
                stats(state, { fitness: 1 });
                form(state, 1);
                return 'You sit out one round, heal properly, and come back sharp.';
              }
            },
            {
              id: 'upstaged',
              chance: 35,
              effect: 'Fitness +1 · Form +1 · Team bond −8',
              detail: 'your replacement scores points and gives a very good interview',
              tone: 'bad',
              apply: ({ state }) => {
                stats(state, { fitness: 1 });
                form(state, 1);
                bond(state, -8);
                return 'You sit out one round. Your replacement scores points and gives a very good interview afterwards.';
              }
            }
          ]
        }
      ]
    })
  },
  {
    id: 'mentor_rookie',
    phase: 'preseason',
    tag: 'Leadership',
    weight: 7,
    when: (ctx) =>
      isF1(ctx) && ctx.state.player.age >= 29 && Boolean(ctx.teammate) && (ctx.teammate?.age ?? 99) <= 23,
    build: (ctx) => ({
      title: 'The kid in the other car',
      body: `${ctx.teammate!.name} is ${ctx.teammate!.age} and has been given the seat next to yours. He is quick. He is also completely lost, and he keeps asking you questions in the debrief.`,
      options: [
        {
          id: 'help',
          label: 'Teach him everything',
          detail: 'You are arming your own replacement.',
          effect: 'Team bond +18 · Reputation +5 · Technical +1.5',
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
          label: 'Give him nothing',
          effect: 'Form +1.5 · Team bond −10',
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
    tag: 'Rivalry',
    weight: 8,
    when: (ctx) => isF1(ctx) && Boolean(ctx.rival),
    build: (ctx) => ({
      title: `${ctx.rival!.name} has been talking`,
      body: `${ctx.rival!.name} has told a magazine that you are "the most overrated driver of your generation" and that he has never once had to actually race you.`,
      options: [
        {
          id: 'respond',
          label: 'Give it back',
          effect: 'Marketability +14 · Reputation +3 · Form +1',
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
          label: 'Refuse to engage',
          effect: 'Reputation +4 · Consistency +1',
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
    tag: 'Contract',
    weight: 9,
    when: (ctx) =>
      isF1(ctx) &&
      ctx.state.player.contract.seasons > 0 &&
      currentTeam(ctx).carPerformance < 70 &&
      ctx.state.player.overall > 80,
    build: (ctx) => {
      const team = currentTeam(ctx);
      return {
        title: 'The release clause',
        body: `Your contract with ${team.name} has ${ctx.state.player.contract.seasons} season(s) left, and a clause your manager put in three years ago that nobody expected to use. The car is not good enough. You can walk.`,
        options: [
          {
            id: 'activate',
            label: 'Activate the clause',
            detail: 'Free on the open market. No guarantee anyone is waiting.',
            effect: `Contract ends now · ${team.shortName} relationship −25 · Team bond −25`,
            apply: ({ state }) => {
              state.player.contract.seasons = 0;
              rel(state, state.player.teamId, -25);
              bond(state, -25);
              rep(state, 2);
              return `You trigger it. ${team.name} release a two-line statement thanking you for your service.`;
            }
          },
          {
            id: 'honour',
            label: 'Honour the contract',
            effect: `${team.shortName} relationship +22 · Team bond +18 · Reputation +6`,
            apply: ({ state }) => {
              rel(state, state.player.teamId, 22);
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
    tag: 'Loyalty',
    weight: 8,
    when: (ctx) => isF1(ctx) && seasonsWithCurrentTeam(ctx.state) >= 3,
    build: (ctx) => {
      const team = currentTeam(ctx);
      const cut = Math.max(1, Math.round(ctx.state.player.contract.salary * 0.3));
      return {
        title: 'They want you to take less',
        body: `${team.name} are up against the cost cap. They have asked you to give up ${formatMoney(cut)} a season so the money can go into the aerodynamics department instead.`,
        options: [
          {
            id: 'accept',
            label: 'Take the cut',
            effect: `−${formatMoney(cut)}/season · Car pace +2.5 · relationship +25`,
            apply: ({ state }) => {
              state.player.contract.salary = Math.max(1, state.player.contract.salary - cut);
              const t = state.teams[state.player.teamId];
              carPace(state, state.player.teamId, 2.5);
              t.development = Math.min(100, t.development + 3);
              rel(state, state.player.teamId, 25);
              bond(state, 20);
              return 'You take the cut. Two updates arrive that were not on the plan, and the second one works.';
            }
          },
          {
            id: 'refuse',
            label: 'Keep your money',
            effect: `Salary unchanged · ${team.shortName} relationship −14 · Team bond −12`,
            apply: ({ state }) => {
              rel(state, state.player.teamId, -14);
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
    tag: 'Politics',
    weight: 9,
    when: (ctx) =>
      isF1(ctx) && ctx.state.player.career.teamRelationship > 68 && f1Seasons(ctx.state) >= 3,
    build: (ctx) => {
      const team = currentTeam(ctx);
      const target = Object.values(ctx.state.drivers)
        .filter((d) => d.series === 'F1' && d.id !== ctx.teammate?.id)
        .sort((a, b) => b.overall - a.overall)[0];
      return {
        title: 'They are asking your opinion',
        body: `${team.name} are about to sign ${target ? target.name : 'a highly rated young driver'} into the other car. Because of who you are here, they have asked what you think first. Everyone in the room knows what that question really is.`,
        options: [
          {
            id: 'veto',
            label: 'Block the signing',
            effect: 'Car pace −1.5 · Reputation −8 · Marketability −5',
            apply: ({ state }) => {
              carPace(state, state.player.teamId, -1.5);
              rep(state, -8);
              bond(state, 6);
              market(state, -5);
              return 'They sign someone else. Within a year the story of why is in three books and both paddock podcasts.';
            }
          },
          {
            id: 'welcome',
            label: 'Tell them to sign him',
            effect: 'Car pace +2 · Reputation +8 · Form −1',
            apply: ({ state }) => {
              const t = state.teams[state.player.teamId];
              carPace(state, state.player.teamId, 2);
              t.development = Math.min(100, t.development + 2);
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
    tag: 'Money',
    weight: 6,
    when: (ctx) => ctx.state.player.career.wealth > 12 && f1Seasons(ctx.state) >= 2,
    build: (ctx) => {
      const stake = Math.min(ctx.state.player.career.wealth * 0.35, 14);
      return {
        title: 'Off-track',
        body: `A karting circuit and academy has come up for sale near where you grew up. It would take ${formatMoney(stake)} and most of your attention for a winter.`,
        options: [
          {
            id: 'buy',
            label: 'Buy it',
            detail: `${formatMoney(stake)} down, and a winter of your attention.`,
            outcomes: [
              {
                id: 'thrives',
                chance: 60,
                effect: `Returns ${formatMoney(stake * 1.4)}–${formatMoney(stake * 2.6)} · Marketability +12`,
                detail: 'within four years it produces drivers and money',
                tone: 'good',
                apply: ({ state, rng }) => {
                  money(state, -stake);
                  market(state, 12);
                  rep(state, 4);
                  money(state, stake * rng.range(1.4, 2.6));
                  return 'You buy it, rename it after your first team, and within four years it is producing drivers and money.';
                }
              },
              {
                id: 'money_pit',
                chance: 40,
                effect: `−${formatMoney(stake)} · Marketability +12 · Reputation +4`,
                detail: 'it costs more than you were told, every year',
                tone: 'bad',
                apply: ({ state }) => {
                  money(state, -stake);
                  market(state, 12);
                  rep(state, 4);
                  return 'You buy it. It costs more than you were told, every year, and you would do it again.';
                }
              }
            ]
          },
          {
            id: 'decline',
            label: 'Stay focused on driving',
            effect: 'Form +1.5 · Pace +0.6',
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
    tag: 'Garage',
    weight: 6,
    when: (ctx) => isF1(ctx) && f1Seasons(ctx.state) >= 2,
    build: () => ({
      title: 'Your race engineer',
      body: 'You have never quite clicked with your race engineer. There is a younger one on the simulator side who reads a session the way you do. Moving him would cost the team a fight it does not want.',
      options: [
        {
          id: 'demand',
          label: 'Demand the change',
          detail: 'You will spend political capital on this.',
          outcomes: [
            {
              id: 'clicks',
              chance: 72,
              effect: 'Qualifying +2 · Consistency +1.5 · Form +2 · Team bond −8',
              detail: 'your best qualifying session together, immediately',
              tone: 'good',
              apply: ({ state }) => {
                bond(state, -8);
                stats(state, { qualifying: 2, consistency: 1.5, technical: 1 });
                form(state, 2);
                return 'You get him. Your first qualifying session together is the best of your career.';
              }
            },
            {
              id: 'slow',
              chance: 28,
              effect: 'Form −1 · Team bond −8',
              detail: 'most of a season finding a rhythm',
              tone: 'bad',
              apply: ({ state }) => {
                bond(state, -8);
                form(state, -1);
                return 'You get him, and it takes most of a season for the two of you to find a rhythm.';
              }
            }
          ]
        },
        {
          id: 'stay',
          label: 'Make it work',
          effect: 'Team bond +10 · Consistency +0.8',
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
    tag: 'Home',
    weight: 5,
    when: (ctx) => isF1(ctx),
    build: (ctx) => ({
      title: 'Your home Grand Prix',
      body: `${ctx.state.player.flag} Everyone you have ever met wants a paddock pass. There are 120 requests and a national broadcaster wants you all Thursday.`,
      options: [
        {
          id: 'give',
          label: 'Give them the weekend',
          effect: 'Marketability +12 · Reputation +3 · Form −1.5',
          apply: ({ state }) => {
            market(state, 12);
            rep(state, 3);
            form(state, -1.5);
            return 'You sign everything, hug everyone, and arrive at first practice having slept four hours.';
          }
        },
        {
          id: 'lock_down',
          label: 'Shut it all out',
          effect: 'Form +2 · Marketability −6',
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
    tag: 'Stewards',
    weight: 5,
    when: (ctx) => isF1(ctx),
    build: () => ({
      title: 'Five-second penalty',
      body: 'You have lost a podium to a penalty for a move that has gone unpunished twice this season. The team can appeal, which will take three weeks and irritate the governing body.',
      options: [
        {
          id: 'appeal',
          label: 'Appeal it',
          detail: 'Three weeks, and the stewards are human.',
          outcomes: [
            {
              id: 'overturned',
              chance: 40,
              effect: 'Reputation +6 · Podium reinstated',
              detail: 'in a hotel conference room eighteen days later',
              tone: 'good',
              apply: ({ state }) => {
                rep(state, 6);
                return 'The penalty is overturned. The podium is reinstated in a hotel conference room eighteen days later.';
              }
            },
            {
              id: 'denied',
              chance: 60,
              effect: 'Reputation −3',
              detail: 'race control looks at you very carefully all year',
              tone: 'bad',
              apply: ({ state }) => {
                rep(state, -3);
                return 'The appeal fails, and you spend the rest of the year being looked at very carefully by race control.';
              }
            }
          ]
        },
        {
          id: 'accept',
          label: 'Let it go',
          effect: 'Reputation +2 · Form +1',
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
    tag: 'Pressure',
    weight: 7,
    when: (ctx) => isF1(ctx) && currentTeam(ctx).pressure > 82 && seasonsWithCurrentTeam(ctx.state) <= 1,
    build: (ctx) => {
      const team = currentTeam(ctx);
      return {
        title: `The ${team.name} problem`,
        body: `You have driven for ${team.name} for one winter and you already understand the thing everyone tries to explain about this place. Every session is a referendum. There is a way to survive it and a way to be swallowed by it.`,
        options: [
          {
            id: 'embrace',
            label: 'Embrace it',
            effect: 'Marketability +12 · Form +2 · Reputation +5 · Consistency −0.8',
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
            label: 'Build a wall around yourself',
            effect: 'Consistency +2.5 · Technical +1 · Marketability −6',
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
    tag: 'Opportunity',
    weight: 20,
    when: (ctx) => Boolean(ctx.state.reserveTeamId),
    build: (ctx) => {
      const team = ctx.state.teams[ctx.state.reserveTeamId!];
      return {
        title: 'The call',
        body: `A race driver at ${team.name} is unwell on Saturday morning. You have never driven this car in anger and qualifying is in four hours.`,
        options: [
          {
            id: 'send',
            label: 'Drive it like you stole it',
            detail: 'One chance to be unforgettable, or to be forgotten.',
            outcomes: [
              {
                id: 'stuns',
                chance: 50,
                effect: `Reputation +14 · Marketability +10 · ${team.shortName} relationship +20`,
                detail: 'you out-qualify the other car and score points',
                tone: 'good',
                apply: ({ state }) => {
                  rep(state, 14);
                  market(state, 10);
                  stats(state, { pace: 2, qualifying: 1.5 });
                  rel(state, team.id, 20);
                  return 'You out-qualify the other car and finish in the points. By Monday three teams have called your manager.';
                }
              },
              {
                id: 'spins',
                chance: 50,
                effect: 'Reputation +2 · Technical +1',
                detail: 'you spin it on lap nine and the debrief is short',
                tone: 'bad',
                apply: ({ state }) => {
                  rep(state, 2);
                  stats(state, { technical: 1 });
                  return 'You spin it on lap nine trying to make an impression. The debrief is short.';
                }
              }
            ]
          },
          {
            id: 'sensible',
            label: 'Bring it home',
            effect: `Reputation +6 · ${team.shortName} relationship +12 · Consistency +1.5`,
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
    tag: 'The end',
    weight: 11,
    when: (ctx) => ctx.state.player.age >= 34 && f1Seasons(ctx.state) >= 6,
    build: (ctx) => ({
      title: 'How much longer?',
      body: `You are ${ctx.state.player.age}. You are still quick on a Saturday and the recovery on a Monday takes three days now. A broadcaster has offered you a contract that begins the moment you stop.`,
      options: [
        {
          id: 'commit',
          label: 'Keep going',
          effect: 'Fitness +1.5 · Consistency +1 · Reputation +2',
          apply: ({ state }) => {
            stats(state, { fitness: 1.5, consistency: 1 });
            rep(state, 2);
            return 'You tell them to call back in five years. Then you hire a second trainer.';
          }
        },
        {
          id: 'plan_exit',
          label: 'Start planning the exit',
          effect: '€6M · Marketability +10 · Form −1.5',
          apply: ({ state }) => {
            money(state, 6);
            market(state, 10);
            form(state, -1.5);
            return 'You sign the media deal quietly. Two team principals hear about it within a week and adjust their plans for you.';
          }
        }
      ]
    })
  },
  // =========================================================================
  //  FORMULA 1, EXPANDED
  //
  //  The F1 pool was twenty cards against a career that can run twenty-five
  //  seasons, and preseason had only four of them. These are the parts of a
  //  driver's life the original set left out: the camera crew, the body, the
  //  phone, the people at home, and the quiet choices nobody outside the
  //  factory ever hears about.
  // =========================================================================

  // ---- preseason ----------------------------------------------------------
  {
    id: 'f1_documentary',
    phase: 'preseason',
    tag: 'Fame',
    weight: 8,
    when: (ctx) => isF1(ctx) && f1Seasons(ctx.state) >= 1,
    build: (ctx) => {
      const fee = ctx.rng.range(2.5, 6.5);
      const team = currentTeam(ctx);
      return {
        title: 'They want to film everything',
        body: `A streaming service is offering ${formatMoney(fee)} for unrestricted access to your season — the debriefs, the bad Sundays, the conversations in the motorhome. ${team.name} hate the idea and have said so in writing. Every weekend that goes wrong becomes television.`,
        options: [
          {
            id: 'let_them_in',
            label: 'Let them in',
            detail: 'The money and the audience. And a camera in the garage on your worst day.',
            outcomes: [
              {
                id: 'loved',
                chance: 60,
                effect: `${formatMoney(fee)} · Marketability +18 · Team bond −12`,
                detail: 'the series makes you',
                tone: 'good',
                apply: ({ state }) => {
                  money(state, fee);
                  market(state, 18);
                  rep(state, 5);
                  bond(state, -12);
                  return 'You come out of it looking thoughtful and quick, and an enormous number of people who have never watched a race now know your name.';
                }
              },
              {
                id: 'exposed',
                chance: 40,
                effect: `${formatMoney(fee)} · Marketability +9 · Reputation −9 · Team bond −18`,
                detail: 'they use the argument',
                tone: 'bad',
                apply: ({ state }) => {
                  money(state, fee);
                  market(state, 9);
                  rep(state, -9);
                  bond(state, -18);
                  form(state, -1);
                  return 'Episode four is eleven minutes of you losing your temper in a debrief. It is the most watched thing you have ever done and the garage has not forgotten it.';
                }
              }
            ]
          },
          {
            id: 'keep_out',
            label: 'Keep the cameras out',
            detail: 'The team will remember it. Nobody else will ever know.',
            effect: 'Team bond +14 · Consistency +1 · Marketability −7',
            apply: ({ state }) => {
              bond(state, 14);
              stats(state, { consistency: 1 });
              market(state, -7);
              return 'You say no. The principal tells you privately that he will not forget it, and for once that is a good thing.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'f1_all_nighter',
    phase: 'preseason',
    tag: 'The factory',
    // Appears in ~53% of careers, and lowering the weight barely moves it —
    // which is the tell. `isF1` excludes reserve drivers, so almost every other
    // F1 preseason card is ineligible during a reserve year and this one is
    // frequently the ONLY candidate. Weight cannot fix that; more cards that
    // admit a reserve driver can. Until then a reserve winter is this card.
    weight: 5,
    when: (ctx) => ctx.state.player.series === 'F1',
    build: () => ({
      title: 'Nobody outside the factory will ever know',
      body: 'The race drivers went home at six. The simulator team need someone to sit in the thing until four in the morning validating setups for the opening three races. They have asked you because you are the one who says yes.',
      options: [
        {
          id: 'stay',
          label: 'Stay',
          detail: 'Become the person the engineers ask for.',
          effect: 'Technical +2.5 · Team bond +15 · Fitness −2 · Form −1',
          apply: ({ state }) => {
            stats(state, { technical: 2.5, fitness: -2 });
            bond(state, 15);
            form(state, -1);
            return 'You do four nights of it and the car that arrives in March is meaningfully better than the one that would have. Nobody outside the building knows, and everybody inside it does.';
          }
        },
        {
          id: 'home',
          label: 'Go home',
          detail: 'Arrive in March rested, like a driver rather than an employee.',
          effect: 'Fitness +2 · Form +2 · Team bond −8',
          apply: ({ state }) => {
            stats(state, { fitness: 2 });
            form(state, 2);
            bond(state, -8);
            return 'You go home and sleep properly for six weeks. Somebody else sits in the simulator, and the engineers learn his name instead of yours.';
          }
        }
      ]
    })
  },
  {
    id: 'f1_weight_programme',
    phase: 'preseason',
    tag: 'The body',
    weight: 7,
    when: (ctx) => isF1(ctx),
    build: () => ({
      title: 'Three kilos before the opener',
      body: 'The team have run the numbers and three kilos is worth real lap time. Your trainer has read the programme they sent over and says, carefully, that he would not put a client of his on it.',
      options: [
        {
          id: 'chase',
          label: 'Chase the target',
          detail: 'Lap time now. Your trainer has put his objection in writing.',
          outcomes: [
            {
              id: 'works',
              chance: 55,
              effect: 'Pace +2 · Qualifying +1.5 · Team bond +8',
              detail: 'you make it and you are quick',
              tone: 'good',
              apply: ({ state }) => {
                stats(state, { pace: 2, qualifying: 1.5 });
                bond(state, 8);
                return 'You make the number by the second test and you are a tenth quicker everywhere. The team are delighted and say so loudly.';
              }
            },
            {
              id: 'breaks',
              chance: 45,
              effect: 'Fitness −4 · Consistency −2 · Form −3',
              detail: 'you fall apart by round six',
              tone: 'bad',
              apply: ({ state }) => {
                stats(state, { fitness: -4, consistency: -2 });
                form(state, -3);
                return 'You make the number and then, somewhere around round six, you stop being able to finish a race distance without your hands shaking.';
              }
            }
          ]
        },
        {
          id: 'refuse',
          label: 'Refuse it',
          detail: 'Keep your body. Irritate the people who write the programmes.',
          effect: 'Fitness +2.5 · Consistency +1 · Team bond −9',
          apply: ({ state }) => {
            stats(state, { fitness: 2.5, consistency: 1 });
            bond(state, -9);
            return 'You tell them no and train the way your own people want. The performance department write you down as difficult and mention it in a meeting you are not in.';
          }
        }
      ]
    })
  },
  {
    id: 'f1_idol_funeral',
    phase: 'preseason',
    tag: 'The sport',
    weight: 6,
    when: (ctx) => isF1(ctx) && f1Seasons(ctx.state) >= 2,
    build: () => ({
      title: 'The driver you grew up watching has died',
      body: 'You had his poster on a wall until you were nineteen. The family have asked you to speak at the memorial, which is on the Friday of the first test, in another country.',
      options: [
        {
          id: 'speak',
          label: 'Go and speak',
          detail: 'Lose the first day of testing. Say the thing that needs saying.',
          effect: 'Reputation +9 · Marketability +8 · Form −2 · Technical −1',
          apply: ({ state }) => {
            rep(state, 9);
            market(state, 8);
            form(state, -2);
            stats(state, { technical: -1 });
            return 'You speak for four minutes without notes in front of six hundred people, and half the grid, and you get it right. You miss the day that would have told you what the car does over kerbs.';
          }
        },
        {
          id: 'test',
          label: 'Stay at the test',
          detail: 'Send flowers. Drive the car.',
          effect: 'Technical +2 · Pace +1 · Reputation −5',
          apply: ({ state }) => {
            stats(state, { technical: 2, pace: 1 });
            rep(state, -5);
            return 'You do a hundred and thirty laps and learn things about the car that matter in March. The photographs from the memorial show an empty chair with your name on it.';
          }
        }
      ]
    })
  },
  {
    id: 'f1_move_near_factory',
    phase: 'preseason',
    tag: 'Life',
    weight: 7,
    once: true,
    when: (ctx) => isF1(ctx) && seasonsWithCurrentTeam(ctx.state) >= 1,
    build: (ctx) => {
      const team = currentTeam(ctx);
      return {
        title: 'They want you living near the factory',
        body: `${team.name} would like you within twenty minutes of the gate — in the simulator on Tuesdays, in the engineering meetings on Wednesdays, in the building enough that people stop treating you as a visitor. Your home is where your actual life is, and it is four hours away.`,
        options: [
          {
            id: 'move',
            label: 'Move',
            detail: 'Become part of the building.',
            effect: 'Technical +3 · Team bond +16 · Form −2',
            apply: ({ state }) => {
              stats(state, { technical: 3, consistency: 1 });
              bond(state, 16);
              form(state, -2);
              return 'You take a flat you do not like in a town you did not choose. By April the engineers are asking what you think before they ask anyone else.';
            }
          },
          {
            id: 'stay',
            label: 'Stay where your life is',
            detail: 'Keep the people. Commute to the racing.',
            effect: 'Form +2 · Fitness +1.5 · Team bond −11 · Technical −1',
            apply: ({ state }) => {
              form(state, 2);
              stats(state, { fitness: 1.5, technical: -1 });
              bond(state, -11);
              return 'You keep your house and your friends and you fly in on Thursdays. The decisions about the car get made on Tuesdays, in a room you are not in.';
            }
          }
        ]
      };
    }
  },

  // ---- midseason ----------------------------------------------------------
  {
    id: 'f1_blame_the_car',
    phase: 'midseason',
    tag: 'Reputation',
    weight: 10,
    // Fires only when the car really is the problem. The player is never told
    // that number — but the card can be gated on it, which is how the game keeps
    // the question honest without ever putting a car rating on screen.
    when: (ctx) => isF1(ctx) && currentTeam(ctx).carPerformance < 70,
    build: (ctx) => {
      const team = currentTeam(ctx);
      return {
        title: 'Is it you or the car?',
        body: `Four races without a point. The same question at every press conference, asked more carefully each time. You could say the thing that everyone in the pit lane already believes, or you could keep standing in front of the people who built it.`,
        options: [
          {
            id: 'the_car',
            label: 'Say the car is the problem',
            detail: 'True, and everyone knows it. The people who made it are in the room.',
            effect: `Reputation +8 · Marketability +5 · ${team.shortName} bond −20`,
            apply: ({ state }) => {
              rep(state, 8);
              market(state, 5);
              bond(state, -20);
              return 'You say it plainly and the journalists write it down gratefully. The aerodynamicists watch it on a screen in the canteen.';
            }
          },
          {
            id: 'take_it',
            label: 'Take it on yourself',
            detail: 'Protect five hundred people. Wear something that is not yours.',
            effect: `${team.shortName} bond +20 · Reputation −9 · Form −1`,
            apply: ({ state }) => {
              bond(state, 20);
              rep(state, -9);
              form(state, -1);
              return 'You say you have not been extracting what is there. It is not true. The factory knows it is not true, and the way they work for you afterwards changes.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'f1_one_upgrade',
    phase: 'midseason',
    tag: 'Team orders',
    weight: 10,
    when: (ctx) => isF1(ctx) && Boolean(ctx.teammate),
    build: (ctx) => ({
      title: 'The factory only built one',
      body: `There is a single new floor and it will not be a pair until the race after next. ${ctx.teammate!.name} is eleven points ahead of you. The team have asked, in a way that is not really a question, what you think should happen.`,
      options: [
        {
          id: 'demand',
          label: 'Demand it',
          detail: 'You are quicker. Say so.',
          effect: 'Pace +1.5 · Qualifying +1 · Team bond −16',
          apply: ({ state }) => {
            stats(state, { pace: 1.5, qualifying: 1 });
            bond(state, -16);
            rep(state, 2);
            return 'You get it, and the weekend goes well, and for the rest of the season the other side of the garage does the minimum for you and nothing more.';
          }
        },
        {
          id: 'concede',
          label: 'Give it to him',
          detail: 'Lose the weekend. Own the room.',
          effect: 'Team bond +18 · Reputation +7 · Form −2',
          apply: ({ state }) => {
            bond(state, 18);
            rep(state, 7);
            form(state, -2);
            return 'You tell them to put it on his car. He outqualifies you by four tenths and thanks you publicly, and every mechanic in that garage now belongs to you.';
          }
        }
      ]
    })
  },
  {
    id: 'f1_the_post',
    phase: 'midseason',
    tag: 'Media',
    weight: 9,
    when: (ctx) => isF1(ctx),
    build: () => ({
      title: 'You should not have posted that',
      body: 'Forty minutes after qualifying you wrote what you actually thought, and it is still climbing. Two sponsors have called the team. The replies are overwhelmingly on your side and that is, if anything, making it worse.',
      options: [
        {
          id: 'delete',
          label: 'Delete it and apologise',
          detail: 'Everyone in a suit relaxes. Everyone else notices.',
          effect: 'Team bond +12 · Marketability +5 · Reputation −7',
          apply: ({ state }) => {
            bond(state, 12);
            market(state, 5);
            rep(state, -7);
            return 'The apology is three sentences long and was written by someone in communications. The people who liked you for saying it can tell.';
          }
        },
        {
          id: 'leave_it',
          label: 'Leave it up',
          detail: 'Stand behind your own sentence.',
          outcomes: [
            {
              id: 'hero',
              chance: 55,
              effect: 'Marketability +16 · Reputation +8 · Team bond −10',
              detail: 'it becomes who you are',
              tone: 'good',
              apply: ({ state }) => {
                market(state, 16);
                rep(state, 8);
                bond(state, -10);
                return 'It becomes the thing people like about you. A sponsor who wanted it deleted signs you eighteen months later precisely because you did not.';
              }
            },
            {
              id: 'costly',
              chance: 45,
              effect: 'Marketability −12 · Team bond −16 · Form −2',
              detail: 'a sponsor walks',
              tone: 'bad',
              apply: ({ state }) => {
                market(state, -12);
                bond(state, -16);
                form(state, -2);
                return 'A title sponsor pulls a campaign and the team send you a number for what it cost them. You are asked to attend a media training course in November.';
              }
            }
          ]
        }
      ]
    })
  },
  {
    id: 'f1_telemetry',
    phase: 'midseason',
    tag: 'Integrity',
    weight: 8,
    when: (ctx) => isF1(ctx) && Boolean(ctx.teammate),
    build: (ctx) => ({
      title: 'He should not be showing you this',
      body: `A performance engineer has left ${ctx.teammate!.name}'s traces open on a screen in a room you both have access to, and then found a reason to leave. He is quicker than you through the long corners and this is exactly where you would find out why.`,
      options: [
        {
          id: 'look',
          label: 'Look',
          detail: 'Four minutes that answer a question you have had all year.',
          outcomes: [
            {
              id: 'learned',
              chance: 65,
              effect: 'Pace +2.5 · Technical +1.5',
              detail: 'nobody ever mentions it',
              tone: 'good',
              apply: ({ state }) => {
                stats(state, { pace: 2.5, technical: 1.5 });
                return 'He brakes eight metres later and carries it differently. You spend a week in the simulator teaching yourself to do the same, and from Spa you are level with him.';
              }
            },
            {
              id: 'caught',
              chance: 35,
              effect: 'Pace +2.5 · Reputation −12 · Team bond −18',
              detail: 'the access logs are not a secret',
              tone: 'bad',
              apply: ({ state }) => {
                stats(state, { pace: 2.5 });
                rep(state, -12);
                bond(state, -18);
                form(state, -1);
                return 'You learn what you wanted to learn. Six weeks later a routine audit of who opened what lands on the sporting director’s desk.';
              }
            }
          ]
        },
        {
          id: 'walk',
          label: 'Walk out',
          detail: 'Find it yourself, slower, with your own engineer.',
          effect: 'Technical +1.5 · Team bond +10 · Reputation +4',
          apply: ({ state }) => {
            stats(state, { technical: 1.5 });
            bond(state, 10);
            rep(state, 4);
            return 'You close the laptop and go and find your own engineer. It takes you until August to work out what he does, and it is yours when you have it.';
          }
        }
      ]
    })
  },
  {
    id: 'f1_fuel_saving',
    phase: 'midseason',
    tag: 'The moment',
    weight: 11,
    when: (ctx) => isF1(ctx),
    build: () => ({
      title: 'Lift and coast',
      body: 'Eleven laps to go, the leader four seconds up the road and fading, and the pit wall in your ear telling you to lift and coast from the hairpin. They have the numbers. You have the corner exit and a very clear view of what is possible.',
      options: [
        {
          id: 'ignore',
          label: 'Ignore it',
          detail: 'You will not get this again this year.',
          outcomes: [
            {
              id: 'makes_it',
              chance: 45,
              effect: 'Racecraft +2 · Reputation +9 · Form +3 · Team bond −8',
              detail: 'you get him, and you get home',
              tone: 'good',
              apply: ({ state }) => {
                stats(state, { racecraft: 2 });
                rep(state, 9);
                form(state, 3);
                bond(state, -8);
                return 'You take him with two laps left and cross the line with the engine screaming about something. The pit wall says nothing on the slow-down lap.';
              }
            },
            {
              id: 'runs_dry',
              chance: 55,
              effect: 'Reputation −6 · Team bond −18 · Form −3',
              detail: 'you stop on the last lap',
              tone: 'bad',
              apply: ({ state }) => {
                rep(state, -6);
                bond(state, -18);
                form(state, -3);
                return 'You are half a second behind him at the final corner when it cuts out. You coast to a stop in front of the grandstand and the team score nothing.';
              }
            }
          ]
        },
        {
          id: 'obey',
          label: 'Lift and coast',
          detail: 'Second place, and a race you will think about for years.',
          effect: 'Team bond +12 · Consistency +1.5 · Form −2',
          apply: ({ state }) => {
            bond(state, 12);
            stats(state, { consistency: 1.5 });
            form(state, -2);
            return 'You finish second by three seconds with fuel in the tank. The engineers are pleased. You are not, and you are still not in December.';
          }
        }
      ]
    })
  },
  {
    id: 'f1_reserve_takes_over',
    phase: 'midseason',
    tag: 'Fitness',
    weight: 7,
    when: (ctx) => isF1(ctx) && f1Seasons(ctx.state) >= 2,
    build: () => ({
      title: 'You are ill on Saturday morning',
      body: 'Thirty-nine degrees, and you could not complete a practice run without your vision going. The doctor will sign you off if you ask. The reserve driver is already in the building and has been waiting three years for a Sunday.',
      options: [
        {
          id: 'race',
          label: 'Race anyway',
          detail: 'The seat stays yours. You will pay for it.',
          effect: 'Reputation +7 · Team bond +8 · Fitness −3 · Form −3',
          apply: ({ state }) => {
            rep(state, 7);
            bond(state, 8);
            stats(state, { fitness: -3, consistency: -1 });
            form(state, -3);
            return 'You finish ninth and cannot get out of the car unaided. It takes three weeks to come right and everybody in the paddock heard about it within an hour.';
          }
        },
        {
          id: 'stand_down',
          label: 'Stand down',
          detail: 'Sensible. And he is quick.',
          outcomes: [
            {
              id: 'ordinary',
              chance: 60,
              effect: 'Fitness +2 · Form +1',
              detail: 'he has a quiet afternoon',
              tone: 'good',
              apply: ({ state }) => {
                stats(state, { fitness: 2 });
                form(state, 1);
                return 'He finishes fourteenth and thanks everyone very sincerely. You are back in the car in a fortnight, properly well.';
              }
            },
            {
              id: 'brilliant',
              chance: 40,
              effect: 'Fitness +2 · Team bond −14 · Form −2',
              detail: 'he scores, and people notice',
              tone: 'bad',
              apply: ({ state }) => {
                stats(state, { fitness: 2 });
                bond(state, -14);
                form(state, -2);
                return 'He qualifies sixth and brings it home fifth, and for the rest of the year his name appears in every conversation about your seat.';
              }
            }
          ]
        }
      ]
    })
  },
  {
    id: 'f1_the_birth',
    phase: 'midseason',
    tag: 'Family',
    weight: 9,
    once: true,
    when: (ctx) => isF1(ctx) && ctx.state.player.age >= 24,
    build: () => ({
      title: 'She is due this week',
      body: 'The due date sits on top of a double-header eleven thousand kilometres away. The team have a reserve ready and have been extremely careful to say that it is entirely your decision.',
      options: [
        {
          id: 'miss',
          label: 'Miss the races',
          detail: 'Be there. Lose two weekends you cannot get back.',
          effect: 'Form −3 · Reputation −4 · Team bond −10 · Consistency +1.5',
          apply: ({ state }) => {
            form(state, -3);
            rep(state, -4);
            bond(state, -10);
            stats(state, { consistency: 1.5 });
            market(state, 6);
            return 'You are in the room. The reserve scores four points in your car and you do not care even slightly, which surprises you.';
          }
        },
        {
          id: 'race',
          label: 'Race',
          detail: 'Points now. A phone call at four in the morning from the other side of the world.',
          effect: 'Form +2 · Team bond +10 · Consistency −1.5',
          apply: ({ state }) => {
            form(state, 2);
            bond(state, 10);
            stats(state, { consistency: -1.5 });
            return 'You find out in a hotel corridor in Singapore at ten past four and score eleven points that weekend. It is a thing that comes up, gently, for a very long time afterwards.';
          }
        }
      ]
    })
  },

  // ---- offseason ----------------------------------------------------------
  {
    id: 'f1_supermodel',
    phase: 'offseason',
    tag: 'Fame',
    weight: 7,
    once: true,
    when: (ctx) => isF1(ctx) && ctx.state.player.career.marketability >= 40,
    build: () => ({
      title: 'She found you on Instagram',
      body: 'She is extremely famous in a world that has nothing to do with racing, and she is genuinely interested. Going out with her in public would mean photographers outside restaurants for the rest of the winter, and a readership that has never watched a Grand Prix knowing exactly who you are.',
      options: [
        {
          id: 'yes',
          label: 'Say yes',
          detail: 'A much larger life. A much smaller amount of privacy.',
          effect: 'Marketability +22 · Form −2 · Fitness −1',
          apply: ({ state }) => {
            market(state, 22);
            rep(state, 3);
            form(state, -2);
            stats(state, { fitness: -1 });
            return 'You are on the front of two magazines by February. Your winter training is photographed, discussed, and interrupted, and your agent has never been happier.';
          }
        },
        {
          id: 'no',
          label: 'Keep your winter',
          detail: 'Nobody outside the sport learns your name this year.',
          effect: 'Fitness +2 · Pace +1 · Consistency +1',
          apply: ({ state }) => {
            stats(state, { fitness: 2, pace: 1, consistency: 1 });
            return 'You do not reply, which is its own kind of answer. You spend the winter doing the work and arrive in March in the best shape of your life.';
          }
        }
      ]
    })
  },
  {
    id: 'f1_flag_of_convenience',
    phase: 'offseason',
    tag: 'Identity',
    weight: 6,
    once: true,
    when: (ctx) => isF1(ctx) && f1Seasons(ctx.state) >= 2,
    build: (ctx) => {
      const fee = ctx.rng.range(4, 9);
      return {
        title: 'Race under a different flag',
        body: `A state investment fund will put ${formatMoney(fee)} behind you and open doors that do not open otherwise. The condition is that you take their nationality and race under their flag. Your licence would change. So would the anthem, if you ever won.`,
        options: [
          {
            id: 'switch',
            label: 'Take the flag',
            effect: `${formatMoney(fee)} · Marketability +15 · Reputation −11`,
            apply: ({ state }) => {
              money(state, fee);
              market(state, 15);
              rep(state, -11);
              return 'The paperwork takes four months and the money is extraordinary. In your home country you become, permanently, a slightly complicated subject.';
            }
          },
          {
            id: 'keep',
            label: 'Keep your own',
            effect: 'Reputation +8 · Consistency +1 · Marketability −6',
            apply: ({ state }) => {
              rep(state, 8);
              stats(state, { consistency: 1 });
              market(state, -6);
              return 'You say no, and the fund finds somebody who will say yes within a fortnight. At your home race the grandstand is louder than it has ever been.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'f1_already_signed',
    phase: 'offseason',
    tag: 'Contract',
    weight: 9,
    when: (ctx) => isF1(ctx) && seasonsWithCurrentTeam(ctx.state) >= 2,
    build: (ctx) => {
      const team = currentTeam(ctx);
      return {
        title: 'You find out before they tell you',
        body: `A mechanic who has been at ${team.name} for nineteen years could not look at you on Sunday evening, and an hour later somebody sent you a photograph of a seat fitting. Nobody from the team has said a word to you.`,
        options: [
          {
            id: 'confront',
            label: 'Force the conversation',
            detail: 'Walk in and make them say it out loud.',
            effect: `Reputation +6 · Marketability +7 · ${team.shortName} relationship −25`,
            apply: ({ state }) => {
              rep(state, 6);
              market(state, 7);
              bond(state, -25);
              rel(state, state.player.teamId, -25);
              return 'You put the photograph on his desk. He confirms it in eleven words. You leave with your dignity and without a reference.';
            }
          },
          {
            id: 'outdrive',
            label: 'Say nothing and out-drive him',
            detail: 'Let them watch what they are replacing.',
            outcomes: [
              {
                id: 'reconsider',
                chance: 35,
                effect: 'Pace +2 · Reputation +8 · Team bond +12',
                detail: 'they change their minds',
                tone: 'good',
                apply: ({ state }) => {
                  stats(state, { pace: 2, consistency: 1 });
                  rep(state, 8);
                  bond(state, 12);
                  return 'You out-score him across the last five races by a distance that becomes embarrassing, and in November the seat fitting quietly stops being mentioned.';
                }
              },
              {
                id: 'anyway',
                chance: 65,
                effect: 'Pace +2 · Reputation +5 · Team bond −6',
                detail: 'it was signed in July',
                tone: 'mixed',
                apply: ({ state }) => {
                  stats(state, { pace: 2 });
                  rep(state, 5);
                  bond(state, -6);
                  return 'You drive the best five races of your life and it changes nothing, because the contract was signed in July. Three other teams were watching, which is the only reason it mattered.';
                }
              }
            ]
          }
        ]
      };
    }
  }
];

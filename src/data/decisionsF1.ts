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
  }
];

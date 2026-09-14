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
    // The lowest weight in the junior pool, because this card draws from two
    // pools rather than one: its `when` also admits a driver's first two
    // Formula 1 winters, so it gets roughly double the eligible windows of any
    // other junior preseason card. At weight 6 it appeared in 53% of careers.
    weight: 4,
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
  },
  // =========================================================================
  //  THE EARLY YEARS, EXPANDED
  //
  //  Every career passes through the junior ladder, so this pool is the one a
  //  returning player exhausts first. At ~0.77 decisions a season a junior
  //  career draws three to five of these; four games is about sixteen draws,
  //  which against the original eight cards meant seeing everything twice.
  //
  //  Junior racing is about money, family, and being seventeen a long way from
  //  home. Almost none of that existed here before.
  // =========================================================================

  // ---- preseason ----------------------------------------------------------
  {
    id: 'junior_growth',
    phase: 'preseason',
    tag: 'The body',
    weight: 9,
    once: true,
    when: (ctx) => isJunior(ctx) && ctx.state.player.age <= 18,
    build: (ctx) => ({
      title: 'You do not fit the car',
      body: `You have grown eight centimetres since last season. Your knees touch the underside of the wheel, the seat was moulded to a smaller person, and with you in it the car is four kilos over the minimum. You are ${ctx.state.player.age}. Nobody warned you this was a problem you could have.`,
      options: [
        {
          id: 'diet',
          label: 'Make the weight',
          detail: 'The nutritionist has a plan. You will not enjoy the spring.',
          effect: 'Pace +1 · Fitness −3 · Consistency −1.5',
          apply: ({ state }) => {
            stats(state, { pace: 1, fitness: -3, consistency: -1.5 });
            return 'You spend the winter hungry and the season light. By round four you are quick and you are also, quietly, not well.';
          }
        },
        {
          id: 'rebuild',
          label: 'Have the car changed',
          detail: 'New seat, new pedal box, and a month of the programme gone.',
          effect: 'Fitness +1.5 · Technical +1.5 · Form −2',
          apply: ({ state }) => {
            stats(state, { fitness: 1.5, technical: 1.5 });
            form(state, -2);
            return 'The fabricators take a month you did not have. You arrive at the opener comfortable, rested, and badly underprepared.';
          }
        }
      ]
    })
  },
  {
    id: 'junior_agent',
    phase: 'preseason',
    tag: 'Money',
    weight: 8,
    when: (ctx) => isJunior(ctx) && ctx.state.player.age <= 19,
    build: (ctx) => {
      const amount = ctx.rng.range(1.2, 2.4);
      return {
        title: 'The man with the chequebook',
        body: 'He has managed two Formula 1 drivers and he found you in a paddock café. He will fund the entire season — car, travel, engineers, everything — in exchange for a percentage of what you earn for the rest of your life. He says the number out loud like it is nothing.',
        options: [
          {
            id: 'sign',
            label: 'Sign with him',
            detail: 'A fully funded year. He owns a slice of every contract you ever sign.',
            effect: `${formatMoney(amount)} · Marketability +11 · Reputation +4`,
            apply: ({ state }) => {
              money(state, amount);
              market(state, 11);
              rep(state, 4);
              return 'He pays for everything and answers his phone at midnight. You will still be signing his cheques when you are thirty-five.';
            }
          },
          {
            id: 'alone',
            label: 'Do it yourself',
            detail: 'Every invoice, every sponsor call, every hotel booking. Yours.',
            effect: 'Technical +2 · Consistency +1 · Potential +1 · Form −1',
            apply: ({ state }) => {
              stats(state, { technical: 2, consistency: 1 });
              potential(state, 1);
              form(state, -1);
              return 'You spend the season doing your own admin at two in the morning. You learn the business from underneath, which is the only place it is ever properly visible.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'junior_test_or_tyres',
    phase: 'preseason',
    tag: 'Preparation',
    weight: 7,
    when: (ctx) => isJunior(ctx),
    build: () => ({
      title: 'One budget, two ideas',
      body: 'There is enough left for a private test day or a fresh set of tyres for the opening qualifying session. Your engineer wants the test. Your team manager wants the tyres and the result that comes with them.',
      options: [
        {
          id: 'test',
          label: 'Take the test day',
          detail: 'A day of learning nobody else sees.',
          effect: 'Pace +2 · Technical +1.5 · Qualifying −1',
          apply: ({ state }) => {
            stats(state, { pace: 2, technical: 1.5, qualifying: -1 });
            return 'You do ninety laps in the rain at a circuit nobody races at. In August it turns out to have been the most useful day of your year.';
          }
        },
        {
          id: 'tyres',
          label: 'Take the tyres',
          detail: 'One Saturday that people will actually notice.',
          effect: 'Qualifying +2.5 · Form +2 · Technical −1',
          apply: ({ state }) => {
            stats(state, { qualifying: 2.5, technical: -1 });
            form(state, 2);
            rep(state, 2);
            return 'You qualify third on new rubber and the photograph runs everywhere. Nobody asks what the car was actually like.';
          }
        }
      ]
    })
  },
  {
    id: 'junior_sponsor_son',
    phase: 'preseason',
    tag: 'Money',
    weight: 6,
    when: (ctx) => isJunior(ctx),
    build: (ctx) => {
      const amount = ctx.rng.range(0.5, 1.1);
      return {
        title: 'The sponsor has a son',
        body: `A local haulage company will cover ${formatMoney(amount)} of your season. The condition is that you spend your weekends coaching the owner's fourteen-year-old around a kart track ninety minutes from your house. The boy is not talented and he knows it.`,
        options: [
          {
            id: 'coach',
            label: 'Take the money',
            effect: `${formatMoney(amount)} · Racecraft +1 · Fitness −1.5 · Form −1`,
            apply: ({ state }) => {
              money(state, amount);
              stats(state, { racecraft: 1, fitness: -1.5 });
              form(state, -1);
              return 'You spend forty Saturdays explaining apexes to a boy who would rather be anywhere else. It funds your year. You arrive at the opener already tired.';
            }
          },
          {
            id: 'refuse',
            label: 'Keep your winter',
            effect: 'Pace +1.5 · Fitness +1.5 · Marketability −5',
            apply: ({ state }) => {
              stats(state, { pace: 1.5, fitness: 1.5 });
              market(state, -5);
              return 'You train instead. The haulage company puts its logo on somebody else and mentions, at length, that you were difficult.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'junior_loan',
    phase: 'preseason',
    tag: 'Money',
    weight: 7,
    once: true,
    when: (ctx) =>
      isJunior(ctx) && ctx.state.player.age <= 20 && ctx.state.player.career.wealth < 1.5,
    build: (ctx) => {
      const amount = ctx.rng.range(1.8, 2.8);
      return {
        title: 'The bank will lend you a season',
        body: `The manager at your parents' branch has known your family for twenty years and thinks motor racing is a career. He will lend you ${formatMoney(amount)} against nothing at all, because there is nothing to lend against. The repayment schedule assumes you will be earning by the time it starts.`,
        options: [
          {
            id: 'take',
            label: 'Take the loan',
            detail: 'A proper season now. A date in the calendar you cannot move.',
            effect: `${formatMoney(amount)} · Pace +1.5 · Qualifying +1`,
            apply: ({ state }) => {
              money(state, amount);
              stats(state, { pace: 1.5, qualifying: 1 });
              // A marker, not an event: nothing ever matches it as a decision id,
              // and it is how `junior_loan_due` knows the money was actually
              // taken. firedEvents records that an event FIRED, never which
              // option won, so a storyline needs its own breadcrumb.
              state.firedEvents.push('flag_loan_taken');
              return 'You sign in a branch office that smells of carpet. For the first time you have the same equipment as the people you are racing.';
            }
          },
          {
            id: 'decline',
            label: 'Race on what you have',
            detail: 'A worse car, and nothing hanging over you.',
            effect: 'Technical +2 · Racecraft +1.5 · Form −1',
            apply: ({ state }) => {
              stats(state, { technical: 2, racecraft: 1.5 });
              form(state, -1);
              return 'You take the cheaper drive. The car is a handful and you learn more about car control in one year than the boy in the good seat learns in three.';
            }
          }
        ]
      };
    }
  },

  // ---- midseason ----------------------------------------------------------
  {
    id: 'junior_rich_teammate',
    phase: 'midseason',
    tag: 'Politics',
    weight: 8,
    when: (ctx) => isJunior(ctx),
    build: () => ({
      title: 'His father owns half the team',
      body: 'The new floor went on his car. So did the rebuilt engine, and the engineer who won this championship two years ago. Nobody has said anything to you because nobody needs to.',
      options: [
        {
          id: 'confront',
          label: 'Say it to the team principal',
          detail: 'Ask, out loud, whether you are here to race or to make up the numbers.',
          outcomes: [
            {
              id: 'levelled',
              chance: 45,
              effect: 'Pace +2 · Qualifying +1.5 · Team bond −8',
              detail: 'the equipment gets levelled',
              tone: 'good',
              apply: ({ state }) => {
                stats(state, { pace: 2, qualifying: 1.5 });
                bond(state, -8);
                rep(state, 3);
                return 'He does not enjoy the conversation, but from the next round the parts arrive on both cars. He also never quite looks at you the same way.';
              }
            },
            {
              id: 'marked',
              chance: 55,
              effect: 'Reputation +2 · Team bond −20 · Form −2',
              detail: 'you are out at the end of the year',
              tone: 'bad',
              apply: ({ state }) => {
                rep(state, 2);
                bond(state, -20);
                form(state, -2);
                return 'He listens, agrees with everything, and changes nothing. Your seat for next season is advertised in October.';
              }
            }
          ]
        },
        {
          id: 'outdrive',
          label: 'Say nothing and beat him anyway',
          detail: 'In worse equipment, in front of his father.',
          effect: 'Pace +1.5 · Consistency +1.5 · Reputation +4',
          apply: ({ state }) => {
            stats(state, { pace: 1.5, consistency: 1.5 });
            bond(state, 5);
            rep(state, 4);
            return 'You out-qualify him eleven times out of fourteen in the older car. The engineers start finding reasons to walk past your garage.';
          }
        }
      ]
    })
  },
  {
    id: 'junior_homesick',
    phase: 'midseason',
    tag: 'Life',
    weight: 8,
    when: (ctx) => isJunior(ctx) && ctx.state.player.age <= 19,
    build: (ctx) => ({
      title: 'A long way from home',
      body: `You are ${ctx.state.player.age}, living in a rented flat in a country where you speak forty words of the language, and you have not had a conversation that was not about racing in eleven weeks. It has started to show on Sundays.`,
      options: [
        {
          id: 'home',
          label: 'Go home for a month',
          detail: 'Miss two rounds. See your friends. Eat a meal somebody cooked for you.',
          effect: 'Form +3 · Fitness +1.5 · Reputation −4 · Pace −1',
          apply: ({ state }) => {
            form(state, 3);
            stats(state, { fitness: 1.5, pace: -1 });
            rep(state, -4);
            return 'You go home. You sleep. Your championship position gets worse and you come back able to breathe again.';
          }
        },
        {
          id: 'stay',
          label: 'Stay and get on with it',
          detail: 'Everyone does this. Most of them are fine.',
          effect: 'Consistency +2 · Potential +1 · Form −2',
          apply: ({ state }) => {
            stats(state, { consistency: 2 });
            potential(state, 1);
            form(state, -2);
            return 'You stay. It is a miserable few months and it changes something in you that later on people will call professionalism.';
          }
        }
      ]
    })
  },
  {
    id: 'junior_exams',
    phase: 'midseason',
    tag: 'Life',
    weight: 7,
    once: true,
    when: (ctx) => isJunior(ctx) && ctx.state.player.age <= 18,
    build: () => ({
      title: 'The round is on the same weekend as your exams',
      body: 'There is no moving either of them. Your school has been patient for two years and has run out of patience. Your team has entered you and paid for it.',
      options: [
        {
          id: 'race',
          label: 'Race',
          detail: 'There is no exam board in the paddock.',
          effect: 'Form +2 · Reputation +3 · Technical −1.5 · Marketability −4',
          apply: ({ state }) => {
            form(state, 2);
            rep(state, 3);
            stats(state, { technical: -1.5 });
            market(state, -4);
            return 'You race. You score. You also close a door that a great many drivers wish, at thirty-one, they had left open.';
          }
        },
        {
          id: 'exams',
          label: 'Sit the exams',
          detail: 'A weekend of the championship, gone.',
          effect: 'Technical +2.5 · Marketability +6 · Form −2 · Reputation −3',
          apply: ({ state }) => {
            stats(state, { technical: 2.5, consistency: 1 });
            market(state, 6);
            form(state, -2);
            rep(state, -3);
            return 'You sit them. Your rivals score points while you answer questions about oxbow lakes, and in fifteen years you will still be glad.';
          }
        }
      ]
    })
  },
  {
    id: 'junior_stewards',
    phase: 'midseason',
    tag: 'Integrity',
    weight: 7,
    when: (ctx) => isJunior(ctx),
    build: () => ({
      title: 'Nobody saw the chicane',
      body: 'You won. On lap nineteen, defending, you put all four wheels over the kerbs and across the painted line and came out ahead. There is no marshal post at that corner and the television feed was on the leaders.',
      options: [
        {
          id: 'declare',
          label: 'Tell the stewards',
          detail: 'Hand back the win before anyone asks for it.',
          effect: 'Reputation +9 · Team bond +8 · Form −1',
          apply: ({ state }) => {
            rep(state, 9);
            bond(state, 8);
            form(state, -1);
            return 'You knock on the door and explain. They demote you to fourth. The story goes round the paddock within an hour and it does you more good than the trophy would have.';
          }
        },
        {
          id: 'quiet',
          label: 'Say nothing',
          detail: 'It is a win. Wins are how anyone gets out of here.',
          outcomes: [
            {
              id: 'clean',
              chance: 60,
              effect: 'Form +2 · Reputation +2',
              detail: 'nobody ever mentions it',
              tone: 'good',
              apply: ({ state }) => {
                form(state, 2);
                rep(state, 2);
                return 'Nothing happens. The result stands, the trophy is on the shelf, and you think about lap nineteen more often than you expected to.';
              }
            },
            {
              id: 'surfaces',
              chance: 40,
              effect: 'Reputation −11 · Team bond −10 · Form −2',
              detail: 'a spectator had a camera',
              tone: 'bad',
              apply: ({ state }) => {
                rep(state, -11);
                bond(state, -10);
                form(state, -2);
                return 'A spectator posts eleven seconds of phone footage on the Tuesday. You are disqualified, and the word people use about you afterwards is not "mistake".';
              }
            }
          ]
        }
      ]
    })
  },
  {
    id: 'junior_crash_bill',
    phase: 'midseason',
    tag: 'Money',
    weight: 7,
    when: (ctx) => isJunior(ctx),
    build: (ctx) => {
      const bill = ctx.rng.range(0.25, 0.6);
      return {
        title: 'The bill for the car',
        body: `You put it into the barriers backwards on the third day of testing. The chassis is straight but almost nothing bolted to it is. The team has sent an invoice for ${formatMoney(bill)} and made it clear that the alternative is sitting out the next round.`,
        options: [
          {
            id: 'pay',
            label: 'Pay it',
            effect: `−${formatMoney(bill)} · Team bond +7 · Consistency +0.5`,
            apply: ({ state }) => {
              money(state, -bill);
              bond(state, 7);
              stats(state, { consistency: 0.5 });
              return 'You pay it out of money that was meant to last until September. The mechanics notice that you paid without arguing, which turns out to matter.';
            }
          },
          {
            id: 'sit',
            label: 'Sit out the round',
            effect: 'Form −3 · Reputation −4 · Team bond −6',
            apply: ({ state }) => {
              form(state, -3);
              rep(state, -4);
              bond(state, -6);
              return 'You watch from the pit wall in team kit with nothing to do. Your championship rival scores eighteen points and your budget survives to fight another month.';
            }
          }
        ]
      };
    }
  },

  // ---- offseason ----------------------------------------------------------
  {
    id: 'junior_remortgage',
    phase: 'offseason',
    tag: 'Family',
    weight: 9,
    once: true,
    when: (ctx) => isJunior(ctx) && ctx.state.player.age <= 19,
    build: (ctx) => {
      const amount = ctx.rng.range(2.0, 3.2);
      return {
        title: 'They will remortgage the house',
        body: `Your parents have done the arithmetic at the kitchen table and they can raise ${formatMoney(amount)} against the house. Your mother says it like it is a normal thing to do. Nobody in the room says the word "last".`,
        options: [
          {
            id: 'accept',
            label: 'Take it',
            detail: 'A proper car, and a year you are not allowed to waste.',
            effect: `${formatMoney(amount)} · Pace +2 · Qualifying +1.5 · Consistency −1.5`,
            apply: ({ state }) => {
              money(state, amount);
              stats(state, { pace: 2, qualifying: 1.5, consistency: -1.5 });
              return 'You take it. You are quick immediately, and you drive every lap of the season as though a mistake would cost somebody their home, which it would.';
            }
          },
          {
            id: 'refuse',
            label: 'Tell them no',
            detail: 'The cheap seat, and everyone sleeps.',
            effect: 'Technical +2.5 · Racecraft +2 · Pace −1',
            apply: ({ state }) => {
              stats(state, { technical: 2.5, racecraft: 2, pace: -1 });
              bond(state, 5);
              return 'You tell them no, and take a seat in a car that is genuinely bad. You spend a year learning to carry a car that does not want to be carried.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'junior_pay_driver',
    phase: 'offseason',
    tag: 'Money',
    weight: 8,
    when: (ctx) => isJunior(ctx) && ctx.state.player.career.wealth >= 1,
    build: () => ({
      title: 'Two seats, and one of them is free',
      body: 'The team that won this championship will take you if you bring the budget. The team that finished eighth will take you for nothing, and they will give you the engineer who ran the car that won it two years ago.',
      options: [
        {
          id: 'buy',
          label: 'Buy the good seat',
          detail: 'Everything you have, for equipment that can win.',
          effect: 'Pace +2 · Qualifying +2 · Almost everything you have',
          apply: ({ state }) => {
            const spend = Math.max(0, state.player.career.wealth * 0.85);
            money(state, -spend);
            stats(state, { pace: 2, qualifying: 2 });
            return `You hand over ${formatMoney(spend)} and get a car capable of winning. Your bank balance is a rounding error and your lap times are not.`;
          }
        },
        {
          id: 'engineer',
          label: 'Take the free seat and the engineer',
          detail: 'A slower car, and the best person you will ever work with.',
          effect: 'Technical +3 · Consistency +2 · Pace −0.5',
          apply: ({ state }) => {
            stats(state, { technical: 3, consistency: 2, pace: -0.5 });
            bond(state, 10);
            return 'He is sixty-one and has forgotten more than your last team knew. You finish fifth in a car that belongs eighth, and you understand exactly why.';
          }
        }
      ]
    })
  },
  {
    id: 'junior_dad_or_pro',
    phase: 'offseason',
    tag: 'Family',
    weight: 8,
    once: true,
    when: (ctx) => isJunior(ctx) && ctx.state.player.age <= 20,
    build: () => ({
      title: 'Your father has managed you since karting',
      body: 'He drove the van, rebuilt the engines in the garage, and negotiated every deal you have ever had — badly, and for free. A professional manager with two Formula 1 clients has offered to take over. Your father says it is your decision, in a voice that means it is not.',
      options: [
        {
          id: 'pro',
          label: 'Sign the professional',
          detail: 'Doors that will not open otherwise.',
          effect: 'Marketability +13 · Reputation +6 · Consistency −1 · Form −2',
          apply: ({ state }) => {
            market(state, 13);
            rep(state, 6);
            stats(state, { consistency: -1 });
            form(state, -2);
            return 'Within a month you are in two meetings you could never have got yourself. Your father comes to fewer races, and then to hardly any.';
          }
        },
        {
          id: 'dad',
          label: 'Stay with your father',
          detail: 'Nobody will ever fight harder for you. He will also lose every negotiation.',
          effect: 'Team bond +10 · Consistency +2 · Marketability −5',
          apply: ({ state }) => {
            bond(state, 10);
            stats(state, { consistency: 2, fitness: 0.5 });
            market(state, -5);
            return 'He keeps doing it. He gets a worse deal than the professional would have, and you keep the person who has been in your corner since you were nine.';
          }
        }
      ]
    })
  },
  {
    id: 'junior_move_abroad',
    phase: 'offseason',
    tag: 'Life',
    weight: 8,
    once: true,
    when: (ctx) => isJunior(ctx) && ctx.state.player.age <= 20,
    build: (ctx) => ({
      title: 'The championship that matters is in Europe',
      body: `Everyone who gets out of here goes. The teams are there, the tracks are there, and the people who decide who gets a Formula 1 test are there. You are ${ctx.state.player.age}, and everyone you have ever known is here.`,
      options: [
        {
          id: 'go',
          label: 'Move',
          detail: 'Better everything, and you will not know a soul.',
          effect: 'Potential +1 · Pace +1.5 · Technical +1.5 · Form −3 · Fitness −1',
          apply: ({ state }) => {
            potential(state, 1);
            stats(state, { pace: 1.5, technical: 1.5, fitness: -1 });
            form(state, -3);
            money(state, -0.5);
            rep(state, 3);
            return 'You move into a flat above a laundrette forty minutes from the factory. The racing is a level harder and so is everything else.';
          }
        },
        {
          id: 'stay',
          label: 'Stay',
          detail: 'A settled life, and a ceiling you cannot see yet.',
          effect: 'Form +2 · Fitness +1 · Consistency +1.5 · Pace −1 · Reputation −4',
          apply: ({ state }) => {
            form(state, 2);
            stats(state, { fitness: 1, consistency: 1.5, pace: -1 });
            rep(state, -4);
            return 'You stay, and you are happy, and you are very good in a championship that the people who matter do not watch.';
          }
        }
      ]
    })
  },
  {
    id: 'junior_winter_series',
    phase: 'offseason',
    tag: 'Preparation',
    weight: 7,
    when: (ctx) => isJunior(ctx),
    build: (ctx) => {
      const cost = ctx.rng.range(0.3, 0.7);
      return {
        title: 'A winter championship on the other side of the world',
        body: `Six races in five weeks, in heat, against grown men who have been racing there for a decade. It costs ${formatMoney(cost)} and it is the only seat time available between now and March.`,
        options: [
          {
            id: 'go',
            label: 'Enter it',
            effect: `Racecraft +2.5 · Pace +1.5 · Fitness −2 · −${formatMoney(cost)}`,
            apply: ({ state }) => {
              stats(state, { racecraft: 2.5, pace: 1.5, fitness: -2 });
              money(state, -cost);
              return 'You get comprehensively roughed up for three weeks and then you start finishing races ahead of people who have done it eleven times. You come home different.';
            }
          },
          {
            id: 'train',
            label: 'Rest and train',
            effect: 'Fitness +3 · Potential +1 · Racecraft −0.5 · Form −1',
            apply: ({ state }) => {
              stats(state, { fitness: 3, racecraft: -0.5 });
              potential(state, 1);
              form(state, -1);
              return 'You spend the winter in a gym and arrive in March in the best physical condition of your life, having not driven a racing car since October.';
            }
          }
        ]
      };
    }
  },
  {
    id: 'junior_loan_due',
    phase: 'offseason',
    tag: 'Money',
    weight: 16,
    once: true,
    // The payoff half of `junior_loan`. A card's `when` can read firedEvents,
    // which is what makes a storyline possible at all — but firedEvents only
    // records that an event FIRED, never which option was chosen, so the loan
    // card leaves its own breadcrumb when the money is actually taken.
    // NOT gated to the junior ladder. A debt taken at seventeen that vanishes
    // the moment you are promoted is not a debt, and roughly seven in eight
    // borrowers reached Formula 1 before this could fire when it was.
    when: (ctx) =>
      ctx.state.firedEvents.includes('flag_loan_taken') && ctx.state.history.length >= 2,
    build: (ctx) => {
      const owed = ctx.rng.range(2.4, 3.4);
      const canPay = ctx.state.player.career.wealth >= owed;
      const earning = ctx.state.player.series === 'F1';
      return {
        title: 'The bank would like a word',
        body: earning
          ? `You had forgotten about it, which is a thing money lets you do. The letter is addressed to your parents as well as to you, it references an agreement you signed when you were eighteen, and the figure at the bottom is ${formatMoney(owed)}.`
          : `The repayment schedule assumed you would be earning by now. You are not, particularly. The letter is polite, it is addressed to your parents as well as to you, and the figure at the bottom is ${formatMoney(owed)}.`,
        options: [
          {
            id: 'pay',
            label: canPay ? 'Pay it off' : 'Pay what you can',
            detail: canPay
              ? 'Clear it, and start again from nothing.'
              : 'It will not cover it. It will buy you time.',
            effect: `−${formatMoney(owed)} · Form +2 · Consistency +1`,
            apply: ({ state }) => {
              money(state, -owed);
              form(state, 2);
              stats(state, { consistency: 1 });
              return 'You clear it, or enough of it. The relief is physical, and your budget for the coming season is whatever you can find between now and March.';
            }
          },
          {
            id: 'defer',
            label: 'Ask them to wait',
            detail: 'One more season. One good result and it is nothing.',
            outcomes: [
              {
                id: 'granted',
                chance: 50,
                effect: 'Reputation −2 · Form −1',
                detail: 'they give you another year',
                tone: 'mixed',
                apply: ({ state }) => {
                  rep(state, -2);
                  form(state, -1);
                  return 'The manager who knew your family signs one more extension, and tells you kindly that he cannot do it again.';
                }
              },
              {
                id: 'public',
                chance: 50,
                effect: 'Reputation −10 · Marketability −13 · Form −2',
                detail: 'it becomes everybody’s business',
                tone: 'bad',
                apply: ({ state }) => {
                  rep(state, -10);
                  market(state, -13);
                  form(state, -2);
                  return 'It goes to collection, and in a paddock this small everybody knows by Friday. Two teams stop returning your calls.';
                }
              }
            ]
          }
        ]
      };
    }
  }
];

import type { DecisionEvent } from './decisionModel';
import { bond, currentTeam, form, isF1, market, money, rel, rep, stats } from './decisionModel';
import type { DecisionContext } from './decisionModel';
import type { Team } from '../game/types';

/**
 * RED FLAGS. Twice a career, everything stops.
 *
 * These are ordinary decision events — same shape, same odds, same engine —
 * held in their own list because of HOW they are chosen rather than what
 * they are. An ordinary decision is drawn from everything that fits. A red
 * flag is drawn only from what this career has actually left in play, and
 * the board shows the player that whole pool rolling past before it stops.
 * Nothing can land that the career did not make possible, which is the only
 * reason the moment reads as fate rather than as the author intervening.
 *
 * TWO IS A STRUCTURE, NOT A QUOTA. The first is scheduled early and the
 * second late, so the first can leave something behind and the second can
 * be what comes back for it. `leaves` marks what was left; a later card's
 * `when` looks for it. The player is told none of this: no meter, no hint,
 * no acknowledgement at the time. It is drawn once, on the retirement
 * screen, out of `pastTense`, `fork` and `aftermath`.
 *
 * Every card must end in a question. If it can be read out and the player
 * has nothing to decide, it is not a card — which is why the two obvious
 * ones (an engine letting go, a rule change) are written as the politics
 * around the event rather than the event.
 */

/** The group shown under the name on the board, and as the card's tag. */
export const RED_FLAG_GROUPS = {
  up: 'The way up',
  squeeze: 'The squeeze',
  test: 'The test',
  reckoning: 'The reckoning'
} as const;

/**
 * Markers a later red flag can come back for.
 *
 * Deliberately not every marker. Taking the meeting openly leaves `known`
 * and bringing the car home leaves nothing, because a choice with nothing
 * to hide has nothing to collect — which is the quiet argument the whole
 * mechanic is making.
 */
export const COLLECTABLE = ['secret', 'feud', 'outspoken', 'owed', 'owned', 'famous', 'blamed'];

export function isCollectable(tags: string[]): boolean {
  return tags.some((t) => COLLECTABLE.includes(t));
}

/**
 * What a story about this driver would actually be about.
 *
 * At one red flag a career there is no earlier one to come back for, so
 * the subject is read out of the career itself: a garage that has turned
 * on you, a name big enough to be worth a profile, or a deal that did not
 * match the promise. The earlier-marker path is kept first because it is
 * the better story whenever it exists.
 */
function storySubject(ctx: DecisionContext): string {
  const log = ctx.state.redFlagLog ?? [];
  for (let i = log.length - 1; i >= 0; i--) {
    const hit = log[i].tags.find((t) => COLLECTABLE.includes(t));
    if (hit) return hit;
  }
  const { career } = ctx.state.player;
  if (career.teamRelationship < 40) return 'feud';
  if (career.reputation >= 55) return 'famous';
  return 'owed';
}

/**
 * A team with a reason to call: one you have history with first, then
 * simply one that is quicker than yours. Undefined in the junior series,
 * where the card speaks about "a seat in the series above" instead.
 */
function callerFor(ctx: DecisionContext): Team | undefined {
  const { state } = ctx;
  if (state.player.series !== 'F1') return undefined;
  const mine = currentTeam(ctx);
  const f1 = Object.values(state.teams).filter(
    (t) => t.series === 'F1' && t.id !== state.player.teamId
  );
  if (f1.length === 0) return undefined;
  const known = f1
    .filter((t) => (state.relationships[t.id as keyof typeof state.relationships] ?? 0) > 12)
    .sort((a, b) => b.carPerformance - a.carPerformance);
  if (known.length > 0) return known[0];
  const faster = f1
    .filter((t) => t.carPerformance > (mine?.carPerformance ?? 0))
    .sort((a, b) => b.carPerformance - a.carPerformance);
  return faster[0] ?? ctx.rng.pick(f1);
}

export const RED_FLAG_EVENTS: DecisionEvent[] = [
  // -------------------------------------------------------------------------
  {
    id: 'rf_the_call',
    phase: 'midseason',
    tag: RED_FLAG_GROUPS.up,
    weight: 1,
    once: true,
    // Earned by out-driving the car: a quicker team only calls a driver who
    // has given them a reason on a Sunday.
    when: (ctx) =>
      ctx.state.player.career.reputation >= 42 ||
      (ctx.lastSeason?.podiums ?? 0) > 0 ||
      (ctx.lastSeason?.championshipPosition ?? 99) <= 6,
    build: (ctx) => {
      const caller = callerFor(ctx);
      // Two forms, because the fallback is a phrase and not a name: `who`
      // opens a sentence and `whom` sits inside one. Sharing them produced
      // "You met A team in the series above." on the retirement screen.
      const who = caller ? caller.name : 'A team in the series above';
      const whom = caller ? caller.name : 'a team in the series above';
      const callerId = caller?.id ?? '';
      return {
        title: 'The call',
        body: `${who} want a meeting. No agents, no press. They have a seat for next year and they want to know if you would take it. Your team does not know they called.`,
        options: [
          {
            id: 'open',
            label: 'Take the meeting, tell your team after',
            detail: 'Honest, on your own timing.',
            pastTense: `You met ${whom}, and told your team afterwards.`,
            fork: 'You could have kept it to yourself.',
            leaves: ['known'],
            outcomes: [
              {
                id: 'respected',
                chance: 60,
                effect: 'Reputation +5 · Relationship +4',
                detail: 'He respects that you said it to his face.',
                tone: 'good',
                apply: (c) => {
                  rep(c.state, 5);
                  bond(c.state, 4);
                  if (callerId) rel(c.state, callerId, 8);
                  return 'You told him yourself. He did not enjoy it, and he respected it.';
                }
              },
              {
                id: 'badly',
                chance: 40,
                effect: 'Relationship −10',
                detail: 'He takes it as a betrayal and says so.',
                tone: 'mixed',
                aftermath: 'He never trusted you again, and he told the people who asked.',
                apply: (c) => {
                  bond(c.state, -10);
                  rep(c.state, 2);
                  if (callerId) rel(c.state, callerId, 5);
                  return 'He heard "I am leaving" and stopped listening after that.';
                }
              }
            ]
          },
          {
            id: 'quiet',
            label: 'Take the meeting, tell nobody',
            detail: 'Nothing on the record. Nothing in writing.',
            pastTense: `You met ${whom}. You told nobody.`,
            fork: 'You could have told them first.',
            leaves: ['secret'],
            outcomes: [
              {
                id: 'clean',
                chance: 65,
                effect: 'Marketability +6',
                detail: 'Not a word in the paddock.',
                tone: 'good',
                apply: (c) => {
                  market(c.state, 6);
                  if (callerId) rel(c.state, callerId, 10);
                  return 'A hotel outside the circuit, and nobody saw a thing.';
                }
              },
              {
                id: 'loose',
                chance: 35,
                effect: 'Marketability +6',
                detail: 'You will not hear about it now.',
                tone: 'bad',
                aftermath: 'It came out in the end. It always does.',
                apply: (c) => {
                  market(c.state, 6);
                  if (callerId) rel(c.state, callerId, 10);
                  return 'Somebody in the room has a bad habit with journalists.';
                }
              }
            ]
          },
          {
            id: 'bid',
            label: 'Tell your team first, make them bid',
            pastTense: 'You used the interest to get paid where you were.',
            fork: `You could have gone to ${whom} instead.`,
            leaves: [],
            effect: 'Money +1.5 · Relationship +6',
            apply: (c) => {
              money(c.state, 1.5);
              bond(c.state, 6);
              return 'They improved the deal inside a week. The car stayed the same.';
            }
          }
        ]
      };
    }
  },

  // -------------------------------------------------------------------------
  {
    id: 'rf_third_failure',
    phase: 'midseason',
    tag: RED_FLAG_GROUPS.squeeze,
    weight: 1,
    once: true,
    // Across the last three seasons rather than one. At one season and two
    // failures this fired in a single career out of three hundred, which is
    // a card that does not exist.
    when: (ctx) =>
      ctx.state.history.slice(-3).reduce((n, h) => n + h.dnfs, 0) >= 2,
    build: () => ({
      title: 'The third failure',
      body: 'Third one this season. The team call it bad luck. Your race engineer does not meet your eye when they say it.',
      options: [
        {
          id: 'public',
          label: 'Say what you think, on camera',
          pastTense: 'You said it on camera.',
          fork: 'You could have swallowed it.',
          leaves: ['outspoken'],
          outcomes: [
            {
              id: 'backed',
              chance: 55,
              effect: 'Reputation +4 · Relationship −8',
              detail: 'The paddock agrees with you. The garage does not.',
              tone: 'mixed',
              apply: (c) => {
                rep(c.state, 4);
                bond(c.state, -8);
                return 'Everyone outside the garage thought you were right.';
              }
            },
            {
              id: 'ranks',
              chance: 45,
              effect: 'Relationship −14',
              detail: 'You are the problem by Thursday.',
              tone: 'bad',
              aftermath: 'You were the difficult one from that week onward.',
              apply: (c) => {
                bond(c.state, -14);
                form(c.state, -1);
                return 'By Thursday the story was about you, not the engine.'
              }
            }
          ]
        },
        {
          id: 'absorb',
          label: 'Absorb it, say nothing',
          pastTense: 'You said nothing about any of it.',
          fork: 'You could have made it their problem.',
          leaves: [],
          effect: 'Relationship +6',
          apply: (c) => {
            bond(c.state, 6);
            return 'You thanked the crew on the radio. They heard what it cost you.';
          }
        },
        {
          id: 'bank',
          label: 'Bank it for the contract talks',
          detail: 'Say nothing now. Spend it in December.',
          pastTense: 'You kept the receipts instead of complaining.',
          fork: 'You could have said it while anyone still cared.',
          leaves: ['owed'],
          outcomes: [
            {
              id: 'leverage',
              chance: 70,
              effect: 'Money +1.2 · Relationship +3',
              detail: 'Three failures are worth a clause.',
              tone: 'good',
              apply: (c) => {
                money(c.state, 1.2);
                bond(c.state, 3);
                return 'In December it was worth a clause and a number.';
              }
            },
            {
              id: 'forgotten',
              chance: 30,
              effect: 'No change',
              detail: 'Nobody wrote it down.',
              tone: 'mixed',
              apply: () => 'By December they remembered a different season.'
            }
          ]
        }
      ]
    })
  },

  // -------------------------------------------------------------------------
  {
    id: 'rf_rainmaster',
    phase: 'midseason',
    tag: RED_FLAG_GROUPS.test,
    weight: 1,
    once: true,
    // Weather is always in play. It is the one card every career can draw.
    when: (ctx) => ctx.state.history.length >= 1,
    build: () => ({
      title: 'Rainmaster',
      body: 'It is biblical out there and the grid order has stopped meaning anything. Half the people ahead of you cannot drive in this. Neither, probably, can you.',
      options: [
        {
          id: 'send',
          label: 'Go for the drive they show in twenty years',
          pastTense: 'You went for it in the wet.',
          fork: 'You could have brought it home.',
          leaves: [],
          outcomes: [
            {
              id: 'legend',
              chance: 40,
              effect: 'Reputation +12 · Racecraft +2',
              detail: 'Podium, from fourteenth.',
              tone: 'good',
              aftermath: 'People who saw it still bring it up.',
              leaves: ['famous'],
              apply: (c) => {
                rep(c.state, 12);
                market(c.state, 8);
                stats(c.state, { racecraft: 2 });
                form(c.state, 3);
                return 'They were still showing it on Thursday.';
              }
            },
            {
              id: 'wall',
              chance: 60,
              effect: 'Relationship −8 · Form −3',
              detail: 'In the wall on lap nine.',
              tone: 'bad',
              aftermath: 'They stopped giving you the wet tyres first.',
              leaves: ['blamed'],
              apply: (c) => {
                bond(c.state, -8);
                form(c.state, -3);
                return 'Lap nine, and on the replay it looked like what it was.';
              }
            }
          ]
        },
        {
          id: 'home',
          label: 'Drive to the conditions, bring it home',
          pastTense: 'You brought it home in the wet.',
          fork: 'You could have gone for the drive of your life.',
          leaves: [],
          outcomes: [
            {
              id: 'points',
              chance: 80,
              effect: 'Consistency +1 · Relationship +5',
              detail: 'Points, quietly.',
              tone: 'good',
              apply: (c) => {
                stats(c.state, { consistency: 1 });
                bond(c.state, 5);
                return 'Nobody wrote about you on Monday, which was the idea.';
              }
            },
            {
              id: 'caught',
              chance: 20,
              effect: 'Form −1',
              detail: 'Caught out at the restart.',
              tone: 'mixed',
              apply: (c) => {
                form(c.state, -1);
                return 'Two places lost at the restart, and no damage done.';
              }
            }
          ]
        },
        {
          id: 'gamble',
          label: 'Gamble on tyres before anyone else',
          pastTense: 'You called the tyres before anyone else dared.',
          fork: 'You could have waited for the pit wall.',
          leaves: [],
          outcomes: [
            {
              id: 'lead',
              chance: 50,
              effect: 'Reputation +8 · Technical +1',
              detail: 'You lead a lap of a grand prix.',
              tone: 'good',
              leaves: ['famous'],
              apply: (c) => {
                rep(c.state, 8);
                stats(c.state, { technical: 1 });
                return 'Whatever else happened, you led a lap. That stays true.';
              }
            },
            {
              id: 'stops',
              chance: 50,
              effect: 'Relationship −6 · Form −2',
              detail: 'Three stops, last of the finishers.',
              tone: 'bad',
              leaves: ['blamed'],
              apply: (c) => {
                bond(c.state, -6);
                form(c.state, -2);
                return 'The call was yours and the radio has it, in your voice.';
              }
            }
          ]
        }
      ]
    })
  },

  // -------------------------------------------------------------------------
  {
    id: 'rf_team_orders',
    phase: 'midseason',
    tag: RED_FLAG_GROUPS.test,
    weight: 1,
    once: true,
    when: (ctx) => isF1(ctx) && (ctx.lastSeason?.points ?? 0) > 0,
    build: () => ({
      title: 'Team orders',
      body: '"Hold position." Nobody on the radio says the other half of the sentence, and nobody needs to.',
      options: [
        {
          id: 'obey',
          label: 'Obey',
          pastTense: 'You held position when you were told to.',
          fork: 'You could have ignored it.',
          leaves: ['owed'],
          effect: 'Relationship +10',
          apply: (c) => {
            bond(c.state, 10);
            return 'You finished second, and they put it in writing that they owed you.';
          }
        },
        {
          id: 'ignore',
          label: 'Ignore it',
          pastTense: 'You ignored the call and took the place anyway.',
          fork: 'You could have done as you were told.',
          leaves: ['outspoken', 'feud'],
          outcomes: [
            {
              id: 'won',
              chance: 65,
              effect: 'Reputation +9 · Relationship −16',
              detail: 'You win. Nobody in the garage looks at you.',
              tone: 'good',
              apply: (c) => {
                rep(c.state, 9);
                market(c.state, 5);
                bond(c.state, -16);
                return 'You won it. Nobody in the garage looked at you afterwards.';
              }
            },
            {
              id: 'both',
              chance: 35,
              effect: 'Relationship −20 · Form −2',
              detail: 'You both finish nowhere, and it was your move.',
              tone: 'bad',
              aftermath: 'Two teams crossed you off over that corner.',
              apply: (c) => {
                bond(c.state, -20);
                form(c.state, -2);
                return 'You took each other off at turn four. It was your move.';
              }
            }
          ]
        },
        {
          id: 'public',
          label: 'Obey, make them say it on the open radio',
          pastTense: 'You made them give the order where everyone could hear it.',
          fork: 'You could have taken it quietly.',
          leaves: ['outspoken'],
          effect: 'Reputation +7 · Relationship −4',
          apply: (c) => {
            rep(c.state, 7);
            market(c.state, 6);
            bond(c.state, -4);
            return 'They had to say it twice, on a channel the world was listening to.';
          }
        }
      ]
    })
  },

  // -------------------------------------------------------------------------
  {
    id: 'rf_seat_behind',
    phase: 'midseason',
    tag: RED_FLAG_GROUPS.squeeze,
    weight: 1,
    once: true,
    when: (ctx) =>
      ctx.state.player.career.teamRelationship < 48 ||
      (ctx.lastSeason?.championshipPosition ?? 0) > 12,
    build: () => ({
      title: 'The seat behind you',
      body: 'He did a filming day on Tuesday. Nobody told you. The academy have been briefing quietly that he is ready.',
      options: [
        {
          id: 'outdrive',
          label: 'Out-drive him, never mention it',
          pastTense: 'You never mentioned the junior they were testing.',
          fork: 'You could have forced an answer out of them.',
          leaves: [],
          outcomes: [
            {
              id: 'gone',
              chance: 50,
              effect: 'Relationship +8 · Form +2',
              detail: 'He is not ready, and it goes away.',
              tone: 'good',
              apply: (c) => {
                bond(c.state, 8);
                form(c.state, 2);
                return 'He was half a second off. Nobody mentioned it again.';
              }
            },
            {
              id: 'ready',
              chance: 50,
              effect: 'Relationship −10',
              detail: 'He is ready, and you find out when everyone does.',
              tone: 'bad',
              apply: (c) => {
                bond(c.state, -10);
                return 'He was ready. You read it at the same time as everyone else.';
              }
            }
          ]
        },
        {
          id: 'demand',
          label: 'Demand an answer this week',
          pastTense: 'You made them tell you where you stood.',
          fork: 'You could have let it run.',
          leaves: ['outspoken'],
          outcomes: [
            {
              id: 'writing',
              chance: 45,
              effect: 'Relationship +12',
              detail: 'They commit to you, in writing.',
              tone: 'good',
              apply: (c) => {
                bond(c.state, 12);
                rep(c.state, 2);
                return 'You made them put a date on it, and they did.';
              }
            },
            {
              id: 'truth',
              chance: 55,
              effect: 'Relationship −12 · Form −1',
              detail: 'They tell you the truth.',
              tone: 'bad',
              aftermath: 'You spent the rest of that contract knowing.',
              apply: (c) => {
                bond(c.state, -12);
                form(c.state, -1);
                return 'They told you the truth, earlier than you wanted it.';
              }
            }
          ]
        },
        {
          id: 'calls',
          label: 'Start making your own calls',
          pastTense: 'You went looking for another seat.',
          fork: 'You could have fought for the one you had.',
          leaves: ['secret'],
          outcomes: [
            {
              id: 'returned',
              chance: 70,
              effect: 'Marketability +8 · Relationship −6',
              detail: 'Two teams return your call. Your own team hears that you rang.',
              tone: 'mixed',
              apply: (c) => {
                market(c.state, 8);
                bond(c.state, -6);
                return 'Two of them rang back. Your own team heard about all of it.';
              }
            },
            {
              id: 'nobody',
              chance: 30,
              effect: 'Marketability −4 · Relationship −8',
              detail: 'Nobody rings back, and now they know you looked.',
              tone: 'bad',
              aftermath: 'Your own team had already started looking too.',
              apply: (c) => {
                market(c.state, -4);
                bond(c.state, -8);
                return 'Nobody rang back, and everybody knew you had asked.';
              }
            }
          ]
        }
      ]
    })
  },

  // -------------------------------------------------------------------------
  {
    id: 'rf_offer',
    phase: 'midseason',
    tag: RED_FLAG_GROUPS.up,
    weight: 1,
    once: true,
    when: (ctx) => ctx.state.player.career.wealth < 6,
    build: () => ({
      title: 'The offer on the table',
      body: 'Two years of seat security, paid up front. The logo goes on the car, on your overalls, and on you at eleven events a year.',
      options: [
        {
          id: 'sign',
          label: 'Sign it',
          pastTense: 'You took the sponsor and everything that came with it.',
          fork: 'You could have kept your name to yourself.',
          leaves: ['owned'],
          effect: 'Money +3 · Marketability +8',
          apply: (c) => {
            money(c.state, 3);
            market(c.state, 8);
            return 'Two seasons paid up front, and eleven appearance days a year.';
          }
        },
        {
          id: 'partial',
          label: 'Sign it, refuse the ambassador work',
          pastTense: 'You took the money and refused to be the face of it.',
          fork: 'You could have signed the whole thing.',
          leaves: [],
          outcomes: [
            {
              id: 'anyway',
              chance: 60,
              effect: 'Money +2.5 · Marketability +3',
              detail: 'They sign anyway. They wanted the car, not you.',
              tone: 'good',
              apply: (c) => {
                money(c.state, 2.5);
                market(c.state, 3);
                return 'They wanted the sidepod more than they wanted you.';
              }
            },
            {
              id: 'walk',
              chance: 40,
              effect: 'Marketability −5',
              detail: 'They walk, and tell the next driver why.',
              tone: 'bad',
              aftermath: 'The money went to somebody less particular.',
              apply: (c) => {
                market(c.state, -5);
                return 'They walked, and told the next driver exactly why.';
              }
            }
          ]
        },
        {
          id: 'refuse',
          label: 'Turn it down',
          pastTense: 'You turned the money down.',
          fork: 'You could have taken the money.',
          leaves: [],
          effect: 'Reputation +3',
          apply: (c) => {
            rep(c.state, 3);
            return 'You kept your name to yourself, and your funding problem.';
          }
        }
      ]
    })
  },

  // -------------------------------------------------------------------------
  // The collector. Eligible only when the career has a secret to find, which
  // is what makes it the natural second draw.
  {
    id: 'rf_paddock_rumour',
    phase: 'midseason',
    tag: RED_FLAG_GROUPS.reckoning,
    weight: 1,
    once: true,
    // Worth writing about, or worth writing against. Either will do: the
    // paddock does not need a secret to start talking, only a reason.
    when: (ctx) =>
      ctx.state.player.career.reputation >= 48 ||
      ctx.state.player.career.teamRelationship < 40 ||
      (ctx.state.redFlagLog ?? []).some((r) => isCollectable(r.tags)),
    build: (ctx) => ({
      title: 'Paddock rumour',
      // What he has is whatever this career actually left lying around. The
      // card is the same shape every time and about a different thing every
      // time, which is the only way the collection can land specifically.
      body: `${
        {
          secret: 'A journalist has the date, the hotel and your manager’s name.',
          feud: 'A journalist has the radio transcript, and two people in your own garage talking.',
          outspoken: 'A journalist has you on tape saying it, and a team principal happy to answer back.',
          owed: 'A journalist knows what you were promised and what you were actually given.',
          owned: 'A journalist has been through your sponsor’s accounts and wants to ask about them.',
          famous: 'A journalist is writing the long piece about that afternoon and has spoken to everyone who was there.',
          blamed: 'A journalist has the telemetry from the lap you put it in the wall.'
        }[storySubject(ctx)] ?? 'A journalist has most of it already.'
      } He runs it on Thursday. He is offering you Wednesday.`,
      options: [
        {
          id: 'deny',
          label: 'Deny everything',
          pastTense: 'You denied it.',
          fork: 'You could have got in front of it.',
          leaves: [],
          outcomes: [
            {
              id: 'dies',
              chance: 40,
              effect: 'No change',
              detail: 'It dies by Sunday. Nothing to stand it up.',
              tone: 'good',
              apply: () => 'He had nothing to stand it up with. It died by Sunday.'
            },
            {
              id: 'runs',
              chance: 60,
              effect: 'Relationship −18 · Reputation −6',
              detail: 'It runs with your denial in the third paragraph.',
              tone: 'bad',
              aftermath: 'They did not renew. Nobody else called.',
              apply: (c) => {
                bond(c.state, -18);
                rep(c.state, -6);
                return 'It ran on Thursday with your denial in the third paragraph.';
              }
            }
          ]
        },
        {
          id: 'own',
          label: 'Confirm it, in your words, first',
          pastTense: 'You put your own version out first.',
          fork: 'You could have denied all of it.',
          leaves: [],
          effect: 'Reputation +4 · Relationship −10',
          apply: (c) => {
            rep(c.state, 4);
            bond(c.state, -10);
            return 'Your team read it at the same moment as everybody else.';
          }
        },
        {
          id: 'trade',
          label: 'Give him something better about someone else',
          pastTense: 'You traded somebody else to stay out of it.',
          fork: 'You could have taken it on the chin.',
          leaves: ['owed'],
          outcomes: [
            {
              id: 'clear',
              chance: 75,
              effect: 'Marketability +4',
              detail: 'Your name stays out of it.',
              tone: 'good',
              apply: (c) => {
                market(c.state, 4);
                return 'Somebody else had a bad Thursday. Not you.';
              }
            },
            {
              id: 'both',
              chance: 25,
              effect: 'Reputation −10 · Relationship −12',
              detail: 'He runs both. Yours second, and sourced.',
              tone: 'bad',
              aftermath: 'The paddock worked out where the other story came from.',
              apply: (c) => {
                rep(c.state, -10);
                bond(c.state, -12);
                return 'He ran both. Yours was second, and it was sourced.';
              }
            }
          ]
        }
      ]
    })
  }
];

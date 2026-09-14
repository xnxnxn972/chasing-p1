# Decision ideas — the backlog

Write ideas here in plain English. Nothing in this file is code and nothing here
runs; it is the queue I work from when turning ideas into real cards in
`src/data/decisions*.ts`.

Add your idea under the right heading, in the template below. Rough is fine —
one line of situation and two choices is enough for me to build from. What I
mostly need from you is the **dilemma**, because that is the part the engine
cannot invent.

---

## The template

```
### <Working title>
Phase:     preseason | midseason | offseason
When:      who this can happen to (series, age, results, team, contract...)
Situation: two or three sentences, the way a driver would experience it
Option A:  what he does — and what it costs him
Option B:  what he does instead — and what that costs him
Option C:  (optional)
Gamble?:   which options should be a dice roll rather than a certainty
```

Two rules worth keeping in mind while writing:

**Both options have to hurt.** If one choice is plainly better, it is not a
decision, it is a button. The good cards in the game so far are the ones where
you can argue for either side afterwards.

**The card can never say what the car is worth.** The player never sees raw car
strength — that is deliberate, it's what stops the game becoming spreadsheet
optimisation. So a card can say "they are promising a big step for next year",
never "this car is a 78".

---

## What a card is allowed to change

These are the levers the engine already has. An idea that pulls only these can
be built immediately; anything else needs new engine code first (say so and
I'll tell you how big a job it is).

| Lever | What it means in the fiction |
|---|---|
| Six attributes | Pace, Qualifying, Consistency, Racecraft, Technical, Fitness |
| Potential | The hidden ceiling on how good he can ever get |
| Form | A temporary run of good or bad weekends |
| Reputation | What the paddock thinks of him as a driver |
| Marketability | What sponsors and team boards think he is worth |
| Team relationship | How the team he is at now feels about him |
| Relationship with a specific team | Whether Ferrari would ever call |
| Money | Wealth, and career earnings |
| Car performance | The team's car — only ever nudged, never revealed |

A card can also do bigger structural things, which are more work but possible:
change team mid-season, trigger an injury that costs races, end a contract,
force a series move, retire him.

---

## When a card can fire

Every card is gated so it only appears to a driver it makes sense for. The
vocabulary already available: series (F4/F3/F2/F1), age, reserve status,
number of F1 seasons, seasons at the current team, last season's championship
position, whether he has ever won a title, whether he's in an academy, current
attributes, reputation, marketability, team relationship, wealth, and who his
team-mate and nearest rival are.

Phases, per season:

- **preseason** — winter, testing, contracts already signed
- **midseason** — a specific race weekend or the middle of a campaign
- **offseason** — results are in, the driver market is open

---

## What already exists (don't re-invent these)

34 cards. Junior applies to F4/F3/F2, F1 to a race seat, Late to champions and
drivers near the end.

### Junior ladder — 8
| Phase | Card |
|---|---|
| preseason | School or the car *(once per career)* |
| preseason | A sponsor calls |
| preseason | Winter (fitness programme) |
| midseason | The driver coach |
| midseason | Your team-mate put you in the wall |
| midseason | A Formula 1 test |
| offseason | An academy invitation |
| offseason | Skip a rung? |

### Formula 1 — 20
| Phase | Card |
|---|---|
| preseason | The commercial calendar |
| preseason | The kid in the other car (mentoring a rookie) |
| preseason | Your race engineer |
| preseason | The <team> problem (weight of expectation) |
| midseason | Let him through (team orders) |
| midseason | The upgrade argument |
| midseason | Publicly criticised by the principal |
| midseason | He says you ignored the call |
| midseason | Last corner, last lap (title fight) |
| midseason | Cracked ribs |
| midseason | <rival> has been talking |
| midseason | Your home Grand Prix |
| midseason | Five-second penalty (stewards) |
| midseason | The call (reserve driver gets a race) |
| offseason | The radical car |
| offseason | The release clause |
| offseason | They want you to take less |
| offseason | They are asking your opinion (driver veto) |
| offseason | Off-track (brand / business) |
| offseason | How much longer? |

### Late career and champions — 6
| Phase | Card |
|---|---|
| preseason | Defending it |
| midseason | He is quicker than you |
| midseason | It is going to rain |
| offseason | The number one plate |
| offseason | The five-year plan (rebuild) |
| offseason | One more (final season) |

---

## Where the thin spots are

Roughly 1.3 decisions fire per season, so a 20-season career sees about 25
cards. The repetition is not spread evenly:

- **The junior ladder is the worst of it.** 8 cards, split 3 / 3 / 2 across the
  three phases — and *every* career starts there. The opening of every new game
  draws from the same tiny pool. This is the highest-value place to add.
- **Preseason is thin everywhere.** 3 junior, 4 F1, 1 late.
- **Nothing covers the bad years.** No card for driving a car that cannot score,
  for a team running out of money, for a season lost to reliability.
- **Nothing covers life outside the car.** One brand/business card and one
  school card, in a 30-year career.
- **The reserve year is one card.** A driver can spend a whole season as
  reserve and see a single decision.

---

## How big does the pool need to be?

The complaint is "someone who plays four games sees the same cards again". At
0.77 decisions a season, a junior career of 3-6 seasons draws roughly **3-5
junior cards**, so four games is about **16 draws**. Against today's pool of 8,
every card is seen twice over. Against a pool of ~24 it is mostly fresh.

**Target: triple the junior pool, 8 -> 24.** F1 is in better shape at 20 and
can grow more slowly.

| Stage | Now | Target |
|---|---|---|
| Junior — preseason | 3 | 8 |
| Junior — midseason | 3 | 8 |
| Junior — offseason | 2 | 8 |
| F1 | 20 | 28 |
| Late | 6 | 10 |

## Storylines are possible without engine work

A card's `when` can read `ctx.state.firedEvents`, so a decision can require that
an earlier one was taken. A loan accepted at 17 can come due at 20; an agent who
took a percentage can reappear when the first F1 salary lands. Two or three
cards chained this way give a junior career a spine, and they cost nothing but
content.

---

## Ideas

Anything with `[built]` in front of it is already in the game.

### FROM YANIV — 2026-09-14

**The bank loan** · offseason · junior · CHAINS
The bank will lend you a season. A: Take it — funded year, and a repayment card
that fires two or three seasons later whether or not you are earning. B: Decline.

**The supermodel** · offseason · F1 or late junior
She found you on Instagram. A: Go out with her — marketability up, form and
focus down, and the press follow you everywhere now. B: Don't — keep your head down.

**The birth** · midseason · F1, married
Your wife is due this week. A: Miss the races — family intact, points and team
relationship gone. B: Race — points kept, something at home does not recover.

**Move abroad** · offseason · junior
A: Move — better development, lose form and stability, costs money.
B: Stay home — stronger relationships, slower progression.

**Is it you or the car?** · midseason · F1, bad car
A: Say the car is the problem — reputation protected, team relationship damaged.
B: Take the blame publicly — team relationship up, reputation down.

**One upgrade, two cars** · midseason · F1
A: Demand it — small performance gain, significant team-mate and team cost.
B: Give it to your team-mate — reputation and relationship up, weekend sacrificed.

**Move near the factory** · offseason · F1
A: Move — simulator time, technical and team relationship up, life elsewhere.
B: Stay — keep your life, lose the access.

**The documentary** · preseason · F1
A: Let them in — money and marketability up, team relationship down, reputation risk.
B: Keep them out — protect the team, leave the money and the fame.

**The post that blew up** · midseason · F1
A: Delete and apologise — sponsors and team calm, authenticity and reputation hit.
B: Leave it up — fans and marketability up, team relationship risk.

**The all-nighter** · preseason · F1 or reserve
A: Stay and validate setups — technical and team relationship up, fitness and form down.
B: Go home — fitness preserved, a chance to become indispensable missed.

**The weight programme** · preseason · F1
A: Chase the target — possible performance and form gain, fitness and injury risk.
B: Refuse — fitness preserved, the team irritated.

### THE EARLY YEARS — the priority

**The family remortgage** · offseason · junior, age<=18
Your parents will remortgage the house for one more season. Nobody says the word
"last". A: Accept — a fully funded year, and a debt of a different kind (money
up, a later card calls it in). B: Refuse and take the cheap seat — worse team,
family intact.

**The pay driver** · offseason · junior
The quick team will take you if you bring budget. The struggling team will take
you for nothing and give you their best engineer. A: Find the money — better car,
wealth gutted. B: Free seat — poorer machinery, real coaching.

**The agent's percentage** · preseason · junior, age<=19 · CHAINS
An agent will fund your entire season for a slice of everything you ever earn.
A: Sign — money now, a permanent cut later (a card that fires on your first F1
contract). B: Decline — fund it yourself, slower start.

**The growth spurt** · preseason · junior, age 16-18 · once
You have grown eight centimetres. You no longer fit the car and you are over the
weight limit. A: Crash diet — keep the seat, fitness and consistency suffer.
B: New seat fabricated — miss testing, keep your body.

**The rich team-mate** · midseason · junior
His father funds the team. The upgrades go to his car and everyone knows it.
A: Confront the boss — relationship damage, possible fairness. B: Say nothing
and beat him anyway — reputation if you manage it, nothing if you don't.

**Homesick** · midseason · junior, age<=18, racing abroad
You are seventeen, living alone in a foreign country, and you are not coping.
A: Go home for a month — form and stability recover, development stalls.
B: Stay — grind through it, form drops, you come out harder.

**The exam weekend** · midseason · junior, age<=18
The round clashes with your final exams. A: Race — one shot at the title fight.
B: Sit the exams — marketability and technical up, miss the round.

**The mechanic who believes in you** · offseason · junior
An experienced mechanic will follow you to your next team for nothing. Your new
team has its own people and resents it. A: Bring him — technical up, team
relationship down. B: Leave him — the team is happy, you lose the one person who
knew your car.

**The crash bill** · midseason · junior
You destroyed the car in testing. The team wants it paid for or you sit out.
A: Pay — wealth gone. B: Sit out the round — championship damage, money kept.

**Dad or a professional** · offseason · junior, age<=20
Your father has managed you since karting. A real manager is offering. A: Sign
the professional — marketability and better seats, something at home breaks.
B: Stay with your father — loyalty, fewer doors open.

**The sponsor's son** · preseason · junior
A sponsor will fund your year if you coach their fourteen-year-old at weekends.
A: Take it — money, time and energy gone. B: Refuse — keep your winter.

**Winter series abroad** · offseason · junior
Race a foreign winter championship for seat time. A: Go — pace and racecraft up,
fitness and money down. B: Rest and train — fitness and potential, no seat time.

**The stewards' room** · midseason · junior
You won, but you cut the chicane and nobody has spotted it yet. A: Declare it —
lose the win, reputation and integrity up. B: Say nothing — keep the win,
reputation risk if it surfaces.

**Test day or tyres** · preseason · junior
You can afford one private test or a fresh set for qualifying. A: Test day —
technical and pace. B: Tyres — one good Saturday, and the result that comes with it.

**The engine** · midseason · junior
One fresh engine, two cars. A: Take it — pace this weekend, team-mate and team
relationship cost. B: Concede it — relationship up, a weekend lost.

**Sign now or fight for the title** · offseason · junior, leading a championship
The team above will take you next year, but only if you sign before the final
round, and the paperwork says you race for them from next week. A: Sign — the
step up, the title abandoned. B: Finish the fight — the seat may be gone.

### FORMULA 1 AND AFTER

**The national flag** · offseason · F1
A sponsor wants you to race under a different nationality. Money and doors.
A: Switch — marketability up, reputation and home support down. B: Refuse.

**The team-mate's telemetry** · midseason · F1
An engineer offers you data you are not supposed to have. A: Look — technical
and pace, and something you cannot undo if it surfaces. B: Refuse — the engineer
respects you, the gap stays.

**The last corner** · midseason · F1 · title decider
You can win the championship by not lifting. A: Take him out — the title, and a
reputation that never recovers. B: Lift — the title goes, everyone knows why.

**The idol's funeral** · preseason · F1
The driver you grew up watching has died. You are asked to speak. A: Speak —
reputation and marketability, and a weekend you spend somewhere else entirely.
B: Decline — keep your preparation, and a small permanent regret.

**Fuel saving while catching the leader** · midseason · F1
The pit wall says lift and coast. He is four seconds up the road and fading.
A: Ignore it — possible win, real chance of not finishing, team furious.
B: Obey — points, and a race you think about for years.

**The reserve gets your car** · midseason · F1
You are ill on Saturday. A: Race anyway — fitness and form damage, the seat is
yours. B: Stand down — the reserve drives your car, and drives it well.

**Buying the junior team** · offseason · late career
Put your earnings into the team that gave you your first seat. A: Buy it — money
gone, a relationship and a legacy. B: Keep the money.

**They have already signed someone else** · offseason · F1
You know before they tell you. A: Force the conversation — leave on your terms.
B: Say nothing and out-drive him until they change their mind.


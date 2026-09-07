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

## Ideas

Add below. Anything with `[built]` in front of it is already in the game.

### <your first idea here>

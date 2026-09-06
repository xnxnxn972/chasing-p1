# CHASING P1 — MVP (v0.1)

> One career. One goal.

A browser-based, choice-driven Formula 1 career simulation. You start at 16 as an
unknown junior and try to climb F4 → F3 → F2 → Formula 1 → World Champion. You
never drive a race: you make decisions, the season is simulated, and the career
story that comes out the other side is the product.

A full career takes about five minutes.

## Running it

```bash
npm install
npm run dev
```

`npm run build` produces a `dist/` with a relative base, so it drops straight
onto GitHub Pages. `npm run typecheck` runs `tsc --noEmit`.

## The three screens

| Screen | File | What it is |
| --- | --- | --- |
| WHO ARE YOU? | `src/screens/SetupScreen.tsx` | Brand lockup, the four pillars, name, number, nationality, driving style, seed |
| CAREER | `src/screens/CareerScreen.tsx` | Driver card, the current decision, the growing career record |
| CAREER SUMMARY | `src/screens/SummaryScreen.tsx` | Title, verdict, totals, achievements, share card |

Everything else happens inside the CAREER screen: contract offers, decisions,
season results and championship tables are all cards in the same column.

## Architecture

Real-team **data** is isolated from game **logic**. No file in `src/game/`
branches on a team id — Ferrari is always Ferrari, but Ferrari's pace is part of
the simulation and changes every season.

```
src/data/     f1Teams · juniorTeams · nationalities · decisions · decisionsLate · achievements
src/game/     careerEngine · seasonSimulator · driverDevelopment · driverMarket
              contractEngine · teamDevelopment · decisionEngine · achievementEngine
              careerVerdict · random · types
src/screens/  SetupScreen · CareerScreen · SummaryScreen
src/components/ Brand · DriverCard · StepCard · CareerTable
```

### The season machine

`careerEngine` is a cursor-driven state machine. `step()` runs stages until one
produces something for the player to look at, then stops:

```
contract → preseason → midseason → race → offseason → advance → contract …
```

- **contract** — builds offers when the player is out of contract
- **preseason / midseason / offseason** — 0–3 decisions per season, drawn by `decisionEngine`
- **race** — simulates the full season, then applies development
- **advance** — ages everyone, evolves the teams, runs the AI driver market

The UI only ever sees `state.pending`, which is one of four card types:
`decision`, `offers`, `result`, `news`.

### Determinism

Everything comes from `gameSeed`. `GameState.rngState` is the serialisable
position in the stream, so each transition rehydrates an `Rng`, uses it, and
writes the position back. Same seed + same decisions = same career, which is
what a future daily-seed mode would be built on.

### Race simulation

Every race of every season is actually run — 24 races × 22 drivers is cheap, and
it is the only honest way to get wins, poles and DNFs out of a distribution
rather than out of a formula. The player never sees an individual race.

Per race: a qualifying score sets the grid, a race score (carrying grid position
forward) sets the result, and reliability plus consistency decide retirements.
Roughly one weekend in six is chaotic, which is where the upsets live. Formula 1
weights the car at 55% and the driver at 32%; the junior formulae invert that,
because junior machinery is nearly identical and the driver is the story.

### Teams evolve

`teamDevelopment` moves every car's pace each season from its development
rating, random drift and mean reversion, with a regulation reset every four to
six years that hands out hidden ±14 swings. By 2040 the order is unrecognisable,
which is the point: there must never be an obvious correct team.

The player is never shown a car rating. `carEstimate` converts pace rank into a
fuzzy label (`CHAMPIONSHIP CONTENDER` … `BACK OF THE GRID`) with real scouting
error, so signing is a judgement call rather than spreadsheet optimisation.

### The driver market

Two numbers do the work, both on the same scale as driver OVR:

- `playerAppeal` — how attractive the signing is (ability plus results, reputation, youth, upside; heavily age-penalised past 34)
- `playerAbility` — what the team thinks he would actually do in the car, used when weighing him against a driver already in the seat

Each team has a hiring bar around 78 at the back of the grid and 89 at Ferrari.
When the player is out of contract the market weighs him against the drivers
actually available and will hold up to two seats open for him — which is what
makes a Formula 1 seat something to win rather than something to reach.

## Balance

Measured over 150 auto-played careers per cohort — run `npm run balance` (`tools/simtest.ts`):

| | reaches F1 | ≥1 title | ≥3 titles | avg F1 wins | avg seasons |
| --- | --- | --- | --- | --- | --- |
| Always takes the fastest car offered | 90% | 45% | 31% | 48 | 23 |
| Arbitrary choices | 82% | 27% | 17% | 22 | 21 |

The junior ladder is the main filter: promotion needs results (top 6 in F4, top 5
in F3), and three seasons without moving up ends the career. Hidden potential is
skewed (72–97, most drivers in the high seventies), so plenty of careers stall
before Formula 1.

## Look and feel

Premium motorsport minimalism, per the CHASING P1 brand sheet: near-black
ground, a single acid-lime accent (`--lime: #c8ff00`), wide-tracked uppercase
labels, hairline rules and italic condensed display type. `src/components/Brand.tsx`
holds the P1 monogram — drawn as SVG geometry rather than set as type, so it
renders identically before webfonts land — plus the lockup and the labelled rule
bars that frame every screen.

Colour is spent on exactly two things: the lime accent, and real F1 team
identity (an offer card's top edge, a constructors-table dot). Everything else
is greyscale.

## Content

- 11 real 2026 F1 teams, 22 seats, ~30 persistent AI drivers who develop, move, retire and win titles you were not part of
- 18 fictional junior teams across F4/F3/F2
- 31 decision events across contracts, politics, loyalty, money, status, risk, reputation, rivalry and retirement
- 24 achievements, 16 career titles, deterministic verdict templates, career score and share card

## Known gaps (deliberate, for v1.5+)

- Driver/team fit (`TeamCarProfile` exists in the data but is not read by the simulator yet)
- Rivalry detection — `SimDriver.clashes` is tracked, nothing declares "A RIVALRY IS BORN"
- No save/resume; a career lives in React state only
- Junior teams are fictional; a "start in 2026 with the real grid" mode is not built
- Career score percentiles are hand-set tiers, not a real distribution

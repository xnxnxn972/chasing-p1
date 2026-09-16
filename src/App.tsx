import { useEffect, useState } from 'react';
import type { GameState } from './game/types';
import type { CareerSetup } from './game/careerEngine';
import { createCareer } from './game/careerEngine';
import { SetupScreen } from './screens/SetupScreen';
import { CareerScreen } from './screens/CareerScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { initTelemetry, trackCareerEnd, trackCareerStart, trackExtra, trackProgress } from './game/telemetry';
import { computeTotals, careerScore, careerTitle } from './game/careerVerdict';
import { ambitionOutcome, nextAmbition } from './game/unfinishedBusiness';
import { incomingChallenge } from './game/challenge';
import { countVisit, player, storageWorks, updatePlayer } from './game/playerStore';
import { streakAfter, today } from './game/streak';

export function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [setup, setSetup] = useState<CareerSetup | null>(null);
  // The thing the last career failed to do, carried into the next one. It now
  // survives the tab closing: an ambition that evaporates when somebody shuts
  // their laptop is a hook for the player who was never going to leave anyway,
  // which is the opposite of what it was built for.
  const [ambitionId, setAmbitionId] = useState<string | undefined>(() => player().ambitionId);
  // Read once, from the URL this visit landed on. It survives "play again"
  // within the visit, so a challenged player keeps the target until they beat it.
  const [challengeScore] = useState<number | undefined>(() => incomingChallenge() ?? undefined);
  // The best score this browser has ever managed, which is what makes a career
  // a personal best and decides whether the share prompt is worth showing.
  // All-time rather than per-visit, so returning to beat your own score works.
  const [bestScore, setBestScore] = useState(() => player().bestScore);
  // How many careers this browser has played, so "your best yet" is only ever
  // said when there is a previous career to be better than.
  const [careerNumber, setCareerNumber] = useState(() => player().careers);

  useEffect(() => {
    const stop = initTelemetry();
    const p = countVisit();
    // The log can now tell a returning player from a new one, which is the
    // whole point of the store. `storage` records the cases where it cannot —
    // private windows and blocked site data — so those are not silently
    // counted as first-ever visits and left to drag the return rate down.
    trackExtra('player_id', p.id);
    trackExtra('player_visits', p.visits);
    trackExtra('player_careers', p.careers);
    trackExtra('first_seen', p.firstSeen);
    trackExtra('storage', storageWorks());
    return stop;
  }, []);

  // Log the finished career once, when it finishes.
  const finished = state?.finished ?? false;
  useEffect(() => {
    if (!state || !finished) return;
    const totals = computeTotals(state);
    const outcome = ambitionOutcome(state, totals);
    trackCareerEnd({
      seasons: state.history.length,
      reachedF1: totals.f1Starts > 0,
      titles: totals.titles,
      careerTitle: careerTitle(state, totals),
      score: careerScore(state, totals)
    });
    // Whether the carried ambition was actually delivered is the one number
    // that says if this feature works at all.
    if (outcome) trackExtra('ambition', outcome.ambition.id + (outcome.met ? ' ✓' : ' ✗'));
    const carried = nextAmbition(state, totals)?.id;
    setAmbitionId(carried);
    updatePlayer({ ambitionId: carried });
    // Only when the career transitions to finished.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (!state || !setup) {
    return (
      <SetupScreen
        ambitionId={ambitionId}
        challengeScore={challengeScore}
        onStart={(next) => {
          trackCareerStart(next);
          setSetup(next);
          setCareerNumber((n) => n + 1);
          // A racing day is counted when a career is STARTED. Finishing is
          // not required: somebody who turned up and played counts as having
          // turned up, and a streak that only rewards completion would punish
          // the player who came back for ten minutes.
          const p = player();
          const day = today();
          const next_ = updatePlayer({
            careers: p.careers + 1,
            lastPlayed: day,
            streak: streakAfter(p.lastPlayed, p.streak, day),
            // Remembered so tomorrow's form opens on this driver rather than
            // empty. Written on START rather than on finish: somebody who
            // abandons a career still chose that name.
            lastName: next.name,
            lastNumber: next.number,
            lastNationality: next.nationality,
            lastStyle: next.style
          });
          // Logged here rather than on mount: the streak only advances when a
          // career actually starts, so reading it at page load would record
          // yesterday's number against today's career.
          trackExtra('player_streak', next_.streak);
          setState(createCareer({ ...next, challengeScore }));
        }}
      />
    );
  }

  const restart = () => {
    // Fold the finished career into the running best HERE rather than when it
    // finished: the summary screen is still comparing against the previous best
    // to decide whether this was a personal best, and updating it any earlier
    // makes that comparison false the instant it is rendered.
    if (state) {
      const score = careerScore(state, computeTotals(state));
      setBestScore((b) => Math.max(b, score));
      updatePlayer({ bestScore: Math.max(player().bestScore, score) });
    }
    setState(null);
    setSetup(null);
  };

  if (state.finished) {
    return <SummaryScreen state={state} onRestart={restart} previousBest={bestScore} careerIndex={careerNumber} />;
  }

  return (
    <CareerScreen
      state={state}
      onState={(next) => {
        trackProgress({
          seasons: next.history.length,
          series: next.reserveTeamId ? 'F1 reserve' : next.player.series,
          age: next.player.age,
          decisions: next.firedEvents.length,
          reachedF1: next.history.some((h) => h.series === 'F1' && !h.reserveYear)
        });
        setState(next);
      }}
      onRestart={restart}
    />
  );
}

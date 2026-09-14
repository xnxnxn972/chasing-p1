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

export function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [setup, setSetup] = useState<CareerSetup | null>(null);
  // The thing the last career failed to do, carried into the next one. Held in
  // memory rather than storage on purpose: it is a hook for the player who is
  // still here, not a commitment we ask them to honour a week later.
  const [ambitionId, setAmbitionId] = useState<string | undefined>(undefined);
  // Read once, from the URL this visit landed on. It survives "play again"
  // within the visit, so a challenged player keeps the target until they beat it.
  const [challengeScore] = useState<number | undefined>(() => incomingChallenge() ?? undefined);
  // The best score this visit has managed, which is what makes a career a
  // personal best and decides whether the share prompt is worth showing.
  const [bestScore, setBestScore] = useState(0);
  // Which career of this visit is being played, so "your best yet" is only
  // ever said when there is a previous career to be better than.
  const [careerNumber, setCareerNumber] = useState(0);

  useEffect(() => initTelemetry(), []);

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
    setAmbitionId(nextAmbition(state, totals)?.id);
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
    if (state) setBestScore((b) => Math.max(b, careerScore(state, computeTotals(state))));
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

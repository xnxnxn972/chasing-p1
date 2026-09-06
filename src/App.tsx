import { useEffect, useState } from 'react';
import type { GameState } from './game/types';
import type { CareerSetup } from './game/careerEngine';
import { createCareer } from './game/careerEngine';
import { SetupScreen } from './screens/SetupScreen';
import { CareerScreen } from './screens/CareerScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { initTelemetry, trackCareerEnd, trackCareerStart, trackProgress } from './game/telemetry';
import { computeTotals, careerScore, careerTitle } from './game/careerVerdict';

export function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [setup, setSetup] = useState<CareerSetup | null>(null);

  useEffect(() => initTelemetry(), []);

  // Log the finished career once, when it finishes.
  const finished = state?.finished ?? false;
  useEffect(() => {
    if (!state || !finished) return;
    const totals = computeTotals(state);
    trackCareerEnd({
      seasons: state.history.length,
      reachedF1: totals.f1Starts > 0,
      titles: totals.titles,
      careerTitle: careerTitle(state, totals),
      score: careerScore(state, totals)
    });
    // Only when the career transitions to finished.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (!state || !setup) {
    return (
      <SetupScreen
        onStart={(next) => {
          trackCareerStart(next);
          setSetup(next);
          setState(createCareer(next));
        }}
      />
    );
  }

  const restart = () => {
    setState(null);
    setSetup(null);
  };

  if (state.finished) {
    return <SummaryScreen state={state} onRestart={restart} />;
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

import { useState } from 'react';
import type { GameState } from './game/types';
import type { CareerSetup } from './game/careerEngine';
import { createCareer } from './game/careerEngine';
import { SetupScreen } from './screens/SetupScreen';
import { CareerScreen } from './screens/CareerScreen';
import { SummaryScreen } from './screens/SummaryScreen';

export function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [setup, setSetup] = useState<CareerSetup | null>(null);

  if (!state || !setup) {
    return (
      <SetupScreen
        onStart={(next) => {
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

  return <CareerScreen state={state} onState={setState} onRestart={restart} />;
}

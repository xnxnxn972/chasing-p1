/**
 * Standalone entry for Brake Point. Same shape as Lights Out: its own Vite
 * entry so it is a crawlable URL with its own title, and so the career bundle
 * is not downloaded by somebody who only wants to brake for one corner.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrakePoint } from '../../src/minigames/BrakePoint/BrakePoint';
import { initTelemetry } from '../../src/game/telemetry';
import '../../src/styles/global.css';
import '../lights-out/standalone.css';

function Page() {
  return (
    <div className="mg-page">
      <div className="mg-bar">
        <a href="/minigames/">&larr; Driver training</a>
        <span>Brake Point</span>
      </div>

      <h1 className="mg-h1">How Late Do You Dare?</h1>
      <p className="mg-lede">
        Three corners at racing speed. No target, no timing bar. Hold the brake as late
        as you dare, let go to turn in, and find out how much road you left unused.
      </p>

      <BrakePoint mode="standalone" />

      <div className="mg-notes">
        <h2>Where the braking point comes from</h2>
        <p>
          It is not a number someone picked. A car shedding speed at a given rate needs a
          given distance, and that is all the ideal point is: the run from entry speed
          down to the speed the corner can actually be taken at, at about 3.3g. Change
          the corner and the point moves on its own.
        </p>
        <p>
          Real braking is heavier than that at first touch. Brembo put the pedal loads in
          a modern Formula 1 car at roughly 100kg, and the initial bite nearer 4g or 5g
          than 3g, but no car holds its peak through a whole braking zone: as speed falls
          so does downforce, and with it the grip that was making the peak possible.
        </p>
        <h2>Why late is so expensive</h2>
        <p>
          Braking early is safe and slow, and it costs you about a point a metre. Braking
          late costs about nineteen. Three metres of greed turns a 99 into a 41, which is
          roughly what a locked front and a wide exit are worth in the real thing.
        </p>
      </div>

      <div className="mg-cta">
        <h2>The rest of the career is decisions</h2>
        <p>
          Nerve gets you through a corner. It does not get you a seat. In{' '}
          <strong>Chasing P1</strong> you start at sixteen and find out how far your
          choices take you.
        </p>
        <a className="mg-btn" href="/">
          Play Chasing P1 &rarr;
        </a>
      </div>

      <div className="mg-more">
        <h3>More training</h3>
        <p>
          <a href="/minigames/lights-out/">Lights Out: the F1 reaction time test</a>
        </p>
        <p>
          <a href="/chances-of-becoming-an-f1-driver/">
            Chances of becoming an F1 driver: the honest numbers
          </a>
        </p>
      </div>

      <footer className="mg-footer">
        <a href="/">Chasing P1</a>, a decision-driven Formula 1 career simulation.
      </footer>
    </div>
  );
}

initTelemetry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Page />
  </StrictMode>
);

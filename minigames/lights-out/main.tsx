/**
 * Standalone entry for Lights Out.
 *
 * A separate Vite entry rather than a route inside the app, for the same
 * reason the articles are static pages: this is meant to be FOUND. Somebody
 * searching "F1 reaction time test" needs a real crawlable URL with its own
 * title and description, which a hash route or an SPA fallback does not give.
 * It also means the career bundle is not downloaded by someone who only wants
 * to tap a light.
 *
 * The game component is imported directly from src/, so this page and the
 * career event run exactly the same code.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LightsOut } from '../../src/minigames/LightsOut/LightsOut';
import { initTelemetry } from '../../src/game/telemetry';
import '../../src/styles/global.css';
import './standalone.css';

function Page() {
  return (
    <div className="mg-page">
      <div className="mg-bar">
        <a href="/">&larr; Chasing P1</a>
        <span>Driver training</span>
      </div>

      <h1 className="mg-h1">Reaction Time Test</h1>
      <p className="mg-lede">
        Hold the clutch. Five red lights come on, one per second. They hold. Then they go
        out, and the clock starts. Let go the instant they do.
      </p>

      <LightsOut mode="standalone" />

      <div className="mg-notes">
        <h2>What counts as fast?</h2>
        <p>
          A Formula 1 start is usually around <strong>0.2 seconds</strong>. Anything under
          0.15s off a genuine reaction is exceptional. Under 0.1s the FIA treats it as a
          jump start, on the grounds that nobody reacts that quickly, so this test does
          the same.
        </p>
        <h2>Why you hold instead of tap</h2>
        <p>
          A driver on the grid is already in first gear with the engine at pre-start revs,
          holding the clutch paddle in. Lights out is not a signal to press something. It
          is a signal to <strong>let go</strong>, dropping the clutch to its bite point
          while feeding in the throttle. So this test measures a release, not a tap, and
          letting go while the lights are still on is a jump start exactly as it would be
          on a real grid.
        </p>
        <p>
          The real thing is harder than this. A start is clutch bite point, wheelspin and
          where you are looking, all at once. The lights are only the part everyone can
          practise.
        </p>
      </div>

      <div className="mg-cta">
        <h2>The rest of the career is decisions</h2>
        <p>
          Reaction time gets you off the line. It does not get you a seat. In{' '}
          <strong>Chasing P1</strong> you start at sixteen and find out how far your
          choices take you: which team to sign for, when to move, when to take the blame.
        </p>
        <a className="mg-btn" href="/">
          Play Chasing P1 &rarr;
        </a>
      </div>

      <div className="mg-more">
        <h3>Read next</h3>
        <p>
          <a href="/chances-of-becoming-an-f1-driver/">
            Chances of becoming an F1 driver: the honest numbers
          </a>
        </p>
        <p>
          <a href="/how-to-become-an-f1-driver/">
            How to become an F1 driver: the real road from karting to Formula 1
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

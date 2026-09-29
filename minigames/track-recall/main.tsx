/**
 * Standalone entry for Track Recall. Its own Vite entry, like the other
 * minigames, so it is a crawlable URL with its own title and does not pull in
 * the career bundle.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TrackRecall } from '../../src/minigames/TrackRecall/TrackRecall';
import { initTelemetry } from '../../src/game/telemetry';
import '../../src/styles/global.css';
import '../lights-out/standalone.css';

function Page() {
  return (
    <div className="mg-page">
      <div className="mg-bar">
        <a href="/minigames/">&larr; Driver training</a>
        <span>Track Recall</span>
      </div>

      <h1 className="mg-h1">Draw It From Memory</h1>
      <p className="mg-lede">
        Five seconds to study the circuit. One lap traced from the start line, the way
        it is raced. Then ten seconds to draw it yourself.
      </p>

      <TrackRecall mode="standalone" />

      <div className="mg-notes">
        <h2>Why the lap is animated</h2>
        <p>
          A circuit is not just a shape. It has a start line and a direction, and a
          driver carries both. Watching the lap traced turns this from a drawing test
          into a memory test of the route, which is why <strong>Interlagos</strong> is
          in the pool: it is the only one of these six run anti-clockwise.
        </p>
        <h2>How it is scored</h2>
        <p>
          Generously, and on shape alone. Before comparing, both loops are stripped of
          where you drew, how big, which direction round, where you started and how fast
          your hand moved. A few degrees of tilt is forgiven; ninety is not, because you
          were shown which way up it goes.
        </p>
        <p>
          A wobbly but recognisable Suzuka scores well. A different circuit scores about
          thirty, and a circle about twenty.
        </p>
      </div>

      <div className="mg-cta">
        <h2>The rest of the career is decisions</h2>
        <p>
          Knowing the track is the easy part. In <strong>Chasing P1</strong> you start at
          sixteen and find out how far your choices take you.
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

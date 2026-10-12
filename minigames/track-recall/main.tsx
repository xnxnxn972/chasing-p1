/**
 * Standalone entry for Track Recall.
 *
 * MOUNTS THE GAME AND NOTHING ELSE. The page around it - heading, lede,
 * notes, call to action, footer - is static HTML in index.html, because a
 * page whose every word is rendered by React depends on Google's second-wave
 * JS render to be indexed at all. Track Recall sat un-indexed for twelve days
 * while the static articles took search traffic the whole time.
 *
 * The game component is imported from src/, so this page and the career event
 * run exactly the same code.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TrackRecall } from '../../src/minigames/TrackRecall/TrackRecall';
import { initTelemetry } from '../../src/game/telemetry';
import '../../src/styles/global.css';
import '../lights-out/standalone.css';

initTelemetry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TrackRecall mode="standalone" />
  </StrictMode>
);

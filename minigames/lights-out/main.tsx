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
 * MOUNTS THE GAME AND NOTHING ELSE. Everything around it is static HTML in
 * index.html - see the note there. A crawlable URL is worth little if the
 * page it serves is an empty div.
 *
 * The game component is imported from src/, so this page and the career event
 * run exactly the same code.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LightsOut } from '../../src/minigames/LightsOut/LightsOut';
import { initTelemetry } from '../../src/game/telemetry';
import '../../src/styles/global.css';
import './standalone.css';

initTelemetry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LightsOut mode="standalone" />
  </StrictMode>
);

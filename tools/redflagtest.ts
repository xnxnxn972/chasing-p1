/**
 * Do red flags actually reach players, and do the threads ever close?
 *
 * The two numbers that decide whether the feature exists in practice:
 * careers that saw at least one, and careers whose second one came back for
 * the first. A mechanic scheduled twice a career is worth nothing if half of
 * careers end before the second slot or leave nothing in play to draw from.
 */
import { createCareer, chooseDecisionOption, chooseOffer, continueStep } from '../src/game/careerEngine';
import type { GameState } from '../src/game/types';

const styles = ['speed', 'technical', 'physical'] as const;

function autoplay(seed: string, style: (typeof styles)[number], bias: number): GameState {
  let s = createCareer({ name: 'Test Driver', number: 27, nationality: 'IL', style, seed });
  let guard = 0;
  while (!s.finished && guard++ < 400) {
    const p = s.pending;
    if (!p) { s = continueStep(s); continue; }
    if (p.kind === 'decision') s = chooseDecisionOption(s, p.options[bias % p.options.length].id);
    else if (p.kind === 'redflag') s = chooseDecisionOption(s, p.decision.options[bias % p.decision.options.length].id);
    else if (p.kind === 'offers') s = chooseOffer(s, p.offers[0].id);
    else s = continueStep(s);
  }
  if (guard >= 400) throw new Error('career did not terminate for seed ' + seed);
  return s;
}

const N = 300;
let any = 0, two = 0, threads = 0, withLine = 0, seasonsTotal = 0, firstSeasonSum = 0, firstSeasonN = 0;
const seen: Record<string, number> = {};
const died: number[] = [];

for (let i = 0; i < N; i++) {
  const s = autoplay('RF' + i, styles[i % 3], i);
  const log = s.redFlagLog ?? [];
  seasonsTotal += s.history.length;
  if (log.length > 0) any++;
  if (log.length > 1) two++;
  if (log.some((r) => r.collects !== undefined)) threads++;
  if (log.some((r) => r.aftermath)) withLine++;
  for (const r of log) seen[r.title] = (seen[r.title] ?? 0) + 1;
  if (log.length === 0) died.push(s.history.length);
  if (log[0]) { firstSeasonSum += log[0].year - 2026 + 1; firstSeasonN++; }
}

console.log(`careers simulated        ${N}`);
console.log(`mean seasons             ${(seasonsTotal / N).toFixed(1)}`);
console.log(`saw at least one         ${any} (${Math.round((100 * any) / N)}%)`);
console.log(`with a consequence line  ${withLine} (${Math.round((100 * withLine) / N)}%)`);
console.log(`mean season of the first ${(firstSeasonSum / Math.max(1, firstSeasonN)).toFixed(1)}`);
if (died.length) console.log(`careers with none        ${died.length}, mean length ${(died.reduce((a, b) => a + b, 0) / died.length).toFixed(1)} seasons`);
console.log('\nwhich situations landed');
for (const [k, v] of Object.entries(seen).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(4)}  ${k}`);
}

// Three real threads, exactly as the retirement screen would read them.
let shown = 0;
for (let i = 0; i < 400 && shown < 3; i++) {
  const log = autoplay('RF' + i, styles[i % 3], i).redFlagLog ?? [];
  const beat = log[log.length - 1];
  if (!beat || !beat.line) continue;
  shown++;
  console.log(`
--- thread ${shown}, as the screen would draw it ---`);
  console.log(`${beat.year}  ${beat.title.toUpperCase()}`);
  console.log(`      ${beat.line}`);
  if (beat.aftermath) console.log(`   >> ${beat.aftermath}`);
  if (beat.fork) console.log(`   .. ${beat.fork}`);
  console.log(`   [line=${!!beat.line} fork=${!!beat.fork} aftermath=${!!beat.aftermath}]`);
}

// Does every beat at least have a line and a fork? Without those the
// retirement panel renders a heading over nothing.
let beats = 0, missing = 0;
for (let i = 0; i < 300; i++) {
  const log = autoplay('RF' + i, styles[i % 3], i).redFlagLog ?? [];
  for (const b of log) {
    beats++;
    if (!b.line || !b.fork) missing++;
  }
}
console.log(`
beats ${beats} | missing a line or a fork ${missing}`);

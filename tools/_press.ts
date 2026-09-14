import { createCareer, chooseDecisionOption, chooseOffer, continueStep } from '../src/game/careerEngine';
import { JUNIOR_EVENTS } from '../src/data/decisionsJunior';
import { F1_EVENTS } from '../src/data/decisionsF1';
import { LATE_EVENTS } from '../src/data/decisionsLate';
import { RESERVE_EVENTS } from '../src/data/decisionsReserve';
import type { GameState } from '../src/game/types';

const POOLS = [
  ['Junior', JUNIOR_EVENTS], ['Formula 1', F1_EVENTS],
  ['Late career', LATE_EVENTS], ['Reserve', RESERVE_EVENTS]
] as const;
const stageOf = new Map<string, string>();
const phaseOf = new Map<string, string>();
for (const [name, arr] of POOLS) for (const e of arr) { stageOf.set(e.id, name); phaseOf.set(e.id, e.phase); }

function play(seed: string, style: any, mode: number): string[] {
  let s: GameState = createCareer({ name: 'T', number: 27, nationality: 'IL', style, seed });
  let g = 0;
  while (!s.finished && g++ < 400) {
    const p: any = s.pending;
    if (!p) { s = continueStep(s); continue; }
    if (p.kind === 'decision') s = chooseDecisionOption(s, p.options[g % p.options.length].id);
    else if (p.kind === 'offers') {
      const i = mode === 0 ? 0 : p.offers.findIndex((o: any) => !o.isReserve);
      s = chooseOffer(s, p.offers[i === -1 ? 0 : i].id);
    } else s = continueStep(s);
  }
  return s.firedEvents.filter((e) => !e.startsWith('flag_'));
}

const N = 1500;
const styles = ['speed', 'technical', 'physical'];
const draws: Record<string, number> = {};        // total times drawn
const seenIn: Record<string, number> = {};       // careers that saw it at least once
const repeatIn: Record<string, number> = {};     // careers that saw it MORE than once
const bucketDraws: Record<string, number> = {};
for (let i = 0; i < N; i++) {
  const cards = play('Z' + i, styles[i % 3], i % 2);
  const counts: Record<string, number> = {};
  for (const c of cards) {
    counts[c] = (counts[c] || 0) + 1;
    draws[c] = (draws[c] || 0) + 1;
    const key = (stageOf.get(c) || '?') + ' / ' + (phaseOf.get(c) || '?');
    bucketDraws[key] = (bucketDraws[key] || 0) + 1;
  }
  for (const [c, n] of Object.entries(counts)) {
    seenIn[c] = (seenIn[c] || 0) + 1;
    if (n > 1) repeatIn[c] = (repeatIn[c] || 0) + 1;
  }
}

console.log('MOST-SEEN CARDS (share of careers that meet it at least once)');
Object.entries(seenIn).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([c, n]) =>
  console.log('  ' + c.padEnd(26) + (n / N * 100).toFixed(1).padStart(6) + '%   repeats within a career ' +
    ((repeatIn[c] || 0) / N * 100).toFixed(1) + '%'));

console.log('');
console.log('MOST-REPEATED CARDS (seen twice or more in the SAME career)');
Object.entries(repeatIn).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([c, n]) =>
  console.log('  ' + c.padEnd(26) + (n / N * 100).toFixed(1).padStart(6) + '% of careers'));

console.log('');
console.log('PRESSURE BY POOL — draws per career against pool size');
console.log('  pool                    cards   draws/career   draws per card');
const sizes: Record<string, number> = {};
for (const [name, arr] of POOLS) for (const e of arr) {
  const k = name + ' / ' + e.phase;
  sizes[k] = (sizes[k] || 0) + 1;
}
Object.entries(sizes)
  .map(([k, size]) => [k, size, (bucketDraws[k] || 0) / N] as const)
  .sort((a, b) => b[2] / b[1] - a[2] / a[1])
  .forEach(([k, size, dpc]) =>
    console.log('  ' + k.padEnd(24) + String(size).padStart(5) + dpc.toFixed(2).padStart(15) +
      (dpc / size).toFixed(3).padStart(17)));

/**
 * Headless balance harness. Auto-plays whole careers and reports how often a
 * career reaches Formula 1, wins titles and so on — the numbers in README.md.
 *
 *   npx esbuild tools/simtest.ts --bundle --platform=node --format=esm  *     --outfile=.tmp/simtest.mjs && node .tmp/simtest.mjs
 */
import { createCareer, chooseDecisionOption, chooseOffer, continueStep } from '../src/game/careerEngine';
import { computeTotals, careerScore, careerTitle, careerVerdict } from '../src/game/careerVerdict';
import type { ContractOffer, GameState } from '../src/game/types';

type Picker = { decision: (n: number, i: number) => number; offer: (o: ContractOffer[], i: number) => number };

const greedy: Picker = {
  decision: (n, i) => (i * 7) % n,
  // A motivated player takes the fastest car, breaking ties on money.
  offer: (offers) => {
    let best = 0;
    for (let k = 1; k < offers.length; k++) {
      const a = offers[k], b = offers[best];
      const aScore = (a.isReserve ? -10 : 0) + a.carStars * 10 + a.salary * 0.1;
      const bScore = (b.isReserve ? -10 : 0) + b.carStars * 10 + b.salary * 0.1;
      if (aScore > bScore) best = k;
    }
    return best;
  }
};
const arbitrary: Picker = {
  decision: (n, i) => (i * 3 + 1) % n,
  offer: (o, i) => (i * 5) % o.length
};

let lastClicks = 0;

function autoplay(seed: string, style: any, pick: Picker, i: number): GameState {
  let s = createCareer({ name: 'Test Driver', number: 27, nationality: 'IL', style, seed });
  let guard = 0;
  while (!s.finished && guard++ < 400) {
    const p = s.pending;
    if (!p) { s = continueStep(s); continue; }
    if (p.kind === 'decision') s = chooseDecisionOption(s, p.options[pick.decision(p.options.length, i)].id);
    else if (p.kind === 'offers') s = chooseOffer(s, p.offers[pick.offer(p.offers, i)].id);
    else s = continueStep(s);
  }
  if (guard >= 400) throw new Error('career did not terminate for seed ' + seed);
  lastClicks = guard;
  return s;
}

const styles = ['speed', 'technical', 'physical'];
function cohort(label: string, pick: Picker, N = 150) {
  let reachedF1 = 0, champs = 0, multi = 0, totalScore = 0, wins = 0, seasons = 0, clicks = 0, decisions = 0, peakAges = 0;
  const titleCounts: Record<string, number> = {};
  for (let i = 0; i < N; i++) {
    const s = autoplay('SEED' + i, styles[i % 3], pick, i);
    const t = computeTotals(s);
    if (t.f1Starts > 0) reachedF1++;
    if (t.titles > 0) champs++;
    if (t.titles > 2) multi++;
    wins += t.f1Wins;
    seasons += s.history.length;
    clicks += lastClicks;
    decisions += s.firedEvents.length;
    // Age at which the driver hit their highest rating.
    let best = 0, bestAge = 0;
    for (const h of s.history) if (h.driverOverallEnd > best) { best = h.driverOverallEnd; bestAge = h.age; }
    peakAges += bestAge;
    totalScore += careerScore(s, t);
    const title = careerTitle(s, t);
    titleCounts[title] = (titleCounts[title] || 0) + 1;
  }
  console.log(`\n== ${label} (n=${N}) ==`);
  console.log(` reached F1 ${Math.round(reachedF1/N*100)}% | >=1 title ${Math.round(champs/N*100)}% | >=3 titles ${Math.round(multi/N*100)}%`);
  console.log(` avg F1 wins ${(wins/N).toFixed(1)} | avg seasons ${(seasons/N).toFixed(1)} | avg score ${Math.round(totalScore/N)}`);
  console.log(` avg clicks/career ${(clicks/N).toFixed(0)} | decisions/season ${(decisions/seasons).toFixed(2)} | avg peak age ${(peakAges/N).toFixed(1)}`);
  console.log(' ', Object.entries(titleCounts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${v}`).join(' · '));
}

cohort('greedy (always takes the fastest car offered)', greedy);
cohort('arbitrary choices', arbitrary);

const a = autoplay('FIXEDSEED', 'technical', greedy, 3);
const b = autoplay('FIXEDSEED', 'technical', greedy, 3);
console.log('\ndeterministic:', JSON.stringify(a.history) === JSON.stringify(b.history));

const sample = autoplay('SHOWCASE7', 'speed', greedy, 1);
const st = computeTotals(sample);
console.log('\n--- sample career ---');
for (const h of sample.history) {
  console.log(
    String(h.year), 'age', String(h.age).padStart(2), h.series.padEnd(3), h.teamName.padEnd(18),
    'OVR', String(h.driverOverallEnd).padStart(2), 'W', String(h.wins).padStart(2),
    'P', String(h.podiums).padStart(2), 'pts', String(h.points).padStart(3),
    h.reserveYear ? 'RESERVE' : 'P' + h.championshipPosition);
}
console.log(careerTitle(sample, st), '|', careerScore(sample, st));
console.log(careerVerdict(sample, st));

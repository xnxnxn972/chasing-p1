/**
 * Chasing P1 — the page-load funnel.
 *
 *   npm run loads
 *
 * cp_sessions answers "what did players do". This answers the question that
 * comes before it: how many people arrived at all, how many touched anything,
 * and how many started a career. The dashboard cannot show this, because it
 * reads cp_sessions, and cp_sessions deliberately writes nothing until a
 * visitor interacts — which is exactly why cp_loads exists.
 *
 * THREE FILTERS, each of which has already caused a wrong number once:
 *
 *  1. `page` — article reads live in the same table. Their visit_id never
 *     reaches cp_sessions, so counted as game loads every one of them looks
 *     like a bounce. The game funnel is page = '/' and nothing else.
 *
 *  2. `dev` — our own testing. Twenty-nine of the first sixty-three rows were
 *     ours, which took the measured bounce rate from 38% to 59% until they
 *     were marked. The ?dev=1 opt-out stops new ones; this excludes the old.
 *
 *  3. `webdriver` — self-identifying automation.
 *
 * Paginated by timestamp rather than offset. A silent row cap has produced a
 * wrong answer in this project three times; do not replace this with a single
 * unbounded request.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SUPABASE_URL = 'https://hmvxanqkorcfxwsdusuj.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtdnhhbnFrb3JjZnh3c2R1c3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjI4OTgsImV4cCI6MjA5NTI5ODg5OH0.7o7OnhikQdgApqPTEIbhjOZ-YcKDU1fBFpcLXPXtEtA';
const PAGE = 1000;

const TOKEN_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '.cp1-token');

function readToken() {
  const fromEnv = process.env.CP1_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  try {
    const fromFile = readFileSync(TOKEN_FILE, 'utf8')
      .replace(/^﻿/, '')
      .trim()
      .replace(/^[<"']+|[>"']+$/g, '');
    if (fromFile) return fromFile;
  } catch {
    /* fall through to the message below */
  }
  return null;
}

const token = readToken();
if (!token) {
  console.error('No admin token.');
  console.error('  Get it:   select token from public.cp_admin where id = 1;');
  console.error('  Save it:  write it to .cp1-token in the repo root (gitignored)');
  process.exit(1);
}

async function fetchAll(rpc, extra = {}) {
  const rows = [];
  let before = null;
  for (;;) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${rpc}?limit=${PAGE}`, {
      method: 'POST',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_token: token, p_limit: PAGE, p_before: before, ...extra })
    });
    if (!res.ok) throw new Error(`${rpc}: ${res.status} ${await res.text()}`);
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    rows.push(...page);
    before = page[page.length - 1].created_at;
    if (page.length < PAGE) break;
  }
  return rows;
}

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—');
const rule = (s) => console.log(`\n${s}\n${'-'.repeat(s.length)}`);

const loads = await fetchAll('cp_loads_admin');
const sessions = await fetchAll('cp_sessions_admin');
console.log(`fetched ${loads.length} loads, ${sessions.length} careers`);

// Real human traffic to the GAME. See the three filters in the header comment.
const real = loads.filter((l) => !l.dev && !l.webdriver);
const game = real.filter((l) => l.page === '/');
const articles = real.filter((l) => l.page !== '/');

rule('GAME FUNNEL  (page = "/", excluding our own testing and bots)');
const engaged = game.filter((l) => l.engaged);
const started = game.filter((l) => l.started);
console.log(`  arrived            ${game.length}`);
console.log(`  touched something  ${engaged.length}  ${pct(engaged.length, game.length)}`);
console.log(`  started a career   ${started.length}  ${pct(started.length, game.length)}`);
console.log(`  bounced            ${game.length - engaged.length}  ${pct(game.length - engaged.length, game.length)}`);

rule('BY DEVICE');
for (const d of ['mobile', 'desktop', 'tablet']) {
  const g = game.filter((l) => l.device === d);
  if (!g.length) continue;
  const s = g.filter((l) => l.started).length;
  const b = g.filter((l) => !l.engaged).length;
  console.log(`  ${d.padEnd(8)} ${String(g.length).padStart(4)} loads   started ${pct(s, g.length).padStart(6)}   bounced ${pct(b, g.length).padStart(6)}`);
}

rule('ARTICLE READS  (page <> "/")');
if (!articles.length) {
  console.log('  none yet');
} else {
  const byPage = new Map();
  for (const a of articles) byPage.set(a.page, [...(byPage.get(a.page) ?? []), a]);
  for (const [page, rows] of [...byPage].sort((x, y) => y[1].length - x[1].length)) {
    const src = new Map();
    for (const r of rows) src.set(r.source, (src.get(r.source) ?? 0) + 1);
    const top = [...src].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join(' ');
    console.log(`  ${String(rows.length).padStart(4)}  ${page}`);
    console.log(`        ${new Set(rows.map((r) => r.country)).size} countries · ${top}`);
  }
}

// A reader who clicks through starts a NEW visit, so the two cannot be joined.
// The conversion signal is the referrer on the game side.
rule('READ TO PLAY  (careers whose referrer was one of our own articles)');
const fromArticle = sessions.filter(
  (s) => s.referrer && /^https:\/\/playchasingp1\.com\/.+-/.test(s.referrer)
);
if (!fromArticle.length) {
  console.log('  none yet');
} else {
  const byRef = new Map();
  for (const s of fromArticle) byRef.set(s.referrer, (byRef.get(s.referrer) ?? 0) + 1);
  for (const [ref, n] of [...byRef].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${ref}`);
  }
}

rule('EXCLUDED');
console.log(`  our own testing (dev)   ${loads.filter((l) => l.dev).length}`);
console.log(`  self-identifying bots   ${loads.filter((l) => l.webdriver).length}`);

/**
 * Chasing P1 — build the analytics dashboard.
 *
 *   CP1_TOKEN=<admin token> node tools/dashboard.mjs
 *
 * Fetches the whole session log, aggregates it, and writes a self-contained
 * HTML file with the numbers baked in. Re-run it whenever you want the
 * dashboard refreshed, then republish the same file to the same Artifact URL.
 *
 * WHY THE NUMBERS ARE BAKED IN RATHER THAN FETCHED BY THE PAGE: a published
 * Artifact runs under a CSP that blocks outbound fetch/XHR to everything except
 * a short CDN allowlist. Supabase is not on it, so a live-querying dashboard is
 * not possible there. Baking also keeps the admin token out of the published
 * HTML, which matters more — anyone who opened a live page would hold a key to
 * the whole log.
 *
 * The token is read from the environment and never written to disk.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SUPABASE_URL = 'https://hmvxanqkorcfxwsdusuj.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtdnhhbnFrb3JjZnh3c2R1c3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjI4OTgsImV4cCI6MjA5NTI5ODg5OH0.7o7OnhikQdgApqPTEIbhjOZ-YcKDU1fBFpcLXPXtEtA';

/** The Reddit post that started the traffic. Everything before it is our own testing. */
const POST_AT = Date.parse('2026-09-13T08:40:00Z');
const PAGE = 1000; // PostgREST caps a single response at 1000 rows.

const token = process.env.CP1_TOKEN;
if (!token) {
  console.error('Set CP1_TOKEN to the admin token (see supabase-admin-rpc.sql).');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchPage(offset) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/cp_sessions_admin?limit=${PAGE}&offset=${offset}`,
    {
      method: 'POST',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_token: token, p_limit: 2000 })
    }
  );
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchAll() {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await fetchPage(offset);
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

// ---------------------------------------------------------------------------
// The traffic-source classifier, mirrored from cp_traffic_source.
//
// Kept here as well as in SQL so the dashboard is correct even when the
// database still has an older version of the function. If the two ever
// disagree, SQL is the source of truth and this should be updated to match.
// ---------------------------------------------------------------------------

function sourceOf(row) {
  const ref = row.referrer;
  // An explicit tag already resolved server-side wins, except where the server
  // handed back a raw Android package -- that is the bug this re-derives past.
  if (row.source && !row.source.startsWith('com.') && !row.source.startsWith('app:')) {
    return row.source;
  }
  if (!ref) return 'direct / app';
  if (ref.startsWith('android-app://')) {
    if (/com\.reddit/.test(ref)) return 'reddit';
    if (/googlequicksearchbox|com\.google\.android\.gms/.test(ref)) return 'search';
    if (/com\.facebook/.test(ref)) return 'facebook';
    if (/com\.instagram/.test(ref)) return 'instagram';
    if (/com\.twitter|com\.x\.android/.test(ref)) return 'twitter/x';
    if (/com\.whatsapp/.test(ref)) return 'whatsapp';
    if (/org\.telegram/.test(ref)) return 'telegram';
    if (/com\.discord/.test(ref)) return 'discord';
    return 'app: ' + (ref.match(/android-app:\/\/([^/]+)/)?.[1] ?? '?');
  }
  return row.source || 'other';
}

/** Native app vs web, kept separate so folding them never loses the detail. */
function viaOf(row) {
  if (!row.referrer) return 'no referrer';
  return row.referrer.startsWith('android-app://') ? 'app' : 'web';
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

function rank(rows, key, { limit = 0 } = {}) {
  const by = new Map();
  for (const r of rows) {
    const k = key(r);
    if (k == null) continue;
    if (!by.has(k)) by.set(k, { key: k, careers: 0, visits: new Set(), finished: 0, act: [] });
    const e = by.get(k);
    e.careers++;
    e.visits.add(r.visit_id);
    if (r.finished) e.finished++;
    e.act.push(r.active_s || 0);
  }
  const out = [...by.values()]
    .map((e) => ({
      key: e.key,
      careers: e.careers,
      visits: e.visits.size,
      finished: e.finished,
      medianActive: median(e.act)
    }))
    .sort((a, b) => b.visits - a.visits || b.careers - a.careers);
  return limit ? out.slice(0, limit) : out;
}

/** Careers and FIRST-SEEN visits per time bucket, in chronological order. */
function series(rows, bucketOf) {
  const buckets = new Map();
  const seen = new Set();
  for (const r of [...rows].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))) {
    const b = bucketOf(r.created_at);
    if (!buckets.has(b))
      buckets.set(b, { t: b, careers: 0, visits: 0, newVisits: 0, finished: 0, act: [], seenHere: new Set() });
    const e = buckets.get(b);
    e.careers++;
    if (r.finished) e.finished++;
    e.act.push(r.active_s || 0);
    e.seenHere.add(r.visit_id);
    if (!seen.has(r.visit_id)) {
      seen.add(r.visit_id);
      e.newVisits++;
    }
  }
  return [...buckets.values()].map((e) => ({
    t: e.t,
    careers: e.careers,
    visits: e.seenHere.size,
    newVisits: e.newVisits,
    finished: e.finished,
    medianActive: median(e.act)
  }));
}

const hourKey = (iso) => iso.slice(0, 13) + ':00';
const dayKey = (iso) => iso.slice(0, 10);

/**
 * Careers played against a dev server. They are tagged env='dev' in the table,
 * but the admin reader does not return that column, so they are identified by
 * the only thing that does come back: a localhost referrer. Three such rows
 * (mine, from verifying a build) had already reached the published dashboard as
 * a traffic source called "localhost".
 */
function isDev(row) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(row.referrer || '');
}

function build(rows) {
  const post = rows.filter((r) => Date.parse(r.created_at) >= POST_AT && !isDev(r));
  for (const r of post) {
    r._source = sourceOf(r);
    r._via = viaOf(r);
  }

  const visits = new Set(post.map((r) => r.visit_id));
  const perVisit = new Map();
  for (const r of post) perVisit.set(r.visit_id, (perVisit.get(r.visit_id) || 0) + 1);
  const counts = [...perVisit.values()].sort((a, b) => b - a);

  const hours = series(post, hourKey);
  const now = Date.now();
  // The newest bucket is still filling; the page marks it rather than letting
  // a partial hour read as a collapse.
  const lastHourPartial = now - Date.parse(hours.at(-1).t + ':00Z') < 3600e3;
  const lastDayPartial = true;

  return {
    generatedAt: new Date().toISOString(),
    postAt: new Date(POST_AT).toISOString(),
    totals: {
      careers: post.length,
      visits: visits.size,
      finished: post.filter((r) => r.finished).length,
      reachedF1: post.filter((r) => r.last_series === 'F1').length,
      shared: post.filter((r) => r.shared).length,
      countries: new Set(post.map((r) => r.geo_country).filter(Boolean)).size,
      playSeconds: post.reduce((s, r) => s + (r.active_s || 0), 0),
      medianActive: median(post.map((r) => r.active_s || 0)),
      medianSeasons: median(post.filter((r) => r.finished).map((r) => r.seasons)),
      titlesWon: post.reduce((s, r) => s + (r.titles || 0), 0),
      repeatVisits: counts.filter((c) => c > 1).length,
      deepVisits: counts.filter((c) => c >= 5).length,
      maxCareers: counts[0] ?? 0,
      prePost: rows.filter((r) => Date.parse(r.created_at) < POST_AT).length,
      devExcluded: rows.filter((r) => Date.parse(r.created_at) >= POST_AT && isDev(r)).length
    },
    hours,
    days: series(post, dayKey),
    lastHourPartial,
    lastDayPartial,
    sources: rank(post, (r) => r._source),
    via: rank(post, (r) => r._via),
    countries: rank(post, (r) => r.geo_country || null, { limit: 14 }),
    // Uncapped, so the donut's "other" slice is every remaining country and
    // the ring sums to every visit that has a country at all.
    allCountries: rank(post, (r) => r.geo_country || null),
    countryCount: new Set(post.map((r) => r.geo_country).filter(Boolean)).size,
    devices: rank(post, (r) => `${r.device} / ${r.platform || '—'}`),
    verdicts: rank(post.filter((r) => r.finished), (r) => r.career_title || 'unnamed', { limit: 12 }),
    seasons: (() => {
      const by = new Map();
      for (const r of post.filter((x) => x.finished)) by.set(r.seasons, (by.get(r.seasons) || 0) + 1);
      return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([s, n]) => ({ seasons: s, careers: n }));
    })(),
    versions: rank(post, (r) => r.app_version || 'unknown'),
    topCareers: post
      .filter((r) => r.finished)
      .sort((a, b) => b.career_score - a.career_score)
      .slice(0, 8)
      .map((r) => ({
        player: r.player,
        title: r.career_title,
        score: r.career_score,
        titles: r.titles,
        seasons: r.seasons,
        country: r.geo_country
      }))
  };
}

// ---------------------------------------------------------------------------

const rows = await fetchAll();
const data = build(rows);
const here = dirname(fileURLToPath(import.meta.url));

// The template carries the whole page; only the numbers are substituted. Keeping
// them apart means a design change never risks the aggregation and vice versa.
const template = readFileSync(join(here, 'dashboard.template.html'), 'utf8');
const json = JSON.stringify(data)
  // The blob sits inside a <script> tag, so a literal </script> or an HTML
  // comment opener in any string would end it early.
  .replace(/<\//g, '<\/')
  .replace(/<!--/g, '<\u0021--');
const html = template.replace('__DATA__', () => json);

const htmlOut = join(here, '..', 'dashboard.html');
writeFileSync(htmlOut, html);
writeFileSync(join(here, '..', 'dashboard.data.json'), JSON.stringify(data, null, 2));
console.log(
  `fetched ${rows.length} rows (${data.totals.prePost} pre-post, ` +
    `${data.totals.devExcluded} dev) -> ${data.totals.careers} careers, ` +
    `${data.totals.visits} visits, ${data.hours.length} hourly buckets`
);
console.log(`wrote ${htmlOut}`);

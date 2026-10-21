/**
 * Chasing P1 — traffic that is not a person, shared by every report.
 *
 * This lives in its own file for one reason: `npm run dashboard` and
 * `npm run loads` read the same log and are quoted in the same breath. A rule
 * that exists twice drifts, and then the two reports disagree about how many
 * careers were played, which is worse than either number being wrong on its
 * own.
 *
 * WHAT THIS IS NOT: the `dev` flag (our own testing, suppressed at the client
 * by ?dev=1) and the `webdriver` flag (automation that identifies itself).
 * Those are already handled. This file is for automation that does neither.
 */

/**
 * Yandex arrived on 27 September 2026 and played 438 careers across 9 visits:
 * 185, 99, 62, 36, 18, 12, 11, 10, 5. The previous record for a real person
 * across the whole run was 67, and these ran at a 15-second median active time
 * with a 16% finish rate, against 132s and 76% for everyone else. In one day it
 * put 340 careers into a 502-career total.
 *
 * Matching on the referrer is blunt: a genuine Yandex searcher would be thrown
 * away with it. That is an acceptable trade only because Yandex sent exactly
 * zero visits in the sixteen days before this, so the expected loss is nil, and
 * because the count is reported rather than silently dropped. If real Yandex
 * traffic ever appears, this rule is the first thing to revisit.
 */
export function isBotReferrer(referrer) {
  const ref = referrer || '';
  return /(^|\/\/)([a-z0-9-]+\.)*yandex\.(ru|com)/i.test(ref);
}

/**
 * The durable half of the problem: the next scraper arrives with a different
 * referrer, or none at all.
 *
 * WHY VOLUME IS THE WRONG AXIS. This used to be a report-only threshold of 80
 * careers, justified by "the highest count ever recorded from traffic we
 * believe was real is 67". That premise was wrong. Listing every visit of 25+
 * careers against its median active time and finish rate shows two populations
 * that do not overlap:
 *
 *     185 careers    4s   15% finished   yandex
 *      95            9s    6%            no referrer
 *      73            8s   12%
 *      67            6s   18%   <- the "real" record the old comment cited
 *      43            8s   12%
 *     ---------------------------------------------- gap
 *      25           21s   44%
 *      45           25s   49%
 *      66           98s   85%
 *      61          105s  100%
 *      53          125s  100%
 *
 * Nobody opens ninety careers and spends nine seconds in each. The dropped set
 * tops out at 19s and 31%; the nearest kept visit is 21s and 44%. Requiring
 * BOTH conditions means a single borderline number cannot bin a real player.
 *
 * THE CAREER FLOOR IS A JUDGEMENT, NOT A BOUNDARY. The distribution is smooth
 * below 25 (floors of 10/15/20/25/30 drop 10.4/9.1/8.2/6.9/6.3% of careers),
 * so 25 is the conservative end of a continuum, chosen because nobody opens
 * twenty-five careers by accident while a handful of quick bounces is normal.
 * Anything under the floor stays in, and outlierVisits() still reports what
 * slips past.
 */
export const AUTO_MIN_CAREERS = 25;
export const AUTO_MAX_MEDIAN_ACTIVE = 20;
export const AUTO_MAX_FINISH_PCT = 35;

/** The rows of ONE visit. True when it behaves like a script, not a player. */
export function isAutomationVisit(visitRows) {
  const n = visitRows.length;
  if (n < AUTO_MIN_CAREERS) return false;
  const act = visitRows.map((r) => r.active_s || 0).sort((a, b) => a - b);
  const median = act[Math.floor(n / 2)];
  if (median > AUTO_MAX_MEDIAN_ACTIVE) return false;
  const finishPct = (100 * visitRows.filter((r) => r.finished).length) / n;
  return finishPct <= AUTO_MAX_FINISH_PCT;
}

/** Visit ids to drop, from every row in the window. Counted, never silent. */
export function automationVisitIds(rows) {
  const byVisit = new Map();
  for (const r of rows) {
    if (!byVisit.has(r.visit_id)) byVisit.set(r.visit_id, []);
    byVisit.get(r.visit_id).push(r);
  }
  const ids = new Set();
  for (const [id, vr] of byVisit) if (isAutomationVisit(vr)) ids.add(id);
  return ids;
}

/**
 * Still reported, for anything the rule above does not catch: a scraper that
 * paces itself, or a genuine marathon worth knowing about.
 */
export const OUTLIER_CAREERS = 80;

export function outlierVisits(rows, careersPerVisit) {
  const out = [];
  for (const [visitId, n] of careersPerVisit) {
    if (n < OUTLIER_CAREERS) continue;
    const sample = rows.find((r) => r.visit_id === visitId);
    out.push({ visitId, careers: n, referrer: sample?.referrer || '(none)', day: sample?.created_at?.slice(0, 10) });
  }
  return out.sort((a, b) => b.careers - a.careers);
}

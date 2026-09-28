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
 * The durable half of the problem. The referrer rule above fixes the instance
 * we found; it does nothing about the next scraper, which will arrive with a
 * different referrer or none at all. Rather than guess at a threshold and
 * silently discard careers, this only *reports* visits far outside human range
 * so the next one is noticed in the same week rather than after it has been
 * quoted in a decision.
 *
 * 80 is deliberately above the highest career count ever recorded from traffic
 * we believe was real (67, on 17 September), so a genuine marathon session is
 * flagged for a look rather than binned.
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

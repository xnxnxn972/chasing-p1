/**
 * One row per play session, written to the shared Supabase project.
 *
 * Design rules, in order of importance:
 *  1. It must never break or delay the game. Every call is fire-and-forget and
 *     wrapped so a failure — offline, blocked, table missing — is silent.
 *  2. One row per session, updated in place, so the table reads as a log.
 *  3. The final update goes out with `keepalive` on page hide, which is the
 *     only thing that reliably survives a mobile browser being backgrounded.
 *
 * NOTE ON PERSONAL DATA: it no longer records one. IP address, country and city
 * were removed after Google Safe Browsing blocked the site as a deceptive page
 * for harvesting personal information. What remains is what the player did in
 * the game, the device class, and where the link came from — none of which
 * identifies anybody.
 */

// Same project as Flag Collection / Treasure Traitors. The anon key is public
// by design and is already committed elsewhere in this repo.
const SUPABASE_URL = 'https://hmvxanqkorcfxwsdusuj.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtdnhhbnFrb3JjZnh3c2R1c3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjI4OTgsImV4cCI6MjA5NTI5ODg5OH0.7o7OnhikQdgApqPTEIbhjOZ-YcKDU1fBFpcLXPXtEtA';

// Writes go through a security-definer function, not the table. The table has
// no SELECT policy (visitors must not read the log), and an UPDATE cannot find
// a row it cannot see — so PATCHing it silently matched nothing.
const RPC = `${SUPABASE_URL}/rest/v1/rpc/cp_log_session`;
const LOAD_RPC = `${SUPABASE_URL}/rest/v1/rpc/cp_log_load`;

export interface SessionRow {
  /** Unique per CAREER — one row per career played. */
  session_id: string;
  /** Stable for one page load, so careers from one visit can be grouped. */
  visit_id: string;
  /** 1 for the first career of the visit, 2 for the second, and so on. */
  career_index: number;
  env: 'prod' | 'dev';
  started_at: string;
  duration_s: number;
  /** Driver identity, from the setup screen. */
  driver_name: string | null;
  driver_number: number | null;
  nationality: string | null;
  style: string | null;
  seed: string | null;
  /** Where they got to. */
  careers_started: number;
  careers_finished: number;
  reached_f1: boolean;
  seasons: number;
  titles: number;
  career_title: string | null;
  career_score: number;
  /** Did they try to share? */
  shared: boolean;
  share_result: string | null;
  /** Who and where. */
  ip: string | null;
  country: string | null;
  city: string | null;
  user_agent: string | null;
  screen: string | null;
  referrer: string | null;
  /** 'mobile' | 'tablet' | 'desktop'. */
  device: string | null;
  /** 'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux' | 'ChromeOS' | 'other'. */
  platform: string | null;
  /** Which build produced this row. Rows are meaningless without it. */
  app_version: string | null;
  /**
   * Anything not worth a column of its own, yet. Adding a key here needs no
   * migration and no deploy coordination: old rows simply lack it, and queries
   * read it with `meta->>'key'`. Promote a key to a real column once it earns
   * an index.
   */
  meta: Record<string, unknown>;
}

/**
 * What they played on. Two traps this handles:
 *  - iPadOS 13+ sends a desktop Safari user agent; only the touch-point count
 *    gives it away, so an iPad would otherwise log as a Mac.
 *  - Android tablets send "Android" without "Mobile", which is the only thing
 *    separating them from phones.
 */
function detectDevice(): { device: string; platform: string } {
  if (typeof navigator === 'undefined') return { device: 'unknown', platform: 'unknown' };
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean; platform?: string } })
    .userAgentData;
  const ua = navigator.userAgent || '';
  const touch = navigator.maxTouchPoints ?? 0;

  const isIPadOS = /Macintosh/.test(ua) && touch > 1;
  const isIOS = /iPhone|iPod|iPad/.test(ua) || isIPadOS;
  const isAndroid = /Android/.test(ua);

  let platform: string;
  if (isIOS) platform = 'iOS';
  else if (isAndroid) platform = 'Android';
  else if (/Windows/.test(ua)) platform = 'Windows';
  else if (/CrOS/.test(ua)) platform = 'ChromeOS';
  else if (/Mac OS X|Macintosh/.test(ua)) platform = 'macOS';
  else if (/Linux/.test(ua)) platform = 'Linux';
  else platform = uaData?.platform || 'other';

  let device: string;
  if (/iPad/.test(ua) || isIPadOS || (isAndroid && !/Mobile/.test(ua))) device = 'tablet';
  else if (isIOS || isAndroid || /Mobi/.test(ua) || uaData?.mobile === true) device = 'mobile';
  else device = 'desktop';

  return { device, platform };
}

/**
 * A PERMANENT OPT-OUT FOR OUR OWN TRAFFIC.
 *
 * WHY: half of the first day of page-load data was mine. Verifying a deploy
 * means loading the production URL over and over, and those loads arrive with
 * no referrer — so the referrer-based dev filter that keeps the careers
 * dashboard clean could not see them, and they counted as visitors who
 * arrived and bounced. 29 of 63 loads, every one a false bounce.
 *
 * Heuristics were the wrong answer. navigator.webdriver is false in the
 * preview browser, the user agent is ordinary Chrome, and filtering by country
 * would throw away real players from the same place. So it is explicit and
 * sticky, the way analytics opt-outs normally are:
 *
 *     playchasingp1.com/?dev=1   stop logging this browser, permanently
 *     playchasingp1.com/?dev=0   start again
 *
 * Set once per browser used for testing and nothing from it is ever recorded
 * again — no loads, no careers — because suppression happens before the first
 * write rather than being filtered out afterwards.
 */
const DEV_KEY = 'cp1.dev';

function isOptedOut(): boolean {
  try {
    const flag = new URLSearchParams(location.search).get('dev');
    if (flag === '1') localStorage.setItem(DEV_KEY, '1');
    else if (flag === '0') localStorage.removeItem(DEV_KEY);
    return localStorage.getItem(DEV_KEY) === '1';
  } catch {
    // No storage, no opt-out. A visitor who blocks site data is a real visitor.
    return false;
  }
}

/**
 * Is this a browser being driven by software rather than a person?
 *
 * Nine rows in ten were link scanners and crawlers hitting the Pages URL — one
 * second of activity, no career started, arriving from a dozen datacentres.
 * Logging them buries the real numbers.
 *
 * `?tel=force` overrides this, which is the only way to verify the write path
 * from an automated browser.
 */
function looksAutomated(): boolean {
  if (typeof navigator === 'undefined') return true;
  if (isOptedOut()) return true;
  try {
    if (new URLSearchParams(location.search).get('tel') === 'force') return false;
  } catch {
    // No URL to read; fall through to the checks below.
  }
  if ((navigator as Navigator & { webdriver?: boolean }).webdriver === true) return true;
  const ua = navigator.userAgent || '';
  return /bot|crawl|spider|slurp|headless|phantom|puppeteer|playwright|selenium|lighthouse|scanner|curl\/|wget|python-requests|facebookexternalhit|bingpreview|preview/i.test(
    ua
  );
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Where the visit came from, captured once at load.
 *
 * document.referrer answers this only partly, and its gaps are not random:
 *
 *  * A native share — the one this game's own Share button produces — arrives
 *    through WhatsApp or iMessage with NO referrer at all. The channel we can
 *    most influence is the one referrer is blindest to.
 *  * Browsers default to a strict referrer policy, so a cross-origin referrer
 *    arrives as a bare origin. "They came from Google" is knowable; what they
 *    searched for is not, by anyone, ever.
 *  * In-app browsers (Instagram, Facebook) frequently strip it outright.
 *
 * So we also read the tags off our own URL. They survive being pasted into a
 * chat, which is exactly where referrer dies. Standard utm_* names, plus a
 * short `s` for links meant to be seen by a human.
 */
const LANDING_TAGS: Record<string, string> = (() => {
  const tags: Record<string, string> = {};
  if (typeof location === 'undefined') return tags;
  try {
    const q = new URLSearchParams(location.search);
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 's', 'src', 'ref', 'beat']) {
      const value = q.get(key);
      if (value) tags[key === 's' ? 'src' : key] = value.slice(0, 60);
    }
  } catch {
    /* a malformed query string is not worth failing a page load over */
  }
  return tags;
})();

const started = Date.now();
let rowStarted = started;

/**
 * Two different clocks, because they answer different questions.
 *
 *  duration_s        wall clock from page load to the last write. Includes the
 *                    tab sitting idle or backgrounded.
 *  meta.active_s     time the page was actually VISIBLE, accumulated across
 *                    backgrounding. This is the "how long did they play" number.
 *
 * Visible-time is a proxy, not true engagement: a tab left open in the
 * foreground while the player makes coffee still counts. Measuring real
 * attention would need input tracking, which is not worth it here.
 */
let visibleSince = typeof document !== 'undefined' && document.visibilityState === 'visible'
  ? Date.now()
  : 0;
let activeMs = 0;

function pauseActive(): void {
  if (visibleSince) {
    activeMs += Date.now() - visibleSince;
    visibleSince = 0;
  }
}

function resumeActive(): void {
  if (!visibleSince) visibleSince = Date.now();
}

function activeSeconds(): number {
  return Math.round((activeMs + (visibleSince ? Date.now() - visibleSince : 0)) / 1000);
}

const visitId = newId();

const row: SessionRow = {
  session_id: newId(),
  visit_id: visitId,
  career_index: 0,
  env: typeof location !== 'undefined' && /^(localhost|127\.|\[?::1)/.test(location.hostname) ? 'dev' : 'prod',
  started_at: new Date(started).toISOString(),
  duration_s: 0,
  driver_name: null,
  driver_number: null,
  nationality: null,
  style: null,
  seed: null,
  careers_started: 0,
  careers_finished: 0,
  reached_f1: false,
  seasons: 0,
  titles: 0,
  career_title: null,
  career_score: 0,
  shared: false,
  share_result: null,
  ip: null,
  country: null,
  city: null,
  user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : null,
  screen: typeof window !== 'undefined' ? `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}` : null,
  referrer: typeof document !== 'undefined' ? document.referrer.slice(0, 300) || null : null,
  app_version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : null,
  meta: { ...LANDING_TAGS },
  ...detectDevice()
};

let suppressed = false;
let sending: Promise<void> | null = null;

/**
 * Nothing is written until the visitor actually does something.
 *
 * navigator.webdriver catches WebDriver tools and self-identifying bots, but
 * the crawlers that filled this log presented as ordinary Chrome and would slip
 * straight through. What separates them is behaviour: nineteen rows in
 * twenty-one never touched anything. So a row is created on the first click,
 * keypress or career start — never on page load alone.
 *
 * The cost is that a real person who opens the page and leaves without
 * touching it also goes unrecorded. That is an acceptable trade: such a visit
 * is indistinguishable from a crawler anyway, so counting it was never telling
 * us anything.
 */
let engaged = false;

function markEngaged(): void {
  if (engaged || suppressed) return;
  engaged = true;
  schedule();
}

function headers(extra: Record<string, string> = {}): HeadersInit {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...extra
  };
}

/**
 * REMOVED: the IP and location lookup.
 *
 * This used to call a third-party service (ipwho.is) on page load to record the
 * visitor's IP address, country and city. Google Safe Browsing classified the
 * site as a DECEPTIVE PAGE — "tricking users into revealing personal
 * information" — and blocked it in Chrome entirely.
 *
 * That classification was wrong about the intent and right about the shape. To
 * an automated classifier the site was: a domain registered two days earlier,
 * serving a form asking for a name and a number, silently harvesting the
 * visitor's IP from a third-party endpoint, and posting the result to another
 * third-party API. That is the fingerprint of a phishing kit.
 *
 * It was also personal data under GDPR that this project had no privacy notice
 * for, which had been flagged repeatedly and never resolved. Removing it fixes
 * both problems at once.
 *
 * The ip / country / city columns stay in the table so historical rows keep
 * their meaning; new rows simply leave them null. If the geography breakdown is
 * ever wanted back, derive it server-side from the request rather than asking
 * the browser to fetch its own IP.
 */

async function push(keepalive = false): Promise<void> {
  if (suppressed || !engaged) return;
  row.duration_s = Math.round((Date.now() - rowStarted) / 1000);
  row.meta.active_s = activeSeconds();

  // Snapshot synchronously: `push` is async and a new career can begin while
  // it is in flight, which would otherwise send the wrong row's data.
  const snapshot: Partial<SessionRow> = { ...row, meta: { ...row.meta } };

  try {
    await fetch(RPC, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ p: snapshot }),
      keepalive
    });
  } catch {
    // Telemetry is never allowed to surface to the player.
  }
}

/** Coalesce rapid updates so a burst of events is one write. */
function schedule(keepalive = false): void {
  if (sending) return;
  sending = new Promise<void>((resolve) => {
    setTimeout(async () => {
      sending = null;
      await push(keepalive);
      resolve();
    }, keepalive ? 0 : 400);
  });
}

let installed = false;

/**
 * COUNT THE ARRIVAL, SEPARATELY FROM THE CAREER.
 *
 * cp_sessions writes nothing until the visitor does something, which is what
 * keeps crawlers out of the careers data and must not change. The cost was
 * that somebody who opened the front page and left was invisible, so the
 * opening screen could not be measured at all: "94% of visitors start a
 * career" really meant "94% of people who already interacted went on to start
 * one", which cannot tell us whether the front page is losing anybody.
 *
 * This writes one small row to a DIFFERENT table, joined later on visit_id:
 * a load with no matching session is somebody who arrived and left.
 *
 * It carries no name, no score and nothing typed. Crawler rows land here on
 * purpose and are filtered when the data is read — dropping them at write
 * time is exactly how the blind spot was created in the first place.
 *
 * Fired a second after load rather than immediately, so a visitor who closes
 * the tab instantly costs nothing, and so it never competes with rendering.
 */
function logLoad(): void {
  const send = () => {
    try {
      const body = JSON.stringify({
        p: {
          visit_id: visitId,
          referrer: row.referrer,
          device: row.device,
          platform: row.platform,
          screen: row.screen,
          app_version: row.app_version,
          webdriver: typeof navigator !== 'undefined' && navigator.webdriver === true,
          meta: { ...LANDING_TAGS }
        }
      });
      void fetch(LOAD_RPC, { method: 'POST', headers: headers(), body, keepalive: true }).catch(() => {});
    } catch {
      /* a failed count is not worth failing a page load over */
    }
  };
  setTimeout(send, 1000);
}

export function initTelemetry(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  // Decided once, at start: a driven browser is never logged at all, so it
  // costs no requests either.
  if (looksAutomated()) {
    suppressed = true;
    return;
  }

  logLoad();

  // `visibilitychange` is the only event that fires reliably when a mobile
  // browser is backgrounded or the tab is closed; `pagehide` covers the rest.
  const flush = () => {
    if (document.visibilityState === 'hidden') {
      // Stop the active clock BEFORE writing, so the flushed row does not bill
      // the player for time spent with the tab in the background.
      pauseActive();
      void push(true);
    } else {
      resumeActive();
    }
  };
  // Every interaction refreshes last_activity_at, throttled so a career's worth
  // of clicks is a handful of writes rather than sixty. Session length is then
  // last_activity_at - created_at, computed in SQL — which stays correct even
  // when the final flush never lands.
  let lastPing = 0;
  const onActivity = () => {
    if (!engaged) {
      markEngaged();
      lastPing = Date.now();
      return;
    }
    const now = Date.now();
    if (now - lastPing < 30000) return;
    lastPing = now;
    schedule();
  };
  document.addEventListener('click', onActivity, { passive: true });
  document.addEventListener('keydown', onActivity, { passive: true });

  document.addEventListener('visibilitychange', flush);
  window.addEventListener('pagehide', () => {
    pauseActive();
    void push(true);
  });
}

/**
 * Begin a fresh row. The visit keeps its id so careers from one sitting can be
 * grouped, but each career gets its own row — three careers, three rows.
 */
function startNewRow(): void {
  void push();                     // flush the career that just ended
  row.session_id = newId();
  row.started_at = new Date().toISOString();
  row.careers_finished = 0;
  row.reached_f1 = false;
  row.seasons = 0;
  row.titles = 0;
  row.career_title = null;
  row.career_score = 0;
  row.shared = false;
  row.share_result = null;
  row.meta = { ...LANDING_TAGS };
  activeMs = 0;
  visibleSince = Date.now();
  rowStarted = Date.now();
}

export function trackCareerStart(setup: {
  name: string;
  number: number;
  nationality: string;
  style: string;
  seed: string;
}): void {
  markEngaged();
  // Every career has a unique seed, so being told about one we already hold
  // means a duplicate call — a double-tap, a re-render — not a new career.
  // Without this the duplicate opens a second row that never gets played.
  if (row.seed !== null && row.seed === setup.seed) return;
  // Second and later careers of a visit start their own row.
  if (row.career_index > 0) startNewRow();
  row.career_index += 1;
  row.careers_started = 1;
  row.driver_name = setup.name.slice(0, 60);
  row.driver_number = setup.number;
  row.nationality = setup.nationality;
  row.style = setup.style;
  row.seed = setup.seed;
  schedule();
}

/**
 * Progress markers, refreshed as the career runs.
 *
 * Deliberately does NOT trigger a write: it only mutates the row, and the
 * throttled activity ping and the page-hide flush carry it. Writing here would
 * mean a request per click.
 *
 * Without this, `seasons` was only set when a career FINISHED, so every
 * abandoned career logged zero — making "where do people quit" unanswerable.
 */
export function trackProgress(p: {
  seasons: number;
  series: string;
  age: number;
  decisions: number;
  reachedF1: boolean;
}): void {
  row.seasons = p.seasons;
  row.reached_f1 = p.reachedF1 || row.reached_f1;
  row.meta.last_series = p.series;
  row.meta.last_age = p.age;
  row.meta.decisions = p.decisions;
}

export function trackCareerEnd(summary: {
  seasons: number;
  reachedF1: boolean;
  titles: number;
  careerTitle: string;
  score: number;
}): void {
  row.careers_finished += 1;
  row.seasons = summary.seasons;
  row.reached_f1 = summary.reachedF1 || row.reached_f1;
  // Keep the best career of the session, so one row still tells the story.
  if (summary.score >= row.career_score) {
    row.titles = summary.titles;
    row.career_title = summary.careerTitle;
    row.career_score = summary.score;
  }
  schedule();
}

/**
 * Record anything else, with no schema change required. Use this first; move a
 * key into its own column only once you want to index or group by it.
 *
 *   trackExtra('reached_summary', true)
 *   trackExtra('decisions_taken', 14)
 */
export function trackExtra(key: string, value: unknown): void {
  row.meta[key] = value;
  schedule();
}

export function trackShare(result: string): void {
  row.shared = true;
  // `shared` is set the moment the sheet OPENS, so on its own it cannot tell a
  // completed share from a cancelled one. share_result is the outcome.
  row.share_result = result;
  schedule();
}

/**
 * The share prompt was shown for this career.
 *
 * Without this, whether the prompt helps can only be inferred by rebuilding its
 * conditions from the log and comparing across BUILDS — which confounds it with
 * everything else that shipped the same day. Recording it lets prompted and
 * unprompted careers be compared inside a single build, where nothing else
 * differs.
 */
export function trackPromptShown(score: number): void {
  if (row.meta.prompt_shown) return;
  row.meta.prompt_shown = true;
  row.meta.prompt_score = score;
  schedule();
}

/** For debugging from the console. */
export function telemetrySnapshot(): SessionRow {
  return {
    ...row,
    duration_s: Math.round((Date.now() - rowStarted) / 1000),
    meta: { ...row.meta, active_s: activeSeconds() }
  };
}

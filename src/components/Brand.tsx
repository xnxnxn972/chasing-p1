/**
 * The CHASING P1 identity.
 *
 * The mark is a forward-leaning P1 monogram: the P carries a hard diagonal
 * split from lime into white, the numeral stays solid lime. Everything is drawn
 * as geometry rather than set as type, so it renders identically before webfonts
 * land and scales cleanly from the 24px header lockup to the summary hero.
 */

export function P1Mark({ size = 48, title }: { size?: number; title?: string }) {
  return (
    <svg
      className="p1-mark"
      viewBox="0 0 102 72"
      height={size}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        {/* Hard diagonal split, weighted so white carries the upper mass of the
            P and lime takes the stem — the balance the brand sheet uses. */}
        <linearGradient id="p1-split" x1="0.05" y1="1" x2="0.95" y2="0">
          <stop offset="0%" stopColor="var(--lime)" />
          <stop offset="33%" stopColor="var(--lime)" />
          <stop offset="41%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#dde4ea" />
        </linearGradient>
        <linearGradient id="p1-one" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="26%" stopColor="#ffffff" />
          <stop offset="34%" stopColor="var(--lime)" />
          <stop offset="100%" stopColor="var(--lime)" />
        </linearGradient>
      </defs>
      <g transform="translate(16,0) skewX(-12)">
        {/* P — outer silhouette with the counter cut out by the even-odd rule. */}
        <path
          fill="url(#p1-split)"
          fillRule="evenodd"
          d="M0,0 H48 V42 H18 V72 H0 Z M18,14 H34 V28 H18 Z"
        />
        {/* 1 — stem plus the angled flag, catching white at the tip. */}
        <path fill="url(#p1-one)" d="M84,0 V72 H66 V16 H54 L66,0 Z" />
      </g>
    </svg>
  );
}

/** Mark + wordmark + tagline, as on the brand sheet. */
export function BrandLockup({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const markSize = size === 'lg' ? 86 : size === 'md' ? 54 : 34;
  return (
    <div className={`lockup lockup-${size}`}>
      <P1Mark size={markSize} title="Chasing P1" />
      <span className="lockup-bar" />
      <div className="lockup-words">
        <span className="lockup-chasing">Chasing</span>
        <span className="lockup-p1">
          P<em>1</em>
        </span>
      </div>
    </div>
  );
}

/** The thin labelled rule that frames every screen. */
export function RuleBar({
  left,
  right,
  accent = false
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`rule-bar${accent ? ' is-accent' : ''}`}>
      <span className="rule-bar-left">{left}</span>
      <span className="rule-line" />
      {right ? <span className="rule-bar-right">{right}</span> : null}
    </div>
  );
}

export const TAGLINE = 'One career. One goal.';

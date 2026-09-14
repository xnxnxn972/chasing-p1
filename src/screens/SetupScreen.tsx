import { useRef, useState } from 'react';
import type { DrivingStyle } from '../game/types';
import type { CareerSetup } from '../game/careerEngine';
import { NATIONALITIES } from '../data/nationalities';
import { makeSeed } from '../game/random';
import { BrandLockup, RuleBar, TAGLINE } from '../components/Brand';
import { ambitionById } from '../game/unfinishedBusiness';

const STYLE_CARDS: {
  id: DrivingStyle;
  name: string;
  pros: string[];
  cons: string[];
}[] = [
  {
    id: 'speed',
    name: 'Speed',
    pros: ['Qualifying', 'Overtaking', 'Spectacular days'],
    cons: ['Crashes more', 'Less consistent']
  },
  {
    id: 'technical',
    name: 'Technical',
    pros: ['Car development', 'Tyre management', 'Great in bad cars'],
    cons: ['Slow to find raw pace']
  },
  {
    id: 'physical',
    name: 'Physical',
    pros: ['Starts', 'Wheel-to-wheel', 'Difficult conditions'],
    cons: ['Weaker on Saturdays']
  }
];

/** The four pillars, cut to one clause each so the form is reachable without
    scrolling on a phone — where four visits in five come from. */
const PILLARS: { name: string; copy: string; icon: React.ReactNode }[] = [
  {
    name: 'Build',
    copy: 'Develop your driver.',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M3 20V13M9 20V8M15 20V11M21 20V4" strokeLinecap="square" />
      </svg>
    )
  },
  {
    name: 'Compete',
    copy: 'Outthink the grid.',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M12 3a9 9 0 0 1 0 18 9 9 0 0 1 0-18Z" />
        <path d="M21 12h-8a3 3 0 0 0-3 3v5.7" />
      </svg>
    )
  },
  {
    name: 'Achieve',
    copy: 'Chase the title.',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M7 3h10v6a5 5 0 0 1-10 0V3Z" />
        <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3M12 14v4M8 21h8" strokeLinecap="square" />
      </svg>
    )
  },
  {
    name: 'Beyond',
    copy: 'Leave a legacy.',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M8.5 12a3.5 3.5 0 1 1 3.5 3.5c-2 0-2.5-7-4.5-7a3.5 3.5 0 0 0 0 7c2 0 2.5-7 4.5-7a3.5 3.5 0 0 1 0 7" />
      </svg>
    )
  }
];

/**
 * A name in the style of the chosen nationality. Offered on a button rather
 * than pre-filled: a name the player typed is a name they are attached to, and
 * that attachment is most of what makes a career theirs.
 */
function randomName(code: string): string {
  const nat = NATIONALITIES.find((n) => n.code === code) ?? NATIONALITIES[0];
  const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
  return `${pick(nat.firstNames)} ${pick(nat.lastNames)}`;
}

export function SetupScreen({
  onStart,
  ambitionId,
  challengeScore
}: {
  onStart: (setup: CareerSetup) => void;
  ambitionId?: string;
  challengeScore?: number;
}) {
  const [name, setName] = useState('');
  const [number, setNumber] = useState(27);
  const [nationality, setNationality] = useState('GB');
  const [style, setStyle] = useState<DrivingStyle>('speed');
  // A double-tap on Start fired onStart twice, burning a second career row.
  // This has to be a ref: two clicks landing in one React batch both see the
  // old value of a state variable, so a useState guard does not hold.
  const starting = useRef(false);
  const [started, setStarted] = useState(false);

  const ambition = ambitionById(ambitionId);

  const trimmed = name.trim();
  const valid = trimmed.length > 0 && number >= 2 && number <= 99;

  return (
    <div className="setup">
      <RuleBar left="Chasing P1" right="F1 Career Simulation" accent />

      <div className="setup-hero">
        <BrandLockup size="lg" />
        <div className="tagline">{TAGLINE}</div>
      </div>

      {challengeScore ? (
        <div className="ambition-banner is-challenge">
          <span className="label">You have been challenged</span>
          <strong>Beat {challengeScore.toLocaleString()}</strong>
          <span className="ambition-missed">
            Someone sent you their career. Build a better one.
          </span>
        </div>
      ) : (
        ambition && (
          <div className="ambition-banner">
            <span className="label">Unfinished business</span>
            <strong>{ambition.label}</strong>
            <span className="ambition-missed">{ambition.missed}</span>
          </div>
        )
      )}

      <div className="pillars">
        {PILLARS.map((pillar) => (
          <div className="pillar" key={pillar.name}>
            {pillar.icon}
            <h4>{pillar.name}</h4>
            <p>{pillar.copy}</p>
          </div>
        ))}
      </div>

      <header className="setup-head">
        <h1>Who Are You?</h1>
        <p>Sixteen years old. One dream: Formula 1.</p>
        <div className="rule" />
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid || starting.current) return;
          starting.current = true;
          setStarted(true);
          // The seed is generated here and never shown: the engine needs one for
          // determinism, the player does not need to think about it.
          onStart({ name: trimmed, number, nationality, style, seed: makeSeed(), ambitionId });
        }}
      >
        <div className="field-row">
          <div className="field">
            <label htmlFor="name">Name</label>
            <div className="input-with-action">
              <input
                id="name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your driver's name"
                maxLength={28}
                autoFocus
              />
              <button
                type="button"
                className="dice"
                onClick={() => setName(randomName(nationality))}
                title="Suggest a name"
                aria-label="Suggest a driver name"
              >
                <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
                  <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
                  <circle cx="8.5" cy="8.5" r="1.35" fill="currentColor" stroke="none" />
                  <circle cx="15.5" cy="15.5" r="1.35" fill="currentColor" stroke="none" />
                  <circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none" />
                </svg>
              </button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="number">Number</label>
            <input
              id="number"
              className="input"
              type="number"
              min={2}
              max={99}
              value={number}
              onChange={(e) => setNumber(Number(e.target.value))}
            />
          </div>
        </div>
        {/* #1 is reserved: the reigning World Champion earns the right to it. */}
        <p className="hint" style={{ marginTop: -14, marginBottom: 22 }}>
          2&ndash;99. Number 1 belongs to the reigning World Champion &mdash; win it and you can run it.
        </p>

        <div className="field">
          <label htmlFor="nat">Nationality</label>
          <select
            id="nat"
            className="select"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
          >
            {[...NATIONALITIES]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((n) => (
                <option key={n.code} value={n.code}>
                  {n.flag} {n.name}
                </option>
              ))}
          </select>
        </div>

        <div className="field">
          <label>Driving style</label>
          <div className="styles">
            {STYLE_CARDS.map((card) => (
              <button
                key={card.id}
                type="button"
                className={`style-card${style === card.id ? ' is-active' : ''}`}
                onClick={() => setStyle(card.id)}
                aria-pressed={style === card.id}
              >
                <h3>{card.name}</h3>
                <ul>
                  {card.pros.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                  {card.cons.map((c) => (
                    <li className="con" key={c}>
                      {c}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={!valid || started}>
          Start your career
        </button>
      </form>

      <div className="page-foot">
        <RuleBar left="Chasing P1" right={TAGLINE} accent />
      </div>
    </div>
  );
}

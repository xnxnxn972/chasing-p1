import { useState } from 'react';
import type { DrivingStyle } from '../game/types';
import type { CareerSetup } from '../game/careerEngine';
import { NATIONALITIES } from '../data/nationalities';
import { makeSeed } from '../game/random';
import { BrandLockup, RuleBar, TAGLINE } from '../components/Brand';

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

/** The four pillars from the brand sheet, with the same line-art icons. */
const PILLARS: { name: string; copy: string; icon: React.ReactNode }[] = [
  {
    name: 'Build',
    copy: 'Develop your driver. Improve performance. Make the right calls.',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M3 20V13M9 20V8M15 20V11M21 20V4" strokeLinecap="square" />
      </svg>
    )
  },
  {
    name: 'Compete',
    copy: 'Race. Adapt. Outthink rivals. Prove yourself.',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M12 3a9 9 0 0 1 0 18 9 9 0 0 1 0-18Z" />
        <path d="M21 12h-8a3 3 0 0 0-3 3v5.7" />
      </svg>
    )
  },
  {
    name: 'Achieve',
    copy: 'Championships. Lasting legacy. Become the best.',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M7 3h10v6a5 5 0 0 1-10 0V3Z" />
        <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3M12 14v4M8 21h8" strokeLinecap="square" />
      </svg>
    )
  },
  {
    name: 'Beyond',
    copy: 'More than races. A career that defines you.',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M8.5 12a3.5 3.5 0 1 1 3.5 3.5c-2 0-2.5-7-4.5-7a3.5 3.5 0 0 0 0 7c2 0 2.5-7 4.5-7a3.5 3.5 0 0 1 0 7" />
      </svg>
    )
  }
];

export function SetupScreen({ onStart }: { onStart: (setup: CareerSetup) => void }) {
  const [name, setName] = useState('');
  const [number, setNumber] = useState(27);
  const [nationality, setNationality] = useState('GB');
  const [style, setStyle] = useState<DrivingStyle>('speed');
  const [seed, setSeed] = useState(makeSeed());

  const trimmed = name.trim();
  const valid = trimmed.length > 0 && number >= 2 && number <= 99;

  return (
    <div className="setup">
      <RuleBar left="Chasing P1" right="F1 Career Simulation" accent />

      <div className="setup-hero">
        <BrandLockup size="lg" />
        <div className="tagline">{TAGLINE}</div>
      </div>

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
          if (valid) onStart({ name: trimmed, number, nationality, style, seed: seed.trim() || makeSeed() });
        }}
      >
        <div className="field-row">
          <div className="field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your driver's name"
              maxLength={28}
              autoFocus
            />
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

        <div className="field">
          <label htmlFor="seed">Career seed</label>
          <div className="field-row">
            <input
              id="seed"
              className="input"
              value={seed}
              onChange={(e) => setSeed(e.target.value.toUpperCase())}
              maxLength={16}
            />
            <button type="button" className="btn" onClick={() => setSeed(makeSeed())}>
              Reroll
            </button>
          </div>
          <p className="hint">
            The whole universe comes from this &mdash; your hidden potential, how the teams develop, who your
            rivals are. Share a seed to race the same world as someone else.
          </p>
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={!valid}>
          Start your career
        </button>
      </form>

      <div className="page-foot">
        <RuleBar left="Chasing P1" right={TAGLINE} accent />
      </div>
    </div>
  );
}

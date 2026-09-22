import { useRef, useState } from 'react';
import type { DrivingStyle } from '../game/types';
import type { CareerSetup } from '../game/careerEngine';
import { NATIONALITIES } from '../data/nationalities';
import { ordinal, streakIsAlive, today } from '../game/streak';
import { player } from '../game/playerStore';
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
  // Opened on the driver this browser last raced as. A returning player gets
  // their own choices back rather than a blank form; a first-time player gets
  // the defaults, and nothing is ever invented on their behalf.
  const saved = player();
  const [name, setName] = useState(saved.lastName ?? '');
  const [number, setNumber] = useState(saved.lastNumber ?? 27);
  const [nationality, setNationality] = useState(saved.lastNationality ?? 'GB');
  const [style, setStyle] = useState<DrivingStyle>((saved.lastStyle as DrivingStyle) ?? 'speed');
  // A double-tap on Start fired onStart twice, burning a second career row.
  // This has to be a ref: two clicks landing in one React batch both see the
  // old value of a state variable, so a useState guard does not hold.
  const starting = useRef(false);
  const [started, setStarted] = useState(false);

  // THE STREAK. Read once on mount: the record cannot change while this screen
  // is up, and re-reading it on every keystroke would be pointless work.
  const me = saved;
  const playedToday = me.lastPlayed === today();
  const streak = streakIsAlive(me.lastPlayed) ? me.streak : 0;

  const ambition = ambitionById(ambitionId);

  const trimmed = name.trim();
  const valid = trimmed.length > 0 && number >= 2 && number <= 99;

  return (
    <div className="setup">
      <RuleBar left="Chasing P1" right="F1 Career Simulation" accent />

      <div className="setup-hero">
        {/* First heading in the document. The visible identity is a wordmark,
            which neither a screen reader nor a crawler can read, so the page's
            actual title lives here. */}
        <h1 className="sr-only">Chasing P1 — Formula 1 career simulation game</h1>
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
            <p className="pillar-name">{pillar.name}</p>
            <p>{pillar.copy}</p>
          </div>
        ))}
      </div>

      <header className="setup-head">
        {/* "Who Are You?" was the page's only h1, which told a search engine
            nothing. It is the question the player is asked, not the title of
            the page, so it is an h2 now. */}
        <h2 className="setup-question">Who do you want to be?</h2>
        <p>Sixteen years old. One dream: Formula 1.</p>
        <div className="rule" />
      </header>

      {/* THE STREAK. One line, and only when there is something to say. It is
          a nudge, not a scoreboard: the game cannot send anybody a
          notification, so a count that breaks tomorrow is the only deadline
          available to a player who has already left. */}
      {streak > 0 && (
        <p className="streak-note">
          {playedToday ? (
            <>
              <strong>{ordinal(streak)} racing day in a row.</strong> Come back tomorrow to keep it
              going.
            </>
          ) : (
            <>
              <strong>
                {streak === 1 ? 'You raced yesterday.' : `${streak} racing days in a row.`}
              </strong>{' '}
              Start a career today and it becomes {streak + 1}.
            </>
          )}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid || starting.current) return;
          starting.current = true;
          setStarted(true);
          // The seed is generated here and never shown: the engine needs one for
          // determinism, the player does not need to think about it.
          // Every career gets its own seed, including two started on the same
          // day by the same player. The seed is never shown: the engine needs
          // one for determinism, the player does not need to think about it.
          onStart({ name: trimmed, number, nationality, style, seed: makeSeed(), ambitionId });
        }}
      >
        <div className="field-row">
          <div className="field">
            <label htmlFor="name">Driver name</label>
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
            <label htmlFor="number">Race number</label>
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
        </div>
        {/* #1 is reserved: the reigning World Champion earns the right to it. */}
        <p className="hint" style={{ marginTop: -14, marginBottom: 22 }}>
          2&ndash;99. Number 1 belongs to the reigning World Champion &mdash; win it and you can run it.
        </p>


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
          {/* On a phone the three cards collapse to their names, which would
              drop the reason to choose one. This restores it for the selected
              style in a single line. Hidden on desktop, where the cards
              already say it. */}
          <p className="style-pros">
            {(() => {
              const c = STYLE_CARDS.find((x) => x.id === style);
              return c ? [...c.pros.map((t) => `+ ${t}`), ...c.cons.map((t) => `− ${t}`)].join('   ') : '';
            })()}
          </p>
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={!valid || started}>
          Start your career
        </button>
      </form>

      <section className="about">
        <RuleBar left="What is this?" right="Chasing P1" />
        <div className="about-grid">
          <div>
            <h3>A Formula 1 career, one decision at a time</h3>
            <p>
              You start at sixteen in Formula 4 with no money, no reputation and one
              dream. Over the next twenty-five years you climb the junior ladder
              through Formula 3 and Formula 2, sign for a real 2026 Formula 1 team,
              and find out whether you end up World Champion, a journeyman nobody
              remembers, or a driver who never got out of the juniors at all.
            </p>
            <p>
              There is no driving. Every season asks you a small number of hard
              questions and you live with the answers.
            </p>
            {/* A real link, not a button: this is how a crawler finds the
                article at all. A sitemap entry alone gets a page discovered;
                an internal link is what makes it look like part of a site. */}
            <p>
              Curious how it works in real life?{' '}
              <a href="/how-to-become-an-f1-driver/">
                How to become an F1 driver: the real road from karting to Formula 1
              </a>{' '}
              and{' '}
              <a href="/what-is-an-f1-reserve-driver/">what an F1 reserve driver actually does</a>, or{' '}
              <a href="/f1-team-moves-that-changed-history/">
                three team moves that changed Formula 1 history
              </a>
              , or{' '}
              <a href="/how-much-do-f1-drivers-get-paid/">how much F1 drivers actually get paid</a>.
            </p>
          </div>
          <div>
            <h3>The questions are the game</h3>
            <p>
              Should your parents remortgage the house to fund one more season?
              Do you blame the car in public, or protect the five hundred people who
              built it? Your team-mate wants your telemetry — the three years of work
              that explain why you are quick. Do you hand it over?
            </p>
            <p>
              Eighty of these, drawn from the stage of your career you are actually
              in, and no two careers ask the same set.
            </p>
          </div>
          <div>
            <h3>What it costs you</h3>
            <p>
              Nothing. It is free, there is no sign-up, and it runs in a browser on a
              phone or a laptop. A full career takes about four minutes.
            </p>
            <p>
              You never see a number for how fast your car is — only what the paddock
              says about it. That is deliberate. The moment the car is a number, the
              game becomes a spreadsheet.
            </p>
            <p className="privacy-note">
              The driver name and number you choose are part of the game and are not
              a login. There is no account, no password and no payment. We count how
              far careers get so the game can be improved, and we do not collect your
              IP address, your location, or anything that identifies you.
            </p>
          </div>
        </div>
      </section>

      <div className="page-foot">
        <RuleBar left="Chasing P1" right={TAGLINE} accent />
      </div>
    </div>
  );
}

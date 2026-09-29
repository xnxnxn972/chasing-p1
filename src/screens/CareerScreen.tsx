import { useRef } from 'react';
import type { GameState } from '../game/types';
import { applyMinigame, chooseDecisionOption, chooseOffer, continueStep, declineOffers } from '../game/careerEngine';
import { LightsOut } from '../minigames/LightsOut/LightsOut';
import { TrackRecall } from '../minigames/TrackRecall/TrackRecall';
import { boostFor as recallBoost } from '../minigames/TrackRecall/recallScore';
import { DriverCard } from '../components/DriverCard';
import { CareerTable } from '../components/CareerTable';
import { AchievementBadge, DecisionCard, NewsCard, OffersCard, ResultCard } from '../components/StepCard';
import { BrandLockup, RuleBar, TAGLINE } from '../components/Brand';

export function CareerScreen({
  state,
  onState,
  onRestart
}: {
  state: GameState;
  onState: (next: GameState) => void;
  onRestart: () => void;
}) {
  const pending = state.pending;
  // Held between the minigame reporting a result and the player pressing
  // Continue. A ref rather than state: re-rendering the career screen while
  // the result is on screen would remount the minigame and wipe it.
  const lastBoost = useRef(0);

  return (
    <div className="app">
      <RuleBar left={<BrandLockup size="sm" />} right="F1 Career Simulation" />

      <div className="topbar">
        <div className="topbar-left">
          <span className="year">{state.year}</span>
          <span className="badge badge-series">
            {state.reserveTeamId ? 'F1 Reserve' : state.player.series}
          </span>
          <span className="badge">Age {state.player.age}</span>
        </div>
        <button className="btn btn-ghost" onClick={onRestart}>
          Abandon career
        </button>
      </div>

      <div className="career-grid">
        <div className="stack">
          <DriverCard state={state} />
          {state.achievements.length > 0 ? (
            <section className="panel panel-pad">
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                Achievements
              </div>
              <div className="achievements">
                {state.achievements.map((a) => (
                  <AchievementBadge key={a.id} achievement={a} />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className="stack">
          {pending?.kind === 'decision' ? (
            <DecisionCard
              step={pending}
              onChoose={(optionId) => onState(chooseDecisionOption(state, optionId))}
            />
          ) : null}

          {pending?.kind === 'offers' ? (
            <OffersCard
              step={pending}
              onSign={(offerId) => onState(chooseOffer(state, offerId))}
              onDecline={() => onState(declineOffers(state))}
            />
          ) : null}

          {pending?.kind === 'minigame' ? (
            <section className="panel panel-pad">
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                {pending.tag}
              </div>
              {/* One attempt, and the only way out is through it: no skip, no
                  retry. The boost is applied when the player continues rather
                  than the instant they tap, so the result is on screen long
                  enough to read. */}
              {pending.game === 'lights-out' ? (
                <LightsOut
                  mode="career"
                  onExit={() => onState(applyMinigame(state, lastBoost.current))}
                  onComplete={(r) => {
                    lastBoost.current = r.boost;
                  }}
                />
              ) : (
                <TrackRecall
                  mode="career"
                  onExit={() => onState(applyMinigame(state, lastBoost.current))}
                  onComplete={(score) => {
                    lastBoost.current = recallBoost(score);
                  }}
                />
              )}
            </section>
          ) : null}

          {pending?.kind === 'news' ? (
            <NewsCard step={pending} onContinue={() => onState(continueStep(state))} />
          ) : null}

          {pending?.kind === 'result' ? (
            <ResultCard
              step={pending}
              state={state}
              onContinue={() => onState(continueStep(state))}
            />
          ) : null}

          <CareerTable state={state} />
        </div>
      </div>

      <div className="page-foot">
        <RuleBar left="Chasing P1" right={TAGLINE} accent />
      </div>
    </div>
  );
}

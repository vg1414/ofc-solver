// ============================================================
// ScenarioSummary.tsx — Sammanfattning efter scenarioträningen
// ============================================================
// Totalpoäng (räknas upp), snitt per scenario, antal Perfekt/Bra/Miss,
// sämsta beslutet (tryck för att se det igen), alla scenarion i en
// lista och topplistan för just denna variant + antal.
// ============================================================

import { useState } from 'react';
import type { GameVariant } from '../../engine/types';
import { GRADE_LABEL, type Grade, type Judgement, type Move } from '../../training/moves';
import { scenarioLabel, type Scenario } from '../../training/scenarios';
import { boardKey, type TrainingMode } from '../../training/leaderboard';
import { useLeaderboardRun } from '../../training/useLeaderboardRun';
import BottomSheet from '../ui/BottomSheet';
import Footer from '../layout/Footer';
import ResultBoardPreview from '../solver/ResultBoardPreview';
import Leaderboard, { NameSheet } from './Leaderboard';
import ReviewBoard, { evFmt } from './ReviewBoard';
import { MoveExplain } from './CoachReview';
import { GradeBadge } from './ScenarioFeedback';
import { OpponentMini, useCountUp } from './TrainingBits';
import { applyMove } from '../../training/moves';

export interface ScenarioDone {
  scenario: Scenario;
  move: Move;
  j: Judgement;
}

interface Props {
  done: ScenarioDone[];
  mode: TrainingMode;
  variant: GameVariant;
  count: number;
  onRestart: () => void;
  onExit: () => void;
}

export default function ScenarioSummary({ done, mode, variant, count, onRestart, onExit }: Props) {
  const total = done.reduce((n, d) => n + d.j.points, 0);
  const max = count * 100;
  const shown = useCountUp(total, 1200, 0);
  const avg = done.length ? total / done.length : 0;
  const avgDiff = done.length ? done.reduce((n, d) => n + d.j.diff, 0) / done.length : 0;
  const counts: Record<Grade, number> = { perfect: 0, good: 0, miss: 0 };
  for (const d of done) counts[d.j.grade]++;
  const worstIdx = done.reduce((w, d, i) => (d.j.diff > done[w].j.diff ? i : w), 0);
  const worst = done[worstIdx];
  const [review, setReview] = useState<number | null>(null);

  const lb = useLeaderboardRun(boardKey(mode, variant, count), total, true);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 pb-4">
      {/* Totalpoäng */}
      <div className="glass relative overflow-hidden rounded-[28px] p-5 text-center animate-rise-in">
        <div className="gold-strip absolute inset-x-0 top-0" />
        <div className="eyebrow inline-block">{mode === 'joker' ? 'Jokerträning' : 'Omgången klar'} · {variant === 'regular' ? 'Vanlig' : 'Pineapple'}</div>
        <div className="mt-2 font-serif text-[64px] font-extrabold leading-none tabular text-gold">{Math.round(shown)}</div>
        <div className="mt-1 text-[13px] font-bold text-ink-3 tabular">av {max} poäng</div>
        <div className="mx-auto mt-3 h-2.5 max-w-[320px] overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full animate-grow-x" style={{ width: `${(total / max) * 100}%`, background: 'var(--grad-hot)' }} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="Snitt / scenario" value={`${Math.round(avg)} p`} />
          <Stat label="Snitt EV-förlust" value={avgDiff > 0 ? evFmt.format(-avgDiff) : '0,00'} />
        </div>
        <div className="mt-3 flex justify-center gap-2">
          {(['perfect', 'good', 'miss'] as Grade[]).map((g) => (
            <span key={g} className="flex items-center gap-1.5 rounded-full bg-surface/80 px-3 py-1 text-[12.5px] font-bold text-ink-2 shadow-[inset_0_0_0_1px_var(--line)]">
              <GradeBadge grade={g} size={18} />
              {counts[g]} {GRADE_LABEL[g]}
            </span>
          ))}
        </div>
      </div>

      {/* Sämsta beslutet */}
      {worst && worst.j.diff > 0.0001 && (
        <button
          type="button"
          onClick={() => setReview(worstIdx)}
          className="glass flex items-center gap-3 rounded-[24px] p-3.5 text-left transition-transform duration-200 active:scale-[0.98] animate-rise-in"
          style={{ animationDelay: '0.1s' }}
        >
          <ResultBoardPreview board={applyMove(worst.scenario.board, worst.move.placements)} cardWidth={16} />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-danger">Sämsta beslutet</div>
            <div className="text-[13px] font-semibold text-ink-2">Scenario {worstIdx + 1} · {scenarioLabel(worst.scenario)}</div>
            <div className="mt-0.5 text-[15px] font-extrabold tabular text-ink">{evFmt.format(-worst.j.diff)} EV</div>
            <div className="text-[11.5px] font-bold text-accent-ink">Se det igen →</div>
          </div>
        </button>
      )}

      {/* Alla scenarion */}
      <div className="glass overflow-hidden rounded-[24px] divide-y divide-line animate-rise-in" style={{ animationDelay: '0.15s' }}>
        {done.map((d, i) => (
          <button key={d.scenario.id} type="button" onClick={() => setReview(i)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-sunken/60">
            <GradeBadge grade={d.j.grade} size={26} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-ink">Scenario {i + 1}</div>
              <div className="truncate text-[11.5px] text-ink-3">{scenarioLabel(d.scenario)}</div>
            </div>
            <div className="text-right">
              <div className="text-[15px] font-extrabold tabular text-gold">+{d.j.points}</div>
              {d.j.diff > 0.0001 && <div className="text-[10.5px] font-bold tabular text-danger">{evFmt.format(-d.j.diff)}</div>}
            </div>
          </button>
        ))}
      </div>

      {/* Topplista */}
      <div className="glass rounded-[24px] p-3.5 animate-rise-in" style={{ animationDelay: '0.2s' }}>
        <div className="mb-1.5 flex items-baseline justify-between px-1">
          <h2 className="title-serif text-[21px]">Topplista</h2>
          <span className="text-[11px] font-bold text-ink-3">{mode === 'joker' ? '★ Joker · ' : ''}{count} scenarion · {variant === 'regular' ? 'Vanlig' : 'Pineapple'}</span>
        </div>
        <Leaderboard entries={lb.entries} highlightId={lb.highlightId} format={(s) => `${s} p`} />
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onExit} className="btn-ghost h-12 flex-1 rounded-full text-[14px] font-bold">
          Till start
        </button>
        <button type="button" onClick={onRestart} className="btn-primary h-12 flex-[2] rounded-full text-[15px] font-bold">
          ↻ Spela igen
        </button>
      </div>
      <Footer />

      <NameSheet open={lb.askName} rank={lb.rank} scoreText={`${total} p`} initialName={lb.initialName} onSave={lb.save} onClose={lb.skip} />

      <BottomSheet open={review !== null} onClose={() => setReview(null)} title={review !== null ? `Scenario ${review + 1}` : undefined}>
        {review !== null && done[review] && <ReviewContent d={done[review]} />}
      </BottomSheet>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] bg-sunken/70 px-2 py-2">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-3">{label}</div>
      <div className="text-[18px] font-extrabold tabular text-ink">{value}</div>
    </div>
  );
}

function ReviewContent({ d }: { d: ScenarioDone }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <GradeBadge grade={d.j.grade} size={36} />
        <div className="flex-1 text-[13px] font-semibold text-ink-2">
          {scenarioLabel(d.scenario)}
          <div className="tabular">
            <b className="text-gold">+{d.j.points} p</b> · {d.j.diff > 0.0001 ? `${evFmt.format(-d.j.diff)} EV` : 'bästa draget'}
          </div>
        </div>
      </div>
      <OpponentMini board={d.scenario.opponentBoard} />
      <ReviewBoard board={d.scenario.board} move={d.move} judgement={d.j} maxCardWidth={64} />
      <MoveExplain move={d.move} j={d.j} />
      {d.j.screened && <p className="text-[11.5px] font-semibold text-fl">ⓘ Solvern sållade bort ditt drag tidigt — EV:n är osäkrare.</p>}
    </div>
  );
}

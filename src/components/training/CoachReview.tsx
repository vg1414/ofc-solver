// ============================================================
// CoachReview.tsx — Coachens bedömning: bricka + ark med bästa draget
// ============================================================
//  - CoachPill: liten bricka efter varje drag. Var draget inte bäst
//    visas solverns drag direkt som minikort med rad (T/M/B), och ett
//    tryck öppnar arket.
//  - CoachSheet: ark med betyg, EV och brädet där man växlar mellan
//    "Ditt drag" och "Bästa draget" (samma ReviewBoard som Scenarion).
//    Knappen "Räkna om noggrant" kör om draget på Noggrann nivå.
//  - CoachDots: en prick per bedömt drag i handen, tryck för att se det.
// ============================================================

import type { Board, RowName } from '../../engine/types';
import type { SolverInput } from '../../hooks/useSolver';
import { GRADE_LABEL, type Judgement, type Move } from '../../training/moves';
import PlayingCard from '../cards/PlayingCard';
import BottomSheet from '../ui/BottomSheet';
import { GradeBadge } from './ScenarioFeedback';
import ReviewBoard, { evFmt } from './ReviewBoard';
import { haptic } from '../cards/cardStyle';

export interface CoachEntry {
  key: string;
  hand: number;
  round: number;
  fl: boolean;
  /** Brädet innan draget */
  board: Board;
  move: Move;
  /** Solverinput för draget (utan options) — för omräkning */
  input: SolverInput;
  j: Judgement | null;
  /** Omräknad på Noggrann nivå */
  thorough?: boolean;
}

const ROW_SHORT: Record<RowName, string> = { top: 'T', middle: 'M', bottom: 'B' };
const ROW_ORDER: RowName[] = ['top', 'middle', 'bottom'];

const isBest = (j: Judgement) => j.diff <= 0.0001;

/** Solverns drag som minikort, grupperat per rad: "T [K♠]  B [7♦][7♣]  kasta [2♣]" */
function BestMove({ j }: { j: Judgement }) {
  const groups = ROW_ORDER.map((r) => ({ r, cards: j.best.placements.filter((p) => p.row === r).map((p) => p.card) })).filter((g) => g.cards.length);
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {groups.map((g) => (
        <span key={g.r} className="flex items-center gap-[3px]">
          <span className="text-[10px] font-extrabold text-ink-3">{ROW_SHORT[g.r]}</span>
          {g.cards.map((c, i) => (
            <PlayingCard key={i} card={c} width={20} compact />
          ))}
        </span>
      ))}
      {j.best.discards.length > 0 && (
        <span className="flex items-center gap-[3px] opacity-70">
          <span className="text-[10px] font-extrabold text-ink-3">✕</span>
          {j.best.discards.map((c, i) => (
            <PlayingCard key={i} card={c} width={20} compact />
          ))}
        </span>
      )}
    </span>
  );
}

export function CoachPill({ entry, onOpen }: { entry: CoachEntry; onOpen: (e: CoachEntry) => void }) {
  const j = entry.j;
  if (!j) return null;
  const best = isBest(j);
  // Fantasy Land = 13+ kort, för många för brickan — där räcker arket
  const showCards = !best && !entry.fl && j.best.placements.length <= 5;
  return (
    <button
      type="button"
      onClick={() => {
        haptic(4);
        onOpen(entry);
      }}
      className="flex max-w-full items-center gap-2 self-start rounded-[18px] bg-surface/90 py-1 pl-1 pr-2.5 text-left text-[12px] font-bold shadow-[var(--shadow-soft)] transition-transform duration-200 active:scale-[0.97] animate-badge-in"
    >
      <GradeBadge grade={j.grade} size={22} />
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span>
          <span className="text-ink-2">Coach: </span>
          <span className="tabular text-ink">{best ? 'bästa draget!' : `${evFmt.format(-j.diff)} EV`}</span>
        </span>
        {showCards && (
          <span className="flex items-center gap-1.5 rounded-full bg-gold-soft px-1.5 py-[2px]">
            <span className="text-[10.5px] font-extrabold text-gold">★ Bästa</span>
            <BestMove j={j} />
          </span>
        )}
      </span>
      <span className="text-[14px] text-ink-3" aria-hidden="true">›</span>
    </button>
  );
}

export function CoachSheet({
  entry,
  onClose,
  onRecheck,
  rechecking,
}: {
  entry: CoachEntry | null;
  onClose: () => void;
  onRecheck?: (e: CoachEntry) => void;
  rechecking?: boolean;
}) {
  const j = entry?.j;
  return (
    <BottomSheet open={!!j} onClose={onClose} title="Coach">
      {entry && j && (
        <div key={entry.key} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <GradeBadge grade={j.grade} size={44} />
            <div className="min-w-0 flex-1">
              <div className="title-serif text-[20px]">
                {GRADE_LABEL[j.grade]}
                {isBest(j) ? '!' : ''}
              </div>
              <div className="text-[12px] font-semibold text-ink-3">
                Hand {entry.hand} · {entry.fl ? 'Fantasy Land' : entry.round === 1 ? 'Öppningshand' : `Runda ${entry.round}`}
                {!isBest(j) && <> · {evFmt.format(-j.diff)} EV</>}
              </div>
            </div>
          </div>
          <ReviewBoard key={entry.thorough ? 't' : 'n'} board={entry.board} move={entry.move} judgement={j} maxCardWidth={60} />
          {!entry.fl &&
            (entry.thorough ? (
              <div className="self-start rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] font-bold text-accent-ink">✓ Noggrann (2000 sim, ditt drag låst)</div>
            ) : (
              onRecheck && (
                <button
                  type="button"
                  disabled={rechecking}
                  onClick={() => {
                    haptic(6);
                    onRecheck(entry);
                  }}
                  className="btn-ghost flex h-11 items-center justify-center gap-2 rounded-full text-[13.5px] font-bold disabled:opacity-80"
                >
                  {rechecking ? (
                    <>
                      <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
                      Räknar noggrant… (kan ta upp till 45 s)
                    </>
                  ) : (
                    <>Räkna om noggrant (2000 sim)</>
                  )}
                </button>
              )
            ))}
          {!entry.thorough && !entry.fl && <p className="-mt-1 px-1 text-[11px] text-ink-3">Coachen räknar på Normal (800 sim). Noggrann ger säkrare EV.</p>}
          {j.screened && (
            <p className="rounded-[14px] bg-fl-soft px-3 py-2 text-[11.5px] font-semibold leading-snug text-fl">
              ⓘ Solvern sållade bort ditt drag tidigt, så dess EV är osäkrare och kan vara lite för låg.
            </p>
          )}
          {j.missing && (
            <p className="rounded-[14px] bg-fl-soft px-3 py-2 text-[11.5px] font-semibold leading-snug text-fl">
              ⓘ Draget fanns inte bland solverns topp 15 — EV visas som det sämsta alternativet.
            </p>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

/** En prick per bedömt drag i handen — tryck för att se draget i arket */
export function CoachDots({ entries, onOpen }: { entries: CoachEntry[]; onOpen: (e: CoachEntry) => void }) {
  const judged = entries.filter((e) => e.j);
  if (!judged.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-bold text-ink-3">Dina drag:</span>
      {judged.map((e) => (
        <button key={e.key} type="button" aria-label={`Se drag, runda ${e.round}`} onClick={() => onOpen(e)} className="transition-transform duration-200 active:scale-90">
          <GradeBadge grade={e.j!.grade} size={20} />
        </button>
      ))}
    </div>
  );
}

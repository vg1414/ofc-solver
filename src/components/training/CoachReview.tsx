// ============================================================
// CoachReview.tsx — Coachens bedömning: bricka + ark med bästa draget
// ============================================================
//  - CoachPill: liten bricka efter varje drag. Var draget inte bäst
//    visas solverns drag direkt som minikort med rad (T/M/B), och ett
//    tryck öppnar arket.
//  - CoachSheet: ark med betyg, EV och brädet där man växlar mellan
//    "Ditt drag" och "Bästa draget" (samma ReviewBoard som Scenarion).
//    Knappen "Räkna om noggrant" kör om draget på Noggrann nivå.
//  - MoveReviewSheet: själva arket (används även av Scenarion/Joker),
//    med MoveExplain = regelbaserad förklaring (explain.ts).
//  - CoachDots: en prick per bedömt drag i handen, tryck för att se det.
// ============================================================

import type { Board, RowName } from '../../engine/types';
import type { SolverInput } from '../../hooks/useSolver';
import { GRADE_LABEL, type Judgement, type Move } from '../../training/moves';
import { explainMove, type Slot } from '../../training/explain';
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
  saved,
  onToggleSave,
}: {
  entry: CoachEntry | null;
  onClose: () => void;
  onRecheck?: (e: CoachEntry) => void;
  rechecking?: boolean;
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  return (
    <MoveReviewSheet
      open={!!entry?.j}
      onClose={onClose}
      itemKey={entry?.key ?? ''}
      subtitle={entry ? `Hand ${entry.hand} · ${entry.fl ? 'Fantasy Land' : entry.round === 1 ? 'Öppningshand' : `Runda ${entry.round}`}` : ''}
      board={entry?.board}
      move={entry?.move}
      j={entry?.j ?? null}
      fl={entry?.fl}
      thorough={entry?.thorough ? '✓ Noggrann (2000 sim, ditt drag låst)' : undefined}
      onRecheck={entry && onRecheck ? () => onRecheck(entry) : undefined}
      rechecking={rechecking}
      saved={saved}
      onToggleSave={onToggleSave}
    />
  );
}

/**
 * Ark för ett bedömt drag: betyg, brädet (ditt drag / bästa draget),
 * förklaringen och ev. "Räkna om noggrant". Används av coachen i Hel hand
 * och av draglistan i Scenarion/Joker.
 */
export function MoveReviewSheet({
  open,
  onClose,
  itemKey,
  subtitle,
  board,
  move,
  j,
  fl = false,
  thorough,
  onRecheck,
  rechecking,
  extra,
  saved = false,
  onToggleSave,
  title = 'Coach',
  loading,
  action,
}: {
  open: boolean;
  onClose: () => void;
  itemKey: string;
  subtitle: string;
  board?: Board;
  move?: Move;
  j: Judgement | null;
  fl?: boolean;
  /** Text när draget redan är räknat på Noggrann nivå */
  thorough?: string;
  onRecheck?: () => void;
  rechecking?: boolean;
  /** T.ex. motståndarens bräde ovanför ditt */
  extra?: React.ReactNode;
  /** ☆ Spara för analys (savedMoves.ts) */
  saved?: boolean;
  onToggleSave?: () => void;
  /** Ersätter titeln "Coach" */
  title?: string;
  /** Bedömningen räknas (j saknas än): visa en snurra i arket */
  loading?: React.ReactNode;
  /** Knapp uppe till höger, t.ex. dela läget som bild */
  action?: React.ReactNode;
}) {
  return (
    <BottomSheet open={open && (!!j || !!loading)} onClose={onClose} title={title}>
      {!j && loading}
      {board && move && j && (
        <div key={itemKey} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <GradeBadge grade={j.grade} size={44} />
            <div className="min-w-0 flex-1">
              <div className="title-serif text-[20px]">
                {GRADE_LABEL[j.grade]}
                {isBest(j) ? '!' : ''}
              </div>
              <div className="text-[12px] font-semibold text-ink-3">
                {subtitle}
                {!isBest(j) && <> · {evFmt.format(-j.diff)} EV</>}
              </div>
            </div>
            {action}
          </div>
          {extra}
          <ReviewBoard key={thorough ? 't' : 'n'} board={board} move={move} judgement={j} maxCardWidth={60} />
          <MoveExplain move={move} j={j} fl={fl} />
          {!fl &&
            (thorough ? (
              <div className="self-start rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] font-bold text-accent-ink">{thorough}</div>
            ) : (
              onRecheck && (
                <button
                  type="button"
                  disabled={rechecking}
                  onClick={() => {
                    haptic(6);
                    onRecheck();
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
          {!thorough && !fl && <p className="-mt-1 px-1 text-[11px] text-ink-3">Coachen räknar på Normal (800 sim). Noggrann ger säkrare EV.</p>}
          {onToggleSave && <SaveButton saved={saved} onToggle={onToggleSave} />}
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

/** ☆ Spara för analys / ★ Sparad */
export function SaveButton({ saved, onToggle, removeLabel = '★ Sparad · tryck för att ta bort' }: { saved: boolean; onToggle: () => void; removeLabel?: string }) {
  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => {
        haptic(saved ? 4 : [6, 30, 6]);
        onToggle();
      }}
      className={`flex h-11 items-center justify-center gap-2 rounded-full text-[13.5px] font-bold transition-transform duration-200 active:scale-[0.98] ${
        saved ? 'bg-gold-soft text-gold shadow-[inset_0_0_0_1px_var(--gold-line)]' : 'btn-ghost'
      }`}
    >
      {saved ? removeLabel : '☆ Spara för analys'}
    </button>
  );
}

const SLOT_LABEL: Record<Slot, string> = { top: 'Topp', middle: 'Mitten', bottom: 'Botten', discard: 'Kastas' };

/** "Varför?" — vilka kort som ligger olika + foul-risk/FL-chans + slutsats (explain.ts) */
export function MoveExplain({ move, j, fl = false }: { move: Move; j: Judgement; fl?: boolean }) {
  const ex = explainMove(move, j, fl);
  return (
    <div className="flex flex-col gap-2 rounded-[18px] bg-sunken/70 px-3 py-2.5">
      <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Varför?</div>
      {ex.diffs.length > 0 && (
        <div className="flex flex-col gap-1">
          {ex.diffs.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-[12px] font-semibold">
              <PlayingCard card={d.card} width={22} compact />
              <span className="text-ink-2">
                Du: <b className="text-ink">{SLOT_LABEL[d.mine]}</b>
              </span>
              <span className="text-ink-3" aria-hidden="true">→</span>
              <span className="text-gold">
                ★ Bästa: <b>{SLOT_LABEL[d.best]}</b>
              </span>
            </div>
          ))}
        </div>
      )}
      {ex.lines.map((l, i) => (
        <p key={i} className="text-[12px] leading-snug text-ink-2">
          {l}
        </p>
      ))}
      <p className="text-[12.5px] font-bold leading-snug text-ink">{ex.verdict}</p>
    </div>
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

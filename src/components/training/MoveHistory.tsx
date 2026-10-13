// ============================================================
// MoveHistory.tsx — Lista över dina tidigare drag (Träna-fliken)
// ============================================================
// Lodrät lista, grupperad (per hand i Hel hand), senaste överst.
// Varje rad: betygsbricka, vilken runda, korten du la (T/M/B) och
// EV-förlusten. Ett tryck öppnar arket med brädet, bästa draget och
// förklaringen. Drag som coachen fortfarande räknar på visas med en
// pulserande prick ("räknar…").
// ☆/★ längst till höger markerar draget för analys senare (savedMoves.ts).
// hideGrades: inga betyg (Hel hand utan coach, Spela) — då går raden
// inte att öppna, men den kan fortfarande stjärnmärkas.
// Placeras av DockLayout: högerkolumnen på bred skärm, under brädena
// på stående telefon.
// ============================================================

import type { RowName } from '../../engine/types';
import type { Judgement, Move } from '../../training/moves';
import PlayingCard from '../cards/PlayingCard';
import { haptic } from '../cards/cardStyle';
import { GradeBadge } from './ScenarioFeedback';
import { evFmt } from './ReviewBoard';

export interface HistoryItem {
  key: string;
  /** Rubrik för gruppen, t.ex. "Hand 3" */
  group: string;
  label: string;
  move: Move;
  /** null = räknar fortfarande */
  j: Judgement | null;
  /** Fantasy Land: för många kort för raden — visa antal i stället */
  fl?: boolean;
}

const ROW_SHORT: Record<RowName, string> = { top: 'T', middle: 'M', bottom: 'B' };
const ROW_ORDER: RowName[] = ['top', 'middle', 'bottom'];

function MoveCards({ move }: { move: Move }) {
  const groups = ROW_ORDER.map((r) => ({ r, cards: move.placements.filter((p) => p.row === r).map((p) => p.card) })).filter((g) => g.cards.length);
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {groups.map((g) => (
        <span key={g.r} className="flex items-center gap-[2px]">
          <span className="text-[9.5px] font-extrabold text-ink-3">{ROW_SHORT[g.r]}</span>
          {g.cards.map((c, i) => (
            <PlayingCard key={i} card={c} width={18} compact />
          ))}
        </span>
      ))}
      {move.discards.length > 0 && (
        <span className="flex items-center gap-[2px] opacity-60">
          <span className="text-[9.5px] font-extrabold text-ink-3">✕</span>
          {move.discards.map((c, i) => (
            <PlayingCard key={i} card={c} width={18} compact />
          ))}
        </span>
      )}
    </span>
  );
}

interface MoveHistoryProps {
  items: HistoryItem[];
  onOpen?: (key: string) => void;
  empty?: string;
  /** Nycklar (HistoryItem.key) som är sparade */
  saved?: Set<string>;
  onToggleSave?: (key: string) => void;
  hideGrades?: boolean;
  title?: string;
  /** Rader utan bedömning går också att öppna ("analysera ›") — Sparade drag */
  openUnjudged?: boolean;
}

export default function MoveHistory({ items, onOpen, empty = 'Dina drag dyker upp här när du har lagt dem.', saved, onToggleSave, hideGrades = false, title = 'Dina drag', openUnjudged = false }: MoveHistoryProps) {
  // Grupper i den ordning de dök upp, sedan omvänt: senaste gruppen och senaste draget överst
  const groups: { name: string; items: HistoryItem[] }[] = [];
  for (const it of items) {
    const g = groups.find((x) => x.name === it.group);
    if (g) g.items.push(it);
    else groups.push({ name: it.group, items: [it] });
  }
  groups.reverse();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-1">
        <span className="eyebrow">{title}</span>
        {items.length > 0 && (
          <span className="text-[10.5px] font-semibold text-ink-3">{hideGrades ? '☆ = spara för analys' : 'tryck för bästa draget · ☆ spara'}</span>
        )}
      </div>
      {items.length === 0 && <p className="px-1 text-[12px] text-ink-3">{empty}</p>}
      {groups.map((g) => (
        <div key={g.name} className="flex flex-col gap-1">
          <div className="px-1 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">{g.name}</div>
          {[...g.items].reverse().map((it) => {
            const j = hideGrades ? null : it.j;
            const best = j && j.diff <= 0.0001;
            const isSaved = !!saved?.has(it.key);
            return (
              <div key={it.key} className="flex items-stretch gap-1 rounded-[16px] bg-surface/80 shadow-[var(--shadow-soft)] animate-fade-in">
                <button
                  type="button"
                  disabled={(!j && !openUnjudged) || !onOpen}
                  onClick={() => {
                    haptic(4);
                    onOpen?.(it.key);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[16px] py-1.5 pl-2 text-left transition-transform duration-200 active:scale-[0.98] disabled:active:scale-100"
                >
                  {hideGrades ? null : j ? (
                    <GradeBadge grade={j.grade} size={26} />
                  ) : openUnjudged ? (
                    <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-sunken text-[12px] text-ink-3">?</span>
                  ) : (
                    <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-sunken">
                      <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[11.5px] font-bold text-ink-2">{it.label}</span>
                    {it.fl ? <span className="text-[11px] text-ink-3">{it.move.placements.length} kort lagda</span> : <MoveCards move={it.move} />}
                  </span>
                  {!hideGrades && (
                    <span className="shrink-0 text-right text-[12px] font-extrabold tabular">
                      {!j ? <span className="font-semibold text-ink-3">{openUnjudged ? 'analysera' : 'räknar…'}</span> : best ? <span className="text-accent-ink">bästa</span> : <span className="text-ink">{evFmt.format(-j.diff)}</span>}
                    </span>
                  )}
                  {(j || openUnjudged) && <span className="text-[14px] text-ink-3" aria-hidden="true">›</span>}
                </button>
                {onToggleSave && (
                  <button
                    type="button"
                    aria-label={isSaved ? 'Ta bort från sparade' : 'Spara draget för analys'}
                    aria-pressed={isSaved}
                    onClick={() => {
                      haptic(isSaved ? 4 : [6, 30, 6]);
                      onToggleSave(it.key);
                    }}
                    className={`flex w-10 shrink-0 items-center justify-center rounded-[16px] text-[19px] transition-transform duration-200 active:scale-90 ${isSaved ? 'text-gold' : 'text-ink-3'}`}
                  >
                    <span key={String(isSaved)} className={isSaved ? 'animate-grade-pop' : ''}>
                      {isSaved ? '★' : '☆'}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

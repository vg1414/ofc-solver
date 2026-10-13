// ============================================================
// BoardView.tsx — Ett OFC-bräde (Topp 3 / Mitt 5 / Botten 5)
// ============================================================
//
// Interaktion:
//  - Är ett kort valt ("lyft") andas alla lediga platser i grönt.
//    Tryck på en plats → kortet läggs där. Tryck någonstans på raden
//    → kortet läggs på radens första lediga plats (stora tumvänliga mål).
//  - Dra-och-släpp: raderna och platserna är släppytor (data-drop-*).
//  - Tryck på ett lagt kort → det "beväpnas" (skakar + rött ✕).
//    Tryck igen inom 2,5 s → kortet tas bort. Skyddar mot feltryck.
//  - Spökkort: solverns förslag visas genomskinligt med streckad ram.
//
// Kortstorlek: brädet är en "container" och kortbredden räknas ut från
// brädets egen bredd (cqw), så 5 kort alltid får plats — oavsett skärm.
// ============================================================

import { useEffect, useState } from 'react';
import type { Board, Card, RowName } from '../../engine/types';
import type { CardPlacement } from '../../solver/solver';
import { calcAllRoyalties, calcRowRoyalty5, calcTopRoyalty } from '../../engine/royalties';
import PlayingCard from '../cards/PlayingCard';
import { useDragContext } from '../dnd/useDraggable';
import { haptic } from '../cards/cardStyle';

const ROWS: { name: RowName; label: string }[] = [
  { name: 'top', label: 'Topp' },
  { name: 'middle', label: 'Mitt' },
  { name: 'bottom', label: 'Botten' },
];

const filledOf = (cards: (Card | null)[]) => cards.filter((c): c is Card => c !== null);

function liveRoyalty(board: Board, row: RowName): number {
  const t = filledOf(board.top.cards), m = filledOf(board.middle.cards), b = filledOf(board.bottom.cards);
  // Fullt bräde: jokrarna väljs för hela brädet (som i poängräkningen)
  if (t.length === 3 && m.length === 5 && b.length === 5) return calcAllRoyalties(t, m, b)[row];
  const filled = filledOf(board[row].cards);
  if (row === 'top') return filled.length === 3 ? calcTopRoyalty(filled) : 0;
  return filled.length === 5 ? calcRowRoyalty5(filled, row) : 0;
}

interface BoardViewProps {
  board: Board;
  /** Kortet som är lyft och väntar på att placeras */
  heldCard?: Card | null;
  /** Kan man lägga kort här (aktivt bräde)? */
  interactive?: boolean;
  onPlace?: (row: RowName, slot: number) => void;
  onRemove?: (row: RowName, slot: number) => void;
  /** Får just detta kort tas bort? (utelämnas → alla kort, om onRemove finns) */
  canRemove?: (row: RowName, slot: number) => boolean;
  ghosts?: CardPlacement[];
  fouled?: boolean;
  /** Visa royalties per rad (beräknas live när raden är full) */
  showRoyalties?: boolean;
  /** Handen är klar: visa bara den royalty som tjänades in per rad (rader man förlorade visar inget) */
  earnedRoyalties?: Record<RowName, number>;
  /** Max kortbredd i px */
  maxCardWidth?: number;
}

export default function BoardView({
  board,
  heldCard = null,
  interactive = false,
  onPlace,
  onRemove,
  canRemove,
  ghosts = [],
  fouled = false,
  showRoyalties = true,
  earnedRoyalties,
  maxCardWidth = 64,
}: BoardViewProps) {
  const drag = useDragContext();
  const [armed, setArmed] = useState<{ row: RowName; slot: number } | null>(null);
  const dragging = interactive && !!drag?.dragging;
  const placing = interactive && (!!heldCard || dragging);

  // Avväpna automatiskt efter en stund
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(null), 2500);
    return () => window.clearTimeout(t);
  }, [armed]);

  const tapCard = (row: RowName, slot: number) => {
    if (!onRemove || (canRemove && !canRemove(row, slot))) return;
    if (armed?.row === row && armed.slot === slot) {
      onRemove(row, slot);
      setArmed(null);
      haptic(12);
    } else {
      setArmed({ row, slot });
      haptic(4);
    }
  };

  const tapRow = (row: RowName) => {
    if (!placing || !heldCard || !onPlace) return;
    const free = board[row].cards.findIndex((c) => c === null);
    if (free >= 0) onPlace(row, free);
  };

  return (
    <div className="@container w-full" style={{ containerType: 'inline-size' }}>
      <div
        className={`felt flex flex-col gap-[calc(var(--card-w)*0.12)] rounded-[26px] p-3 sm:p-4 ${fouled ? 'felt-row fouled' : ''}`}
        style={{ '--card-w': `min(${maxCardWidth}px, calc((100cqw - 84px) / 5 - 5px), var(--card-h-cap, 999px))` } as React.CSSProperties}
      >
        {ROWS.map(({ name, label }) => {
          const cards = board[name].cards;
          const hasFree = cards.some((c) => c === null);
          const isOverRow = dragging && drag?.over?.row === name;
          const roy = !showRoyalties ? 0 : earnedRoyalties ? earnedRoyalties[name] : liveRoyalty(board, name);

          return (
            <div
              key={name}
              data-drop-row={interactive ? name : undefined}
              onClick={() => tapRow(name)}
              className={`flex items-center gap-1.5 rounded-[16px] -mx-1.5 px-1.5 py-1 transition-colors duration-200 ${
                isOverRow && hasFree ? 'bg-[rgba(255,214,120,0.18)]' : ''
              } ${placing && hasFree && heldCard ? 'cursor-pointer' : ''}`}
            >
              {/* Etikett */}
              <div className="w-[50px] shrink-0 flex flex-col items-start leading-tight">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[color:var(--felt-label)]">{label}</span>
                {roy > 0 && (
                  <span className="mt-1 text-[12px] font-extrabold text-gold tabular animate-badge-in">+{roy}p</span>
                )}
              </div>

              {/* Platser */}
              <div className="flex gap-[calc(var(--card-w)*0.09)]">
                {cards.map((card, i) => {
                  const ghost = !card ? ghosts.find((g) => g.row === name && g.slotIndex === i) : undefined;
                  const isOverSlot = isOverRow && drag?.over?.slot === i && !card;
                  const isArmed = armed?.row === name && armed.slot === i;

                  if (card) {
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-label={isArmed ? 'Tryck igen för att ta bort kortet' : 'Ta bort kort'}
                        onClick={(e) => {
                          e.stopPropagation();
                          tapCard(name, i);
                        }}
                        className={`relative rounded-[calc(var(--card-w)*0.14)] transition-transform duration-200 active:scale-95 ${isArmed ? 'animate-wiggle' : ''}`}
                        disabled={!onRemove || (canRemove ? !canRemove(name, i) : false)}
                      >
                        <PlayingCard card={card} snap />
                        {isArmed && (
                          <span className="absolute inset-0 flex items-center justify-center rounded-[calc(var(--card-w)*0.14)] bg-[rgba(208,68,63,0.78)] text-white text-xl font-bold backdrop-blur-[1px] animate-badge-in">
                            ✕
                          </span>
                        )}
                      </button>
                    );
                  }

                  return (
                    <div
                      key={i}
                      data-drop-row={interactive ? name : undefined}
                      data-drop-slot={interactive ? i : undefined}
                      onClick={(e) => {
                        if (!placing || !heldCard || !onPlace) return;
                        e.stopPropagation();
                        onPlace(name, i);
                      }}
                      className={`slot relative w-[var(--card-w)] h-[calc(var(--card-w)*1.4)] ${isOverSlot ? 'over' : placing ? 'target' : ''}`}
                    >
                      {ghost && !placing && <PlayingCard card={ghost.card} ghost className="absolute inset-0" />}
                      {placing && !isOverSlot && (
                        <span className="absolute inset-0 flex items-center justify-center text-[#d4900f] text-xl font-light" aria-hidden>
                          +
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

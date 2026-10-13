// ============================================================
// BoardView.tsx — Ett OFC-bräde (Toppen 3 / Mitten 5 / Botten 5)
// ============================================================
//
// Interaktion:
//  - Är ett kort valt ("lyft") andas alla lediga platser i grönt.
//    Tryck på en plats → kortet läggs där. Tryck någonstans på raden
//    → kortet läggs på radens första lediga plats (stora tumvänliga mål).
//  - Dra-och-släpp: raderna och platserna är släppytor (data-drop-*).
//  - Tryck på ett lagt kort → det "beväpnas" (skakar + rött ✕).
//    Tryck igen inom 2,5 s → kortet tas bort. Skyddar mot feltryck.
//  - Ett lagt kort (som får tas bort) kan också dras: till en ledig plats
//    = flytta, till ett annat flyttbart kort = byt plats, utanför brädet
//    = ta bort. Själva flytten görs av DragProviderns onDrop.
//  - Spökkort: solverns förslag visas genomskinligt med streckad ram.
//  - `recent`: kort från senaste draget får en streckad ram (men syns
//    som vanligt), så att man ser vilka kort som just lades.
//
// Kortstorlek: brädet är en "container" och kortbredden räknas ut från
// brädets egen bredd (cqw), så 5 kort alltid får plats — oavsett skärm.
// ============================================================

import { useEffect, useState } from 'react';
import type { Board, Card, RowName } from '../../engine/types';
import type { CardPlacement } from '../../solver/solver';
import { calcAllRoyalties, calcRowRoyalty5, calcTopRoyalty } from '../../engine/royalties';
import PlayingCard from '../cards/PlayingCard';
import { useDraggable, useDragContext } from '../dnd/useDraggable';
import { haptic } from '../cards/cardStyle';

const ROWS: { name: RowName; label: string }[] = [
  { name: 'top', label: 'Toppen' },
  { name: 'middle', label: 'Mitten' },
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

/** Ett lagt kort: tryck två gånger för att ta bort, eller dra för att flytta */
function PlacedCard({
  card,
  row,
  slot,
  armed,
  removable,
  hidden,
  swapTarget,
  recent,
  onTap,
}: {
  card: Card;
  row: RowName;
  slot: number;
  armed: boolean;
  removable: boolean;
  /** Kortet dras just nu (visas svagt på sin gamla plats) */
  hidden: boolean;
  /** Ett annat kort svävar här → släpp för att byta plats */
  swapTarget: boolean;
  /** Lagt i senaste draget (streckad ram) */
  recent: boolean;
  onTap: () => void;
}) {
  const drag = useDraggable(removable ? card : null, onTap, !removable, { row, slot });
  return (
    <button
      type="button"
      aria-label={armed ? 'Tryck igen för att ta bort kortet' : 'Ta bort kort'}
      data-drop-row={removable ? row : undefined}
      data-drop-filled={removable ? slot : undefined}
      {...drag}
      onClick={(e) => {
        // Klicket får inte bubbla till raden (den lägger annars ett lyft kort där)
        e.stopPropagation();
        drag.onClick(e);
      }}
      style={removable ? drag.style : undefined}
      className={`relative rounded-[calc(var(--card-w)*0.14)] transition-[transform,opacity,box-shadow] duration-200 active:scale-95 ${armed ? 'animate-wiggle' : ''} ${
        hidden ? 'opacity-30' : ''
      } ${swapTarget ? 'scale-[1.06] shadow-[0_0_0_2.5px_#e8a828,0_0_16px_rgba(245,184,61,0.6)]' : ''}`}
      disabled={!removable}
    >
      <PlayingCard card={card} snap recent={recent} />
      {armed && (
        <span className="absolute inset-0 flex items-center justify-center rounded-[calc(var(--card-w)*0.14)] bg-[rgba(208,68,63,0.78)] text-white text-xl font-bold backdrop-blur-[1px] animate-badge-in">
          ✕
        </span>
      )}
    </button>
  );
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
  /** Platser som fylldes i senaste draget (streckad ram) */
  recent?: { row: RowName; slot: number }[];
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
  recent,
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
        data-drop-board={interactive ? '' : undefined}
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
                    const removable = interactive && !!onRemove && (canRemove ? canRemove(name, i) : true);
                    const isSource = dragging && drag?.source?.row === name && drag.source.slot === i;
                    return (
                      <PlacedCard
                        key={i}
                        card={card}
                        row={name}
                        slot={i}
                        armed={isArmed}
                        removable={removable}
                        hidden={isSource}
                        swapTarget={removable && !!drag?.source && !isSource && isOverRow && drag?.over?.filled === i}
                        recent={!!recent?.some((r) => r.row === name && r.slot === i)}
                        onTap={() => tapCard(name, i)}
                      />
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

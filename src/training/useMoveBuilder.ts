// ============================================================
// useMoveBuilder.ts — Bygg ditt drag: tryck kort → tryck rad, eller dra
// ============================================================
//
// Håller reda på korten i handen och vilka av dem du lagt ut i detta
// drag. Varje kort i handen får ett id (0, 1, 2 …) så att två jokrar
// går att skilja åt. Brädet som visas = grundbrädet + dina placeringar.
//
//  - tapHand(i)        lyft/sänk kort i handen
//  - placeAt(row,slot) lägg det lyfta kortet
//  - drop(card, mål)   dra-och-släpp: första kortet i handen som matchar.
//                      Med `source` är det ett lagt kort som dras: till en
//                      ledig plats = flytta, på ett annat eget kort = byt
//                      plats, utanför brädet eller till handen = ta tillbaka
//  - remove(row,slot)  ta tillbaka ett kort du lagt i detta drag
//  - reset()           ta tillbaka alla
// Draget är klart när `place` kort ligger ute. Kort som blir kvar i
// handen kastas (Pineapple: 1 av 3, Fantasy Land: allt utöver 13).
// ============================================================

import { useCallback, useMemo, useState } from 'react';
import type { Board, Card, RowName } from '../engine/types';
import type { BoardSlot, DropTarget } from '../components/dnd/dragCore';
import { haptic, sameCard } from '../components/cards/cardStyle';
import { cloneBoard, type Move } from './moves';

interface Placed {
  id: number;
  row: RowName;
  slot: number;
}

export function useMoveBuilder(base: Board, hand: Card[], place: number) {
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [chosen, setHeld] = useState<number | null>(null);

  const board = useMemo(() => {
    const b = cloneBoard(base);
    for (const p of placed) b[p.row].cards[p.slot] = hand[p.id];
    return b;
  }, [base, hand, placed]);

  /** Kort kvar i handen, med sina id */
  const remaining = useMemo(
    () => hand.map((card, id) => ({ card, id })).filter((h) => !placed.some((p) => p.id === h.id)),
    [hand, placed],
  );

  const done = placed.length >= place;
  // Bara ett kort kvar att lägga och inget val om vilket → det är redan lyft,
  // så man kan trycka direkt på en rad (vanlig OFC efter öppningen)
  const auto = !done && remaining.length === 1 ? remaining[0].id : null;
  const held = chosen !== null && remaining.some((r) => r.id === chosen) ? chosen : auto;
  const heldCard = held !== null ? hand[held] : null;

  const put = useCallback(
    (id: number, row: RowName, slot: number) => {
      if (placed.length >= place || placed.some((p) => p.id === id)) return false;
      if (board[row].cards[slot] !== null) return false;
      setPlaced((ps) => [...ps, { id, row, slot }]);
      setHeld(null);
      haptic(12);
      return true;
    },
    [board, placed, place],
  );

  const tapHand = useCallback(
    (index: number) => {
      const h = remaining[index];
      if (!h) return;
      haptic(5);
      // Det automatiskt lyfta kortet (enda kortet) går inte att sänka
      if (h.id === auto) return;
      setHeld((cur) => (cur === h.id ? null : h.id));
    },
    [remaining, auto],
  );

  const placeAt = useCallback(
    (row: RowName, slot: number) => {
      if (held !== null) put(held, row, slot);
    },
    [held, put],
  );

  /** Flytta ett lagt kort (se drop) */
  const moveCard = useCallback(
    (from: BoardSlot, t: DropTarget | null) => {
      const p = placed.find((x) => x.row === from.row && x.slot === from.slot);
      if (!p) return false;
      // Utanför brädet eller tillbaka till handen → ta bort
      if (!t || (!t.row && !t.board)) {
        setPlaced((ps) => ps.filter((x) => x !== p));
        haptic(12);
        return true;
      }
      if (!t.row) return false; // mellan raderna: inget händer
      const row = t.row;
      if (t.filled !== undefined) {
        if (row === from.row && t.filled === from.slot) return false;
        const q = placed.find((x) => x.row === row && x.slot === t.filled);
        if (q) {
          // Två egna kort byter plats
          setPlaced((ps) => ps.map((x) => (x === p ? { ...x, row, slot: q.slot } : x === q ? { ...x, row: from.row, slot: from.slot } : x)));
          haptic(12);
          return true;
        }
      }
      // Ledig plats: den man siktade på, annars radens första lediga
      const slot = t.slot ?? board[row].cards.findIndex((c) => c === null);
      if (slot < 0) {
        haptic([4, 30, 4]);
        return false;
      }
      setPlaced((ps) => ps.map((x) => (x === p ? { ...x, row, slot } : x)));
      haptic(12);
      return true;
    },
    [board, placed],
  );

  const drop = useCallback(
    (card: Card, t: DropTarget | null, source?: BoardSlot) => {
      if (source) return moveCard(source, t);
      if (!t?.row) return false;
      const row = t.row;
      // Föredra det lyfta kortet om det är samma (två jokrar)
      const h = (held !== null && sameCard(hand[held], card) && remaining.find((r) => r.id === held)) || remaining.find((r) => sameCard(r.card, card));
      if (!h) return false;
      const slot = t.slot ?? board[row].cards.findIndex((c) => c === null);
      if (slot < 0) {
        haptic([4, 30, 4]);
        return false;
      }
      return put(h.id, row, slot);
    },
    [board, hand, held, put, remaining, moveCard],
  );

  const isMine = useCallback((row: RowName, slot: number) => placed.some((p) => p.row === row && p.slot === slot), [placed]);

  const remove = useCallback((row: RowName, slot: number) => {
    setPlaced((ps) => ps.filter((p) => !(p.row === row && p.slot === slot)));
  }, []);

  const reset = useCallback(() => {
    setPlaced([]);
    setHeld(null);
  }, []);

  const move: Move = useMemo(
    () => ({
      placements: placed.map((p) => ({ card: hand[p.id], row: p.row, slotIndex: p.slot })),
      discards: remaining.map((r) => r.card),
    }),
    [placed, hand, remaining],
  );

  const heldIndex = held !== null ? remaining.findIndex((r) => r.id === held) : -1;

  return { hand, board, remaining, heldCard, heldIndex, placedCount: placed.length, done, move, tapHand, placeAt, drop, remove, isMine, reset };
}

export type MoveBuilder = ReturnType<typeof useMoveBuilder>;

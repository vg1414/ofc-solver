// ============================================================
// useRecentSlots.ts — Vilka kort lades i varje spelares senaste drag?
// ============================================================
//
// Brädena är oföränderliga objekt: varje drag ger ett nytt Board.
// Hooken minns förra brädet per plats, och när ett bräde byts ut
// jämförs de: platser som var tomma förut men har ett kort nu är
// "senaste draget". De ligger kvar tills samma spelare gör nästa drag.
// Ny hand (handNo) → allt nollställs. Fantasy Land (13+ kort på en
// gång) markeras inte — då skulle hela brädet bli streckat.
// Används för streckade kort på brädet (BoardView `recent`) och på
// dela-bilden.
// ============================================================

import { useState } from 'react';
import type { Board, RowName } from '../engine/types';
import { ROWS } from './moves';

export type RecentSlot = { row: RowName; slot: number };

/** Platser som är fyllda i `after` men tomma i `before` */
export function newSlots(before: Board, after: Board): RecentSlot[] {
  const out: RecentSlot[] = [];
  for (const row of ROWS) after[row].cards.forEach((c, slot) => c && !before[row].cards[slot] && out.push({ row, slot }));
  return out;
}

const FL_MIN = 13;

export function useRecentSlots(handNo: number, boards: [Board, Board]): [RecentSlot[], RecentSlot[]] {
  const [st, setSt] = useState({ hand: handNo, boards, recent: [[], []] as [RecentSlot[], RecentSlot[]] });
  // Justera state när brädena byts (Reacts mönster för "state som följer props")
  if (st.hand !== handNo) {
    setSt({ hand: handNo, boards, recent: [[], []] });
  } else if (st.boards[0] !== boards[0] || st.boards[1] !== boards[1]) {
    const recent = [0, 1].map((s) => {
      if (st.boards[s] === boards[s]) return st.recent[s];
      const n = newSlots(st.boards[s], boards[s]);
      return n.length >= FL_MIN ? [] : n;
    }) as [RecentSlot[], RecentSlot[]];
    setSt({ hand: handNo, boards, recent });
  }
  return st.hand === handNo ? st.recent : [[], []];
}

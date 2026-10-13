// ============================================================
// useRecentSlots.ts — Senaste draget och öppningshanden per spelare
// ============================================================
//
// Brädena är oföränderliga objekt: varje drag ger ett nytt Board.
// Hooken minns förra brädet per plats, och när ett bräde byts ut
// jämförs de: platser som var tomma förut men har ett kort nu är
// det draget som just gjordes.
//  - recent:  senaste draget (streckad ram). Ligger kvar tills samma
//             spelare gör nästa drag. Öppningen markeras inte här.
//  - opening: öppningshandens platser (fast mörk ram), hela handen ut.
// Fantasy Land (alla kort på en gång) markeras inte alls.
// Ny hand (handNo) → allt nollställs.
// Används på brädet (BoardView `recent`/`opening`) och på dela-bilden.
// ============================================================

import { useState } from 'react';
import type { Board, RowName } from '../engine/types';
import { ROWS, countPlaced } from './moves';

export type RecentSlot = { row: RowName; slot: number };
type Pair = [RecentSlot[], RecentSlot[]];

/** Platser som är fyllda i `after` men tomma i `before` */
export function newSlots(before: Board, after: Board): RecentSlot[] {
  const out: RecentSlot[] = [];
  for (const row of ROWS) after[row].cards.forEach((c, slot) => c && !before[row].cards[slot] && out.push({ row, slot }));
  return out;
}

const FL_MIN = 13;
const EMPTY: Pair = [[], []];

export function useRecentSlots(handNo: number, boards: [Board, Board]): { recent: Pair; opening: Pair } {
  const [st, setSt] = useState({ hand: handNo, boards, recent: EMPTY, opening: EMPTY });
  // Justera state när brädena byts (Reacts mönster för "state som följer props")
  if (st.hand !== handNo) {
    setSt({ hand: handNo, boards, recent: EMPTY, opening: EMPTY });
  } else if (st.boards[0] !== boards[0] || st.boards[1] !== boards[1]) {
    const recent = [...st.recent] as Pair;
    const opening = [...st.opening] as Pair;
    for (const s of [0, 1] as const) {
      if (st.boards[s] === boards[s]) continue;
      const n = newSlots(st.boards[s], boards[s]);
      const first = countPlaced(st.boards[s]) === 0;
      recent[s] = first ? [] : n;
      if (first) opening[s] = n.length >= FL_MIN ? [] : n;
    }
    setSt({ hand: handNo, boards, recent, opening });
  }
  return st.hand === handNo ? { recent: st.recent, opening: st.opening } : { recent: EMPTY, opening: EMPTY };
}

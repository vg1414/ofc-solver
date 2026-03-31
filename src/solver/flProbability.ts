// ============================================================
// flProbability.ts — Estimera sannolikhet att nå Fantasy Land
// ============================================================
//
// Givet ett bräde efter öppningshandens 5 kort (runda 1),
// estimerar vi sannolikheten att spelaren når Fantasy Land
// genom att simulera resterande 8 kort med Monte Carlo.
//
// Algoritm:
//   1. Bygg den okända leken (54 kort minus döda).
//   2. Shuffla och dra 8 kort (rundorna 2–9).
//   3. Kör greedyCompletion för att fylla brädet.
//   4. Kolla om topphanden kvalificerar för FL (QQ+ / triss).
//   5. Kolla att brädet inte är foul.
//   6. Räkna andelen lyckade simuleringar.
// ============================================================

import type { Card, Board } from '../engine/types';
import { buildDeck, removeDeadCards } from '../engine/deck';
import { getFantasyLandEntryCards } from '../engine/gameState';
import { isFoul } from '../engine/foulCheck';
import { greedyCompletion } from './heuristics';

/**
 * Räknar tomma slots på ett bräde.
 */
function countEmptySlots(board: Board): number {
  let count = 0;
  for (const rowName of ['top', 'middle', 'bottom'] as const) {
    count += board[rowName].cards.filter((c) => c === null).length;
  }
  return count;
}

/**
 * Fisher-Yates in-place shuffle.
 */
function shuffleInPlace(arr: Card[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

/**
 * Estimerar sannolikheten att ett bräde (efter öppningshanden)
 * når Fantasy Land efter att de resterande korten spelats ut.
 *
 * @param boardAfterOpening  Brädet efter att 5 öppningskort placerats
 * @param deadCards          Alla döda kort (inkl. de 5 öppningskorten)
 * @param sims               Antal Monte Carlo-simuleringar (default 200)
 * @returns                  Sannolikhet 0.0–1.0
 */
export function estimateFLProbability(
  boardAfterOpening: Board,
  deadCards: Card[],
  sims: number = 200,
): number {
  const neededCards = countEmptySlots(boardAfterOpening);

  // Om brädet redan är komplett (borde inte hända för öppningshand)
  if (neededCards === 0) {
    const topCards = boardAfterOpening.top.cards.filter(
      (c): c is Card => c !== null,
    );
    const middleCards = boardAfterOpening.middle.cards.filter(
      (c): c is Card => c !== null,
    );
    const bottomCards = boardAfterOpening.bottom.cards.filter(
      (c): c is Card => c !== null,
    );

    if (isFoul(topCards, middleCards, bottomCards)) return 0;
    return getFantasyLandEntryCards(topCards) > 0 ? 1 : 0;
  }

  // Bygg den okända leken
  const unknownDeck = removeDeadCards(buildDeck(), deadCards);

  if (unknownDeck.length < neededCards) {
    return 0;
  }

  let successCount = 0;

  for (let i = 0; i < sims; i++) {
    shuffleInPlace(unknownDeck);

    const drawnCards = unknownDeck.slice(0, neededCards);
    const completedBoard = greedyCompletion(boardAfterOpening, drawnCards, true);

    const topCards = completedBoard.top.cards.filter(
      (c): c is Card => c !== null,
    );
    const middleCards = completedBoard.middle.cards.filter(
      (c): c is Card => c !== null,
    );
    const bottomCards = completedBoard.bottom.cards.filter(
      (c): c is Card => c !== null,
    );

    // Måste ha komplett bräde
    if (topCards.length !== 3 || middleCards.length !== 5 || bottomCards.length !== 5) {
      continue;
    }

    // Kolla foul
    if (isFoul(topCards, middleCards, bottomCards)) {
      continue;
    }

    // Kolla FL-kvalificering
    if (getFantasyLandEntryCards(topCards) > 0) {
      successCount++;
    }
  }

  return successCount / sims;
}

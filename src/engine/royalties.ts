// ============================================================
// royalties.ts — Royalty-beräkning per rad (OFC hemspel-regler)
// ============================================================

import type { Card, RowName, RoyaltyResult } from './types';
import {
  BOTTOM_ROYALTIES,
  MIDDLE_ROYALTIES,
  TOP_PAIR_ROYALTIES,
  TOP_TRIPS_ROYALTIES,
} from './constants';
import { evaluate5, evaluate3 } from './handEval';

// ---------------------------------------------------------------
// Publikt API
// ---------------------------------------------------------------

/**
 * Beräknar royalties för bottom- eller middle-raden (5-kortshänder).
 * Returnerar 0 om handen inte kvalificerar.
 */
export function calcRowRoyalty5(
  cards: Card[],
  row: 'middle' | 'bottom',
): number {
  if (cards.length !== 5) return 0;

  const result = evaluate5(cards);
  const table = row === 'middle' ? MIDDLE_ROYALTIES : BOTTOM_ROYALTIES;
  return table[result.rank] ?? 0;
}

/**
 * Beräknar royalties för top-raden (3-kortshanden).
 * Ger poäng för par 66+ och triss 222–AAA.
 */
export function calcTopRoyalty(cards: Card[]): number {
  if (cards.length !== 3) return 0;

  const result = evaluate3(cards);

  if (result.rank === 'trips') {
    // tiebreakers[0] = rankindex för trissen (2–14)
    return TOP_TRIPS_ROYALTIES[result.tiebreakers[0]] ?? 0;
  }

  if (result.rank === 'pair') {
    // tiebreakers[0] = rankindex för paret
    return TOP_PAIR_ROYALTIES[result.tiebreakers[0]] ?? 0;
  }

  return 0;
}

/**
 * Beräknar alla royalties för ett komplett bräde.
 * Alla rader måste vara fyllda (3 + 5 + 5 kort).
 */
export function calcAllRoyalties(
  topCards: Card[],
  middleCards: Card[],
  bottomCards: Card[],
): RoyaltyResult {
  const top = calcTopRoyalty(topCards);
  const middle = calcRowRoyalty5(middleCards, 'middle');
  const bottom = calcRowRoyalty5(bottomCards, 'bottom');

  return {
    top,
    middle,
    bottom,
    total: top + middle + bottom,
  };
}

/**
 * Beräknar royalties för en enskild rad baserat på radnamn och kort.
 * Används av solvern för att estimera royalty-bidrag.
 */
export function calcRoyaltyForRow(cards: Card[], row: RowName): number {
  switch (row) {
    case 'top':
      return calcTopRoyalty(cards);
    case 'middle':
      return calcRowRoyalty5(cards, 'middle');
    case 'bottom':
      return calcRowRoyalty5(cards, 'bottom');
  }
}

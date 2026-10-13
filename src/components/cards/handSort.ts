// ============================================================
// handSort.ts — Sortera en stor hand (Fantasy Land) efter färg/värde
// ============================================================
// Sorteringen ändrar bara ORDNINGEN som korten visas i, inte handen
// själv. `sortOrder` ger en lista med index in i handen, så att ett
// tryck på kort nr i i den sorterade raden kan översättas tillbaka till
// rätt kort (order[i]). Ny hand börjar alltid osorterad.
//  - Färg:  jokrar först, sedan ♠ ♥ ♣ ♦ (svart/röd växlar), högst först
//  - Värde: jokrar först, sedan A K Q … 2, samma valör i färgordning
// Tryck på det valda läget igen → tillbaka till ordningen korten delades i.
// ============================================================

import type { Card, Suit } from '../../engine/types';
import { RANK_ORDER } from '../../engine/constants';

export type SortMode = 'dealt' | 'suit' | 'rank';

const SUIT_ORDER: Record<Suit, number> = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 };

const rankOf = (c: Card) => (c.kind === 'card' ? RANK_ORDER[c.rank] : 99);
const suitOf = (c: Card) => (c.kind === 'card' ? SUIT_ORDER[c.suit] : -1);

/** Index in i `cards` i den ordning de ska visas */
export function sortOrder(cards: Card[], mode: SortMode): number[] {
  const idx = cards.map((_, i) => i);
  if (mode === 'dealt') return idx;
  return idx.sort((a, b) => {
    const x = cards[a], y = cards[b];
    if (x.kind === 'joker' || y.kind === 'joker') return (x.kind === 'joker' ? 0 : 1) - (y.kind === 'joker' ? 0 : 1) || a - b;
    return mode === 'suit'
      ? suitOf(x) - suitOf(y) || rankOf(y) - rankOf(x)
      : rankOf(y) - rankOf(x) || suitOf(x) - suitOf(y);
  });
}

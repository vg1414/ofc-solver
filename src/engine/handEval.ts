// ============================================================
// handEval.ts — Pokerhandsvärdering (5-kort & 3-kort) med joker-stöd
// ============================================================
//
// Prestandakritiskt: denna funktion körs tusentals gånger i
// Monte Carlo-simuleringen. Undvik allokering där det är möjligt.
// ============================================================

import type { Card, RegularCard, HandResult } from './types';
import { RANK_ORDER, ALL_RANKS, ALL_SUITS, HAND_RANK_ORDER } from './constants';
import { isJoker, makeCard } from './card';

// ---------------------------------------------------------------
// Publikt API
// ---------------------------------------------------------------

/**
 * Värderar en 5-korts pokerhand (middle/bottom).
 * Hanterar 0–2 jokrar genom att testa alla identiteter som
 * maximerar handranken.
 */
export function evaluate5(cards: Card[]): HandResult {
  if (cards.length !== 5) {
    throw new Error(`evaluate5 förväntar 5 kort, fick ${cards.length}`);
  }
  return evaluateHand(cards, 5);
}

/**
 * Värderar en 3-korts hand (top-raden).
 * Giltiga kategorier: high_card, pair, trips, five_of_a_kind
 * (five_of_a_kind kan inte förekomma i 3-kort men trips kan).
 */
export function evaluate3(cards: Card[]): HandResult {
  if (cards.length !== 3) {
    throw new Error(`evaluate3 förväntar 3 kort, fick ${cards.length}`);
  }
  return evaluateHand(cards, 3);
}

/**
 * Jämför två HandResult. Returnerar:
 *  - negativt om a < b (a är svagare)
 *  - 0 om lika
 *  - positivt om a > b (a är starkare)
 */
export function compareHands(a: HandResult, b: HandResult): number {
  const rankDiff = HAND_RANK_ORDER[a.rank] - HAND_RANK_ORDER[b.rank];
  if (rankDiff !== 0) return rankDiff;

  // Tiebreaker: jämför kickers i ordning
  const len = Math.min(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < len; i++) {
    const diff = a.tiebreakers[i] - b.tiebreakers[i];
    if (diff !== 0) return diff;
  }
  return 0;
}

// ---------------------------------------------------------------
// Intern logik
// ---------------------------------------------------------------

/** Intern: evaluera hand med valfritt antal kort (3 eller 5) */
function evaluateHand(cards: Card[], size: 3 | 5): HandResult {
  const jokerIndices: number[] = [];
  const regularCards: RegularCard[] = [];

  for (let i = 0; i < cards.length; i++) {
    if (isJoker(cards[i])) {
      jokerIndices.push(i);
    } else {
      regularCards.push(cards[i] as RegularCard);
    }
  }

  if (jokerIndices.length === 0) {
    // Snabb väg: inga jokrar
    return size === 5 ? classify5(regularCards) : classify3(regularCards);
  }

  // Med jokrar: hitta bästa möjliga hand
  return bestWithWilds(regularCards, jokerIndices.length, size);
}

// ---------------------------------------------------------------
// Joker-logik: hitta bästa hand genom att testa identiteter
// ---------------------------------------------------------------

/**
 * Generera bästa möjliga hand med `wildcardCount` jokrar.
 *
 * Strategi: istället för att brute-forca alla 52^n kombinationer
 * begränsar vi sökningen till kort som faktiskt kan förbättra handen.
 * För varje joker testar vi alla 13 ranks × 4 suits = 52 kort.
 * Med max 2 jokrar = 52 × 52 = 2704 kombinationer — fullt hanterbart.
 */
function bestWithWilds(
  regularCards: RegularCard[],
  wildcardCount: number,
  size: 3 | 5,
): HandResult {
  let best: HandResult | null = null;

  const allCards: RegularCard[] = [];
  for (const suit of ALL_SUITS) {
    for (const rank of ALL_RANKS) {
      allCards.push(makeCard(rank, suit));
    }
  }

  if (wildcardCount === 1) {
    for (const w of allCards) {
      const hand = [...regularCards, w];
      const result = size === 5 ? classify5(hand) : classify3(hand);
      if (!best || compareHands(result, best) > 0) {
        best = result;
      }
    }
  } else if (wildcardCount === 2) {
    for (const w1 of allCards) {
      for (const w2 of allCards) {
        const hand = [...regularCards, w1, w2];
        const result = size === 5 ? classify5(hand) : classify3(hand);
        if (!best || compareHands(result, best) > 0) {
          best = result;
        }
      }
    }
  } else {
    throw new Error(`Max 2 jokrar stöds, fick ${wildcardCount}`);
  }

  return best!;
}

// ---------------------------------------------------------------
// 5-korts klassificering (utan jokrar)
// ---------------------------------------------------------------

function classify5(cards: RegularCard[]): HandResult {
  const values = cards.map(c => RANK_ORDER[c.rank]).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = checkStraight(values);

  // Wheel (A-2-3-4-5): specialfall i straight-check
  const isWheel = values[0] === 14 && values[1] === 5 && values[2] === 4 &&
                  values[3] === 3 && values[4] === 2;

  // Räkna frekvenser
  const freq = countFrequencies(values);
  const groups = Object.entries(freq)
    .map(([v, c]) => ({ value: parseInt(v), count: c }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  // Five of a kind (5 av samma rank, möjligt med jokrar som blivit samma kort)
  if (groups.length === 1 && groups[0].count === 5) {
    return {
      rank: 'five_of_a_kind',
      tiebreakers: [groups[0].value],
      description: `Five of a Kind, ${rankName(groups[0].value)}s`,
    };
  }

  // Straight flush / Royal flush
  if (isFlush && isStraight) {
    if (values[0] === 14 && values[1] === 13 && !isWheel) {
      return {
        rank: 'royal_flush',
        tiebreakers: [14],
        description: 'Royal Flush',
      };
    }
    const high = isWheel ? 5 : values[0];
    return {
      rank: 'straight_flush',
      tiebreakers: [high],
      description: `Straight Flush, ${rankName(high)}-high`,
    };
  }

  // Four of a kind
  if (groups[0].count === 4) {
    const kicker = groups[1].value;
    return {
      rank: 'quads',
      tiebreakers: [groups[0].value, kicker],
      description: `Four of a Kind, ${rankName(groups[0].value)}s`,
    };
  }

  // Full house
  if (groups[0].count === 3 && groups[1].count === 2) {
    return {
      rank: 'full_house',
      tiebreakers: [groups[0].value, groups[1].value],
      description: `Full House, ${rankName(groups[0].value)}s full of ${rankName(groups[1].value)}s`,
    };
  }

  // Flush
  if (isFlush) {
    return {
      rank: 'flush',
      tiebreakers: values,
      description: `Flush, ${rankName(values[0])}-high`,
    };
  }

  // Straight
  if (isStraight) {
    const high = isWheel ? 5 : values[0];
    return {
      rank: 'straight',
      tiebreakers: [high],
      description: `Straight, ${rankName(high)}-high`,
    };
  }

  // Three of a kind
  if (groups[0].count === 3) {
    const kickers = groups.slice(1).map(g => g.value);
    return {
      rank: 'trips',
      tiebreakers: [groups[0].value, ...kickers],
      description: `Three of a Kind, ${rankName(groups[0].value)}s`,
    };
  }

  // Two pair
  if (groups[0].count === 2 && groups[1].count === 2) {
    const pairHigh = Math.max(groups[0].value, groups[1].value);
    const pairLow = Math.min(groups[0].value, groups[1].value);
    const kicker = groups[2].value;
    return {
      rank: 'two_pair',
      tiebreakers: [pairHigh, pairLow, kicker],
      description: `Two Pair, ${rankName(pairHigh)}s and ${rankName(pairLow)}s`,
    };
  }

  // One pair
  if (groups[0].count === 2) {
    const kickers = groups.slice(1).map(g => g.value);
    return {
      rank: 'pair',
      tiebreakers: [groups[0].value, ...kickers],
      description: `Pair of ${rankName(groups[0].value)}s`,
    };
  }

  // High card
  return {
    rank: 'high_card',
    tiebreakers: values,
    description: `High Card, ${rankName(values[0])}`,
  };
}

// ---------------------------------------------------------------
// 3-korts klassificering (top-raden, utan jokrar)
// ---------------------------------------------------------------

function classify3(cards: RegularCard[]): HandResult {
  const values = cards.map(c => RANK_ORDER[c.rank]).sort((a, b) => b - a);

  const freq = countFrequencies(values);
  const groups = Object.entries(freq)
    .map(([v, c]) => ({ value: parseInt(v), count: c }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  // Three of a kind (trips)
  if (groups[0].count === 3) {
    return {
      rank: 'trips',
      tiebreakers: [groups[0].value],
      description: `Three of a Kind, ${rankName(groups[0].value)}s`,
    };
  }

  // Pair
  if (groups[0].count === 2) {
    const kicker = groups[1].value;
    return {
      rank: 'pair',
      tiebreakers: [groups[0].value, kicker],
      description: `Pair of ${rankName(groups[0].value)}s`,
    };
  }

  // High card
  return {
    rank: 'high_card',
    tiebreakers: values,
    description: `High Card, ${rankName(values[0])}`,
  };
}

// ---------------------------------------------------------------
// Hjälpfunktioner
// ---------------------------------------------------------------

/** Kontrollera om sorterade values (fallande) bildar en stege */
function checkStraight(values: number[]): boolean {
  // Normal stege: varje värde är exakt 1 lägre
  let normal = true;
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] - values[i] !== 1) {
      normal = false;
      break;
    }
  }
  if (normal) return true;

  // Wheel: A-2-3-4-5 (representeras som [14, 5, 4, 3, 2])
  if (
    values.length === 5 &&
    values[0] === 14 &&
    values[1] === 5 &&
    values[2] === 4 &&
    values[3] === 3 &&
    values[4] === 2
  ) {
    return true;
  }

  return false;
}

/** Räkna antal förekomster av varje värde */
function countFrequencies(values: number[]): Record<number, number> {
  const freq: Record<number, number> = {};
  for (const v of values) {
    freq[v] = (freq[v] || 0) + 1;
  }
  return freq;
}

/** Mänskligt läsbart namn för ett rank-index */
function rankName(value: number): string {
  const names: Record<number, string> = {
    2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
    10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace',
  };
  return names[value] || String(value);
}

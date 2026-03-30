// ============================================================
// handEval.test.ts — Enhetstester för handvärderaren
// ============================================================

import { describe, it, expect } from 'vitest';
import { evaluate5, evaluate3, compareHands } from './handEval';
import { parseCard } from './card';
import type { Card, HandResult } from './types';

// Hjälpare: skapa kort-array från strängar
function hand(...strs: string[]): Card[] {
  return strs.map(parseCard);
}

// ══════════════════════════════════════════════════════════════
// 5-KORTS HÄNDER (middle / bottom) — utan jokrar
// ══════════════════════════════════════════════════════════════

describe('evaluate5 — vanliga händer (utan jokrar)', () => {
  it('high card', () => {
    const r = evaluate5(hand('2c', '5d', '9h', 'Js', 'Ah'));
    expect(r.rank).toBe('high_card');
    expect(r.tiebreakers).toEqual([14, 11, 9, 5, 2]);
  });

  it('pair', () => {
    const r = evaluate5(hand('Kc', 'Kd', '4h', '7s', '2c'));
    expect(r.rank).toBe('pair');
    expect(r.tiebreakers[0]).toBe(13); // Kings
  });

  it('two pair', () => {
    const r = evaluate5(hand('Qs', 'Qd', '8c', '8h', '3s'));
    expect(r.rank).toBe('two_pair');
    expect(r.tiebreakers).toEqual([12, 8, 3]);
  });

  it('three of a kind', () => {
    const r = evaluate5(hand('7c', '7d', '7h', 'Ks', '2c'));
    expect(r.rank).toBe('trips');
    expect(r.tiebreakers[0]).toBe(7);
  });

  it('straight (normal)', () => {
    const r = evaluate5(hand('5c', '6d', '7h', '8s', '9c'));
    expect(r.rank).toBe('straight');
    expect(r.tiebreakers).toEqual([9]);
  });

  it('straight (wheel A-2-3-4-5)', () => {
    const r = evaluate5(hand('Ac', '2d', '3h', '4s', '5c'));
    expect(r.rank).toBe('straight');
    expect(r.tiebreakers).toEqual([5]); // 5-high
  });

  it('straight (broadway A-K-Q-J-T)', () => {
    const r = evaluate5(hand('Ac', 'Kd', 'Qh', 'Js', 'Tc'));
    // Alla samma suit? Nej, alla olika → straight, inte royal
    expect(r.rank).toBe('straight');
    expect(r.tiebreakers).toEqual([14]);
  });

  it('flush', () => {
    const r = evaluate5(hand('2h', '5h', '8h', 'Jh', 'Ah'));
    expect(r.rank).toBe('flush');
    expect(r.tiebreakers).toEqual([14, 11, 8, 5, 2]);
  });

  it('full house', () => {
    const r = evaluate5(hand('Tc', 'Td', 'Th', '4s', '4c'));
    expect(r.rank).toBe('full_house');
    expect(r.tiebreakers).toEqual([10, 4]);
  });

  it('four of a kind', () => {
    const r = evaluate5(hand('9c', '9d', '9h', '9s', 'Ac'));
    expect(r.rank).toBe('quads');
    expect(r.tiebreakers).toEqual([9, 14]);
  });

  it('straight flush', () => {
    const r = evaluate5(hand('4h', '5h', '6h', '7h', '8h'));
    expect(r.rank).toBe('straight_flush');
    expect(r.tiebreakers).toEqual([8]);
  });

  it('royal flush', () => {
    const r = evaluate5(hand('Ts', 'Js', 'Qs', 'Ks', 'As'));
    expect(r.rank).toBe('royal_flush');
    expect(r.tiebreakers).toEqual([14]);
  });

  it('wheel flush = straight flush (5-high, inte royal)', () => {
    const r = evaluate5(hand('Ac', '2c', '3c', '4c', '5c'));
    expect(r.rank).toBe('straight_flush');
    expect(r.tiebreakers).toEqual([5]);
  });
});

// ══════════════════════════════════════════════════════════════
// 5-KORTS HÄNDER — med jokrar
// ══════════════════════════════════════════════════════════════

describe('evaluate5 — händer med jokrar', () => {
  it('1 joker + par → trips', () => {
    const r = evaluate5(hand('Kc', 'Kd', '4h', '7s', 'JK'));
    expect(r.rank).toBe('trips');
    expect(r.tiebreakers[0]).toBe(13); // trips Kings
  });

  it('1 joker + trips → quads', () => {
    const r = evaluate5(hand('9c', '9d', '9h', '3s', 'JK'));
    expect(r.rank).toBe('quads');
    expect(r.tiebreakers[0]).toBe(9);
  });

  it('1 joker + quads → five of a kind', () => {
    const r = evaluate5(hand('Ac', 'Ad', 'Ah', 'As', 'JK'));
    expect(r.rank).toBe('five_of_a_kind');
    expect(r.tiebreakers[0]).toBe(14);
  });

  it('1 joker + 4 till flush = flush', () => {
    const r = evaluate5(hand('2h', '5h', '8h', 'Jh', 'JK'));
    expect(r.rank).toBe('flush');
    // Bästa joker-identitet: Ah → flush A-high
    expect(r.tiebreakers[0]).toBe(14);
  });

  it('1 joker + 4 till straight = straight', () => {
    const r = evaluate5(hand('5c', '6d', '7h', '8s', 'JK'));
    // Joker = 9 → straight 9-high
    expect(r.rank).toBe('straight');
    expect(r.tiebreakers).toEqual([9]);
  });

  it('1 joker + 4 till straight flush = straight flush', () => {
    const r = evaluate5(hand('5h', '6h', '7h', '8h', 'JK'));
    // Joker = 9h → straight flush 9-high
    expect(r.rank).toBe('straight_flush');
    expect(r.tiebreakers).toEqual([9]);
  });

  it('1 joker + 4 till royal flush = royal flush', () => {
    const r = evaluate5(hand('Ts', 'Js', 'Qs', 'Ks', 'JK'));
    expect(r.rank).toBe('royal_flush');
  });

  it('2 jokrar + par → quads', () => {
    const r = evaluate5(hand('8c', '8d', '3h', 'JK', 'JK'));
    expect(r.rank).toBe('quads');
    expect(r.tiebreakers[0]).toBe(8);
  });

  it('2 jokrar + trips → five of a kind', () => {
    const r = evaluate5(hand('Qc', 'Qd', 'Qh', 'JK', 'JK'));
    expect(r.rank).toBe('five_of_a_kind');
    expect(r.tiebreakers[0]).toBe(12);
  });

  it('2 jokrar hittar bästa möjliga hand', () => {
    // 3 hjärter + 2 jokrar → kan bli flush (alla hjärter)
    const r = evaluate5(hand('Ah', 'Kh', 'Qh', 'JK', 'JK'));
    // Bästa: Jh, Th → royal flush
    expect(r.rank).toBe('royal_flush');
  });

  it('2 jokrar + random kort → minst trips', () => {
    const r = evaluate5(hand('2c', '5d', '9h', 'JK', 'JK'));
    // 2 jokrar kan alltid bli trips av 9:or (9,9,9)
    // Eller bättre: straight? 2,5,9 med joker=? Nej, kan inte göra straight
    // Men kan kolla om straight: gap för stort. Trips av den högsta ranken
    const rankOrder = ['high_card', 'pair', 'two_pair', 'trips', 'straight', 'flush', 'full_house', 'quads'];
    const idx = rankOrder.indexOf(r.rank);
    expect(idx).toBeGreaterThanOrEqual(3); // minst trips
  });
});

// ══════════════════════════════════════════════════════════════
// FIVE OF A KIND — specialkategori
// ══════════════════════════════════════════════════════════════

describe('evaluate5 — five of a kind', () => {
  it('five of a kind med 1 joker', () => {
    const r = evaluate5(hand('Ac', 'Ad', 'Ah', 'As', 'JK'));
    expect(r.rank).toBe('five_of_a_kind');
    expect(r.tiebreakers[0]).toBe(14); // ess
  });

  it('five of a kind med 2 jokrar', () => {
    const r = evaluate5(hand('Kc', 'Kd', 'Kh', 'JK', 'JK'));
    expect(r.rank).toBe('five_of_a_kind');
    expect(r.tiebreakers[0]).toBe(13); // kungar
  });

  it('five of a kind rankar mellan straight flush och royal flush', () => {
    const fiveOfAKind = evaluate5(hand('Ac', 'Ad', 'Ah', 'As', 'JK'));
    const royalFlush = evaluate5(hand('Ts', 'Js', 'Qs', 'Ks', 'As'));
    const straightFlush = evaluate5(hand('4h', '5h', '6h', '7h', '8h'));

    // straight flush < five of a kind < royal flush
    expect(compareHands(fiveOfAKind, straightFlush)).toBeGreaterThan(0);
    expect(compareHands(fiveOfAKind, royalFlush)).toBeLessThan(0);
  });

  it('five of a kind ess > five of a kind kungar', () => {
    const fiveAces = evaluate5(hand('Ac', 'Ad', 'Ah', 'As', 'JK'));
    const fiveKings = evaluate5(hand('Kc', 'Kd', 'Kh', 'JK', 'JK'));

    expect(compareHands(fiveAces, fiveKings)).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════
// 3-KORTS HÄNDER (top) — utan jokrar
// ══════════════════════════════════════════════════════════════

describe('evaluate3 — vanliga händer (utan jokrar)', () => {
  it('high card', () => {
    const r = evaluate3(hand('2c', '7d', 'Jh'));
    expect(r.rank).toBe('high_card');
    expect(r.tiebreakers).toEqual([11, 7, 2]);
  });

  it('pair', () => {
    const r = evaluate3(hand('Qs', 'Qd', '5c'));
    expect(r.rank).toBe('pair');
    expect(r.tiebreakers[0]).toBe(12);
    expect(r.tiebreakers[1]).toBe(5); // kicker
  });

  it('trips', () => {
    const r = evaluate3(hand('Ac', 'Ad', 'Ah'));
    expect(r.rank).toBe('trips');
    expect(r.tiebreakers[0]).toBe(14);
  });
});

// ══════════════════════════════════════════════════════════════
// 3-KORTS HÄNDER — med jokrar
// ══════════════════════════════════════════════════════════════

describe('evaluate3 — händer med jokrar', () => {
  it('1 joker + par → trips', () => {
    const r = evaluate3(hand('Kc', 'Kd', 'JK'));
    expect(r.rank).toBe('trips');
    expect(r.tiebreakers[0]).toBe(13);
  });

  it('1 joker + high card → par av högsta kortet', () => {
    const r = evaluate3(hand('5d', 'Jh', 'JK'));
    expect(r.rank).toBe('pair');
    // Joker = Jx → par av J (bättre än par av 5 eller high card A)
    expect(r.tiebreakers[0]).toBe(11);
  });

  it('2 jokrar + 1 kort → trips', () => {
    const r = evaluate3(hand('8c', 'JK', 'JK'));
    // Bästa: båda jokrar = A → trips ess? Nej, bara 1 vanligt kort = 8.
    // Jokrar kan bli 8,8 → trips 8:or. Eller A,A → par ess + 8 kicker.
    // trips 8:or (HR.TRIPS=3) > par ess (HR.PAIR=1), så trips vinner.
    expect(r.rank).toBe('trips');
  });

  // Max 2 jokrar i leken, så 3 jokrar i en rad kan aldrig hända
});

// ══════════════════════════════════════════════════════════════
// RANKING — korrekt ordning
// ══════════════════════════════════════════════════════════════

describe('compareHands — korrekt ranking-ordning', () => {
  it('pair > high card', () => {
    const pair = evaluate5(hand('Kc', 'Kd', '2h', '5s', '7c'));
    const high = evaluate5(hand('Ac', 'Kd', '2h', '5s', '7c'));
    expect(compareHands(pair, high)).toBeGreaterThan(0);
  });

  it('two pair > pair', () => {
    const twoPair = evaluate5(hand('Kc', 'Kd', '5h', '5s', '7c'));
    const pair = evaluate5(hand('Ac', 'Ad', '2h', '5s', '7c'));
    expect(compareHands(twoPair, pair)).toBeGreaterThan(0);
  });

  it('trips > two pair', () => {
    const trips = evaluate5(hand('3c', '3d', '3h', '5s', '7c'));
    const twoPair = evaluate5(hand('Ac', 'Ad', 'Kh', 'Ks', '7c'));
    expect(compareHands(trips, twoPair)).toBeGreaterThan(0);
  });

  it('straight > trips', () => {
    const straight = evaluate5(hand('5c', '6d', '7h', '8s', '9c'));
    const trips = evaluate5(hand('Ac', 'Ad', 'Ah', '5s', '7c'));
    expect(compareHands(straight, trips)).toBeGreaterThan(0);
  });

  it('flush > straight', () => {
    const flush = evaluate5(hand('2h', '5h', '8h', 'Jh', 'Ah'));
    const straight = evaluate5(hand('5c', '6d', '7h', '8s', '9c'));
    expect(compareHands(flush, straight)).toBeGreaterThan(0);
  });

  it('full house > flush', () => {
    const fh = evaluate5(hand('Tc', 'Td', 'Th', '4s', '4c'));
    const flush = evaluate5(hand('2h', '5h', '8h', 'Jh', 'Ah'));
    expect(compareHands(fh, flush)).toBeGreaterThan(0);
  });

  it('quads > full house', () => {
    const quads = evaluate5(hand('9c', '9d', '9h', '9s', '2c'));
    const fh = evaluate5(hand('Ac', 'Ad', 'Ah', 'Ks', 'Kc'));
    expect(compareHands(quads, fh)).toBeGreaterThan(0);
  });

  it('straight flush > quads', () => {
    const sf = evaluate5(hand('4h', '5h', '6h', '7h', '8h'));
    const quads = evaluate5(hand('Ac', 'Ad', 'Ah', 'As', '2c'));
    expect(compareHands(sf, quads)).toBeGreaterThan(0);
  });

  it('royal flush > straight flush', () => {
    const rf = evaluate5(hand('Ts', 'Js', 'Qs', 'Ks', 'As'));
    const sf = evaluate5(hand('4h', '5h', '6h', '7h', '8h'));
    expect(compareHands(rf, sf)).toBeGreaterThan(0);
  });

  it('royal flush > five of a kind > straight flush > quads', () => {
    const rf = evaluate5(hand('Ts', 'Js', 'Qs', 'Ks', 'As'));
    const foak = evaluate5(hand('Ac', 'Ad', 'Ah', 'As', 'JK'));
    const sf = evaluate5(hand('4h', '5h', '6h', '7h', '8h'));
    const quads = evaluate5(hand('Ac', 'Ad', 'Ah', 'As', '2c'));

    expect(compareHands(rf, foak)).toBeGreaterThan(0);
    expect(compareHands(foak, sf)).toBeGreaterThan(0);
    expect(compareHands(sf, quads)).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════
// TIEBREAKERS
// ══════════════════════════════════════════════════════════════

describe('compareHands — tiebreakers', () => {
  it('högre par vinner', () => {
    const pairK = evaluate5(hand('Kc', 'Kd', '2h', '5s', '7c'));
    const pairQ = evaluate5(hand('Qc', 'Qd', '2h', '5s', '7c'));
    expect(compareHands(pairK, pairQ)).toBeGreaterThan(0);
  });

  it('samma par → kicker avgör', () => {
    const kickerA = evaluate5(hand('Kc', 'Kd', 'Ah', '5s', '7c'));
    const kickerJ = evaluate5(hand('Kc', 'Kd', 'Jh', '5s', '7c'));
    expect(compareHands(kickerA, kickerJ)).toBeGreaterThan(0);
  });

  it('identiska händer → 0', () => {
    const a = evaluate5(hand('Kc', 'Kd', 'Ah', '5s', '7c'));
    const b = evaluate5(hand('Kh', 'Ks', 'Ad', '5c', '7d'));
    expect(compareHands(a, b)).toBe(0);
  });

  it('3-korts: högre pair vinner', () => {
    const pairA = evaluate3(hand('Ac', 'Ad', '5h'));
    const pairK = evaluate3(hand('Kc', 'Kd', '5h'));
    expect(compareHands(pairA, pairK)).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════
// FELHANTERING
// ══════════════════════════════════════════════════════════════

describe('felhantering', () => {
  it('evaluate5 kastar vid fel antal kort', () => {
    expect(() => evaluate5(hand('2c', '3d', '4h'))).toThrow();
    expect(() => evaluate5(hand('2c', '3d', '4h', '5s', '6c', '7d'))).toThrow();
  });

  it('evaluate3 kastar vid fel antal kort', () => {
    expect(() => evaluate3(hand('2c', '3d'))).toThrow();
    expect(() => evaluate3(hand('2c', '3d', '4h', '5s'))).toThrow();
  });
});

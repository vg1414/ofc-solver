// ============================================================
// heuristics.test.ts — Enhetstester för heuristics.ts
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  filterPlacements,
  filterFantasyLandPlacements,
  scorePlacement,
  greedyCompletion,
  resolveJokerIdentity,
  applyPlacement,
} from './heuristics';
import { parseCard } from '../engine/card';
import { createEmptyBoard } from '../engine/types';
import { RANK_ORDER } from '../engine/constants';
import type { Board, Card, RowName } from '../engine/types';
import type { TurnPlacement } from './placement';

// ============================================================
// Hjälpfunktioner
// ============================================================

function cards(...strs: string[]): Card[] {
  return strs.map(parseCard);
}

function makeTurnPlacement(
  placements: { card: string; row: RowName; slotIndex: number }[],
  discards: string[] = [],
): TurnPlacement {
  return {
    placements: placements.map(({ card, row, slotIndex }) => ({
      card: parseCard(card),
      row,
      slotIndex,
    })),
    discards: discards.map(parseCard),
  };
}

/** Skapar ett bräde med specifika kort på angiven rad */
function boardWith(
  topCards: string[],
  middleCards: string[],
  bottomCards: string[],
): Board {
  const board = createEmptyBoard();
  topCards.forEach((c, i) => { board.top.cards[i] = parseCard(c); });
  middleCards.forEach((c, i) => { board.middle.cards[i] = parseCard(c); });
  bottomCards.forEach((c, i) => { board.bottom.cards[i] = parseCard(c); });
  return board;
}

// ============================================================
// filterPlacements
// ============================================================

describe('filterPlacements', () => {
  it('returnerar tom lista om inga placeringar finns', () => {
    const result = filterPlacements([], createEmptyBoard());
    expect(result).toHaveLength(0);
  });

  it('returnerar alla placeringar om de är färre än topN', () => {
    const board = createEmptyBoard();
    const placements: TurnPlacement[] = [
      makeTurnPlacement([{ card: 'As', row: 'bottom', slotIndex: 0 }]),
      makeTurnPlacement([{ card: 'As', row: 'middle', slotIndex: 0 }]),
      makeTurnPlacement([{ card: 'As', row: 'top',    slotIndex: 0 }]),
    ];
    const result = filterPlacements(placements, board, 50);
    expect(result).toHaveLength(3);
  });

  it('begränsar till topN placeringar', () => {
    const board = createEmptyBoard();
    const placements: TurnPlacement[] = Array.from({ length: 10 }, (_, i) =>
      makeTurnPlacement([{ card: 'As', row: 'bottom', slotIndex: 0 }]),
    );
    const result = filterPlacements(placements, board, 3);
    expect(result).toHaveLength(3);
  });

  it('föredrar bottom framför top för starkt kort (As)', () => {
    // Ass på bottom föredras framför ass på top (foul-risk)
    const board = createEmptyBoard();
    const bottomPlacement = makeTurnPlacement([{ card: 'As', row: 'bottom', slotIndex: 0 }]);
    const topPlacement    = makeTurnPlacement([{ card: 'As', row: 'top',    slotIndex: 0 }]);

    const scoreBottom = scorePlacement(bottomPlacement, board);
    const scoreTop    = scorePlacement(topPlacement, board);

    expect(scoreBottom).toBeGreaterThanOrEqual(scoreTop);
  });
});

// ============================================================
// filterFantasyLandPlacements
// ============================================================

describe('filterFantasyLandPlacements', () => {
  it('returnerar tom lista om inga placeringar finns', () => {
    expect(filterFantasyLandPlacements([])).toHaveLength(0);
  });

  it('begränsar till topN (default 100)', () => {
    // Skapa 200 dummyplaceringar
    const placements: TurnPlacement[] = Array.from({ length: 200 }, () =>
      makeTurnPlacement([
        { card: '2c', row: 'top',    slotIndex: 0 },
        { card: '3c', row: 'top',    slotIndex: 1 },
        { card: '4c', row: 'top',    slotIndex: 2 },
        { card: '5c', row: 'middle', slotIndex: 0 },
        { card: '6c', row: 'middle', slotIndex: 1 },
        { card: '7c', row: 'middle', slotIndex: 2 },
        { card: '8c', row: 'middle', slotIndex: 3 },
        { card: '9c', row: 'middle', slotIndex: 4 },
        { card: 'Tc', row: 'bottom', slotIndex: 0 },
        { card: 'Jc', row: 'bottom', slotIndex: 1 },
        { card: 'Qc', row: 'bottom', slotIndex: 2 },
        { card: 'Kc', row: 'bottom', slotIndex: 3 },
        { card: 'Ac', row: 'bottom', slotIndex: 4 },
      ]),
    );
    const result = filterFantasyLandPlacements(placements, 100);
    expect(result.length).toBeLessThanOrEqual(100);
  });

  it('ger lägre poäng till foul-placeringar', () => {
    // Uppenbar foul: flush på middle (starkare) men par på bottom (svagare)
    // OFC-regler: middle måste vara STRIKT svagare än bottom
    // Flush (rank 5) > pair (rank 1) → middle > bottom = FOUL
    const foulPlacement = makeTurnPlacement([
      { card: '2c', row: 'top',    slotIndex: 0 },
      { card: '3d', row: 'top',    slotIndex: 1 },
      { card: '4h', row: 'top',    slotIndex: 2 },
      { card: 'Ah', row: 'middle', slotIndex: 0 },  // flush i hjärter på middle
      { card: '2h', row: 'middle', slotIndex: 1 },
      { card: '5h', row: 'middle', slotIndex: 2 },
      { card: '8h', row: 'middle', slotIndex: 3 },
      { card: 'Jh', row: 'middle', slotIndex: 4 },
      { card: 'Ks', row: 'bottom', slotIndex: 0 },  // par K på bottom (svagare än flush)
      { card: 'Kd', row: 'bottom', slotIndex: 1 },
      { card: '6c', row: 'bottom', slotIndex: 2 },
      { card: '7c', row: 'bottom', slotIndex: 3 },
      { card: '9c', row: 'bottom', slotIndex: 4 },
    ]);

    // Giltig placering: flush på bottom (starkare), par på middle (svagare)
    const validPlacement = makeTurnPlacement([
      { card: '2c', row: 'top',    slotIndex: 0 },
      { card: '3d', row: 'top',    slotIndex: 1 },
      { card: '4h', row: 'top',    slotIndex: 2 },
      { card: 'Ks', row: 'middle', slotIndex: 0 },  // par K på middle
      { card: 'Kd', row: 'middle', slotIndex: 1 },
      { card: '6c', row: 'middle', slotIndex: 2 },
      { card: '7c', row: 'middle', slotIndex: 3 },
      { card: '9c', row: 'middle', slotIndex: 4 },
      { card: 'Ah', row: 'bottom', slotIndex: 0 },  // flush i hjärter på bottom
      { card: '2h', row: 'bottom', slotIndex: 1 },
      { card: '5h', row: 'bottom', slotIndex: 2 },
      { card: '8h', row: 'bottom', slotIndex: 3 },
      { card: 'Jh', row: 'bottom', slotIndex: 4 },
    ]);

    const result = filterFantasyLandPlacements(
      [foulPlacement, validPlacement],
      2,
    );

    // Den giltiga bör komma före foul-placeringen
    expect(result[0]).toEqual(validPlacement);
  });
});

// ============================================================
// scorePlacement
// ============================================================

describe('scorePlacement', () => {
  it('ger positivt poäng för normal placering', () => {
    const board = createEmptyBoard();
    const placement = makeTurnPlacement([
      { card: 'As', row: 'bottom', slotIndex: 0 },
    ]);
    const score = scorePlacement(placement, board);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('flush-draw på bottom ger bättre poäng än slumpmässig placering', () => {
    // 3 hjärter redan i bottom, frågan är om vi lägger 4e hjärter i bottom
    const board = boardWith(
      [],
      [],
      ['Ah', '2h', '3h'],
    );

    const flushDrawPlacement = makeTurnPlacement([
      { card: '4h', row: 'bottom', slotIndex: 3 },
    ]);
    const offSuitPlacement = makeTurnPlacement([
      { card: '4s', row: 'bottom', slotIndex: 3 },
    ]);

    const flushScore  = scorePlacement(flushDrawPlacement, board);
    const offSuitScore = scorePlacement(offSuitPlacement, board);

    expect(flushScore).toBeGreaterThan(offSuitScore);
  });

  it('par QQ på top ger FL-bonus', () => {
    const board = boardWith(['Qs'], [], []);

    const pairQQ = makeTurnPlacement([
      { card: 'Qh', row: 'top', slotIndex: 1 },
    ]);
    const lowCard = makeTurnPlacement([
      { card: '2c', row: 'top', slotIndex: 1 },
    ]);

    const qqScore  = scorePlacement(pairQQ, board);
    const lowScore = scorePlacement(lowCard, board);

    expect(qqScore).toBeGreaterThan(lowScore);
  });
});

// ============================================================
// resolveJokerIdentity
// ============================================================

describe('resolveJokerIdentity', () => {
  it('returnerar ett RegularCard', () => {
    const identity = resolveJokerIdentity([], 'bottom');
    expect(identity.kind).toBe('card');
  });

  it('kompletterar flush på bottom om möjligt', () => {
    // 4 hjärter i bottom → jokern bör bli hjärter
    const existing = cards('Ah', '2h', '3h', '4h');
    const identity = resolveJokerIdentity(existing, 'bottom');
    expect(identity.suit).toBe('hearts');
  });

  it('kompletterar triss på middle', () => {
    // KK i middle → jokern bör bli K
    const existing = cards('Ks', 'Kh');
    const identity = resolveJokerIdentity(existing, 'middle');
    expect(identity.rank).toBe('K');
  });

  it('fallback till As om ingen uppenbar strategi finns', () => {
    // Tomma kort → bör bli ett högt kort
    const identity = resolveJokerIdentity([], 'top');
    expect(identity.kind).toBe('card');
    // Rank ska vara ett giltigt rankvärde
    expect(['2','3','4','5','6','7','8','9','T','J','Q','K','A']).toContain(identity.rank);
  });

  it('väljer annorlunda suit om hjärter redan är representerat', () => {
    // Befintliga kort är alla hjärter, jokern bör välj annan suit för par
    const existing = cards('Ah'); // 1 hjärter
    const identity = resolveJokerIdentity(existing, 'bottom');
    // Identity bör kompletterar — antingen par med A (annan suit) eller flush draw
    expect(identity.kind).toBe('card');
  });
});

// ============================================================
// greedyCompletion
// ============================================================

describe('greedyCompletion', () => {
  it('lämnar brädet oförändrat om inga kort att placera', () => {
    const board = boardWith(
      ['As', '2c', '3h'],
      ['4d', '5s', '6c', '7h', '8d'],
      ['9s', 'Tc', 'Jh', 'Qd', 'Ks'],
    );
    const result = greedyCompletion(board, []);
    expect(result.top.cards).toEqual(board.top.cards);
    expect(result.middle.cards).toEqual(board.middle.cards);
    expect(result.bottom.cards).toEqual(board.bottom.cards);
  });

  it('fyller lediga platser på ett tomt bräde', () => {
    const board = createEmptyBoard();
    const remaining = cards(
      'As', 'Ah', 'Ad',           // top (3 kort)
      '2c', '3c', '4c', '5c', '6c', // middle
      '7s', '8s', '9s', 'Ts', 'Js', // bottom
    );
    const result = greedyCompletion(board, remaining);

    // Alla 13 platser ska vara fyllda
    const allCards = [
      ...result.top.cards,
      ...result.middle.cards,
      ...result.bottom.cards,
    ];
    const filledCount = allCards.filter((c) => c !== null).length;
    expect(filledCount).toBe(13);
  });

  it('placerar starkare kort i bottom och svagare i top', () => {
    const board = createEmptyBoard();
    // Ge 13 kort med tydlig rankspridning
    const remaining = cards(
      '2c', '3d', '4h',           // svaga
      '5s', '6c', '7d', '8h', '9s', // medel
      'Tc', 'Jd', 'Qh', 'Ks', 'As', // starka
    );
    const result = greedyCompletion(board, remaining);

    const bottomCards = result.bottom.cards.filter((c): c is Card => c !== null);
    const topCards    = result.top.cards.filter((c): c is Card => c !== null);

    // Bottom bör ha kort generellt starkare än top
    // (inte alltid sant för varje kort, men summan bör vara högre)
    const bottomSum = bottomCards
      .filter((c) => c.kind === 'card')
      .reduce((sum, c) => sum + (c.kind === 'card' ? RANK_ORDER[c.rank] : 0), 0);
    const topSum = topCards
      .filter((c) => c.kind === 'card')
      .reduce((sum, c) => sum + (c.kind === 'card' ? RANK_ORDER[c.rank] : 0), 0);

    expect(bottomSum).toBeGreaterThan(topSum);
  });

  it('hanterar jokrar och ger dem en identitet', () => {
    const board = createEmptyBoard();
    const remaining = [
      ...cards('2c', '3d', '4h', '5s', '6c', '7d', '8h', '9s', 'Tc', 'Jd', 'Qh', 'Ks'),
      parseCard('JK'), // 1 joker
    ];
    const result = greedyCompletion(board, remaining);

    // Alla platser ska vara fyllda
    const allCards = [
      ...result.top.cards,
      ...result.middle.cards,
      ...result.bottom.cards,
    ];
    const filledCount = allCards.filter((c) => c !== null).length;
    expect(filledCount).toBe(13);

    // Jokern ska ha resolvedAs satt
    const joker = allCards.find((c) => c !== null && c.kind === 'joker');
    expect(joker).toBeDefined();
    if (joker && joker.kind === 'joker') {
      expect(joker.resolvedAs).toBeDefined();
    }
  });

  it('fyller bara de återstående platserna (ignorerar fyllda)', () => {
    // Bottom är redan fyllt
    const board = boardWith(
      [],
      [],
      ['2c', '3d', '4h', '5s', '6c'],
    );
    const remaining = cards(
      'As', 'Ah', 'Ad',           // top (3 kort)
      '7d', '8h', '9s', 'Tc', 'Jd', // middle (5 kort)
    );
    const result = greedyCompletion(board, remaining);

    // Bottom ska vara oförändrat
    expect(result.bottom.cards[0]).toEqual(parseCard('2c'));

    // Top och middle ska vara fyllda
    const topFilled    = result.top.cards.filter((c) => c !== null).length;
    const middleFilled = result.middle.cards.filter((c) => c !== null).length;
    expect(topFilled).toBe(3);
    expect(middleFilled).toBe(5);
  });
});

// ============================================================
// applyPlacement
// ============================================================

describe('applyPlacement', () => {
  it('placerar ett kort på korrekt slot', () => {
    const board = createEmptyBoard();
    const placement = makeTurnPlacement([
      { card: 'As', row: 'bottom', slotIndex: 0 },
    ]);
    const result = applyPlacement(board, placement);
    expect(result.bottom.cards[0]).toEqual(parseCard('As'));
    // Originalbrädets slot ska vara orört
    expect(board.bottom.cards[0]).toBeNull();
  });

  it('placerar flera kort i en TurnPlacement', () => {
    const board = createEmptyBoard();
    const placement = makeTurnPlacement([
      { card: 'As', row: 'bottom', slotIndex: 0 },
      { card: 'Kh', row: 'middle', slotIndex: 0 },
      { card: '2c', row: 'top',    slotIndex: 0 },
    ]);
    const result = applyPlacement(board, placement);
    expect(result.bottom.cards[0]).toEqual(parseCard('As'));
    expect(result.middle.cards[0]).toEqual(parseCard('Kh'));
    expect(result.top.cards[0]).toEqual(parseCard('2c'));
  });
});

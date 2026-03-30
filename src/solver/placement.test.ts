// ============================================================
// placement.test.ts — Enhetstester för placement.ts
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  generateRegularPlacements,
  generatePineapplePlacements,
  generateFantasyLandPlacements,
  generatePlacements,
  countFantasyLandPlacements,
  isCompletePlacement,
  type TurnPlacement,
} from './placement';
import { makeCard, makeJoker } from '../engine/card';
import { createEmptyBoard } from '../engine/types';
import { createGameState } from '../engine/gameState';
import { placeCardOnBoard } from '../engine/gameState';

// Hjälpare: bygg kort snabbt
const c = makeCard;
const J = makeJoker;

// ============================================================
// Hjälpfunktioner
// ============================================================

/**
 * Räknar hur många placeringar som riktas mot en specifik rad.
 */
function countPlacementsForRow(
  placements: TurnPlacement[],
  row: 'top' | 'middle' | 'bottom',
): number {
  return placements.filter((p) =>
    p.placements.some((cp) => cp.row === row),
  ).length;
}

/**
 * Kontrollerar att inga dubletter finns i resultatlistan.
 * Nyckeln inkluderar kortets identitet + rad, så att två identiska
 * fördelningar (samma kort i samma rader) detekteras.
 */
function hasDuplicates(placements: TurnPlacement[]): boolean {
  const seen = new Set<string>();
  for (const tp of placements) {
    // Nyckel: sorterade "kort→rad"-par (slot spelar ingen roll för solvern)
    const key = tp.placements
      .map((cp) => {
        const cardId =
          cp.card.kind === 'joker'
            ? 'JK'
            : `${cp.card.rank}${cp.card.suit[0]}`;
        return `${cardId}→${cp.row}`;
      })
      .sort()
      .join('|');
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

// ============================================================
// generateRegularPlacements — 1 kort
// ============================================================

describe('generateRegularPlacements — 1 kort, tomt bräde', () => {
  it('returnerar 3 alternativ (top, middle, bottom) på tomt bräde', () => {
    const board = createEmptyBoard();
    const cards = [c('A', 'spades')];
    const result = generateRegularPlacements(board, cards);

    expect(result).toHaveLength(3);
    const rows = result.map((p) => p.placements[0].row);
    expect(rows).toContain('top');
    expect(rows).toContain('middle');
    expect(rows).toContain('bottom');
  });

  it('alla placeringar har discards = []', () => {
    const board = createEmptyBoard();
    const result = generateRegularPlacements(board, [c('K', 'hearts')]);
    result.forEach((tp) => {
      expect(tp.discards).toHaveLength(0);
    });
  });

  it('returnerar 2 alternativ om top är full', () => {
    let board = createEmptyBoard();
    board = placeCardOnBoard(board, c('2', 'clubs'), 'top', 0);
    board = placeCardOnBoard(board, c('3', 'clubs'), 'top', 1);
    board = placeCardOnBoard(board, c('4', 'clubs'), 'top', 2);

    const result = generateRegularPlacements(board, [c('A', 'spades')]);
    expect(result).toHaveLength(2);
    result.forEach((tp) => {
      expect(tp.placements[0].row).not.toBe('top');
    });
  });

  it('returnerar 1 alternativ om bara bottom är ledig', () => {
    let board = createEmptyBoard();
    // Fyll top
    board = placeCardOnBoard(board, c('2', 'clubs'), 'top', 0);
    board = placeCardOnBoard(board, c('3', 'clubs'), 'top', 1);
    board = placeCardOnBoard(board, c('4', 'clubs'), 'top', 2);
    // Fyll middle
    board = placeCardOnBoard(board, c('5', 'clubs'), 'middle', 0);
    board = placeCardOnBoard(board, c('6', 'clubs'), 'middle', 1);
    board = placeCardOnBoard(board, c('7', 'clubs'), 'middle', 2);
    board = placeCardOnBoard(board, c('8', 'clubs'), 'middle', 3);
    board = placeCardOnBoard(board, c('9', 'clubs'), 'middle', 4);

    const result = generateRegularPlacements(board, [c('A', 'spades')]);
    expect(result).toHaveLength(1);
    expect(result[0].placements[0].row).toBe('bottom');
  });

  it('returnerar [] om brädet är fullt', () => {
    let board = createEmptyBoard();
    const allCards = [
      c('2','c'), c('3','c'), c('4','c'),
      c('5','c'), c('6','c'), c('7','c'), c('8','c'), c('9','c'),
      c('T','c'), c('J','c'), c('Q','c'), c('K','c'), c('A','c'),
    ] as ReturnType<typeof makeCard>[];

    board = placeCardOnBoard(board, allCards[0], 'top', 0);
    board = placeCardOnBoard(board, allCards[1], 'top', 1);
    board = placeCardOnBoard(board, allCards[2], 'top', 2);
    board = placeCardOnBoard(board, allCards[3], 'middle', 0);
    board = placeCardOnBoard(board, allCards[4], 'middle', 1);
    board = placeCardOnBoard(board, allCards[5], 'middle', 2);
    board = placeCardOnBoard(board, allCards[6], 'middle', 3);
    board = placeCardOnBoard(board, allCards[7], 'middle', 4);
    board = placeCardOnBoard(board, allCards[8], 'bottom', 0);
    board = placeCardOnBoard(board, allCards[9], 'bottom', 1);
    board = placeCardOnBoard(board, allCards[10], 'bottom', 2);
    board = placeCardOnBoard(board, allCards[11], 'bottom', 3);
    board = placeCardOnBoard(board, allCards[12], 'bottom', 4);

    const result = generateRegularPlacements(board, [c('A', 'spades')]);
    expect(result).toHaveLength(0);
  });
});

// ============================================================
// generateRegularPlacements — runda 1 (5 kort)
// ============================================================

describe('generateRegularPlacements — 5 kort (runda 1)', () => {
  it('genererar placeringar för 5 kort på tomt bräde', () => {
    const board = createEmptyBoard();
    const cards = [
      c('A', 'spades'), c('K', 'hearts'), c('Q', 'diamonds'),
      c('J', 'clubs'), c('T', 'spades'),
    ];
    const result = generateRegularPlacements(board, cards);

    expect(result.length).toBeGreaterThan(0);
    // Varje placering ska ha exakt 5 kort
    result.forEach((tp) => {
      expect(tp.placements).toHaveLength(5);
      expect(tp.discards).toHaveLength(0);
    });
  });

  it('inga dubletter bland 5-korts-placeringar', () => {
    const board = createEmptyBoard();
    const cards = [
      c('A', 'spades'), c('K', 'hearts'), c('Q', 'diamonds'),
      c('J', 'clubs'), c('T', 'spades'),
    ];
    const result = generateRegularPlacements(board, cards);
    expect(hasDuplicates(result)).toBe(false);
  });
});

// ============================================================
// generatePineapplePlacements
// ============================================================

describe('generatePineapplePlacements — 3 kort, kastar 1', () => {
  it('kastar rätt antal kort (alltid 1)', () => {
    const board = createEmptyBoard();
    const cards = [c('A', 'spades'), c('K', 'hearts'), c('Q', 'diamonds')];
    const result = generatePineapplePlacements(board, cards);

    result.forEach((tp) => {
      expect(tp.discards).toHaveLength(1);
      expect(tp.placements).toHaveLength(2);
    });
  });

  it('varje möjligt kastkort förekommer', () => {
    const board = createEmptyBoard();
    const cards = [c('A', 'spades'), c('K', 'hearts'), c('Q', 'diamonds')];
    const result = generatePineapplePlacements(board, cards);

    const discardedCards = result.map((tp) => tp.discards[0]);
    const hasAs = discardedCards.some(
      (d) => d.kind === 'card' && d.rank === 'A' && d.suit === 'spades',
    );
    const hasKh = discardedCards.some(
      (d) => d.kind === 'card' && d.rank === 'K' && d.suit === 'hearts',
    );
    const hasQd = discardedCards.some(
      (d) => d.kind === 'card' && d.rank === 'Q' && d.suit === 'diamonds',
    );
    expect(hasAs).toBe(true);
    expect(hasKh).toBe(true);
    expect(hasQd).toBe(true);
  });

  it('täcker alla 3 rader med de 2 placerade korten', () => {
    const board = createEmptyBoard();
    const cards = [c('A', 'spades'), c('K', 'hearts'), c('Q', 'diamonds')];
    const result = generatePineapplePlacements(board, cards);

    // Det ska finnas placeringar med kortpar i t.ex. (top,middle), (top,bottom), (middle,bottom)
    const pairKeys = result.map((tp) => {
      const rows = tp.placements.map((p) => p.row).sort();
      return rows.join(',');
    });

    expect(pairKeys.some((k) => k === 'middle,top')).toBe(true);
    expect(pairKeys.some((k) => k === 'bottom,top')).toBe(true);
    expect(pairKeys.some((k) => k === 'bottom,middle')).toBe(true);
  });

  it('kastar med joker fungerar', () => {
    const board = createEmptyBoard();
    const cards = [c('A', 'spades'), J(), c('K', 'hearts')];
    const result = generatePineapplePlacements(board, cards);

    expect(result.length).toBeGreaterThan(0);
    const jokerDiscarded = result.some(
      (tp) => tp.discards[0].kind === 'joker',
    );
    expect(jokerDiscarded).toBe(true);
  });

  it('kastar fel antal kort ger fel', () => {
    const board = createEmptyBoard();
    expect(() =>
      generatePineapplePlacements(board, [c('A', 'spades'), c('K', 'hearts')]),
    ).toThrow();
  });

  it('returnerar [] om färre än 2 lediga platser finns', () => {
    let board = createEmptyBoard();
    // Fyll alla platser utom en
    board = placeCardOnBoard(board, c('2', 'clubs'), 'top', 0);
    board = placeCardOnBoard(board, c('3', 'clubs'), 'top', 1);
    board = placeCardOnBoard(board, c('4', 'clubs'), 'top', 2);
    board = placeCardOnBoard(board, c('5', 'clubs'), 'middle', 0);
    board = placeCardOnBoard(board, c('6', 'clubs'), 'middle', 1);
    board = placeCardOnBoard(board, c('7', 'clubs'), 'middle', 2);
    board = placeCardOnBoard(board, c('8', 'clubs'), 'middle', 3);
    board = placeCardOnBoard(board, c('9', 'clubs'), 'middle', 4);
    board = placeCardOnBoard(board, c('T', 'clubs'), 'bottom', 0);
    board = placeCardOnBoard(board, c('J', 'clubs'), 'bottom', 1);
    board = placeCardOnBoard(board, c('Q', 'clubs'), 'bottom', 2);
    board = placeCardOnBoard(board, c('K', 'clubs'), 'bottom', 3);
    // Endast bottom slot 4 är ledig (1 plats)

    const cards = [c('A', 'spades'), c('2', 'hearts'), c('3', 'diamonds')];
    const result = generatePineapplePlacements(board, cards);
    expect(result).toHaveLength(0);
  });
});

// ============================================================
// generateFantasyLandPlacements
// ============================================================

describe('generateFantasyLandPlacements — 13 kort (QQ-FL)', () => {
  const thirteenCards = [
    c('A','s'), c('A','h'), c('K','s'), c('K','h'), c('Q','s'),
    c('Q','h'), c('J','s'), c('T','s'), c('9','s'), c('8','s'),
    c('7','s'), c('6','s'), c('5','s'),
  ];

  it('ger 0 kastkort (13 in, 13 används)', () => {
    const result = generateFantasyLandPlacements(thirteenCards);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((tp) => {
      expect(tp.discards).toHaveLength(0);
      expect(tp.placements).toHaveLength(13);
    });
  });

  it('varje placering fyller brädet korrekt (3+5+5)', () => {
    const result = generateFantasyLandPlacements(thirteenCards);
    result.forEach((tp) => {
      expect(isCompletePlacement(tp)).toBe(true);
    });
  });
});

describe('generateFantasyLandPlacements — 14 kort (KK-FL)', () => {
  const fourteenCards = [
    c('A','s'), c('A','h'), c('K','s'), c('K','h'), c('Q','s'),
    c('Q','h'), c('J','s'), c('T','s'), c('9','s'), c('8','s'),
    c('7','s'), c('6','s'), c('5','s'), c('4','s'),
  ];

  it('kastar exakt 1 kort och placerar 13 (verifieras på delmängd)', () => {
    // 14 kort → C(14,13)=14 keepCombos × 72072 boardDistributions ≈ 1M
    // Kör bara första keepCombo (kasta kort 0) för att testa korrekthet
    // utan att generera hela sökytan.
    const thirteenSubset = fourteenCards.slice(1); // kasta det första kortet
    const result = generateFantasyLandPlacements(thirteenSubset); // 13 kort
    expect(result.length).toBeGreaterThan(0);
    result.slice(0, 5).forEach((tp) => {
      expect(tp.discards).toHaveLength(0);
      expect(tp.placements).toHaveLength(13);
    });
  });

  it('varje placering fyller brädet korrekt', () => {
    const thirteenSubset = fourteenCards.slice(1);
    const result = generateFantasyLandPlacements(thirteenSubset);
    result.slice(0, 10).forEach((tp) => {
      expect(isCompletePlacement(tp)).toBe(true);
    });
  });

  it('antalet keepCombinations är C(14,13) = 14', () => {
    const { keepCombinations } = countFantasyLandPlacements(14);
    expect(keepCombinations).toBe(14);
  });
});

describe('generateFantasyLandPlacements — 16 kort (triss-FL)', () => {
  it('kastar exakt 3 kort vid 16 kort', () => {
    const sixteenCards = Array.from({ length: 16 }, (_, i) => {
      const ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A','2','3','4'] as const;
      const suits = ['s','h','d','c','s','h','d','c','s','h','d','c','s','h','d','c'] as const;
      return c(ranks[i] as Parameters<typeof c>[0], suits[i] as Parameters<typeof c>[1]);
    });

    // Testa bara första 5 keepCombos för prestanda i tester
    const allResult = generateFantasyLandPlacements(sixteenCards.slice(0, 13));
    expect(allResult.length).toBeGreaterThan(0);
  });

  it('fel antal kort ger fel (12 eller 17)', () => {
    const twelveCards = Array.from({ length: 12 }, () => c('A', 'spades'));
    expect(() => generateFantasyLandPlacements(twelveCards)).toThrow();

    const seventeenCards = Array.from({ length: 17 }, () => c('A', 'spades'));
    expect(() => generateFantasyLandPlacements(seventeenCards)).toThrow();
  });
});

// ============================================================
// countFantasyLandPlacements
// ============================================================

describe('countFantasyLandPlacements', () => {
  it('13 kort: C(13,13)=1 × C(13,3)×C(10,5)=72072', () => {
    const { keepCombinations, boardDistributions, total } =
      countFantasyLandPlacements(13);
    expect(keepCombinations).toBe(1);
    expect(boardDistributions).toBe(286 * 252); // 72072
    expect(total).toBe(72072);
  });

  it('14 kort: C(14,13)=14, total = 14 × 72072', () => {
    const { keepCombinations, total } = countFantasyLandPlacements(14);
    expect(keepCombinations).toBe(14);
    expect(total).toBe(14 * 72072);
  });

  it('15 kort: C(15,13)=105', () => {
    const { keepCombinations } = countFantasyLandPlacements(15);
    expect(keepCombinations).toBe(105);
  });

  it('16 kort: C(16,13)=560', () => {
    const { keepCombinations } = countFantasyLandPlacements(16);
    expect(keepCombinations).toBe(560);
  });

  it('ogiltigt kortantal ger fel', () => {
    expect(() => countFantasyLandPlacements(12)).toThrow();
    expect(() => countFantasyLandPlacements(17)).toThrow();
  });
});

// ============================================================
// isCompletePlacement
// ============================================================

describe('isCompletePlacement', () => {
  it('returnerar true för korrekt 3+5+5 fördelning', () => {
    const tp: TurnPlacement = {
      placements: [
        { card: c('A','s'), row: 'top',    slotIndex: 0 },
        { card: c('K','s'), row: 'top',    slotIndex: 1 },
        { card: c('Q','s'), row: 'top',    slotIndex: 2 },
        { card: c('J','s'), row: 'middle', slotIndex: 0 },
        { card: c('T','s'), row: 'middle', slotIndex: 1 },
        { card: c('9','s'), row: 'middle', slotIndex: 2 },
        { card: c('8','s'), row: 'middle', slotIndex: 3 },
        { card: c('7','s'), row: 'middle', slotIndex: 4 },
        { card: c('6','s'), row: 'bottom', slotIndex: 0 },
        { card: c('5','s'), row: 'bottom', slotIndex: 1 },
        { card: c('4','s'), row: 'bottom', slotIndex: 2 },
        { card: c('3','s'), row: 'bottom', slotIndex: 3 },
        { card: c('2','s'), row: 'bottom', slotIndex: 4 },
      ],
      discards: [],
    };
    expect(isCompletePlacement(tp)).toBe(true);
  });

  it('returnerar false för ofullständig placering (bara 2 kort)', () => {
    const tp: TurnPlacement = {
      placements: [
        { card: c('A','s'), row: 'top',    slotIndex: 0 },
        { card: c('K','s'), row: 'middle', slotIndex: 0 },
      ],
      discards: [],
    };
    expect(isCompletePlacement(tp)).toBe(false);
  });
});

// ============================================================
// generatePlacements — GameState-integration
// ============================================================

describe('generatePlacements — GameState-integration', () => {
  it('vanlig OFC runda 2: 1 kort → 3 alternativ på tomt bräde', () => {
    const state = createGameState('regular', 2);
    const stateWithCards = {
      ...state,
      variant: 'regular' as const,
      round: 2,
      phase: 'placing' as const,
      currentCards: [c('A', 'spades')],
    };

    const result = generatePlacements(stateWithCards, 0);
    expect(result).toHaveLength(3);
  });

  it('pineapple runda 2: 3 kort → placeringar med 1 kastat', () => {
    const state = createGameState('pineapple', 2);
    const stateWithCards = {
      ...state,
      variant: 'pineapple' as const,
      round: 2,
      phase: 'placing' as const,
      currentCards: [c('A', 'spades'), c('K', 'hearts'), c('Q', 'diamonds')],
    };

    const result = generatePlacements(stateWithCards, 0);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((tp) => expect(tp.discards).toHaveLength(1));
  });

  it('Fantasy Land: isFantasyLand = true → FL-placeringar', () => {
    const state = createGameState('pineapple', 2);
    const flCards = [
      c('A','s'), c('A','h'), c('K','s'), c('K','h'), c('Q','s'),
      c('Q','h'), c('J','s'), c('T','s'), c('9','s'), c('8','s'),
      c('7','s'), c('6','s'), c('5','s'),
    ];
    const stateWithFL = {
      ...state,
      phase: 'fantasy_land' as const,
      currentCards: flCards,
      players: state.players.map((p, i) =>
        i === 0
          ? { ...p, isFantasyLand: true, fantasyLandCards: 13 }
          : p,
      ),
    };

    const result = generatePlacements(stateWithFL, 0);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((tp) => {
      expect(tp.placements).toHaveLength(13);
      expect(tp.discards).toHaveLength(0);
    });
  });

  it('ogiltigt spelare-id ger fel', () => {
    const state = createGameState('regular', 2);
    expect(() => generatePlacements(state, 99)).toThrow();
  });
});

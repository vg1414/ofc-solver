// ============================================================
// gameState.test.ts — Enhetstester för gameState.ts
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  createGameState,
  createPlayer,
  startRound,
  placeCardOnBoard,
  placeCardNextSlot,
  collectDeadCards,
  addDeadCard,
  discardCard,
  countPlacedCards,
  isBoardComplete,
  freeSlots,
  freeSlotIndices,
  setDiscardIndex,
  enterFantasyLand,
  exitFantasyLand,
  anyPlayerInFantasyLand,
  calcFantasyLandCards,
  getFantasyLandEntryCards,
  qualifiesForRepeatFL,
  transitionToScoring,
  resetForNextHand,
  isLegalPlacement,
  maxRounds,
  cardsForRound,
  finishGame,
} from './gameState';
import { parseCard } from './card';
import { createEmptyBoard } from './types';

// ---------------------------------------------------------------
// Hjälpfunktioner
// ---------------------------------------------------------------

const c = parseCard; // korthand

// ---------------------------------------------------------------
// createGameState
// ---------------------------------------------------------------

describe('createGameState', () => {
  it('skapar ett spel med rätt antal spelare', () => {
    const state = createGameState('regular', 2);
    expect(state.players).toHaveLength(2);
    expect(state.variant).toBe('regular');
    expect(state.phase).toBe('setup');
    expect(state.round).toBe(0);
  });

  it('skapar ett Pineapple-spel', () => {
    const state = createGameState('pineapple', 2);
    expect(state.variant).toBe('pineapple');
  });

  it('initialiserar tomma bräden', () => {
    const state = createGameState('regular', 2);
    const board = state.players[0].board;
    expect(board.top.cards.every((c) => c === null)).toBe(true);
    expect(board.middle.cards.every((c) => c === null)).toBe(true);
    expect(board.bottom.cards.every((c) => c === null)).toBe(true);
  });

  it('kastar fel vid < 2 spelare', () => {
    expect(() => createGameState('regular', 1)).toThrow();
  });

  it('skapar 3-spelars-spel', () => {
    const state = createGameState('pineapple', 3);
    expect(state.players).toHaveLength(3);
  });
});

// ---------------------------------------------------------------
// maxRounds / cardsForRound
// ---------------------------------------------------------------

describe('maxRounds', () => {
  it('regular OFC = 9 rundor', () => expect(maxRounds('regular')).toBe(9));
  it('pineapple OFC = 8 rundor', () => expect(maxRounds('pineapple')).toBe(8));
});

describe('cardsForRound', () => {
  it('runda 1 = 5 kort för regular', () => expect(cardsForRound('regular', 1)).toBe(5));
  it('runda 1 = 5 kort för pineapple', () => expect(cardsForRound('pineapple', 1)).toBe(5));
  it('runda 2+ = 1 kort för regular', () => {
    expect(cardsForRound('regular', 2)).toBe(1);
    expect(cardsForRound('regular', 9)).toBe(1);
  });
  it('runda 2+ = 3 kort för pineapple', () => {
    expect(cardsForRound('pineapple', 2)).toBe(3);
    expect(cardsForRound('pineapple', 8)).toBe(3);
  });
});

// ---------------------------------------------------------------
// startRound
// ---------------------------------------------------------------

describe('startRound', () => {
  it('startar runda 1 med 5 kort', () => {
    const state = createGameState('regular', 2);
    const cards = [c('As'), c('Kh'), c('Qd'), c('Jc'), c('Ts')];
    const newState = startRound(state, cards);

    expect(newState.round).toBe(1);
    expect(newState.phase).toBe('placing');
    expect(newState.currentCards).toHaveLength(5);
  });

  it('startar runda 2 i regular med 1 kort', () => {
    let state = createGameState('regular', 2);
    state = startRound(state, [c('As'), c('Kh'), c('Qd'), c('Jc'), c('Ts')]);
    const newState = startRound(state, [c('2c')]);
    expect(newState.round).toBe(2);
    expect(newState.currentCards).toHaveLength(1);
  });

  it('startar runda 2 i pineapple med 3 kort', () => {
    let state = createGameState('pineapple', 2);
    state = startRound(state, [c('As'), c('Kh'), c('Qd'), c('Jc'), c('Ts')]);
    const newState = startRound(state, [c('2c'), c('3d'), c('4h')]);
    expect(newState.round).toBe(2);
    expect(newState.currentCards).toHaveLength(3);
  });

  it('kastar fel om fel antal kort ges', () => {
    const state = createGameState('regular', 2);
    expect(() => startRound(state, [c('As')])).toThrow();
  });
});

// ---------------------------------------------------------------
// placeCardOnBoard
// ---------------------------------------------------------------

describe('placeCardOnBoard', () => {
  it('placerar ett kort i en specifik slot', () => {
    const board = createEmptyBoard();
    const newBoard = placeCardOnBoard(board, c('As'), 'top', 0);
    expect(newBoard.top.cards[0]).toEqual(c('As'));
  });

  it('muterar inte originalbrädet', () => {
    const board = createEmptyBoard();
    placeCardOnBoard(board, c('As'), 'top', 0);
    expect(board.top.cards[0]).toBeNull();
  });

  it('kastar fel om sloten redan är fylld', () => {
    const board = createEmptyBoard();
    const board2 = placeCardOnBoard(board, c('As'), 'top', 0);
    expect(() => placeCardOnBoard(board2, c('Kh'), 'top', 0)).toThrow();
  });

  it('kastar fel vid ogiltigt slotIndex', () => {
    const board = createEmptyBoard();
    expect(() => placeCardOnBoard(board, c('As'), 'top', 5)).toThrow();
    expect(() => placeCardOnBoard(board, c('As'), 'top', -1)).toThrow();
  });

  it('placerar i bottom (kapacitet 5)', () => {
    let board = createEmptyBoard();
    board = placeCardOnBoard(board, c('As'), 'bottom', 4);
    expect(board.bottom.cards[4]).toEqual(c('As'));
  });
});

// ---------------------------------------------------------------
// placeCardNextSlot
// ---------------------------------------------------------------

describe('placeCardNextSlot', () => {
  it('placerar i första lediga slot', () => {
    const board = createEmptyBoard();
    const [newBoard, slotIndex] = placeCardNextSlot(board, c('As'), 'top');
    expect(slotIndex).toBe(0);
    expect(newBoard.top.cards[0]).toEqual(c('As'));
  });

  it('fyller på efter befintliga kort', () => {
    let board = createEmptyBoard();
    [board] = placeCardNextSlot(board, c('As'), 'top');
    const [board2, idx] = placeCardNextSlot(board, c('Kh'), 'top');
    expect(idx).toBe(1);
    expect(board2.top.cards[1]).toEqual(c('Kh'));
  });

  it('kastar fel om raden är full', () => {
    let board = createEmptyBoard();
    [board] = placeCardNextSlot(board, c('As'), 'top');
    [board] = placeCardNextSlot(board, c('Kh'), 'top');
    [board] = placeCardNextSlot(board, c('Qd'), 'top');
    expect(() => placeCardNextSlot(board, c('Jc'), 'top')).toThrow();
  });
});

// ---------------------------------------------------------------
// countPlacedCards / isBoardComplete / freeSlots / freeSlotIndices
// ---------------------------------------------------------------

describe('countPlacedCards', () => {
  it('tomt bräde = 0', () => {
    expect(countPlacedCards(createEmptyBoard())).toBe(0);
  });

  it('räknar placerade kort korrekt', () => {
    let board = createEmptyBoard();
    [board] = placeCardNextSlot(board, c('As'), 'top');
    [board] = placeCardNextSlot(board, c('Kh'), 'middle');
    [board] = placeCardNextSlot(board, c('Qd'), 'bottom');
    expect(countPlacedCards(board)).toBe(3);
  });
});

describe('isBoardComplete', () => {
  it('tomt bräde är inte komplett', () => {
    expect(isBoardComplete(createEmptyBoard())).toBe(false);
  });

  it('komplett bräde (13 kort) är komplett', () => {
    let board = createEmptyBoard();
    const cards = [
      'As', 'Kh', 'Qd',               // top (3)
      'Jc', 'Ts', '9h', '8d', '7c',  // middle (5)
      '6s', '5h', '4d', '3c', '2s',  // bottom (5)
    ];
    for (const card of cards.slice(0, 3)) {
      [board] = placeCardNextSlot(board, c(card), 'top');
    }
    for (const card of cards.slice(3, 8)) {
      [board] = placeCardNextSlot(board, c(card), 'middle');
    }
    for (const card of cards.slice(8)) {
      [board] = placeCardNextSlot(board, c(card), 'bottom');
    }
    expect(isBoardComplete(board)).toBe(true);
  });
});

describe('freeSlots', () => {
  it('tomt bräde: top = 3 fria', () => {
    expect(freeSlots(createEmptyBoard(), 'top')).toBe(3);
  });

  it('efter 1 placering: top = 2 fria', () => {
    let board = createEmptyBoard();
    [board] = placeCardNextSlot(board, c('As'), 'top');
    expect(freeSlots(board, 'top')).toBe(2);
  });
});

describe('freeSlotIndices', () => {
  it('tomt bräde top: [0, 1, 2]', () => {
    expect(freeSlotIndices(createEmptyBoard(), 'top')).toEqual([0, 1, 2]);
  });

  it('efter placering i slot 0: [1, 2]', () => {
    const board = placeCardOnBoard(createEmptyBoard(), c('As'), 'top', 0);
    expect(freeSlotIndices(board, 'top')).toEqual([1, 2]);
  });
});

// ---------------------------------------------------------------
// collectDeadCards / addDeadCard / discardCard
// ---------------------------------------------------------------

describe('collectDeadCards', () => {
  it('tomt state ger inga döda kort', () => {
    const state = createGameState('regular', 2);
    expect(collectDeadCards(state)).toHaveLength(0);
  });

  it('inkluderar kort på brädet', () => {
    let state = createGameState('regular', 2);
    const players = [...state.players];
    players[0] = {
      ...players[0],
      board: placeCardOnBoard(players[0].board, c('As'), 'top', 0),
    };
    state = { ...state, players };
    const dead = collectDeadCards(state);
    expect(dead).toHaveLength(1);
  });

  it('inkluderar currentCards', () => {
    const state = {
      ...createGameState('regular', 2),
      currentCards: [c('As'), c('Kh')],
    };
    expect(collectDeadCards(state)).toHaveLength(2);
  });

  it('inkluderar befintliga deadCards', () => {
    const state = {
      ...createGameState('regular', 2),
      deadCards: [c('2c')],
    };
    expect(collectDeadCards(state)).toHaveLength(1);
  });
});

describe('addDeadCard', () => {
  it('lägger till ett dött kort', () => {
    const state = createGameState('regular', 2);
    const newState = addDeadCard(state, c('As'));
    expect(newState.deadCards).toHaveLength(1);
    expect(newState.deadCards[0]).toEqual(c('As'));
  });
});

describe('discardCard', () => {
  it('tar bort kortet från currentCards och lägger i deadCards', () => {
    const state = {
      ...createGameState('pineapple', 2),
      currentCards: [c('As'), c('Kh'), c('Qd')],
    };
    const newState = discardCard(state, 1);
    expect(newState.currentCards).toHaveLength(2);
    expect(newState.deadCards).toContainEqual(c('Kh'));
  });

  it('kastar fel vid ogiltigt index', () => {
    const state = {
      ...createGameState('pineapple', 2),
      currentCards: [c('As')],
    };
    expect(() => discardCard(state, 5)).toThrow();
  });
});

// ---------------------------------------------------------------
// Pineapple-specifikt
// ---------------------------------------------------------------

describe('setDiscardIndex', () => {
  it('sätter discardIndex', () => {
    const state = {
      ...createGameState('pineapple', 2),
      currentCards: [c('As'), c('Kh'), c('Qd')],
    };
    const newState = setDiscardIndex(state, 2);
    expect(newState.discardIndex).toBe(2);
  });

  it('kastar fel i regular OFC', () => {
    const state = createGameState('regular', 2);
    expect(() => setDiscardIndex(state, 0)).toThrow();
  });

  it('kastar fel vid ogiltigt index', () => {
    const state = {
      ...createGameState('pineapple', 2),
      currentCards: [c('As')],
    };
    expect(() => setDiscardIndex(state, 5)).toThrow();
  });
});

// ---------------------------------------------------------------
// Fantasy Land: getFantasyLandEntryCards
// ---------------------------------------------------------------

describe('getFantasyLandEntryCards', () => {
  it('QQ på topp = 13 kort', () => {
    const topCards = [c('Qs'), c('Qh'), c('2c')];
    expect(getFantasyLandEntryCards(topCards)).toBe(13);
  });

  it('KK på topp = 14 kort', () => {
    const topCards = [c('Ks'), c('Kh'), c('2c')];
    expect(getFantasyLandEntryCards(topCards)).toBe(14);
  });

  it('AA på topp = 15 kort', () => {
    const topCards = [c('As'), c('Ah'), c('2c')];
    expect(getFantasyLandEntryCards(topCards)).toBe(15);
  });

  it('Triss på topp = 16 kort', () => {
    const topCards = [c('As'), c('Ah'), c('Ad')];
    expect(getFantasyLandEntryCards(topCards)).toBe(16);
  });

  it('Triss med lägre rank = 16 kort', () => {
    const topCards = [c('2s'), c('2h'), c('2d')];
    expect(getFantasyLandEntryCards(topCards)).toBe(16);
  });

  it('JJ (för lågt) = 0 kort (ej FL)', () => {
    const topCards = [c('Js'), c('Jh'), c('2c')];
    expect(getFantasyLandEntryCards(topCards)).toBe(0);
  });

  it('High card = 0 kort (ej FL)', () => {
    const topCards = [c('As'), c('Kh'), c('Qd')];
    expect(getFantasyLandEntryCards(topCards)).toBe(0);
  });

  it('66 (par men under QQ) = 0', () => {
    const topCards = [c('6s'), c('6h'), c('2c')];
    expect(getFantasyLandEntryCards(topCards)).toBe(0);
  });

  it('returnerar 0 om inte 3 kort', () => {
    expect(getFantasyLandEntryCards([c('As'), c('Ah')])).toBe(0);
  });
});

// ---------------------------------------------------------------
// Fantasy Land: qualifiesForRepeatFL
// ---------------------------------------------------------------

describe('qualifiesForRepeatFL', () => {
  const emptyCards: never[] = [];

  it('triss på topp kvalificerar', () => {
    const top = [c('As'), c('Ah'), c('Ad')];
    const mid = [c('2s'), c('3h'), c('4d'), c('5c'), c('7s')];
    const bot = [c('8s'), c('9h'), c('Td'), c('Jc'), c('Qs')];
    expect(qualifiesForRepeatFL(top, mid, bot)).toBe(true);
  });

  it('kåk på middle kvalificerar', () => {
    const top = [c('2s'), c('3h'), c('4d')];
    const mid = [c('As'), c('Ah'), c('Ad'), c('Kc'), c('Ks')]; // full house
    const bot = [c('8s'), c('9h'), c('Td'), c('Jc'), c('Qs')];
    expect(qualifiesForRepeatFL(top, mid, bot)).toBe(true);
  });

  it('fyrtal på bottom kvalificerar', () => {
    const top = [c('2s'), c('3h'), c('4d')];
    const mid = [c('8s'), c('9h'), c('Td'), c('Jc'), c('Qs')];
    const bot = [c('As'), c('Ah'), c('Ad'), c('Ac'), c('2s')]; // quads aces (+ kicker)
    // Notera: 4 st ess + 1 kicker = fyrtal
    const bot2 = [c('As'), c('Ah'), c('Ad'), c('Ac'), c('Ks')];
    expect(qualifiesForRepeatFL(top, mid, bot2)).toBe(true);
  });

  it('par på topp kvalificerar inte', () => {
    const top = [c('As'), c('Ah'), c('2d')]; // par
    const mid = [c('3s'), c('4h'), c('5d'), c('6c'), c('8s')];
    const bot = [c('9s'), c('Th'), c('Jd'), c('Qc'), c('Ks')];
    expect(qualifiesForRepeatFL(top, mid, bot)).toBe(false);
  });

  it('straight på middle kvalificerar inte', () => {
    const top = [c('2s'), c('3h'), c('4d')];
    const mid = [c('5s'), c('6h'), c('7d'), c('8c'), c('9s')]; // straight
    const bot = [c('Ts'), c('Jh'), c('Qd'), c('Kc'), c('As')]; // straight
    expect(qualifiesForRepeatFL(top, mid, bot)).toBe(false);
  });

  it('straight flush på bottom kvalificerar', () => {
    const top = [c('2s'), c('3h'), c('4d')];
    const mid = [c('5s'), c('6h'), c('7d'), c('8c'), c('9s')];
    const bot = [c('As'), c('2s'), c('3s'), c('4s'), c('5s')]; // straight flush (A-low)
    expect(qualifiesForRepeatFL(top, mid, bot)).toBe(true);
  });
});

// ---------------------------------------------------------------
// Fantasy Land state-funktioner
// ---------------------------------------------------------------

describe('enterFantasyLand / exitFantasyLand', () => {
  it('activates FL for a player', () => {
    const state = createGameState('pineapple', 2);
    const newState = enterFantasyLand(state, 0, 14);
    expect(newState.players[0].isFantasyLand).toBe(true);
    expect(newState.players[0].fantasyLandCards).toBe(14);
    expect(newState.players[1].isFantasyLand).toBe(false);
  });

  it('kastar fel vid ogiltigt antal FL-kort', () => {
    const state = createGameState('pineapple', 2);
    expect(() => enterFantasyLand(state, 0, 12)).toThrow();
    expect(() => enterFantasyLand(state, 0, 17)).toThrow();
  });

  it('avslutar FL för en spelare', () => {
    let state = createGameState('pineapple', 2);
    state = enterFantasyLand(state, 0, 13);
    state = exitFantasyLand(state, 0);
    expect(state.players[0].isFantasyLand).toBe(false);
    expect(state.players[0].fantasyLandCards).toBe(0);
  });
});

describe('anyPlayerInFantasyLand', () => {
  it('false om ingen är i FL', () => {
    const state = createGameState('regular', 2);
    expect(anyPlayerInFantasyLand(state)).toBe(false);
  });

  it('true om en spelare är i FL', () => {
    let state = createGameState('pineapple', 2);
    state = enterFantasyLand(state, 1, 13);
    expect(anyPlayerInFantasyLand(state)).toBe(true);
  });
});

describe('calcFantasyLandCards', () => {
  it('repeat FL ger alltid 13 kort', () => {
    const topCards = [c('As'), c('Ah'), c('Ad')]; // triss (annars 16)
    expect(calcFantasyLandCards(topCards, true)).toBe(13);
  });

  it('icke-repeat: AA = 15 kort', () => {
    const topCards = [c('As'), c('Ah'), c('2d')];
    expect(calcFantasyLandCards(topCards, false)).toBe(15);
  });

  it('icke-repeat: JJ = 0 (ej FL)', () => {
    const topCards = [c('Js'), c('Jh'), c('2d')];
    expect(calcFantasyLandCards(topCards, false)).toBe(0);
  });
});

// ---------------------------------------------------------------
// Fas-övergångar
// ---------------------------------------------------------------

describe('transitionToScoring', () => {
  it('kastar fel om bräden inte är kompletta', () => {
    const state = createGameState('regular', 2);
    expect(() => transitionToScoring(state)).toThrow();
  });

  it('övergår till scoring när allt är komplett', () => {
    let state = createGameState('regular', 2);
    const allCards = [
      'As', 'Kh', 'Qd', 'Jc', 'Ts', '9h', '8d', '7c', '6s', '5h', '4d', '3c', '2s',
    ];

    // Fyll båda spelarnas bräden
    state = {
      ...state,
      players: state.players.map((p) => {
        let board = p.board;
        const topCards = allCards.slice(0, 3).map(c);
        const midCards = allCards.slice(3, 8).map(c);
        const botCards = allCards.slice(8, 13).map(c);
        for (let i = 0; i < 3; i++) board = placeCardOnBoard(board, topCards[i], 'top', i);
        for (let i = 0; i < 5; i++) board = placeCardOnBoard(board, midCards[i], 'middle', i);
        for (let i = 0; i < 5; i++) board = placeCardOnBoard(board, botCards[i], 'bottom', i);
        return { ...p, board };
      }),
    };

    const scored = transitionToScoring(state);
    expect(scored.phase).toBe('scoring');
  });
});

describe('resetForNextHand', () => {
  it('återställer bräden men behåller FL-status', () => {
    let state = createGameState('pineapple', 2);
    state = enterFantasyLand(state, 0, 14);

    // Lägg ett kort på brädet
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0
          ? { ...p, board: placeCardOnBoard(p.board, c('As'), 'top', 0) }
          : p,
      ),
      deadCards: [c('2c')],
      currentCards: [c('3d')],
    };

    const reset = resetForNextHand(state);
    expect(reset.phase).toBe('setup');
    expect(reset.round).toBe(0);
    expect(reset.deadCards).toHaveLength(0);
    expect(reset.currentCards).toHaveLength(0);
    expect(reset.players[0].board.top.cards.every((c) => c === null)).toBe(true);
    // FL-status bevaras
    expect(reset.players[0].isFantasyLand).toBe(true);
    expect(reset.players[0].fantasyLandCards).toBe(14);
  });
});

describe('finishGame', () => {
  it('sätter fasen till finished', () => {
    const state = createGameState('regular', 2);
    const finished = finishGame(state);
    expect(finished.phase).toBe('finished');
  });
});

// ---------------------------------------------------------------
// isLegalPlacement
// ---------------------------------------------------------------

describe('isLegalPlacement', () => {
  it('ledig slot är laglig', () => {
    expect(isLegalPlacement(createEmptyBoard(), 'top', 0)).toBe(true);
  });

  it('fylld slot är olaglig', () => {
    const board = placeCardOnBoard(createEmptyBoard(), c('As'), 'top', 0);
    expect(isLegalPlacement(board, 'top', 0)).toBe(false);
  });

  it('ogiltigt slotIndex är olagligt', () => {
    expect(isLegalPlacement(createEmptyBoard(), 'top', 5)).toBe(false);
    expect(isLegalPlacement(createEmptyBoard(), 'top', -1)).toBe(false);
  });

  it('slot 4 i bottom är lagligt', () => {
    expect(isLegalPlacement(createEmptyBoard(), 'bottom', 4)).toBe(true);
  });

  it('slot 3 i top är olagligt (kapacitet=3)', () => {
    expect(isLegalPlacement(createEmptyBoard(), 'top', 3)).toBe(false);
  });
});

// ============================================================
// solver.test.ts — Enhetstester för solver.ts
// ============================================================

import { describe, it, expect } from 'vitest';
import { solve, solveFromBoard, toSimpleSolverResult, handleSolverMessage } from './solver';
import type { DetailedSolverResult, SolverWorkerMessage } from './solver';
import { parseCard } from '../engine/card';
import { createGameState } from '../engine/gameState';
import type { Board, GameState, RowName } from '../engine/types';
import { createEmptyBoard } from '../engine/types';

// ============================================================
// Hjälpfunktioner
// ============================================================

/** Skapar ett bräde med kort placerade i specifika rader */
function buildBoard(
  top: string[],
  middle: string[],
  bottom: string[],
): Board {
  const board = createEmptyBoard();

  for (let i = 0; i < top.length; i++) {
    board.top.cards[i] = parseCard(top[i]);
  }
  for (let i = 0; i < middle.length; i++) {
    board.middle.cards[i] = parseCard(middle[i]);
  }
  for (let i = 0; i < bottom.length; i++) {
    board.bottom.cards[i] = parseCard(bottom[i]);
  }

  return board;
}

/** Skapar ett GameState redo för en runda med givet bräde och kort */
function buildGameState(
  board: Board,
  currentCards: string[],
  variant: 'regular' | 'pineapple' = 'regular',
  round: number = 2,
): GameState {
  const state = createGameState(variant);
  state.players[0].board = board;
  state.round = round;
  state.phase = 'placing';
  state.currentCards = currentCards.map(parseCard);
  return state;
}

// ============================================================
// Tester
// ============================================================

describe('solve() — vanlig OFC, 1 kort', () => {
  it('returnerar placeringsalternativ för varje tillgänglig rad', () => {
    // Brädet har lediga platser i alla tre rader
    const board = buildBoard(
      ['Ah', 'Kh'],        // top: 2/3
      ['Ts', '9s', '8s'],  // middle: 3/5
      ['2c', '3c', '4c'],  // bottom: 3/5
    );

    const state = buildGameState(board, ['Jd']);
    const result = solve(state, 0, 1, {
      simulations: 100,
      maxMs: 3000,
      heuristicOnly: false,
    });

    expect(result.options.length).toBeGreaterThanOrEqual(1);
    expect(result.options.length).toBeLessThanOrEqual(3); // max 3 rader
    expect(result.best).toBeDefined();
    expect(result.best.ev).toBeDefined();
    expect(result.best.rank).toBe(1);

    // Varje option ska ha exakt 1 placering (1 kort)
    for (const opt of result.options) {
      expect(opt.placements).toHaveLength(1);
      expect(opt.discards).toHaveLength(0);
    }
  });

  it('ger högst EV till den bästa placeringen', () => {
    const board = buildBoard(
      ['Ah', 'Kh'],
      ['Ts', '9s', '8s'],
      ['2c', '3c', '4c'],
    );

    const state = buildGameState(board, ['Jd']);
    const result = solve(state, 0, 1, { simulations: 100, maxMs: 3000 });

    // Bästa placeringen ska ha rank 1 och högst EV
    expect(result.best.rank).toBe(1);
    for (const opt of result.options) {
      expect(opt.ev).toBeLessThanOrEqual(result.best.ev);
    }
  });

  it('returnerar olika rader för varje alternativ', () => {
    const board = buildBoard([], [], []); // tomt bräde
    const state = buildGameState(board, ['As'], 'regular', 2);
    const result = solve(state, 0, 1, { simulations: 50, maxMs: 2000 });

    // Alla tre rader bör vara representerade
    const rows = result.options.map(o => o.primaryRow);
    expect(rows.length).toBe(3);
    expect(new Set(rows).size).toBe(3);
  });
});

describe('solve() — heuristicOnly-läge', () => {
  it('returnerar resultat utan Monte Carlo', () => {
    const board = buildBoard(
      ['Ah'],
      ['Ts', '9s'],
      ['2c', '3c'],
    );

    const state = buildGameState(board, ['Kd']);
    const result = solve(state, 0, 1, { heuristicOnly: true });

    expect(result.method).toBe('heuristic');
    expect(result.simulations).toBe(0);
    expect(result.options.length).toBeGreaterThanOrEqual(1);
    expect(result.best.rank).toBe(1);
  });
});

describe('solveFromBoard() — förenklat API', () => {
  it('löser med bara bräde och kort (utan GameState)', () => {
    const board = buildBoard(
      [],
      ['Ts', '9s', '8s', '7s'],  // middle: 4/5, flush-draw!
      ['Ac', 'Kc', 'Qc', 'Jc'],  // bottom: 4/5
    );

    const result = solveFromBoard(
      board,
      [parseCard('6s')],  // Denna kompletterar flush i middle!
      [],
      'regular',
      { simulations: 100, maxMs: 2000 },
    );

    expect(result.options.length).toBeGreaterThanOrEqual(1);
    expect(result.best).toBeDefined();
  });

  it('kastar vid inga kort', () => {
    const board = buildBoard([], [], []);
    expect(() => solveFromBoard(board, [])).toThrow('Inga kort');
  });
});

describe('solve() — Pineapple OFC', () => {
  it('hanterar 3 kort (2 placeras, 1 kastas)', () => {
    const board = buildBoard(
      ['Ah'],
      ['Ts', '9s'],
      ['2c', '3c'],
    );

    const state = buildGameState(board, ['Kd', 'Qd', '5h'], 'pineapple', 2);
    const result = solve(state, 0, 1, { simulations: 50, maxMs: 3000 });

    expect(result.options.length).toBeGreaterThanOrEqual(1);

    // Varje alternativ ska ha 2 placeringar + 1 discard
    for (const opt of result.options) {
      expect(opt.placements).toHaveLength(2);
      expect(opt.discards).toHaveLength(1);
    }
  });
});

describe('solve() — Fantasy Land', () => {
  it('hanterar 13 kort i FL', () => {
    const state = createGameState('regular');
    state.players[0].isFantasyLand = true;
    state.players[0].fantasyLandCards = 13;
    state.phase = 'fantasy_land';
    state.round = 1;

    // 13 unika kort
    state.currentCards = [
      'As', 'Ks', 'Qs', 'Js', 'Ts',
      'Ah', 'Kh', 'Qh',
      '2c', '3c', '4c', '5c', '6c',
    ].map(parseCard);

    const result = solve(state, 0, 1, {
      simulations: 20,
      maxMs: 5000,
      topCandidates: 10,
    });

    expect(result.options.length).toBeGreaterThanOrEqual(1);
    expect(result.best).toBeDefined();

    // FL-placeringar ska ha 13 kort och 0 discards (exakt 13 kort)
    expect(result.best.placements).toHaveLength(13);
    expect(result.best.discards).toHaveLength(0);
  });

  it('hanterar 14 kort i FL (KK-entry, kastar 1)', () => {
    const state = createGameState('regular');
    state.players[0].isFantasyLand = true;
    state.players[0].fantasyLandCards = 14;
    state.phase = 'fantasy_land';
    state.round = 1;

    state.currentCards = [
      'As', 'Ks', 'Qs', 'Js', 'Ts',
      'Ah', 'Kh', 'Qh',
      '2c', '3c', '4c', '5c', '6c',
      '7d', // 14:e kortet
    ].map(parseCard);

    // Använd heuristicOnly — full MC med 14 kort är för tungt för test
    const result = solve(state, 0, 1, {
      heuristicOnly: true,
      topCandidates: 5,
    });

    expect(result.options.length).toBeGreaterThanOrEqual(1);
    expect(result.best.placements).toHaveLength(13);
    expect(result.best.discards).toHaveLength(1);
  }, 30000); // FL med 14 kort genererar många kombinationer
});

describe('toSimpleSolverResult()', () => {
  it('konverterar DetailedSolverResult till SolverResult', () => {
    const board = buildBoard([], ['Ts'], ['2c']);
    const state = buildGameState(board, ['Jd']);
    const detailed = solve(state, 0, 1, { heuristicOnly: true });
    const simple = toSimpleSolverResult(detailed);

    expect(simple.options.length).toBe(detailed.options.length);
    expect(simple.best.row).toBe(detailed.best.primaryRow);
    expect(simple.best.ev).toBe(detailed.best.ev);
    expect(simple.best.rank).toBe(1);
    expect(simple.simulations).toBe(detailed.simulations);
  });
});

describe('handleSolverMessage() — Web Worker API', () => {
  it('hanterar "solve"-meddelande', () => {
    const board = buildBoard(['Ah'], ['Ts', '9s'], ['2c', '3c']);
    const state = buildGameState(board, ['Kd']);

    const msg: SolverWorkerMessage = {
      type: 'solve',
      state,
      playerId: 0,
      options: { heuristicOnly: true },
    };

    const response = handleSolverMessage(msg);
    expect(response.type).toBe('result');

    if (response.type === 'result') {
      expect(response.result.options.length).toBeGreaterThanOrEqual(1);
      expect(response.result.best).toBeDefined();
    }
  });

  it('hanterar "solveFromBoard"-meddelande', () => {
    const board = buildBoard([], [], []);

    const msg: SolverWorkerMessage = {
      type: 'solveFromBoard',
      board,
      cards: [parseCard('As')],
      options: { heuristicOnly: true },
    };

    const response = handleSolverMessage(msg);
    expect(response.type).toBe('result');
  });

  it('returnerar error vid ogiltigt meddelande', () => {
    const msg = { type: 'invalid' } as any;
    const response = handleSolverMessage(msg);
    expect(response.type).toBe('error');
  });

  it('returnerar error vid tomt kort-array', () => {
    const board = buildBoard([], [], []);
    const state = buildGameState(board, []);
    state.currentCards = []; // Töm korten

    const msg: SolverWorkerMessage = {
      type: 'solve',
      state,
      playerId: 0,
    };

    const response = handleSolverMessage(msg);
    expect(response.type).toBe('error');
  });
});

describe('solve() — kantfall', () => {
  it('kastar vid ogiltig playerId', () => {
    const state = createGameState('regular');
    state.currentCards = [parseCard('As')];
    state.phase = 'placing';
    state.round = 2;

    expect(() => solve(state, 99)).toThrow('Ingen spelare');
  });

  it('kastar vid tomma currentCards', () => {
    const state = createGameState('regular');
    state.phase = 'placing';
    state.round = 2;

    expect(() => solve(state)).toThrow('Inga kort');
  });

  it('hanterar bräde med jokrar', () => {
    const board = buildBoard(
      ['JK'],           // joker på top
      ['Ts', '9s'],
      ['2c', '3c'],
    );

    const state = buildGameState(board, ['Kd']);
    const result = solve(state, 0, 1, { simulations: 50, maxMs: 2000 });

    expect(result.options.length).toBeGreaterThanOrEqual(1);
    expect(result.best).toBeDefined();
  });

  it('hanterar nästan fullt bräde (1 plats kvar)', () => {
    const board = buildBoard(
      ['Ah', 'Kh', 'Qh'],                // top: fullt
      ['Ts', '9s', '8s', '7s', '6s'],    // middle: fullt
      ['2c', '3c', '4c', '5c'],          // bottom: 4/5 — 1 plats kvar
    );

    const state = buildGameState(board, ['Jd']);
    const result = solve(state, 0, 1, { simulations: 50, maxMs: 2000 });

    // Bara 1 rad (bottom) har plats
    expect(result.options.length).toBe(1);
    expect(result.best.primaryRow).toBe('bottom');
  });
});

describe('solve() — EV-rimlighet', () => {
  it('flush-draw i bottom bör föredras framför slumpmässig placering', () => {
    // 4-till-flush i bottom (spader)
    const board = buildBoard(
      [],
      [],
      ['As', 'Ks', 'Qs', 'Js'],  // 4 spader i bottom
    );

    const state = buildGameState(board, ['Ts']); // 5:e spadern!
    const result = solve(state, 0, 1, { simulations: 200, maxMs: 3000 });

    // Bästa placeringen bör vara bottom (slutför flush → royalty)
    expect(result.best.primaryRow).toBe('bottom');
  });
});

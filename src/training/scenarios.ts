// ============================================================
// scenarios.ts — Realistiska träningsscenarion
// ============================================================
//
// Ett scenario = ett läge mitt i en riktig hand där det är din tur.
// I stället för att slumpa kort på platser spelar datorn fram läget:
//   1. Blanda en 54-kortslek och räkna ut turordningen (vem börjar slumpas).
//   2. Välj var vi stannar: öppningshanden (≈ 25 %) eller en senare runda.
//   3. Datorn spelar ALLA drag fram till dess — både "ditt" bräde och
//      motståndarens — med solvern (snabb nivå). Då ser brädena ut som
//      i ett riktigt parti: par i botten, draws, ibland en svag topp.
//   4. Korten du får = nästa kort i leken.
// Jokerläget: innan datorn börjar flyttas en joker (ibland båda) till de
// platser i leken där din hand kommer att delas ut. Allt annat är som
// vanligt, så brädena ser lika realistiska ut. Den andra jokern ligger
// kvar slumpvis — ibland har någon redan fått den på brädet.
// Triviala lägen (bara en rad ledig för ett kort) slängs och görs om.
// ============================================================

import type { Board, Card, GameVariant } from '../engine/types';
import type { SolverInput } from '../hooks/useSolver';
import type { DetailedSolverResult, SolverOptions } from '../solver/solver';
import { ROWS, countPlaced } from './moves';
import { GEN_OPTIONS, applyToSeat, computerMove, newDeck, newSeat, roundsFor, turnOrder, type Seat, type SeatId, type Solve } from './game';

export interface Scenario {
  id: string;
  variant: GameVariant;
  round: number;
  board: Board;
  opponentBoard: Board;
  hand: Card[];
  /** Dina egna kastade kort (Pineapple) */
  deadCards: Card[];
  /** Antal kort som ska läggas (resten kastas) */
  place: number;
  /** Färdig bedömning (SCENARIO_EVAL), räknad i förväg av scenariokön */
  evaluation?: DetailedSolverResult;
}

/** Bedömningsnivå för scenarion: Noggrann */
export const SCENARIO_EVAL: SolverOptions = { simulations: 2000 };

/** Solver-input för att bedöma scenariot */
export function scenarioInput(s: Scenario, options: SolverOptions): SolverInput {
  return {
    board: s.board,
    cards: s.hand,
    deadCards: s.deadCards,
    variant: s.variant,
    opponentBoard: countPlaced(s.opponentBoard) > 0 ? s.opponentBoard : undefined,
    options,
  };
}

export function scenarioLabel(s: Scenario): string {
  if (s.round === 1) return 'Öppningshand · lägg 5 kort';
  if (s.variant === 'pineapple') return `Runda ${s.round} · lägg 2, kasta 1`;
  return `Runda ${s.round} · ${countPlaced(s.board)} av 13 kort ute`;
}

/** Bara en rad har plats för ett enda kort → inget val att göra */
function isTrivial(board: Board, place: number, hand: number): boolean {
  if (place !== hand || hand !== 1) return false;
  return ROWS.filter((r) => board[r].cards.some((c) => c === null)).length <= 1;
}

function pickRound(variant: GameVariant, rand: () => number): number {
  if (rand() < 0.25) return 1;
  // Vanlig: runda 2–8 (runda 9 = sista kortet, nästan alltid givet)
  const last = variant === 'regular' ? roundsFor(variant) - 1 : roundsFor(variant);
  return 2 + Math.floor(rand() * (last - 1));
}

let seq = 0;

/** Flytta `want` jokrar till lekens platser start … start+want-1 */
export function placeJokers(deck: Card[], start: number, want: number): void {
  for (let k = 0; k < want; k++) {
    const at = start + k;
    if (deck[at].kind === 'joker') continue;
    const j = deck.findIndex((c, i) => c.kind === 'joker' && (i < start || i > at));
    if (j >= 0) [deck[at], deck[j]] = [deck[j], deck[at]];
  }
}

export interface ScenarioOptions {
  /** Jokerträning: minst en joker i handen */
  jokers?: boolean;
}

/**
 * Spela fram ett scenario. `alive()` kollas mellan dragen så att
 * genereringen kan avbrytas direkt (t.ex. när du lämnar träningen).
 */
export async function generateScenario(
  solve: Solve,
  variant: GameVariant,
  alive: () => boolean = () => true,
  rand: () => number = Math.random,
  opts: ScenarioOptions = {},
): Promise<Scenario> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const deck = newDeck();
    let pos = 0;
    const first: SeatId = rand() < 0.5 ? 0 : 1;
    const turns = turnOrder(variant, first);
    const stopRound = pickRound(variant, rand);
    const stop = turns.findIndex((t) => t.seat === 0 && t.round === stopRound);
    if (opts.jokers) {
      const start = turns.slice(0, stop).reduce((n, t) => n + t.count, 0);
      const size = turns[stop].count;
      // Ungefär var tredje hand med plats för det får båda jokrarna
      placeJokers(deck, start, size >= 2 && rand() < 0.3 ? 2 : 1);
    }
    const seats: [Seat, Seat] = [newSeat(), newSeat()];

    for (let i = 0; i < stop; i++) {
      if (!alive()) throw new Error('cancelled');
      const t = turns[i];
      const cards = deck.slice(pos, pos + t.count);
      pos += t.count;
      const me = seats[t.seat];
      const opp = seats[t.seat === 0 ? 1 : 0];
      const move = await computerMove(solve, { seat: me, cards, variant, opponent: opp.board, fl: false, options: GEN_OPTIONS });
      seats[t.seat] = applyToSeat(me, move);
    }

    const t = turns[stop];
    const hand = deck.slice(pos, pos + t.count);
    if (isTrivial(seats[0].board, t.place, hand.length)) continue;
    return {
      id: `s${Date.now()}-${seq++}`,
      variant,
      round: t.round,
      board: seats[0].board,
      opponentBoard: seats[1].board,
      hand,
      deadCards: seats[0].discards,
      place: t.place,
    };
  }
  throw new Error('Kunde inte skapa ett scenario');
}

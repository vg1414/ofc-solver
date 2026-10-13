// ============================================================
// game.ts — Spelregler för träningsläget: turordning, giv, datorns drag
// ============================================================
//
// En hand OFC: alla får 5 kort och lägger dem, sedan
//   - Vanlig:    8 rundor med 1 kort (totalt 13 kort)
//   - Pineapple: 4 rundor med 3 kort, lägg 2 och kasta 1
// Den som är i Fantasy Land får alla sina 13–16 kort på en gång i
// första rundan och lägger 13 (resten kastas).
//
// turnOrder() räknar ut hela turordningen i förväg som en lista, så
// både helhandsläget och scenariogeneratorn kan stega igenom samma lista.
// ============================================================

import type { Board, Card, GameVariant } from '../engine/types';
import { buildDeck } from '../engine/deck';
import { scoreHand, type ScorecardResult } from '../engine/scoring';
import { isFoul } from '../engine/foulCheck';
import { calcFantasyLandCards, qualifiesForRepeatFL } from '../engine/gameState';
import { resolveJokers } from '../engine/resolveJokers';
import type { SolverInput } from '../hooks/useSolver';
import type { DetailedSolverResult, SolverOptions } from '../solver/solver';
import { applyMove, countPlaced, emptyBoard, rowCards, shuffled, type Move } from './moves';

export type SeatId = 0 | 1;

export interface Turn {
  seat: SeatId;
  round: number;
  /** Antal kort som delas ut */
  count: number;
  /** Antal kort som ska läggas (resten kastas) */
  place: number;
  fl: boolean;
}

export function roundsFor(variant: GameVariant): number {
  return variant === 'regular' ? 9 : 5;
}

export function cardsFor(variant: GameVariant, round: number): number {
  if (round === 1) return 5;
  return variant === 'regular' ? 1 : 3;
}

/**
 * Hela turordningen för en hand.
 * @param first  vem som agerar först varje runda
 * @param fl     antal FL-kort per plats (0 = spelar vanligt)
 */
export function turnOrder(variant: GameVariant, first: SeatId, fl: [number, number] = [0, 0]): Turn[] {
  const order: SeatId[] = first === 0 ? [0, 1] : [1, 0];
  const turns: Turn[] = [];
  for (let round = 1; round <= roundsFor(variant); round++) {
    for (const seat of order) {
      if (fl[seat] > 0) {
        if (round === 1) turns.push({ seat, round, count: fl[seat], place: 13, fl: true });
        continue;
      }
      const count = cardsFor(variant, round);
      const place = variant === 'pineapple' && round > 1 ? 2 : count;
      turns.push({ seat, round, count, place, fl: false });
    }
  }
  return turns;
}

export function newDeck(): Card[] {
  return shuffled(buildDeck());
}

// ---------- Platser ----------

export interface Seat {
  board: Board;
  /** Egna kastade kort (Pineapple/FL) — "döda" kort för den spelaren */
  discards: Card[];
  /** FL-kort denna hand (0 = vanlig) */
  fl: number;
}

export function newSeat(fl = 0): Seat {
  return { board: emptyBoard(), discards: [], fl };
}

export function applyToSeat(seat: Seat, move: Move): Seat {
  return { ...seat, board: applyMove(seat.board, move.placements), discards: [...seat.discards, ...move.discards] };
}

// ---------- Datorns drag ----------

export type Solve = (input: SolverInput) => Promise<DetailedSolverResult>;

// Datorn i helhandsläget: nivån väljs i inställningarna (CPU_LEVELS i session.ts).
// Normal = 800 sim, max 3 s per drag — samma som scenariogeneratorn nedan.
/**
 * Datorn när den spelar fram scenarion: Normal-nivå (800 sim, max 3 s).
 * Mätt mot noggrann omräkning: snittförlust ≈ 0,24 EV på öppningar och
 * ≈ 0,07 på enkortsdrag (300 sim / 1,2 s gav 1,21 resp. 0,28) — så brädena
 * ser ut som i ett välspelat parti. Kön förbereder scenarion i förväg,
 * så den längre tiden märks inte.
 */
export const GEN_OPTIONS: SolverOptions = { simulations: 800, maxMs: 3000 };

export interface SolveArgs {
  seat: Seat;
  cards: Card[];
  variant: GameVariant;
  /** Motståndarens bräde om det syns (inte i Fantasy Land) */
  opponent?: Board;
  fl: boolean;
  options: SolverOptions;
}

export function solverInput({ seat, cards, variant, opponent, fl, options }: SolveArgs): SolverInput {
  if (fl) return { board: emptyBoard(), cards, deadCards: [], variant, options, mode: 'fantasyLand' };
  return {
    board: seat.board,
    cards,
    deadCards: seat.discards,
    variant,
    opponentBoard: opponent && countPlaced(opponent) > 0 ? opponent : undefined,
    options,
    mode: 'normal',
  };
}

export async function computerMove(solve: Solve, args: SolveArgs): Promise<Move> {
  const res = await solve(solverInput(args));
  const b = res.best;
  return { placements: b.placements.map((p) => ({ ...p })), discards: [...b.discards] };
}

// ---------- Slutet av handen ----------

export interface HandOutcome {
  score: ScorecardResult;
  /** FL-kort nästa hand per plats (0 = ingen FL) */
  nextFl: [number, number];
}

function nextFlFor(seat: Seat): number {
  const raw = [rowCards(seat.board, 'top'), rowCards(seat.board, 'middle'), rowCards(seat.board, 'bottom')] as const;
  if (isFoul(...raw)) return 0;
  // Jokrarna som husregeln valde (t.ex. ★ = K i topp, inte en dam som ger QQ och foul)
  const { top, middle: mid, bottom: bot } = resolveJokers(...raw);
  if (seat.fl > 0) return qualifiesForRepeatFL(top, mid, bot) ? calcFantasyLandCards(top, true) : 0;
  return calcFantasyLandCards(top, false);
}

/** Poäng mellan plats 0 (du) och plats 1 (datorn), plus FL till nästa hand */
export function settleHand(me: Seat, cpu: Seat): HandOutcome {
  const r = (s: Seat) => [rowCards(s.board, 'top'), rowCards(s.board, 'middle'), rowCards(s.board, 'bottom')] as const;
  const [mt, mm, mb] = r(me);
  const [ct, cm, cb] = r(cpu);
  return { score: scoreHand(mt, mm, mb, ct, cm, cb), nextFl: [nextFlFor(me), nextFlFor(cpu)] };
}

// ---------- En hand som tillstånd ----------
//
// HandState är en vanlig, oföränderlig struktur (bara data, går att spara
// som JSON): kortlek + position, båda platserna, hela turordningen och
// vilken tur vi är på. Används av "Hel hand mot datorn" och 2-spelarläget.

export interface HandState {
  no: number;
  first: SeatId;
  deck: Card[];
  pos: number;
  seats: [Seat, Seat];
  turns: Turn[];
  idx: number;
  /** Korten som är utdelade till turen som pågår */
  dealt: Card[];
  outcome: HandOutcome | null;
}

/** Dela ut korten till nästa tur — eller räkna poäng när alla turer är klara */
export function nextTurn(h: HandState): HandState {
  if (h.idx >= h.turns.length) return { ...h, dealt: [], outcome: settleHand(h.seats[0], h.seats[1]) };
  const t = h.turns[h.idx];
  return { ...h, dealt: h.deck.slice(h.pos, h.pos + t.count), pos: h.pos + t.count };
}

export function startHand(no: number, first: SeatId, fl: [number, number], variant: GameVariant, deck: Card[] = newDeck()): HandState {
  return nextTurn({
    no,
    first,
    deck,
    pos: 0,
    seats: [newSeat(fl[0]), newSeat(fl[1])],
    turns: turnOrder(variant, first, fl),
    idx: 0,
    dealt: [],
    outcome: null,
  });
}

/** Platsen har lagt sitt drag: uppdatera brädet och gå till nästa tur */
export function played(h: HandState, seat: SeatId, move: Move): HandState {
  const seats: [Seat, Seat] = [...h.seats];
  seats[seat] = applyToSeat(seats[seat], move);
  return nextTurn({ ...h, seats, idx: h.idx + 1 });
}

// ============================================================
// moves.ts — Drag, bräden och poäng för träningsläget
// ============================================================
//
// Ett "drag" = vilka kort som läggs i vilka rader (+ ev. kastade kort).
// Solvern returnerar EV för ALLA sätt att lägga korten (result.options),
// så spelarens drag finns alltid med. Vi hittar det genom att jämföra
// en "nyckel": kort@rad för varje kort, sorterat. Platsen i raden
// (slotIndex) spelar ingen roll, och alla jokrar räknas som lika.
// ============================================================

import type { Board, Card, RowName } from '../engine/types';
import { createEmptyBoard } from '../engine/types';
import type { DetailedPlacementOption, DetailedSolverResult } from '../solver/solver';

export const ROWS: RowName[] = ['top', 'middle', 'bottom'];

export interface Placement {
  card: Card;
  row: RowName;
  slotIndex: number;
}

export interface Move {
  placements: Placement[];
  discards: Card[];
}

export function cardKey(c: Card): string {
  return c.kind === 'joker' ? 'JK' : c.rank + c.suit;
}

/** Nyckel som är lika för två drag som lägger samma kort i samma rader */
export function moveKey(m: { placements: { card: Card; row: RowName }[]; discards: Card[] }): string {
  return [
    ...m.placements.map((p) => `${cardKey(p.card)}@${p.row}`),
    ...m.discards.map((c) => `${cardKey(c)}@x`),
  ]
    .sort()
    .join(',');
}

/** Hitta spelarens drag bland solverns alternativ (undefined om det saknas) */
export function findOption(result: DetailedSolverResult, move: Move): DetailedPlacementOption | undefined {
  const key = moveKey(move);
  return result.options.find((o) => moveKey(o) === key);
}

// ---------- Bräden ----------

export function cloneBoard(b: Board): Board {
  return {
    top: { name: 'top', cards: [...b.top.cards] },
    middle: { name: 'middle', cards: [...b.middle.cards] },
    bottom: { name: 'bottom', cards: [...b.bottom.cards] },
  };
}

export function countPlaced(b: Board): number {
  return ROWS.reduce((n, r) => n + b[r].cards.filter((c) => c !== null).length, 0);
}

export function rowCards(b: Board, r: RowName): Card[] {
  return b[r].cards.filter((c): c is Card => c !== null);
}

/** Lägg korten på första lediga plats i respektive rad (solverns slotIndex är bara ett förslag) */
export function applyMove(board: Board, placements: { card: Card; row: RowName }[]): Board {
  const out = cloneBoard(board);
  for (const p of placements) {
    const i = out[p.row].cards.findIndex((c) => c === null);
    if (i < 0) throw new Error(`Raden ${p.row} är full`);
    out[p.row].cards[i] = p.card;
  }
  return out;
}

/** Placeringarna i ett drag, med slotIndex omräknat mot ett visst bräde (för spökkort) */
export function placementsOn(board: Board, placements: { card: Card; row: RowName }[]): Placement[] {
  const taken: Record<RowName, Set<number>> = { top: new Set(), middle: new Set(), bottom: new Set() };
  return placements.map((p) => {
    const i = board[p.row].cards.findIndex((c, k) => c === null && !taken[p.row].has(k));
    taken[p.row].add(i);
    return { card: p.card, row: p.row, slotIndex: i };
  });
}

export function emptyBoard(): Board {
  return createEmptyBoard();
}

// ---------- Poäng i scenarioträningen ----------

export type Grade = 'perfect' | 'good' | 'miss';

export const GRADE_LABEL: Record<Grade, string> = { perfect: 'Perfekt', good: 'Bra', miss: 'Miss' };

/** Gränser för graderingen (EV-diff) */
export const PERFECT_MAX = 0.05;
export const GOOD_MAX = 0.5;

export function gradeOf(diff: number): Grade {
  if (diff <= PERFECT_MAX) return 'perfect';
  if (diff <= GOOD_MAX) return 'good';
  return 'miss';
}

/**
 * Max 100 p per scenario: 100 − diff × 100, aldrig under 0.
 * Perfekt (diff ≤ 0,05) ger alltid fulla 100 p — så små skillnader ligger
 * inom solverns slumpbrus och ska inte kosta poäng.
 */
export function pointsFor(diff: number): number {
  if (diff <= PERFECT_MAX) return 100;
  return Math.max(0, Math.round(100 - diff * 100));
}

/**
 * Spelarens drag räknades inte klart → EV:n är osäkrare.
 * Solvern säger det exakt via `finalist`; saknas fältet (t.ex. Fantasy
 * Land) används tumregeln "färre än hälften så många simuleringar".
 */
export function wasScreenedEarly(player: DetailedPlacementOption, best: DetailedPlacementOption): boolean {
  if (player === best) return false;
  if (player.finalist !== undefined) return !player.finalist;
  return player.simulations < best.simulations * 0.5;
}

export interface Judgement {
  bestEv: number;
  playerEv: number;
  diff: number;
  points: number;
  grade: Grade;
  screened: boolean;
  /** Draget fanns inte i solverns lista (bara möjligt i Fantasy Land, där solvern returnerar topp 15) */
  missing: boolean;
  best: DetailedPlacementOption;
  player: DetailedPlacementOption | null;
}

/**
 * Bedöm spelarens drag mot solverns resultat.
 * Obs: solverns lista är sorterad efter hur länge draget "överlevde",
 * inte efter EV. Ett tidigt bortsållat drag kan av slumpen ha högre EV
 * än result.best — därför aldrig negativ diff.
 */
export function judge(result: DetailedSolverResult, move: Move): Judgement {
  const best = result.best;
  const player = findOption(result, move) ?? null;
  if (!player) {
    // Vanliga drag: ska inte hända (solvern provar alla). Fantasy Land: solvern
    // returnerar bara topp 15 — då är draget minst lika dåligt som det sämsta i listan.
    const worst = Math.min(...result.options.map((o) => o.ev));
    const diff = Math.max(0, best.ev - worst);
    return { bestEv: best.ev, playerEv: worst, diff, points: pointsFor(diff), grade: gradeOf(diff), screened: false, missing: true, best, player };
  }
  const diff = Math.max(0, best.ev - player.ev);
  return {
    bestEv: best.ev,
    playerEv: player.ev,
    diff,
    points: pointsFor(diff),
    grade: gradeOf(diff),
    screened: wasScreenedEarly(player, best),
    missing: false,
    best,
    player,
  };
}

// ---------- Kortlek ----------

/** Blanda en kopia (Fisher–Yates) */
export function shuffled<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

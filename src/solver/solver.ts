// ============================================================
// solver.ts — Huvud-API för OFC-solvern (används av Web Workern)
// ============================================================
//
// Översätter appens kort/bräden till den snabba kärnan i src/core/:
//   - core/sim.ts    → Monte Carlo (vanligt drag, öppningshand, Pineapple)
//   - core/fl.ts     → exakt Fantasy Land-lösare
//   - core/eval.ts   → handvärdering, jokrar, foul, poäng
// och översätter svaret tillbaka till placeringar som UI:t visar.
// ============================================================

import type { Card, Board, GameVariant, RowName } from '../engine/types';
import { createEmptyBoard } from '../engine/types';
import { toInt } from '../core/eval';
import { allAssignments } from '../core/policy';
import { evaluateCandidates, opponentPool } from '../core/sim';
import type { Candidate, CandidateResult } from '../core/sim';
import { solveFantasyLand, evaluateFLAssign } from '../core/fl';

// ============================================================
// Publika typer
// ============================================================

export interface SolverOptions {
  /** Max simuleringar per kandidat (de bästa kandidaterna får flest) */
  simulations?: number;
  /** Max tid i ms för hela beräkningen (default: 20000) */
  maxMs?: number;
  /** Callback för progress (0–100) */
  onProgress?: (percent: number) => void;
  /**
   * Låsta drag: varje inre lista är ett komplett drag (alla kort i handen,
   * 'discard' = kastas i Pineapple). De sållas aldrig bort och räknas lika
   * noga som bästa draget, på samma blandningar. I Fantasy Land räknas
   * de exakt och läggs till i listan om de inte redan är med.
   */
  pinned?: PinnedMove[];
}

/** Ett komplett drag: vilket kort som hamnar i vilken rad (eller kastas) */
export type PinnedMove = { card: Card; row: RowName | 'discard' }[];

export interface CardPlacement {
  card: Card;
  row: RowName;
  slotIndex: number;
}

export interface DetailedPlacementOption {
  /** Förväntat värde i poäng (inkl. värdet av ev. Fantasy Land) */
  ev: number;
  /** Rangordning (1 = bäst) */
  rank: number;
  /** Vilken rad det primära kortet läggs i */
  primaryRow: RowName;
  /** Alla kortplaceringar i denna tur */
  placements: CardPlacement[];
  /** Kort som kastas (Pineapple/FL) */
  discards: Card[];
  /** Antal simuleringar för just denna placering */
  simulations: number;
  /** Andel simuleringar som nådde Fantasy Land (0–1) */
  flProbability?: number;
  /** Andel simuleringar som slutade i foul (0–1) */
  foulProbability?: number;
  /** true om uppställningen ger repeat-FL (Fantasy Land-läge) */
  repeatFL?: boolean;
  /** Brädet efter placeringen */
  resultBoard?: Board;
  /** true = överlevde sållningen till slutet (eller var låst) → lika noga räknad som bästa draget */
  finalist?: boolean;
  /** true = draget var låst via options.pinned */
  pinned?: boolean;
  /** Standardfel för EV-skillnaden mot bästa draget, parvis på samma blandningar (bara finalister) */
  evDiffSE?: number;
  /** Standardfel för EV-skillnaden mot det första låsta draget (options.pinned[0]). 0 i Fantasy Land (exakt) */
  evDiffSEPin0?: number;
}

export interface DetailedSolverResult {
  options: DetailedPlacementOption[];
  best: DetailedPlacementOption;
  simulations: number;
  timedOut: boolean;
  method: 'monteCarlo' | 'exact';
}

const ROWS: RowName[] = ['top', 'middle', 'bottom'];

// ============================================================
// Översättning app ↔ kärna
// ============================================================

/** Ger varje synligt kort ett heltal; jokrar får 52 resp. 53 i ordning */
class CardIds {
  private jokers = 0;
  id(c: Card): number {
    if (c.kind === 'joker') return this.jokers++ === 0 ? 52 : 53;
    return toInt(c);
  }
  rows(board: Board): number[][] {
    return ROWS.map((r) => board[r].cards.filter((c): c is Card => c !== null).map((c) => this.id(c)));
  }
}

function unseenFrom(seen: number[]): number[] {
  const s = new Set(seen);
  return Array.from({ length: 54 }, (_, i) => i).filter((i) => !s.has(i));
}

const sameCard = (a: Card, b: Card) =>
  a.kind === 'joker' ? b.kind === 'joker' : b.kind === 'card' && a.rank === b.rank && a.suit === b.suit;

/** Samma nyckel som allAssignments använder: vilka kort-id:n som hamnar var */
const assignKey = (hand: number[], assign: number[]) =>
  [-1, 0, 1, 2].map((r) => hand.filter((_, k) => assign[k] === r).sort().join('.')).join('|');

/** Översätter ett låst drag till en assign-array (rad per kort, -1 = kastas) */
function pinnedAssign(move: PinnedMove, cards: Card[]): number[] {
  const assign: number[] = cards.map(() => NaN);
  for (const { card, row } of move) {
    const k = cards.findIndex((c, i) => Number.isNaN(assign[i]) && sameCard(c, card));
    if (k < 0) throw new Error('Låst drag innehåller ett kort som inte finns i handen.');
    assign[k] = row === 'discard' ? -1 : ROWS.indexOf(row);
  }
  if (assign.some((a) => Number.isNaN(a))) throw new Error('Låst drag saknar placering för något kort i handen.');
  return assign;
}

function buildOption(
  board: Board, hand: Card[], assign: number[], ev: number, sims: number,
): DetailedPlacementOption {
  const resultBoard: Board = {
    top: { name: 'top', cards: [...board.top.cards] },
    middle: { name: 'middle', cards: [...board.middle.cards] },
    bottom: { name: 'bottom', cards: [...board.bottom.cards] },
  };
  const placements: CardPlacement[] = [];
  const discards: Card[] = [];
  hand.forEach((card, k) => {
    if (assign[k] < 0) { discards.push(card); return; }
    const row = ROWS[assign[k]];
    const slotIndex = resultBoard[row].cards.findIndex((c) => c === null);
    resultBoard[row].cards[slotIndex] = card;
    placements.push({ card, row, slotIndex });
  });
  const counts = [0, 0, 0];
  for (const a of assign) if (a >= 0) counts[a]++;
  const primary = counts[2] >= counts[1] && counts[2] >= counts[0] ? 2 : counts[1] >= counts[0] ? 1 : 0;
  return { ev, rank: 0, primaryRow: ROWS[primary], placements, discards, simulations: sims, resultBoard };
}

function finish(options: DetailedPlacementOption[], method: DetailedSolverResult['method'], timedOut = false): DetailedSolverResult {
  options.forEach((o, i) => (o.rank = i + 1));
  return { options, best: options[0], simulations: options.reduce((a, o) => a + o.simulations, 0), timedOut, method };
}

// ============================================================
// Huvud-API
// ============================================================

/**
 * Bästa placering av `cards` på `board` (vanligt drag, öppning eller Pineapple).
 * Döda kort = kort som syns men inte ligger på något bräde (t.ex. kastade).
 */
export function solveFromBoard(
  board: Board,
  cards: Card[],
  deadCards: Card[] = [],
  variant: GameVariant = 'regular',
  options: SolverOptions = {},
  opponentBoard?: Board,
): DetailedSolverResult {
  if (cards.length === 0) throw new Error('Inga kort att placera.');
  const { simulations = 800, onProgress } = options;
  const maxMs = options.maxMs ?? (simulations <= 300 ? 8000 : simulations <= 800 ? 20000 : 45000);

  const ids = new CardIds();
  const rows = ids.rows(board);
  const opp = opponentBoard ? ids.rows(opponentBoard) : undefined;
  const hand = cards.map((c) => ids.id(c));
  const dead = deadCards.map((c) => ids.id(c));
  const seen = [...rows.flat(), ...(opp ?? []).flat(), ...hand, ...dead];
  const unseen = unseenFrom(seen);

  const free = 13 - rows.flat().length;
  if (hand.length > free + (variant === 'pineapple' && hand.length === 3 ? 1 : 0)) {
    throw new Error('Fler kort än lediga platser på brädet.');
  }

  // Kandidater: alla sätt att lägga ut korten (Pineapple: ett av tre kastas)
  const cands: Candidate[] = [];
  if (variant === 'pineapple' && hand.length === 3) {
    for (let d = 0; d < 3; d++) {
      const keep = hand.filter((_, k) => k !== d);
      for (const a of allAssignments(rows, keep)) cands.push({ assign: [...a.slice(0, d), -1, ...a.slice(d)] });
    }
  } else {
    for (const a of allAssignments(rows, hand)) cands.push({ assign: a });
  }
  if (cands.length === 0) throw new Error('Inga giltiga placeringar hittades.');

  // Låsta drag → markera motsvarande kandidat
  if (options.pinned?.length) {
    const byKey = new Map(cands.map((c) => [assignKey(hand, c.assign), c]));
    options.pinned.forEach((move, idx) => {
      const cand = byKey.get(assignKey(hand, pinnedAssign(move, cards)));
      if (!cand) throw new Error('Låst drag är inte ett giltigt drag i den här situationen.');
      cand.pinned = true;
      if (cand.pinIndex === undefined) cand.pinIndex = idx;
    });
  }

  const t0 = Date.now();
  const res: CandidateResult[] = evaluateCandidates(
    { rows, hand, unseen, opponent: opp, variant, maxSims: simulations, maxMs, onProgress },
    cands,
  );
  const timedOut = Date.now() - t0 >= maxMs;

  const out = res.map((r) => {
    const o = buildOption(board, cards, r.assign, r.ev, r.sims);
    o.flProbability = r.flRate;
    o.foulProbability = r.foulRate;
    o.finalist = r.finalist;
    if (r.pinned) o.pinned = true;
    if (r.evDiffSE !== undefined) o.evDiffSE = r.evDiffSE;
    if (r.evDiffSEPin0 !== undefined) o.evDiffSEPin0 = r.evDiffSEPin0;
    return o;
  });
  return finish(out, 'monteCarlo', timedOut);
}

/** Öppningshand: 5 kort på tomt bräde */
export function solveOpeningHand(
  cards: Card[],
  deadCards: Card[] = [],
  options: SolverOptions = {},
  variant: GameVariant = 'regular',
): DetailedSolverResult {
  return solveFromBoard(createEmptyBoard(), cards, deadCards, variant, options);
}

/** Fantasy Land: 13–16 kort → exakt bästa uppställning */
export function solveFantasyLandMode(
  cards: Card[],
  _deadCards: Card[] = [],
  options: SolverOptions = {},
): DetailedSolverResult {
  if (cards.length < 13 || cards.length > 16) throw new Error(`Fantasy Land kräver 13–16 kort, fick ${cards.length}.`);
  options.onProgress?.(5);
  const ids = new CardIds();
  const hand = cards.map((c) => ids.id(c));
  const pool = opponentPool('regular');
  options.onProgress?.(30);
  const res = solveFantasyLand(hand, pool);
  options.onProgress?.(100);
  const top = res.slice(0, 15);
  // Låsta uppställningar (Jämför): räknas exakt och läggs till om de inte redan är med
  const pinnedKeys = new Set<string>();
  for (const move of options.pinned ?? []) {
    const assign = pinnedAssign(move, cards);
    const key = assignKey(hand, assign);
    pinnedKeys.add(key);
    if (!top.some((r) => assignKey(hand, r.assign) === key)) top.push(evaluateFLAssign(hand, assign, pool));
  }
  const out = top.map((r) => {
    const o = buildOption(createEmptyBoard(), cards, r.assign, r.ev, pool.length);
    o.repeatFL = r.repeat;
    if (pinnedKeys.has(assignKey(hand, r.assign))) {
      o.pinned = true;
      o.evDiffSEPin0 = 0;
    }
    return o;
  });
  // Bästa först (en låst uppställning kan bara vara sämre eller lika, men sortera för säkerhets skull)
  out.sort((a, b) => b.ev - a.ev);
  return finish(out, 'exact');
}

// ============================================================
// Web Worker-meddelanden
// ============================================================

export type SolverWorkerMessage =
  | { type: 'solveFromBoard'; board: Board; cards: Card[]; deadCards?: Card[]; variant?: GameVariant; opponentBoard?: Board; options?: SolverOptions }
  | { type: 'solve_opening'; cards: Card[]; deadCards?: Card[]; variant?: GameVariant; options?: SolverOptions }
  | { type: 'solve_fl'; cards: Card[]; deadCards?: Card[]; options?: SolverOptions };

export type SolverWorkerResponse =
  | { type: 'result'; result: DetailedSolverResult }
  | { type: 'error'; message: string }
  | { type: 'progress'; percent: number };

export function handleSolverMessage(msg: SolverWorkerMessage): SolverWorkerResponse {
  try {
    switch (msg.type) {
      case 'solveFromBoard':
        return { type: 'result', result: solveFromBoard(msg.board, msg.cards, msg.deadCards, msg.variant, msg.options, msg.opponentBoard) };
      case 'solve_opening':
        return { type: 'result', result: solveOpeningHand(msg.cards, msg.deadCards, msg.options, msg.variant) };
      case 'solve_fl':
        return { type: 'result', result: solveFantasyLandMode(msg.cards, msg.deadCards, msg.options) };
    }
    return { type: 'error', message: `Okänd meddelandetyp: ${(msg as { type: string }).type}` };
  } catch (err) {
    return { type: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}

// ============================================================
// solver.ts — Huvud-API för OFC-solvern
// ============================================================
//
// Orkestrerare som tar emot ett GameState och returnerar rankade
// placeringsalternativ med EV-värden. Delegerar till:
//   - placement.ts   → generera lagliga placeringar
//   - heuristics.ts  → filtrera och rangordna snabbt
//   - monteCarlo.ts  → beräkna EV via simulering
//
// Exponerar solve() som kan köras i en Web Worker via
// solverWorker.ts (allt är synkront och serialiserbart).
//
// Hanterar:
//   - Vanlig OFC (1 kort åt gången, runda 2–9)
//   - Vanlig OFC runda 1 (5 kort)
//   - Pineapple OFC (3 kort in, 2 placeras, 1 kastas)
//   - Fantasy Land (13–16 kort, komplett bräde på en gång)
// ============================================================

import type {
  Card,
  Board,
  GameState,
  GameVariant,
  RowName,
  PlacementOption,
  SolverResult,
} from '../engine/types';
import { collectDeadCards } from '../engine/gameState';
import type { TurnPlacement, CardPlacement } from './placement';
import {
  generateRegularPlacements,
  generatePineapplePlacements,
  generateFantasyLandPlacements as generateFLPlacements,
} from './placement';
import { filterPlacements, filterFantasyLandPlacements } from './heuristics';
import {
  runMonteCarlo,
  runFantasyLandMonteCarlo,
  runMonteCarloSinglePlayer,
} from './monteCarlo';
import type { MonteCarloResult, PlacementEV } from './monteCarlo';

// ============================================================
// Publika typer
// ============================================================

export interface SolverOptions {
  /** Antal Monte Carlo-simuleringar per kandidat (default: 1000) */
  simulations?: number;
  /** Max tid i ms för hela beräkningen (default: 5000) */
  maxMs?: number;
  /** Max kandidater att utvärdera med MC (default: 50) */
  topCandidates?: number;
  /** Hoppa över Monte Carlo och använd bara heuristik (snabbläge) */
  heuristicOnly?: boolean;
}

/**
 * Utökat solverresultat med detaljer om varje placering,
 * inklusive vilka kort som placeras var och vilka som kastas.
 */
export interface DetailedSolverResult {
  /** Alla utvärderade alternativ, sorterade bäst → sämst */
  options: DetailedPlacementOption[];
  /** Bästa alternativ */
  best: DetailedPlacementOption;
  /** Antal simuleringar totalt */
  simulations: number;
  /** true om beräkningen avbröts p.g.a. tidsgräns */
  timedOut: boolean;
  /** Vilken metod som användes */
  method: 'monteCarlo' | 'heuristic';
}

export interface DetailedPlacementOption {
  /** EV för denna placering */
  ev: number;
  /** Rangordning (1 = bäst) */
  rank: number;
  /** Vilken rad det primära kortet läggs i (för enkel-kort-placering) */
  primaryRow: RowName;
  /** Alla kortplaceringar i denna tur */
  placements: CardPlacement[];
  /** Kort som kastas (Pineapple/FL) */
  discards: Card[];
  /** Antal simuleringar för just denna placering */
  simulations: number;
}

// ============================================================
// Huvud-API
// ============================================================

/**
 * Kör solvern och returnerar rankade placeringsalternativ.
 *
 * Detta är det primära API:et — allt annat (heuristik, Monte Carlo,
 * FL-hantering) delegeras härifrån.
 *
 * Designad att köras i en Web Worker (synkron, serialiserbar input/output).
 *
 * @param state       Aktuellt GameState
 * @param playerId    Spelarens index i state.players
 * @param opponentId  Motståndarens index (default: 1 om playerId=0, annars 0)
 * @param options     Simuleringsinställningar
 */
export function solve(
  state: GameState,
  playerId: number = 0,
  opponentId?: number,
  options: SolverOptions = {},
): DetailedSolverResult {
  const oppId = opponentId ?? (playerId === 0 ? 1 : 0);

  const player = state.players[playerId];
  if (!player) {
    throw new Error(`Ingen spelare med id ${playerId}.`);
  }
  if (!state.players[oppId]) {
    throw new Error(`Ingen motståndare med id ${oppId}.`);
  }

  if (state.currentCards.length === 0) {
    throw new Error('Inga kort att placera (currentCards är tom).');
  }

  // Välj lösningsväg baserat på spelets fas
  if (player.isFantasyLand) {
    return solveFantasyLand(state, playerId, oppId, options);
  }

  return solveNormal(state, playerId, oppId, options);
}

/**
 * Förenklat API: tar emot bräde + kort utan fullständigt GameState.
 * Skapar ett minimalt GameState internt. Användbart för Web Worker
 * och tester.
 *
 * @param board       Spelarens nuvarande bräde
 * @param cards       Kort att placera
 * @param deadCards   Döda kort (redan använda)
 * @param variant     Spelvariant
 * @param options     Simuleringsinställningar
 */
export function solveFromBoard(
  board: Board,
  cards: Card[],
  deadCards: Card[] = [],
  variant: GameVariant = 'regular',
  options: SolverOptions = {},
): DetailedSolverResult {
  const {
    simulations = 1000,
    maxMs = 5000,
    topCandidates = 50,
    heuristicOnly = false,
  } = options;

  if (cards.length === 0) {
    throw new Error('Inga kort att placera.');
  }

  if (heuristicOnly) {
    return solveHeuristicOnly(board, cards, variant);
  }

  const mcResult = runMonteCarloSinglePlayer(board, cards, deadCards, {
    simulations,
    maxMs,
    topCandidates,
  });

  return convertMonteCarloResult(mcResult, 'monteCarlo');
}

// ============================================================
// Interna lösningsvägar
// ============================================================

/**
 * Löser en vanlig (icke-FL) placering med full Monte Carlo.
 */
function solveNormal(
  state: GameState,
  playerId: number,
  opponentId: number,
  options: SolverOptions,
): DetailedSolverResult {
  const {
    simulations = 1000,
    maxMs = 5000,
    topCandidates = 50,
    heuristicOnly = false,
  } = options;

  if (heuristicOnly) {
    const player = state.players[playerId];
    return solveHeuristicOnly(player.board, state.currentCards, state.variant);
  }

  const mcResult = runMonteCarlo(state, playerId, opponentId, {
    simulations,
    maxMs,
    topCandidates,
  });

  return convertMonteCarloResult(mcResult, 'monteCarlo');
}

/**
 * Löser en Fantasy Land-placering.
 */
function solveFantasyLand(
  state: GameState,
  _playerId: number,
  opponentId: number,
  options: SolverOptions,
): DetailedSolverResult {
  const {
    simulations = 500,
    maxMs = 8000,
    topCandidates = 100,
    heuristicOnly = false,
  } = options;

  const opponent = state.players[opponentId];
  const deadCards = collectDeadCards(state);

  if (heuristicOnly) {
    return solveFantasyLandHeuristicOnly(state.currentCards);
  }

  const mcResult = runFantasyLandMonteCarlo(
    state.currentCards,
    deadCards,
    opponent.board,
    { simulations, maxMs, topCandidates },
  );

  return convertMonteCarloResult(mcResult, 'monteCarlo');
}

/**
 * Ren heuristisk lösning (ingen Monte Carlo).
 * Snabbt men mindre exakt — användbart för realtidsförhandsgranskning.
 */
function solveHeuristicOnly(
  board: Board,
  cards: Card[],
  variant: GameVariant,
): DetailedSolverResult {
  let candidates: TurnPlacement[];

  if (variant === 'pineapple' && cards.length === 3) {
    candidates = generatePineapplePlacements(board, cards);
  } else {
    candidates = generateRegularPlacements(board, cards);
  }

  const filtered = filterPlacements(candidates, board, 50);

  if (filtered.length === 0) {
    throw new Error('Inga giltiga placeringar hittades.');
  }

  const options: DetailedPlacementOption[] = filtered.map((p, idx) => ({
    ev: filtered.length - idx, // Heuristisk rangordning (ej riktig EV)
    rank: idx + 1,
    primaryRow: getPrimaryRow(p),
    placements: p.placements,
    discards: p.discards,
    simulations: 0,
  }));

  return {
    options,
    best: options[0],
    simulations: 0,
    timedOut: false,
    method: 'heuristic',
  };
}

/**
 * Ren heuristisk lösning för Fantasy Land.
 */
function solveFantasyLandHeuristicOnly(
  cards: Card[],
): DetailedSolverResult {
  const all = generateFLPlacements(cards);
  const filtered = filterFantasyLandPlacements(all, 100);

  if (filtered.length === 0) {
    throw new Error('Inga giltiga FL-placeringar hittades.');
  }

  const options: DetailedPlacementOption[] = filtered.map((p, idx) => ({
    ev: filtered.length - idx,
    rank: idx + 1,
    primaryRow: 'bottom' as RowName, // FL har inga "primära" rader
    placements: p.placements,
    discards: p.discards,
    simulations: 0,
  }));

  return {
    options,
    best: options[0],
    simulations: 0,
    timedOut: false,
    method: 'heuristic',
  };
}

// ============================================================
// Konverteringshjälp
// ============================================================

/**
 * Konverterar MonteCarloResult till DetailedSolverResult.
 */
function convertMonteCarloResult(
  mcResult: MonteCarloResult,
  method: 'monteCarlo' | 'heuristic',
): DetailedSolverResult {
  const options: DetailedPlacementOption[] = mcResult.ranked.map(
    (r: PlacementEV, idx: number) => ({
      ev: r.ev,
      rank: idx + 1,
      primaryRow: getPrimaryRow(r.placement),
      placements: r.placement.placements,
      discards: r.placement.discards,
      simulations: r.simulations,
    }),
  );

  return {
    options,
    best: options[0],
    simulations: mcResult.totalSimulations,
    timedOut: mcResult.timedOut,
    method,
  };
}

/**
 * Bestämmer den "primära" raden för en placering.
 * För enkla placeringar (1 kort): raden där kortet läggs.
 * För flerkorts-placeringar: raden med flest kort (eller bottom).
 */
function getPrimaryRow(placement: TurnPlacement): RowName {
  if (placement.placements.length === 0) return 'bottom';
  if (placement.placements.length === 1) return placement.placements[0].row;

  const counts: Record<RowName, number> = { top: 0, middle: 0, bottom: 0 };
  for (const p of placement.placements) {
    counts[p.row]++;
  }

  // Returnera raden med flest kort (tiebreak: bottom > middle > top)
  if (counts.bottom >= counts.middle && counts.bottom >= counts.top) return 'bottom';
  if (counts.middle >= counts.top) return 'middle';
  return 'top';
}

// ============================================================
// Konvertering till SolverResult (kompatibel med types.ts)
// ============================================================

/**
 * Konverterar DetailedSolverResult till det enklare SolverResult-formatet
 * definierat i types.ts (för äldre UI-konsumenter).
 */
export function toSimpleSolverResult(result: DetailedSolverResult): SolverResult {
  const options: PlacementOption[] = result.options.map((o) => ({
    row: o.primaryRow,
    slotIndex: o.placements[0]?.slotIndex ?? 0,
    ev: o.ev,
    rank: o.rank,
  }));

  return {
    options,
    best: options[0],
    simulations: result.simulations,
  };
}

// ============================================================
// Web Worker-kompatibelt meddelande-API
// ============================================================

/**
 * Input-meddelande som kan skickas till en Web Worker.
 * Alla fält är serialiserbara (inga funktioner/klasser).
 */
export interface SolverWorkerInput {
  type: 'solve';
  state: GameState;
  playerId: number;
  opponentId?: number;
  options?: SolverOptions;
}

export interface SolverWorkerInputFromBoard {
  type: 'solveFromBoard';
  board: Board;
  cards: Card[];
  deadCards?: Card[];
  variant?: GameVariant;
  options?: SolverOptions;
}

export type SolverWorkerMessage = SolverWorkerInput | SolverWorkerInputFromBoard;

export interface SolverWorkerOutput {
  type: 'result';
  result: DetailedSolverResult;
}

export interface SolverWorkerError {
  type: 'error';
  message: string;
}

export type SolverWorkerResponse = SolverWorkerOutput | SolverWorkerError;

/**
 * Hanterar ett meddelande i Web Worker-kontext.
 * Kan anropas direkt från solverWorker.ts:
 *
 *   self.onmessage = (e) => {
 *     const response = handleSolverMessage(e.data);
 *     self.postMessage(response);
 *   };
 */
export function handleSolverMessage(
  msg: SolverWorkerMessage,
): SolverWorkerResponse {
  try {
    if (msg.type === 'solve') {
      const result = solve(msg.state, msg.playerId, msg.opponentId, msg.options);
      return { type: 'result', result };
    }

    if (msg.type === 'solveFromBoard') {
      const result = solveFromBoard(
        msg.board,
        msg.cards,
        msg.deadCards,
        msg.variant,
        msg.options,
      );
      return { type: 'result', result };
    }

    return { type: 'error', message: `Okänd meddelandetyp: ${(msg as any).type}` };
  } catch (err: any) {
    return { type: 'error', message: err.message || String(err) };
  }
}

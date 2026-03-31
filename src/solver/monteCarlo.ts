// ============================================================
// monteCarlo.ts — Monte Carlo-motor för OFC-solvern
// ============================================================
//
// Hur det fungerar:
//
//   1. Spelaren har ett eller flera kort att placera.
//   2. Vi tar fram alla möjliga TurnPlacement (via placement.ts),
//      filtrerar med heuristik (via heuristics.ts).
//   3. För varje kandidat:
//      a. Applicera placeringen på spelarens bräde.
//      b. Kör N slumpmässiga "rollouts" (färdigspelningar):
//         - Blanda de okända korten (ej döda, ej på brädet).
//         - Fyll spelarens bräde med greedyCompletion.
//         - Fyll motståndarens bräde med greedyCompletion.
//         - Beräkna poäng med scoreHand.
//      c. EV = genomsnittlig poäng för P1 över alla rollouts.
//   4. Returnera kandidaterna sorterade efter EV.
//
// Joker-hantering:
//   - Jokrar i leken behandlas som okända kort precis som vanliga.
//   - greedyCompletion hanterar joker-identitetsresolution.
//
// Prestanda:
//   - Standard: 1000 simuleringar per kandidat.
//   - Fantasy Land: heuristik reducerar kandidater till ~100 innan
//     Monte Carlo körs med 500 simuleringar per kandidat.
//   - Tidsgräns (maxMs): avbryt tidigt om vi tar för lång tid.
//     Returnerar de bästa resultaten vi hann med.
// ============================================================

import type { Card, Board, GameState } from '../engine/types';
import { buildDeck, removeDeadCards } from '../engine/deck';
import { scoreHand } from '../engine/scoring';
import { collectDeadCards, isBoardComplete, getFantasyLandEntryCards } from '../engine/gameState';
import { FL_VALUE_MAP } from './flConfig';
import type { TurnPlacement } from './placement';
import {
  generatePlacements,
  generateFantasyLandPlacements,
} from './placement';
import {
  filterPlacements,
  filterFantasyLandPlacements,
  greedyCompletion,
  applyPlacement,
} from './heuristics';

// ============================================================
// Publika typer
// ============================================================

export interface MonteCarloOptions {
  /** Antal simuleringar per placeringskandidat (default: 1000) */
  simulations?: number;
  /** Max antal millisekunder för hela beräkningen (default: 5000) */
  maxMs?: number;
  /** Max antal kandidater att utvärdera med MC (default: 50) */
  topCandidates?: number;
  /** Anropas med 0–100 under beräkning */
  onProgress?: (percent: number) => void;
  /** FL-aggressivitet som påverkar bonus i rollout */
  flAggression?: 'conservative' | 'balanced' | 'aggressive';
}

export interface PlacementEV {
  placement: TurnPlacement;
  /** Genomsnittligt poäng för P1 (kan vara negativt) */
  ev: number;
  /** Antal simuleringar som faktiskt kördes */
  simulations: number;
}

export interface MonteCarloResult {
  /** Alla utvärderade placeringar, sorterade bäst → sämst */
  ranked: PlacementEV[];
  /** Bästa placering */
  best: PlacementEV;
  /** Totalt antal simuleringar */
  totalSimulations: number;
  /** true om vi avbröt p.g.a. tidsgräns */
  timedOut: boolean;
}

// ============================================================
// Huvud-API
// ============================================================

/**
 * Kör Monte Carlo-simulering för en spelares placering.
 *
 * @param state       Aktuellt GameState
 * @param playerId    Index i state.players för spelaren vi optimerar
 * @param opponentId  Index i state.players för motståndaren
 * @param options     Simuleringsinställningar
 */
export function runMonteCarlo(
  state: GameState,
  playerId: number,
  opponentId: number,
  options: MonteCarloOptions = {},
): MonteCarloResult {
  const {
    simulations = 1000,
    maxMs = 5000,
    topCandidates = 50,
    onProgress,
    flAggression,
  } = options;

  const player   = state.players[playerId];
  const opponent = state.players[opponentId];

  if (!player || !opponent) {
    throw new Error(`Ogiltigt playerId (${playerId}) eller opponentId (${opponentId}).`);
  }

  const deadline = Date.now() + maxMs;

  // --- Generera och filtrera kandidater ---
  const isFL = player.isFantasyLand;

  let candidates: TurnPlacement[];
  let simsPerCandidate: number;

  if (isFL) {
    // Fantasy Land: generera alla FL-placeringar och filtrera till topp-100
    const allFL = generateFantasyLandPlacements(state.currentCards);
    candidates = filterFantasyLandPlacements(allFL, Math.min(topCandidates, 100));
    simsPerCandidate = Math.max(200, Math.min(simulations, 500));
  } else {
    // Vanlig OFC / Pineapple
    const allPlacements = generatePlacements(state, playerId);
    candidates = filterPlacements(allPlacements, player.board, topCandidates);
    simsPerCandidate = simulations;
  }

  if (candidates.length === 0) {
    throw new Error('Inga giltiga placeringar hittades.');
  }

  // --- Bygg "kända döda kort" ---
  // Döda kort = allt som är placerat + currentCards + explicit deadCards
  const allDeadCards = collectDeadCards(state);

  // --- Kör Monte Carlo för varje kandidat ---
  const results: PlacementEV[] = [];
  let totalSims = 0;
  let timedOut = false;

  const totalCandidates = candidates.length;
  for (let ci = 0; ci < candidates.length; ci++) {
    const candidate = candidates[ci];
    if (Date.now() >= deadline) {
      timedOut = true;
      break;
    }

    onProgress?.(Math.round((ci / totalCandidates) * 100));

    const { ev, simCount } = evaluatePlacement(
      candidate,
      player.board,
      opponent.board,
      allDeadCards,
      state.currentCards,
      simsPerCandidate,
      deadline,
      flAggression,
    );

    results.push({ placement: candidate, ev, simulations: simCount });
    totalSims += simCount;
  }

  onProgress?.(100);

  // Sortera bäst → sämst
  results.sort((a, b) => b.ev - a.ev);

  if (results.length === 0) {
    throw new Error('Monte Carlo returnerade inga resultat.');
  }

  return {
    ranked: results,
    best: results[0],
    totalSimulations: totalSims,
    timedOut,
  };
}

// ============================================================
// Intern simulering
// ============================================================

/**
 * Utvärderar en enskild TurnPlacement med N rollouts.
 * Returnerar genomsnittlig EV och antal körda simuleringar.
 */
function evaluatePlacement(
  placement: TurnPlacement,
  playerBoard: Board,
  opponentBoard: Board,
  allDeadCards: Card[],
  _currentCards: Card[],
  simulations: number,
  deadline: number,
  flAggression?: 'conservative' | 'balanced' | 'aggressive',
): { ev: number; simCount: number } {
  // Applicera placeringen på spelarens bräde
  const boardAfterPlacement = applyPlacement(playerBoard, placement);

  // Korten som kastas i denna tur (t.ex. Pineapple-discard) är nu döda
  const newDead = [...allDeadCards, ...placement.discards];

  // Hur många kort saknas på varje bräde?
  const playerNeedsCards   = countEmptySlots(boardAfterPlacement);
  const opponentNeedsCards = countEmptySlots(opponentBoard);

  // Om båda brädena är kompletta → inga slumpmässiga rollouts behövs
  if (playerNeedsCards === 0 && opponentNeedsCards === 0) {
    const ev = scoreTwoBoards(boardAfterPlacement, opponentBoard);
    return { ev, simCount: 1 };
  }

  // Bygg den "okända" leken (alla 54 kort minus döda)
  const unknownDeck = buildUnknownDeck(newDead);

  let totalEV = 0;
  let simCount = 0;

  for (let i = 0; i < simulations; i++) {
    if (i % 100 === 0 && Date.now() >= deadline) break;

    const ev = rollout(
      boardAfterPlacement,
      opponentBoard,
      unknownDeck,
      playerNeedsCards,
      opponentNeedsCards,
      flAggression,
    );

    totalEV += ev;
    simCount++;
  }

  if (simCount === 0) {
    return { ev: 0, simCount: 0 };
  }

  return { ev: totalEV / simCount, simCount };
}

/**
 * En enskild rollout: slumpa ut okända kort, fyll brädena med greedy,
 * beräkna och returnera P1:s nettopotäng.
 */
function rollout(
  playerBoard: Board,
  opponentBoard: Board,
  unknownDeck: Card[],
  playerNeedsCards: number,
  opponentNeedsCards: number,
  flAggression?: 'conservative' | 'balanced' | 'aggressive',
): number {
  // Blanda leken inplace (Fisher-Yates, definieras nedan för prestanda)
  shuffleInPlace(unknownDeck);

  // Dra kort till spelaren och motståndaren
  const totalNeeded = playerNeedsCards + opponentNeedsCards;

  // Om vi inte har tillräckligt med kort: returnera 0 (degenerat fall)
  if (unknownDeck.length < totalNeeded) {
    return 0;
  }

  const playerCards   = unknownDeck.slice(0, playerNeedsCards);
  const opponentCards = unknownDeck.slice(playerNeedsCards, totalNeeded);

  // Fyll brädena med greedy-completion
  const completedPlayer   = greedyCompletion(playerBoard, playerCards, true);
  const completedOpponent = greedyCompletion(opponentBoard, opponentCards);

  const baseScore = scoreTwoBoards(completedPlayer, completedOpponent);

  // FL-bonus: om spelaren kvalificerar sig för Fantasy Land, lägg till FL-värde
  const topCards = completedPlayer.top.cards.filter((c): c is Card => c !== null);
  if (topCards.length === 3) {
    const flCards = getFantasyLandEntryCards(topCards as any);
    if (flCards > 0 && baseScore > -50) {
      const flValue = FL_VALUE_MAP[flAggression ?? 'balanced'];
      return baseScore + flValue;
    }
  }

  return baseScore;
}

/**
 * Beräknar P1:s nettopotäng för två kompletta bräden.
 * Returnerar 0 om något bräde inte är komplett (säkerhetsventil).
 */
function scoreTwoBoards(playerBoard: Board, opponentBoard: Board): number {
  const p1Top    = extractRowCards(playerBoard,   'top');
  const p1Middle = extractRowCards(playerBoard,   'middle');
  const p1Bottom = extractRowCards(playerBoard,   'bottom');
  const p2Top    = extractRowCards(opponentBoard, 'top');
  const p2Middle = extractRowCards(opponentBoard, 'middle');
  const p2Bottom = extractRowCards(opponentBoard, 'bottom');

  // Säkerhetskontroll: rätt kortantal
  if (
    p1Top.length    !== 3 || p1Middle.length !== 5 || p1Bottom.length !== 5 ||
    p2Top.length    !== 3 || p2Middle.length !== 5 || p2Bottom.length !== 5
  ) {
    return 0;
  }

  try {
    const result = scoreHand(p1Top, p1Middle, p1Bottom, p2Top, p2Middle, p2Bottom);
    return result.p1Net;
  } catch {
    // Ogiltigt bräde (t.ex. duplikat-kort) → returnera 0
    return 0;
  }
}

// ============================================================
// Hjälpfunktioner
// ============================================================

/**
 * Räknar tomma slots på ett bräde (behövda kort för completion).
 */
function countEmptySlots(board: Board): number {
  let count = 0;
  for (const rowName of ['top', 'middle', 'bottom'] as const) {
    count += board[rowName].cards.filter((c) => c === null).length;
  }
  return count;
}

/**
 * Extraherar icke-null-kort från en rad.
 */
function extractRowCards(board: Board, row: 'top' | 'middle' | 'bottom'): Card[] {
  return board[row].cards.filter((c): c is Card => c !== null);
}

/**
 * Bygger den "okända" kortleken: alla 54 kort minus de döda.
 * Skapar en ny array varje gång (blandas per rollout).
 */
function buildUnknownDeck(deadCards: Card[]): Card[] {
  const full = buildDeck(); // 54 kort
  return removeDeadCards(full, deadCards);
}

/**
 * Fisher-Yates in-place shuffle (snabbare än att skapa ny array).
 * Muterar arrayen.
 */
function shuffleInPlace(arr: Card[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

// ============================================================
// Specialfall: enspelar-EV (utan motståndare)
// ============================================================

/**
 * Beräknar EV för spelaren mot en slumpmässig motståndare.
 * Används när motståndarens bräde är helt okänt (tomt).
 *
 * Identisk med runMonteCarlo men opponentBoard är alltid tomt.
 * Exporteras för användning i Web Worker och tester.
 */
export function runMonteCarloSinglePlayer(
  playerBoard: Board,
  cardsToPlace: Card[],
  deadCards: Card[],
  options: MonteCarloOptions = {},
): MonteCarloResult {
  const {
    simulations = 1000,
    maxMs = 5000,
    topCandidates = 50,
    onProgress,
  } = options;

  const deadline = Date.now() + maxMs;

  // Generera alla möjliga placeringar för korten i handen
  const emptyOpponentBoard: Board = {
    top:    { name: 'top',    cards: [null, null, null] },
    middle: { name: 'middle', cards: [null, null, null, null, null] },
    bottom: { name: 'bottom', cards: [null, null, null, null, null] },
  };

  // Skapa ett minimalt state för placement-generering
  const placementCandidates = generatePlacementsFromBoard(
    playerBoard,
    cardsToPlace,
  );

  const filtered = filterPlacements(placementCandidates, playerBoard, topCandidates);

  if (filtered.length === 0) {
    throw new Error('Inga giltiga placeringar hittades.');
  }

  const allDead = [...deadCards, ...cardsToPlace];
  const results: PlacementEV[] = [];
  let totalSims = 0;
  let timedOut = false;

  const totalCandidates = filtered.length;
  for (let ci = 0; ci < filtered.length; ci++) {
    const candidate = filtered[ci];
    if (Date.now() >= deadline) {
      timedOut = true;
      break;
    }

    onProgress?.(Math.round((ci / totalCandidates) * 100));

    const { ev, simCount } = evaluatePlacement(
      candidate,
      playerBoard,
      emptyOpponentBoard,
      allDead,
      cardsToPlace,
      simulations,
      deadline,
    );

    results.push({ placement: candidate, ev, simulations: simCount });
    totalSims += simCount;
  }

  onProgress?.(100);
  results.sort((a, b) => b.ev - a.ev);

  if (results.length === 0) {
    throw new Error('Monte Carlo returnerade inga resultat.');
  }

  return {
    ranked: results,
    best: results[0],
    totalSimulations: totalSims,
    timedOut,
  };
}

// ============================================================
// Fantasy Land Monte Carlo
// ============================================================

/**
 * Kör Monte Carlo för en Fantasy Land-hand.
 *
 * FL: spelaren har 13–16 kort att fördela (kastas de övrigt).
 * Inget ytterligare slumpmoment — brädet läggs komplett på en gång.
 * Solvern utvärderar alla (heuristiskt filtrerade) fördelningar
 * mot slumpmässiga motståndarbrädena.
 *
 * @param flCards     13–16 kort i FL-handen
 * @param deadCards   Alla döda kort (inklusive FL-korten)
 * @param opponentBoard  Motståndarens nuvarande (möjligen tomma) bräde
 * @param options     Simuleringsinställningar
 */
export function runFantasyLandMonteCarlo(
  flCards: Card[],
  deadCards: Card[],
  opponentBoard: Board,
  options: MonteCarloOptions = {},
): MonteCarloResult {
  const {
    simulations = 500,
    maxMs = 8000,
    topCandidates = 100,
    onProgress,
  } = options;

  const deadline = Date.now() + maxMs;

  const allFL = generateFantasyLandPlacements(flCards);
  const candidates = filterFantasyLandPlacements(allFL, topCandidates);

  if (candidates.length === 0) {
    throw new Error('Inga giltiga FL-placeringar hittades.');
  }

  // Alla FL-kort är döda (oavsett vilka som kastas)
  const allDead = [...deadCards, ...flCards];

  const results: PlacementEV[] = [];
  let totalSims = 0;
  let timedOut = false;

  const emptyPlayerBoard: Board = {
    top:    { name: 'top',    cards: [null, null, null] },
    middle: { name: 'middle', cards: [null, null, null, null, null] },
    bottom: { name: 'bottom', cards: [null, null, null, null, null] },
  };

  const totalCandidates = candidates.length;
  for (let ci = 0; ci < candidates.length; ci++) {
    const candidate = candidates[ci];
    if (Date.now() >= deadline) {
      timedOut = true;
      break;
    }

    onProgress?.(Math.round((ci / totalCandidates) * 100));

    // Applicera FL-placeringen (sätter ett komplett bräde)
    const completedBoard = applyPlacement(emptyPlayerBoard, candidate);

    // Kontrollera att brädet är komplett efter applicering
    if (!isBoardComplete(completedBoard)) {
      continue;
    }

    // Kör rollouts mot motståndaren
    const unknownDeck = buildUnknownDeck(allDead);
    const opponentNeedsCards = countEmptySlots(opponentBoard);

    let totalEV = 0;
    let simCount = 0;

    for (let i = 0; i < simulations; i++) {
      if (i % 100 === 0 && Date.now() >= deadline) break;

      shuffleInPlace(unknownDeck);

      let completedOpponent: Board;
      if (opponentNeedsCards === 0) {
        completedOpponent = opponentBoard;
      } else {
        if (unknownDeck.length < opponentNeedsCards) break;
        const oppCards = unknownDeck.slice(0, opponentNeedsCards);
        completedOpponent = greedyCompletion(opponentBoard, oppCards);
      }

      totalEV += scoreTwoBoards(completedBoard, completedOpponent);
      simCount++;
    }

    if (simCount > 0) {
      results.push({
        placement: candidate,
        ev: totalEV / simCount,
        simulations: simCount,
      });
      totalSims += simCount;
    }
  }

  onProgress?.(100);
  results.sort((a, b) => b.ev - a.ev);

  if (results.length === 0) {
    throw new Error('FL Monte Carlo returnerade inga resultat.');
  }

  return {
    ranked: results,
    best: results[0],
    totalSimulations: totalSims,
    timedOut,
  };
}

// ============================================================
// Intern hjälp: generera placeringar från bräde + kort
// (utan fullt GameState — används i runMonteCarloSinglePlayer)
// ============================================================

import { generateRegularPlacements, generatePineapplePlacements } from './placement';

function generatePlacementsFromBoard(
  board: Board,
  cards: Card[],
): TurnPlacement[] {
  if (cards.length === 3) {
    // Pineapple: 3 kort → 2 placeras, 1 kastas
    return generatePineapplePlacements(board, cards);
  }
  // Vanlig OFC: 1 eller 5 kort
  return generateRegularPlacements(board, cards);
}

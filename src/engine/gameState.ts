// ============================================================
// gameState.ts — Speltillstånd & rund-övergångar för OFC
// ============================================================
//
// Hanterar:
//   - Skapa nytt spel (vanlig OFC eller Pineapple)
//   - Placera kort på brädet
//   - Rund-övergångar (1–9 för vanlig, 1–8+FL för Pineapple)
//   - Fantasy Land: variabelt antal kort (QQ=13, KK=14, AA=15, triss=16)
//   - Repeat-FL: alltid 13 kort, stannar kvar om krav uppfylls
//   - Döda kort (dead cards) för solverberäkningar
// ============================================================

import type {
  Card,
  GameState,
  GameVariant,
  PlayerState,
  Board,
  RowName,
} from './types';
import { createEmptyBoard, ROW_CAPACITY } from './types';
import { evaluate3, evaluate5 } from './handEval';
import { isJoker } from './card';

// ---------------------------------------------------------------
// Konstanter
// ---------------------------------------------------------------

/** Antal rundor i vanlig OFC (5 enkla + 4 pineapple-liknande = 9 totalt) */
const REGULAR_OFC_ROUNDS = 9;

/** Antal rundor i Pineapple OFC */
const PINEAPPLE_OFC_ROUNDS = 8;

/** Antal kort i runda 1 (vanlig OFC) */
const INITIAL_DEAL_REGULAR = 5;

/** Antal kort i runda 1 (Pineapple OFC) */
const INITIAL_DEAL_PINEAPPLE = 5;

/** Antal kort per runda 2+ (vanlig OFC) */
const CARDS_PER_ROUND_REGULAR = 1;

/** Antal kort per runda 2+ (Pineapple OFC) */
const CARDS_PER_ROUND_PINEAPPLE = 3;

/** Fantasy Land: antal kort vid repeat */
const FL_REPEAT_CARDS = 13;

/** Antal kort att placera på brädet */
const BOARD_TOTAL_CARDS = 13; // 3 + 5 + 5

// ---------------------------------------------------------------
// Fantasy Land-logik
// ---------------------------------------------------------------

/**
 * Kontrollerar om en topphands HandResult kvalificerar för FL-inträde,
 * och i så fall hur många kort spelaren ska få.
 *
 * QQ = 13 kort, KK = 14 kort, AA = 15 kort, triss = 16 kort.
 * Returnerar 0 om handen inte kvalificerar.
 */
export function getFantasyLandEntryCards(topCards: Card[]): number {
  if (topCards.length !== 3) return 0;

  const result = evaluate3(topCards);

  if (result.rank === 'trips') {
    return 16;
  }

  if (result.rank === 'pair') {
    const pairRankValue = result.tiebreakers[0];
    if (pairRankValue === 14) return 15; // AA
    if (pairRankValue === 13) return 14; // KK
    if (pairRankValue === 12) return 13; // QQ
  }

  return 0;
}

/**
 * Kontrollerar om en avslutad hand kvalificerar för att stanna kvar i FL (repeat).
 *
 * Krav (något av):
 *   - Minst fyrtal (quads) på bottom
 *   - Minst kåk (full_house) på middle
 *   - Minst triss (trips) på top
 */
export function qualifiesForRepeatFL(
  topCards: Card[],
  middleCards: Card[],
  bottomCards: Card[],
): boolean {
  if (topCards.length === 3) {
    const topResult = evaluate3(topCards);
    if (topResult.rank === 'trips') return true;
  }

  if (middleCards.length === 5) {
    const midResult = evaluate5(middleCards);
    const midRank = midResult.rank;
    if (
      midRank === 'full_house' ||
      midRank === 'quads' ||
      midRank === 'straight_flush' ||
      midRank === 'royal_flush' ||
      midRank === 'five_of_a_kind'
    ) {
      return true;
    }
  }

  if (bottomCards.length === 5) {
    const botResult = evaluate5(bottomCards);
    const botRank = botResult.rank;
    if (
      botRank === 'quads' ||
      botRank === 'straight_flush' ||
      botRank === 'royal_flush' ||
      botRank === 'five_of_a_kind'
    ) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------
// Skapa spel
// ---------------------------------------------------------------

/**
 * Skapar ett nytt PlayerState för en spelare.
 */
export function createPlayer(id: number): PlayerState {
  return {
    id,
    board: createEmptyBoard(),
    isFantasyLand: false,
    fantasyLandCards: 0,
  };
}

/**
 * Skapar ett nytt GameState redo att börja.
 *
 * @param variant  'regular' | 'pineapple'
 * @param numPlayers  Antal spelare (minst 2)
 */
export function createGameState(
  variant: GameVariant,
  numPlayers: number = 2,
): GameState {
  if (numPlayers < 2) {
    throw new Error('OFC kräver minst 2 spelare.');
  }

  const players: PlayerState[] = [];
  for (let i = 0; i < numPlayers; i++) {
    players.push(createPlayer(i));
  }

  return {
    variant,
    phase: 'setup',
    round: 0,
    players,
    deadCards: [],
    currentCards: [],
    discardIndex: null,
  };
}

// ---------------------------------------------------------------
// Rund-hantering
// ---------------------------------------------------------------

/**
 * Returnerar det maximala antalet rundor för varianten.
 */
export function maxRounds(variant: GameVariant): number {
  return variant === 'regular' ? REGULAR_OFC_ROUNDS : PINEAPPLE_OFC_ROUNDS;
}

/**
 * Returnerar hur många kort som ska delas ut i en given runda.
 * Runda 1 = 5 kort (alltid). Runda 2+ beror på varianten.
 */
export function cardsForRound(variant: GameVariant, round: number): number {
  if (round === 1) {
    return variant === 'regular' ? INITIAL_DEAL_REGULAR : INITIAL_DEAL_PINEAPPLE;
  }
  return variant === 'regular' ? CARDS_PER_ROUND_REGULAR : CARDS_PER_ROUND_PINEAPPLE;
}

/**
 * Startar en ny runda: uppdaterar fas och sätter currentCards.
 * Muterar INTE state — returnerar en ny kopia.
 */
export function startRound(state: GameState, dealtCards: Card[]): GameState {
  const newRound = state.round + 1;
  const expected = cardsForRound(state.variant, newRound);

  if (dealtCards.length !== expected) {
    throw new Error(
      `Runda ${newRound} (${state.variant}) förväntar ${expected} kort, fick ${dealtCards.length}.`,
    );
  }

  return {
    ...state,
    round: newRound,
    phase: 'placing',
    currentCards: dealtCards,
    discardIndex: null,
  };
}

// ---------------------------------------------------------------
// Placering av kort
// ---------------------------------------------------------------

/**
 * Placerar ett kort i en rad på ett bräde.
 * Returnerar en ny Board (muterar inte originalet).
 *
 * @throws om raden är full
 */
export function placeCardOnBoard(
  board: Board,
  card: Card,
  row: RowName,
  slotIndex: number,
): Board {
  const targetRow = board[row];
  const capacity = ROW_CAPACITY[row];

  if (slotIndex < 0 || slotIndex >= capacity) {
    throw new Error(
      `Ogiltigt slotIndex ${slotIndex} för raden "${row}" (kapacitet: ${capacity}).`,
    );
  }

  if (targetRow.cards[slotIndex] !== null) {
    throw new Error(`Slot ${slotIndex} i raden "${row}" är redan fyllt.`);
  }

  const newCards = [...targetRow.cards];
  newCards[slotIndex] = card;

  return {
    ...board,
    [row]: { ...targetRow, cards: newCards },
  };
}

/**
 * Placerar ett kort i nästa lediga plats i en rad (utan att ange slotIndex).
 * Returnerar [ny Board, slotIndex som användes].
 *
 * @throws om raden är full
 */
export function placeCardNextSlot(
  board: Board,
  card: Card,
  row: RowName,
): [Board, number] {
  const targetRow = board[row];
  const slotIndex = targetRow.cards.findIndex((c) => c === null);

  if (slotIndex === -1) {
    throw new Error(`Raden "${row}" är full.`);
  }

  const newBoard = placeCardOnBoard(board, card, row, slotIndex);
  return [newBoard, slotIndex];
}

// ---------------------------------------------------------------
// Döda kort (dead cards)
// ---------------------------------------------------------------

/**
 * Samlar ihop alla placerade kort från alla spelare + currentCards
 * som inte ska återvända till leken.
 *
 * Används av solvern för att veta vilka kort som är "borta".
 */
export function collectDeadCards(state: GameState): Card[] {
  const dead: Card[] = [];

  for (const player of state.players) {
    for (const rowName of ['top', 'middle', 'bottom'] as RowName[]) {
      for (const card of player.board[rowName].cards) {
        if (card !== null) dead.push(card);
      }
    }
  }

  // Inkludera kort i handen (currentCards)
  dead.push(...state.currentCards);

  // Inkludera tidigare döda kort (t.ex. kastade i Pineapple)
  dead.push(...state.deadCards);

  return dead;
}

/**
 * Lägger till ett kort i dead cards-listan.
 * Returnerar ny GameState.
 */
export function addDeadCard(state: GameState, card: Card): GameState {
  return {
    ...state,
    deadCards: [...state.deadCards, card],
  };
}

/**
 * Markerar ett kort som kastat (Pineapple: discardIndex i currentCards).
 * Lägger till kortet i deadCards och tar bort det från currentCards.
 * Returnerar ny GameState.
 */
export function discardCard(state: GameState, index: number): GameState {
  if (index < 0 || index >= state.currentCards.length) {
    throw new Error(`Ogiltigt discardIndex: ${index}.`);
  }

  const card = state.currentCards[index];
  const newCurrentCards = state.currentCards.filter((_, i) => i !== index);

  return {
    ...state,
    currentCards: newCurrentCards,
    discardIndex: null,
    deadCards: [...state.deadCards, card],
  };
}

// ---------------------------------------------------------------
// Bräd-statusfunktioner
// ---------------------------------------------------------------

/**
 * Returnerar antalet placerade kort på ett bräde.
 */
export function countPlacedCards(board: Board): number {
  let count = 0;
  for (const rowName of ['top', 'middle', 'bottom'] as RowName[]) {
    for (const card of board[rowName].cards) {
      if (card !== null) count++;
    }
  }
  return count;
}

/**
 * Kontrollerar om ett bräde är komplett (alla 13 platser fyllda).
 */
export function isBoardComplete(board: Board): boolean {
  return countPlacedCards(board) === BOARD_TOTAL_CARDS;
}

/**
 * Returnerar antalet lediga platser i en specifik rad.
 */
export function freeSlots(board: Board, row: RowName): number {
  return board[row].cards.filter((c) => c === null).length;
}

/**
 * Returnerar en lista med lediga slotIndex i en rad.
 */
export function freeSlotIndices(board: Board, row: RowName): number[] {
  return board[row].cards
    .map((c, i) => (c === null ? i : -1))
    .filter((i) => i !== -1);
}

// ---------------------------------------------------------------
// Pineapple-specifik logik
// ---------------------------------------------------------------

/**
 * Kontrollerar om spelaren i Pineapple-runda har valt vilket kort att kasta.
 * I Pineapple: 3 kort delas ut, spelaren lägger 2 och kastar 1.
 */
export function pineappleDiscardChosen(state: GameState): boolean {
  return state.discardIndex !== null;
}

/**
 * Sätter discardIndex för Pineapple-runda.
 * Returnerar ny GameState.
 */
export function setDiscardIndex(state: GameState, index: number): GameState {
  if (state.variant !== 'pineapple') {
    throw new Error('setDiscardIndex gäller bara Pineapple OFC.');
  }
  if (index < 0 || index >= state.currentCards.length) {
    throw new Error(`Ogiltigt discardIndex: ${index}.`);
  }
  return { ...state, discardIndex: index };
}

// ---------------------------------------------------------------
// Fantasy Land-hantering
// ---------------------------------------------------------------

/**
 * Aktiverar Fantasy Land för en spelare.
 * Sätter isFantasyLand = true och antalet FL-kort.
 *
 * @param cardCount  Antal kort spelaren ska få (13–16).
 */
export function enterFantasyLand(
  state: GameState,
  playerId: number,
  cardCount: number,
): GameState {
  if (cardCount < 13 || cardCount > 16) {
    throw new Error(`FL-kortantal måste vara 13–16, fick ${cardCount}.`);
  }

  const players = state.players.map((p) =>
    p.id === playerId
      ? { ...p, isFantasyLand: true, fantasyLandCards: cardCount }
      : p,
  );

  return { ...state, players };
}

/**
 * Avslutar Fantasy Land för en spelare (sätter tillbaka till normalt läge).
 */
export function exitFantasyLand(
  state: GameState,
  playerId: number,
): GameState {
  const players = state.players.map((p) =>
    p.id === playerId
      ? { ...p, isFantasyLand: false, fantasyLandCards: 0 }
      : p,
  );

  return { ...state, players };
}

/**
 * Kontrollerar om någon spelare är i Fantasy Land.
 */
export function anyPlayerInFantasyLand(state: GameState): boolean {
  return state.players.some((p) => p.isFantasyLand);
}

/**
 * Beräknar FL-kortantal för nästa hand baserat på topphanden.
 * Vid repeat-FL är svaret alltid FL_REPEAT_CARDS (13).
 *
 * @param topCards      Spelarens toppkort (3 st)
 * @param isRepeat      true = spelaren är redan i FL (repeat)
 */
export function calcFantasyLandCards(
  topCards: Card[],
  isRepeat: boolean,
): number {
  if (isRepeat) return FL_REPEAT_CARDS;
  return getFantasyLandEntryCards(topCards);
}

// ---------------------------------------------------------------
// Fas-övergångar
// ---------------------------------------------------------------

/**
 * Övergång till scoring-fasen när alla bräden är kompletta.
 */
export function transitionToScoring(state: GameState): GameState {
  const allComplete = state.players.every((p) => isBoardComplete(p.board));
  if (!allComplete) {
    throw new Error('Kan inte gå till scoring — alla bräden är inte kompletta.');
  }
  return { ...state, phase: 'scoring' };
}

/**
 * Återställer bräden inför nästa hand (håller speltillstånd som FL-status).
 * Rensa currentCards och deadCards.
 */
export function resetForNextHand(state: GameState): GameState {
  const players = state.players.map((p) => ({
    ...p,
    board: createEmptyBoard(),
  }));

  return {
    ...state,
    phase: 'setup',
    round: 0,
    players,
    currentCards: [],
    deadCards: [],
    discardIndex: null,
  };
}

/**
 * Kontrollerar om spelet är slut (alla rundor genomförda).
 */
export function isGameOver(state: GameState): boolean {
  return state.phase === 'finished';
}

/**
 * Avslutar spelet.
 */
export function finishGame(state: GameState): GameState {
  return { ...state, phase: 'finished' };
}

// ---------------------------------------------------------------
// Validering
// ---------------------------------------------------------------

/**
 * Kontrollerar om ett kort är en joker.
 * Återexporterad för bekvämlighet i gameState-kontext.
 */
export { isJoker };

/**
 * Kontrollerar om en placering är laglig (sloten är ledig).
 */
export function isLegalPlacement(
  board: Board,
  row: RowName,
  slotIndex: number,
): boolean {
  const capacity = ROW_CAPACITY[row];
  if (slotIndex < 0 || slotIndex >= capacity) return false;
  return board[row].cards[slotIndex] === null;
}

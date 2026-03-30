// ============================================================
// placement.ts — Generera lagliga placeringar för OFC-solvern
// ============================================================
//
// Hanterar tre placeringsscenarier:
//
//   1. Vanlig OFC (runda 1: 5 kort, runda 2+: 1 kort)
//      → Returnerar alla lediga slots på brädet för varje kort.
//
//   2. Pineapple OFC (runda 2+: 3 kort in, 2 placeras, 1 kastas)
//      → Returnerar alla kombinationer av:
//        (vilket kort kastas × placering för de 2 kvarvarande korten)
//
//   3. Fantasy Land (13–16 kort in, 13 placeras, resten kastas)
//      → Returnerar alla sätt att:
//        (a) välja 13 kort att behålla (kasta resten)
//        (b) fördela de 13 korten på brädet (3 top + 5 middle + 5 bottom)
//
// Notera: Placeringsgenereringen tar INTE hänsyn till foul-regler —
// det är upp till solvern att filtrera bort foul-placeringar.
// ============================================================

import type { Card, Board, RowName, GameState } from '../engine/types';
import { ROW_CAPACITY } from '../engine/types';
import { freeSlotIndices } from '../engine/gameState';

// ============================================================
// Publika typer
// ============================================================

/**
 * En enskild placering: vilket kort läggs var.
 */
export interface CardPlacement {
  card: Card;
  row: RowName;
  slotIndex: number;
}

/**
 * En komplett placering för en hel tur.
 *
 * - `placements`: Lista med 1–13 kort och var de ska läggas.
 * - `discards`:   Lista med kort som kastas denna tur.
 */
export interface TurnPlacement {
  placements: CardPlacement[];
  discards: Card[];
}

// ============================================================
// Interna hjälpfunktioner
// ============================================================

/**
 * Alla lediga (row, slotIndex)-par på ett bräde.
 */
function allFreeSlots(board: Board): { row: RowName; slotIndex: number }[] {
  const result: { row: RowName; slotIndex: number }[] = [];
  const rows: RowName[] = ['top', 'middle', 'bottom'];
  for (const row of rows) {
    for (const slotIndex of freeSlotIndices(board, row)) {
      result.push({ row, slotIndex });
    }
  }
  return result;
}

/**
 * Genererar alla kombinationer av k element ur en array.
 * Returnerar en lista med varje kombination som array av index.
 */
function combinations(n: number, k: number): number[][] {
  const result: number[][] = [];

  function recurse(start: number, combo: number[]) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < n; i++) {
      combo.push(i);
      recurse(i + 1, combo);
      combo.pop();
    }
  }

  recurse(0, []);
  return result;
}

/**
 * Genererar alla permutationer av en array.
 * Används för FL-placering där ordning på brädet spelar roll.
 *
 * OBS: Används INTE direkt — vi använder istället en mer effektiv
 * approach baserad på tilldelning slot-för-slot.
 */

/**
 * Tilldelar rekursivt cards[cardIdx] till ett av de lediga slotsen,
 * och fortsätter med nästa kort tills alla är placerade.
 *
 * `usedSlots` håller koll på vilka slots som redan är valda.
 * `current` är den pågående tilldelningslistan.
 * `result` ackumuleras med färdiga tilldelningar.
 *
 * Slots är sorterade: alla top-slots, sedan middle, sedan bottom.
 * Vi tar alltid slots i ordning från vänster för att undvika dubbletter
 * från permutationer av identiska slots i samma rad.
 */
function assignCardsToSlots(
  cards: Card[],
  slots: { row: RowName; slotIndex: number }[],
  cardIdx: number,
  usedSlots: boolean[],
  current: CardPlacement[],
  result: TurnPlacement[],
  discards: Card[],
): void {
  if (cardIdx === cards.length) {
    result.push({
      placements: current.map((p) => ({ ...p })),
      discards: [...discards],
    });
    return;
  }

  const card = cards[cardIdx];

  // Håll koll på vilka (row, slotIndex)-kombinationer vi provat
  // för detta kort för att undvika dubletter (om flera slots i samma
  // rad är lediga spelar det ingen roll vilken vi väljer — solvern
  // komprimerar senare till rad-nivå).
  // Vi itererar slots i fast ordning och väljer den FÖRSTA lediga sloten
  // per rad för att undvika redundanta permutationer.
  const triedRows = new Set<RowName>();

  for (let i = 0; i < slots.length; i++) {
    if (usedSlots[i]) continue;

    const { row, slotIndex } = slots[i];

    // Hoppa över om vi redan provat denna rad för detta kort
    // (slot-position inom raden spelar ingen roll för solvern på denna nivå)
    if (triedRows.has(row)) continue;
    triedRows.add(row);

    usedSlots[i] = true;
    current.push({ card, row, slotIndex });

    assignCardsToSlots(cards, slots, cardIdx + 1, usedSlots, current, result, discards);

    current.pop();
    usedSlots[i] = false;
  }
}

// ============================================================
// 1. Vanlig OFC — placeringar
// ============================================================

/**
 * Genererar alla lagliga placeringar för en eller flera kort
 * i vanlig OFC (runda 1: 5 kort, runda 2+: 1 kort).
 *
 * Varje TurnPlacement har `discards = []` (inget kastas i vanlig OFC).
 *
 * @param board   Spelarens aktuella bräde
 * @param cards   Kort att placera (1 eller 5 beroende på runda)
 */
export function generateRegularPlacements(
  board: Board,
  cards: Card[],
): TurnPlacement[] {
  const slots = allFreeSlots(board);

  if (cards.length > slots.length) {
    // Fler kort än lediga platser — bör inte hända i ett korrekt spel
    return [];
  }

  if (cards.length === 1) {
    // Vanligaste fallet: ett kort, välj rad (inte slot-specifikt)
    const result: TurnPlacement[] = [];
    const triedRows = new Set<RowName>();

    for (const slot of slots) {
      if (triedRows.has(slot.row)) continue;
      triedRows.add(slot.row);

      result.push({
        placements: [{ card: cards[0], row: slot.row, slotIndex: slot.slotIndex }],
        discards: [],
      });
    }

    return result;
  }

  // Runda 1: flera kort (5 st) ska fördelas
  const result: TurnPlacement[] = [];
  const usedSlots = new Array<boolean>(slots.length).fill(false);
  assignCardsToSlots(cards, slots, 0, usedSlots, [], result, []);
  return result;
}

// ============================================================
// 2. Pineapple OFC — placeringar
// ============================================================

/**
 * Genererar alla lagliga placeringar för Pineapple OFC.
 *
 * Pineapple: 3 kort delas ut, spelaren väljer 1 att kasta och
 * placerar de 2 kvarvarande korten på brädet.
 *
 * Returnerar alla kombinationer av:
 *   - Vilket av de 3 korten som kastas (3 val)
 *   - Var de 2 kvarvarande korten placeras (rad × rad-kombinationer)
 *
 * @param board   Spelarens aktuella bräde
 * @param cards   De 3 delade korten
 */
export function generatePineapplePlacements(
  board: Board,
  cards: Card[],
): TurnPlacement[] {
  if (cards.length !== 3) {
    throw new Error(
      `generatePineapplePlacements förväntar 3 kort, fick ${cards.length}.`,
    );
  }

  const result: TurnPlacement[] = [];
  const slots = allFreeSlots(board);

  if (slots.length < 2) {
    // Inte tillräckligt med lediga platser
    return [];
  }

  // Prova varje möjligt kastval (index 0, 1 eller 2)
  for (let discardIdx = 0; discardIdx < 3; discardIdx++) {
    const discard = cards[discardIdx];
    const keepCards = cards.filter((_, i) => i !== discardIdx);

    // Generera alla sätt att placera de 2 kvarvarande korten
    // på de lediga raderna (ordning spelar roll: keepCards[0] vs keepCards[1] är olika kort)
    const usedSlots = new Array<boolean>(slots.length).fill(false);
    const turnResults: TurnPlacement[] = [];
    assignCardsToSlots(keepCards, slots, 0, usedSlots, [], turnResults, [discard]);

    result.push(...turnResults);
  }

  return result;
}

// ============================================================
// 3. Fantasy Land — placeringar
// ============================================================

/**
 * Genererar alla lagliga FL-placeringar.
 *
 * FL: Spelaren tar emot 13–16 kort, väljer 13 att placera (kasta resten).
 * De 13 korten fördelas: 3 på top, 5 på middle, 5 på bottom.
 *
 * Antal kombinationer kan vara mycket stora för 16 kort (C(16,13) = 560
 * val av vilka 13 att behålla, gånger antalet fördelningar = 13!/(3!5!5!)).
 * Solvern bör använda heuristik för att begränsa sökytan.
 *
 * @param cards   De 13–16 delade FL-korten
 */
export function generateFantasyLandPlacements(cards: Card[]): TurnPlacement[] {
  const n = cards.length;

  if (n < 13 || n > 16) {
    throw new Error(
      `generateFantasyLandPlacements förväntar 13–16 kort, fick ${n}.`,
    );
  }

  const discardCount = n - 13;
  const result: TurnPlacement[] = [];

  // Välj vilka 13 index att BEHÅLLA (kasta resten)
  const keepCombos = combinations(n, 13);

  for (const keepIndices of keepCombos) {
    const keepCards = keepIndices.map((i) => cards[i]);
    const discardCards = cards.filter((_, i) => !keepIndices.includes(i));

    // Säkerhetskoll: rätt antal kastas
    if (discardCards.length !== discardCount) continue;

    // Generera alla sätt att fördela de 13 korten:
    // 3 till top, 5 till middle, 5 till bottom.
    // Vi väljer index i keepCards för varje rad.

    const topCombos = combinations(13, 3);

    for (const topIndices of topCombos) {
      const remaining = keepCards.filter((_, i) => !topIndices.includes(i)); // 10 kvar
      const midCombos = combinations(10, 5);

      for (const midIndices of midCombos) {
        const topCards = topIndices.map((i) => keepCards[i]);
        const middleCards = midIndices.map((i) => remaining[i]);
        const bottomCards = remaining.filter((_, i) => !midIndices.includes(i));

        // Bygg placements: fördela korten på slots i ordning
        const placements: CardPlacement[] = [
          ...topCards.map((card, i) => ({
            card,
            row: 'top' as RowName,
            slotIndex: i,
          })),
          ...middleCards.map((card, i) => ({
            card,
            row: 'middle' as RowName,
            slotIndex: i,
          })),
          ...bottomCards.map((card, i) => ({
            card,
            row: 'bottom' as RowName,
            slotIndex: i,
          })),
        ];

        result.push({
          placements,
          discards: discardCards,
        });
      }
    }
  }

  return result;
}

// ============================================================
// 4. Huvud-API: välj rätt genereringsfunktion baserat på GameState
// ============================================================

/**
 * Returnerar alla lagliga TurnPlacement för aktuellt GameState och spelare.
 *
 * Väljer automatiskt rätt funktion baserat på:
 *   - Spelarens FL-status (isFantasyLand)
 *   - Spelets variant (regular / pineapple)
 *   - Aktuell runda
 *
 * @param state     Aktuellt GameState
 * @param playerId  Spelarens ID (index i state.players)
 */
export function generatePlacements(
  state: GameState,
  playerId: number,
): TurnPlacement[] {
  const player = state.players[playerId];

  if (!player) {
    throw new Error(`Ingen spelare med id ${playerId}.`);
  }

  const cards = state.currentCards;

  // Fantasy Land
  if (player.isFantasyLand) {
    return generateFantasyLandPlacements(cards);
  }

  // Pineapple (runda 2+: 3 kort delas)
  if (state.variant === 'pineapple' && state.round > 1) {
    return generatePineapplePlacements(player.board, cards);
  }

  // Vanlig OFC (runda 1: 5 kort, runda 2+: 1 kort)
  return generateRegularPlacements(player.board, cards);
}

// ============================================================
// 5. Hjälpfunktioner för solvern
// ============================================================

/**
 * Räknar antalet möjliga TurnPlacement utan att generera dem alla.
 * Användbart för att estimera sökytan innan simulering.
 *
 * Returnerar { keepCombinations, boardDistributions, total }
 */
export function countFantasyLandPlacements(cardCount: number): {
  keepCombinations: number;
  boardDistributions: number;
  total: number;
} {
  if (cardCount < 13 || cardCount > 16) {
    throw new Error(`cardCount måste vara 13–16, fick ${cardCount}.`);
  }

  // C(n, 13): antal sätt att välja vilka 13 att behålla
  const keepCombinations = binomialCoeff(cardCount, 13);

  // Antal sätt att fördela 13 kort på 3+5+5:
  // C(13,3) * C(10,5) = 286 * 252 = 72072
  const boardDistributions = binomialCoeff(13, 3) * binomialCoeff(10, 5);

  return {
    keepCombinations,
    boardDistributions,
    total: keepCombinations * boardDistributions,
  };
}

function binomialCoeff(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

/**
 * Kontrollerar om en TurnPlacement fyller brädet korrekt (3+5+5 kort).
 * Användbar som sanity-check i tester och solvern.
 */
export function isCompletePlacement(placement: TurnPlacement): boolean {
  const counts: Record<RowName, number> = { top: 0, middle: 0, bottom: 0 };
  for (const p of placement.placements) {
    counts[p.row]++;
  }
  return (
    counts.top === ROW_CAPACITY.top &&
    counts.middle === ROW_CAPACITY.middle &&
    counts.bottom === ROW_CAPACITY.bottom
  );
}

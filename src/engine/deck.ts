// ============================================================
// deck.ts — Kortlek med 54 kort (52 + 2 jokrar) & döda kort
// ============================================================

import type { Card, RegularCard } from './types';
import { ALL_RANKS, ALL_SUITS, JOKER_COUNT } from './constants';
import { makeCard, makeJoker, isRegularCard, cardsEqual } from './card';

// --- Bygg kortlek ---

/**
 * Skapar en komplett osorterad kortlek med 54 kort:
 * 52 vanliga kort + 2 jokrar.
 */
export function buildDeck(): Card[] {
  const deck: Card[] = [];

  for (const suit of ALL_SUITS) {
    for (const rank of ALL_RANKS) {
      deck.push(makeCard(rank, suit));
    }
  }

  for (let i = 0; i < JOKER_COUNT; i++) {
    deck.push(makeJoker());
  }

  return deck; // 54 kort totalt
}

// --- Slumpa kortlek (Fisher-Yates) ---

/**
 * Blandar en kortlek in-place med Fisher-Yates-algoritmen.
 * Returnerar samma array (muterar).
 */
export function shuffleDeck(deck: Card[]): Card[] {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Skapar och blandar en ny 54-korts kortlek.
 */
export function createShuffledDeck(): Card[] {
  return shuffleDeck(buildDeck());
}

// --- Döda kort (dead cards) ---

/**
 * Kontrollerar om ett kort finns i listan med döda kort.
 * Jokrar matchar alltid andra jokrar (kind === 'joker').
 * Vanliga kort matchar på rank + färg.
 */
export function isDeadCard(card: Card, deadCards: Card[]): boolean {
  for (const dead of deadCards) {
    if (card.kind === 'joker' && dead.kind === 'joker') return true;
    if (
      isRegularCard(card) &&
      isRegularCard(dead) &&
      cardsEqual(card as RegularCard, dead as RegularCard)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Tar bort döda kort från en kortlek.
 * Notera: om det finns 2 jokrar i leken och 1 joker är död,
 * tas bara EN joker bort.
 */
export function removeDeadCards(deck: Card[], deadCards: Card[]): Card[] {
  const remaining = [...deck];
  for (const dead of deadCards) {
    const idx = remaining.findIndex((c) => {
      if (dead.kind === 'joker' && c.kind === 'joker') return true;
      if (
        dead.kind === 'card' &&
        c.kind === 'card' &&
        cardsEqual(dead as RegularCard, c as RegularCard)
      ) {
        return true;
      }
      return false;
    });
    if (idx !== -1) {
      remaining.splice(idx, 1);
    }
  }
  return remaining;
}

// --- Dra kort ---

/**
 * Drar `count` kort från toppen av leken.
 * Returnerar [dragna kort, resterande kortlek].
 * Muterar INTE originalArrayen.
 */
export function dealCards(deck: Card[], count: number): [Card[], Card[]] {
  if (count > deck.length) {
    throw new Error(
      `Kan inte dra ${count} kort — leken innehåller bara ${deck.length} kort.`
    );
  }
  return [deck.slice(0, count), deck.slice(count)];
}

// --- Hjälpfunktioner ---

/**
 * Returnerar antalet återstående kort i leken efter att döda kort tagits bort.
 */
export function remainingCount(deck: Card[], deadCards: Card[]): number {
  return removeDeadCards(deck, deadCards).length;
}

/**
 * Kontrollerar om ett specifikt vanligt kort finns kvar i leken
 * (dvs inte är ett dött kort).
 */
export function isAvailable(card: Card, deadCards: Card[]): boolean {
  return !isDeadCard(card, deadCards);
}

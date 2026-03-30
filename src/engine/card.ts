// ============================================================
// card.ts — Skapa, parsa och formatera kort
// ============================================================

import type { Card, RegularCard, JokerCard, Rank, Suit } from './types';
import { ALL_RANKS, ALL_SUITS, RANK_ORDER, SUIT_SYMBOL } from './constants';

// --- Skapa kort ---

/** Skapar ett vanligt kort */
export function makeCard(rank: Rank, suit: Suit): RegularCard {
  return { kind: 'card', rank, suit };
}

/** Skapar en joker */
export function makeJoker(): JokerCard {
  return { kind: 'joker' };
}

// --- Typskydd ---

export function isRegularCard(card: Card): card is RegularCard {
  return card.kind === 'card';
}

export function isJoker(card: Card): card is JokerCard {
  return card.kind === 'joker';
}

// --- Parsa kort från sträng ---

/**
 * Parsar en kortsträng till ett Card-objekt.
 * Format: "As" = A♠, "Th" = T♥, "JK" = joker.
 *
 * Rankbokstäver: 2-9, T, J, Q, K, A
 * Färgbokstäver: c (clubs), d (diamonds), h (hearts), s (spades)
 *
 * @throws om strängen inte är ett giltigt kortformat
 */
export function parseCard(str: string): Card {
  const trimmed = str.trim().toUpperCase();

  if (trimmed === 'JK' || trimmed === 'JOKER') {
    return makeJoker();
  }

  if (trimmed.length !== 2) {
    throw new Error(`Ogiltigt kortformat: "${str}". Förväntade 2 tecken (t.ex. "As", "Th") eller "JK".`);
  }

  const rankChar = trimmed[0];
  const suitChar = trimmed[1].toLowerCase();

  const RANK_MAP: Record<string, Rank> = {
    '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
    '7': '7', '8': '8', '9': '9', 'T': 'T',
    'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A',
  };

  const SUIT_MAP: Record<string, Suit> = {
    'c': 'clubs',
    'd': 'diamonds',
    'h': 'hearts',
    's': 'spades',
  };

  const rank = RANK_MAP[rankChar];
  if (!rank) {
    throw new Error(`Ogiltig rank: "${rankChar}". Giltiga värden: 2-9, T, J, Q, K, A.`);
  }

  const suit = SUIT_MAP[suitChar];
  if (!suit) {
    throw new Error(`Ogiltig färg: "${suitChar}". Giltiga värden: c, d, h, s.`);
  }

  return makeCard(rank, suit);
}

// --- Formatera kort som sträng ---

const SUIT_CHAR: Record<Suit, string> = {
  clubs:    'c',
  diamonds: 'd',
  hearts:   'h',
  spades:   's',
};

/**
 * Konverterar ett kort till en kompakt sträng, t.ex. "As", "Th", "JK".
 */
export function cardToString(card: Card): string {
  if (isJoker(card)) return 'JK';
  return `${card.rank}${SUIT_CHAR[card.suit]}`;
}

/**
 * Konverterar ett kort till en läsbar sträng med symbol, t.ex. "A♠", "T♥", "JOKER".
 */
export function cardToDisplay(card: Card): string {
  if (isJoker(card)) return 'JOKER';
  return `${card.rank}${SUIT_SYMBOL[card.suit]}`;
}

// --- Jämföra kort ---

/**
 * Jämför rankordning. Returnerar:
 *  - negativt om a < b
 *  - 0 om a === b
 *  - positivt om a > b
 */
export function compareRanks(a: Rank, b: Rank): number {
  return RANK_ORDER[a] - RANK_ORDER[b];
}

/**
 * Returnerar numeriskt rankindex (2–14) för ett vanligt kort.
 */
export function rankValue(card: RegularCard): number {
  return RANK_ORDER[card.rank];
}

/**
 * Kontrollerar om två vanliga kort är identiska (samma rank och färg).
 */
export function cardsEqual(a: RegularCard, b: RegularCard): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

// --- Validering ---

export function isValidRank(r: string): r is Rank {
  return (ALL_RANKS as string[]).includes(r);
}

export function isValidSuit(s: string): s is Suit {
  return (ALL_SUITS as string[]).includes(s);
}

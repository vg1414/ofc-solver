// ============================================================
// constants.ts — Enums, rankindex och royalty-tabeller
// ============================================================

import type { Rank, Suit, HandRank } from './types';

// --- Rankordning (numeriskt index för jämförelser) ---

export const RANK_ORDER: Record<Rank, number> = {
  '2':  2,
  '3':  3,
  '4':  4,
  '5':  5,
  '6':  6,
  '7':  7,
  '8':  8,
  '9':  9,
  'T': 10,
  'J': 11,
  'Q': 12,
  'K': 13,
  'A': 14,
};

export const ALL_RANKS: Rank[] = [
  '2','3','4','5','6','7','8','9','T','J','Q','K','A'
];

export const ALL_SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];

// --- Handrank-ordning (lägre index = svagare hand) ---

export const HAND_RANK_ORDER: Record<HandRank, number> = {
  high_card:       0,
  pair:            1,
  two_pair:        2,
  trips:           3,
  straight:        4,
  flush:           5,
  full_house:      6,
  quads:           7,
  straight_flush:  8,
  five_of_a_kind:  9,  // 20p bottom — mellan straight flush (15p) och royal (25p)
  royal_flush:    10,
};

// --- Royalty-tabeller ---

/**
 * Bottom-royalties.
 * Triss ger 0p på bottom (avvikelse från standard-OFC).
 */
export const BOTTOM_ROYALTIES: Partial<Record<HandRank, number>> = {
  trips:          0,   // triss = 0p (ej standard)
  straight:       2,
  flush:          4,
  full_house:     6,
  quads:          10,
  straight_flush: 15,
  royal_flush:    25,
  five_of_a_kind: 20,
};

/**
 * Middle-royalties.
 * Alltid dubbla poäng jämfört med bottom.
 * Triss ger 2p (dvs dubbelt av bottom-0 = 0, men specialregel = 2p).
 */
export const MIDDLE_ROYALTIES: Partial<Record<HandRank, number>> = {
  trips:          2,   // specialregel: 2p (inte dubbla av 0)
  straight:       4,
  flush:          8,
  full_house:     12,
  quads:          20,
  straight_flush: 30,
  royal_flush:    50,
  five_of_a_kind: 40,
};

/**
 * Topp-royalties (3-korts hand).
 * Par: 66=1p, 77=2p, ..., AA=9p
 * Triss: 222=10p, 333=11p, ..., AAA=22p
 */

/** Par-royalties på topp: rankindex → poäng */
export const TOP_PAIR_ROYALTIES: Record<number, number> = {
  6:  1,  // 66
  7:  2,  // 77
  8:  3,  // 88
  9:  4,  // 99
  10: 5,  // TT
  11: 6,  // JJ
  12: 7,  // QQ
  13: 8,  // KK
  14: 9,  // AA
};

/** Triss-royalties på topp: rankindex → poäng (222=10p upp till AAA=22p) */
export const TOP_TRIPS_ROYALTIES: Record<number, number> = {
  2:  10, // 222
  3:  11, // 333
  4:  12, // 444
  5:  13, // 555
  6:  14, // 666
  7:  15, // 777
  8:  16, // 888
  9:  17, // 999
  10: 18, // TTT
  11: 19, // JJJ
  12: 20, // QQQ
  13: 21, // KKK
  14: 22, // AAA
};

// --- Fantasy Land ---

/**
 * FL-inträde: minsta topphanden → antal kort att ta emot.
 * QQ=13, KK=14, AA=15, triss=16.
 */
export const FL_ENTRY_CARDS: Record<string, number> = {
  QQ: 13,
  KK: 14,
  AA: 15,
  trips: 16,
};

/** Antal kort att kasta i FL (totalKort - 13) */
export function flDiscardCount(totalCards: number): number {
  return totalCards - 13;
}

// --- Kortlekar ---

/** Total kortleksstorlek inklusive jokrar */
export const DECK_SIZE = 54;
export const STANDARD_DECK_SIZE = 52;
export const JOKER_COUNT = 2;

// --- Suit-symboler (för visning) ---

export const SUIT_SYMBOL: Record<Suit, string> = {
  clubs:    '♣',
  diamonds: '♦',
  hearts:   '♥',
  spades:   '♠',
};

export const SUIT_COLOR: Record<Suit, 'black' | 'red'> = {
  clubs:    'black',
  diamonds: 'red',
  hearts:   'red',
  spades:   'black',
};

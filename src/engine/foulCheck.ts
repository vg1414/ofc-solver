// ============================================================
// foulCheck.ts — Foul-validering för OFC
// ============================================================
//
// Regler: top < middle < bottom (rankordning).
// Om top ≥ middle ELLER middle ≥ bottom → foul.
//
// Joker-hantering:
//   Jokrar bestäms i slutet av handen. foulCheck anropar
//   handEval (som optimerar joker-identiteter internt) och
//   jämför de resulterande HandResult-objekten. Det betyder
//   att om en jokerkombination kan undvika foul gör
//   handEval.ts det automatiskt — vi behöver bara jämföra
//   de optimala resultaten.
// ============================================================

import type { Card, HandResult } from './types';
import { evaluate3, evaluate5, compareHands } from './handEval';

// ---------------------------------------------------------------
// Publikt API
// ---------------------------------------------------------------

/**
 * Kontrollerar om ett komplett bräde är foul.
 *
 * Returnerar `true` om handen är foul (ogiltig).
 *
 * Krav: topCards.length === 3, middle/bottomCards.length === 5.
 * Jokrar hanteras automatiskt via handEval (wildcards optimeras
 * för att undvika foul om möjligt).
 */
export function isFoul(
  topCards: Card[],
  middleCards: Card[],
  bottomCards: Card[],
): boolean {
  if (topCards.length !== 3 || middleCards.length !== 5 || bottomCards.length !== 5) {
    throw new Error(
      `isFoul förväntar 3+5+5 kort, fick ${topCards.length}+${middleCards.length}+${bottomCards.length}`,
    );
  }

  const topResult    = evaluate3(topCards);
  const middleResult = evaluate5(middleCards);
  const bottomResult = evaluate5(bottomCards);

  return isFoulFromResults(topResult, middleResult, bottomResult);
}

/**
 * Kontrollerar foul direkt från redan utvärderade HandResult.
 * Användbart när handvärderingen redan gjorts (undviker dubbelt arbete).
 *
 * Foul om: top ≥ middle ELLER middle ≥ bottom.
 */
export function isFoulFromResults(
  topResult: HandResult,
  middleResult: HandResult,
  bottomResult: HandResult,
): boolean {
  // top måste vara STRIKT svagare än middle
  if (compareHands(topResult, middleResult) >= 0) return true;

  // middle måste vara STRIKT svagare än bottom
  if (compareHands(middleResult, bottomResult) >= 0) return true;

  return false;
}

/**
 * Returnerar en detaljerad foul-rapport (för debugging och UI).
 */
export interface FoulReport {
  isFoul: boolean;
  topVsMiddle: 'ok' | 'foul';   // 'foul' om top ≥ middle
  middleVsBottom: 'ok' | 'foul'; // 'foul' om middle ≥ bottom
  description: string;
}

export function foulReport(
  topCards: Card[],
  middleCards: Card[],
  bottomCards: Card[],
): FoulReport {
  if (topCards.length !== 3 || middleCards.length !== 5 || bottomCards.length !== 5) {
    throw new Error(
      `foulReport förväntar 3+5+5 kort, fick ${topCards.length}+${middleCards.length}+${bottomCards.length}`,
    );
  }

  const topResult    = evaluate3(topCards);
  const middleResult = evaluate5(middleCards);
  const bottomResult = evaluate5(bottomCards);

  const topVsMiddle: 'ok' | 'foul' =
    compareHands(topResult, middleResult) >= 0 ? 'foul' : 'ok';

  const middleVsBottom: 'ok' | 'foul' =
    compareHands(middleResult, bottomResult) >= 0 ? 'foul' : 'ok';

  const fouled = topVsMiddle === 'foul' || middleVsBottom === 'foul';

  let description: string;
  if (!fouled) {
    description = `Giltig hand: ${topResult.description} / ${middleResult.description} / ${bottomResult.description}`;
  } else if (topVsMiddle === 'foul' && middleVsBottom === 'foul') {
    description = `Dubbel foul: topp (${topResult.description}) ≥ middle (${middleResult.description}) OCH middle ≥ bottom (${bottomResult.description})`;
  } else if (topVsMiddle === 'foul') {
    description = `Foul: topp (${topResult.description}) ≥ middle (${middleResult.description})`;
  } else {
    description = `Foul: middle (${middleResult.description}) ≥ bottom (${bottomResult.description})`;
  }

  return { isFoul: fouled, topVsMiddle, middleVsBottom, description };
}

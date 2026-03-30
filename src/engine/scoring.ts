// ============================================================
// scoring.ts — Full OFC-poängberäkning mellan två spelare
// ============================================================
//
// Poängflöde:
//   1. Kontrollera foul för varje spelare.
//   2. Om en spelare är foul: hen får 0p, motståndaren
//      får +6p (scoop) PLUS sina egna royalties.
//   3. Om ingen är foul: jämför rad för rad (1p per vunnen rad),
//      scoop (+3p) om man vinner alla tre, plus royalties.
//
// Rad-för-rad-jämförelse:
//   - Top:    evaluate3 → compareHands
//   - Middle: evaluate5 → compareHands
//   - Bottom: evaluate5 → compareHands
//
// Joker-hantering: delegeras helt till handEval (wildcards
// optimeras automatiskt av evaluate3/evaluate5).
// ============================================================

import type { Card, HandResult, RoyaltyResult } from './types';
import { evaluate3, evaluate5, compareHands } from './handEval';
import { calcAllRoyalties } from './royalties';
import { isFoulFromResults } from './foulCheck';

// ---------------------------------------------------------------
// Typer
// ---------------------------------------------------------------

export interface RowScore {
  /** Poäng som spelare 1 vann på denna rad (negativ = förlust) */
  p1Points: number;
  /** Vinnare: 'p1' | 'p2' | 'tie' */
  winner: 'p1' | 'p2' | 'tie';
  p1Hand: HandResult;
  p2Hand: HandResult;
}

export interface ScorecardResult {
  /** Nettopåäng för spelare 1 (positivt = P1 vann) */
  p1Net: number;
  /** Nettopåäng för spelare 2 (positivt = P2 vann) */
  p2Net: number;

  p1Foul: boolean;
  p2Foul: boolean;

  /** Royalties för respektive spelare (0 vid foul) */
  p1Royalties: RoyaltyResult;
  p2Royalties: RoyaltyResult;

  /** Rad-för-rad-resultat (null om någon är foul) */
  rows: {
    top: RowScore | null;
    middle: RowScore | null;
    bottom: RowScore | null;
  };

  /** Antal rader P1 vann (0–3, exkl. foul-scenarion) */
  p1RowWins: number;
  /** Antal rader P2 vann (0–3, exkl. foul-scenarion) */
  p2RowWins: number;

  /** Scoop-bonus (+3p) om en spelare vann alla 3 rader */
  p1Scoop: boolean;
  p2Scoop: boolean;

  description: string;
}

// ---------------------------------------------------------------
// Konstanter
// ---------------------------------------------------------------

/** Poäng motståndaren får vid foul (ersätter alla rad-poäng) */
const FOUL_PENALTY = 6;

/** Scoop-bonus när man vinner alla 3 rader */
const SCOOP_BONUS = 3;

// ---------------------------------------------------------------
// Publikt API
// ---------------------------------------------------------------

/**
 * Beräknar hela poängutfallet för en hand mellan P1 och P2.
 *
 * @param p1Top    P1:s 3 toppkort
 * @param p1Middle P1:s 5 middle-kort
 * @param p1Bottom P1:s 5 bottom-kort
 * @param p2Top    P2:s 3 toppkort
 * @param p2Middle P2:s 5 middle-kort
 * @param p2Bottom P2:s 5 bottom-kort
 */
export function scoreHand(
  p1Top: Card[], p1Middle: Card[], p1Bottom: Card[],
  p2Top: Card[], p2Middle: Card[], p2Bottom: Card[],
): ScorecardResult {
  // 1. Evaluera händerna
  const p1TopR    = evaluate3(p1Top);
  const p1MidR    = evaluate5(p1Middle);
  const p1BotR    = evaluate5(p1Bottom);
  const p2TopR    = evaluate3(p2Top);
  const p2MidR    = evaluate5(p2Middle);
  const p2BotR    = evaluate5(p2Bottom);

  // 2. Foul-kontroll
  const p1Foul = isFoulFromResults(p1TopR, p1MidR, p1BotR);
  const p2Foul = isFoulFromResults(p2TopR, p2MidR, p2BotR);

  // 3. Royalties (0 om foul)
  const p1Royalties = p1Foul
    ? { top: 0, middle: 0, bottom: 0, total: 0 }
    : calcAllRoyalties(p1Top, p1Middle, p1Bottom);
  const p2Royalties = p2Foul
    ? { top: 0, middle: 0, bottom: 0, total: 0 }
    : calcAllRoyalties(p2Top, p2Middle, p2Bottom);

  // 4. Poängberäkning
  if (p1Foul && p2Foul) {
    // Båda foul → 0 poäng vardera (ingen vinner)
    return buildResult({
      p1Net: 0, p2Net: 0,
      p1Foul, p2Foul,
      p1Royalties, p2Royalties,
      rows: { top: null, middle: null, bottom: null },
      p1RowWins: 0, p2RowWins: 0,
      p1Scoop: false, p2Scoop: false,
      description: 'Båda spelare foulade — 0 poäng vardera',
    });
  }

  if (p1Foul) {
    // P1 foulade: P2 får 6 + sina royalties
    const p2Net = FOUL_PENALTY + p2Royalties.total;
    return buildResult({
      p1Net: -p2Net, p2Net,
      p1Foul, p2Foul,
      p1Royalties, p2Royalties,
      rows: { top: null, middle: null, bottom: null },
      p1RowWins: 0, p2RowWins: 0,
      p1Scoop: false, p2Scoop: false,
      description: `P1 foulade. P2 får scoop ${FOUL_PENALTY}p + royalties ${p2Royalties.total}p = ${p2Net}p`,
    });
  }

  if (p2Foul) {
    // P2 foulade: P1 får 6 + sina royalties
    const p1Net = FOUL_PENALTY + p1Royalties.total;
    return buildResult({
      p1Net, p2Net: -p1Net,
      p1Foul, p2Foul,
      p1Royalties, p2Royalties,
      rows: { top: null, middle: null, bottom: null },
      p1RowWins: 0, p2RowWins: 0,
      p1Scoop: false, p2Scoop: false,
      description: `P2 foulade. P1 får scoop ${FOUL_PENALTY}p + royalties ${p1Royalties.total}p = ${p1Net}p`,
    });
  }

  // 5. Ingen foul — jämför rad för rad
  const topRow    = scoreRow(p1TopR,  p2TopR);
  const middleRow = scoreRow(p1MidR,  p2MidR);
  const bottomRow = scoreRow(p1BotR,  p2BotR);

  const p1RowWins = [topRow, middleRow, bottomRow].filter(r => r.winner === 'p1').length;
  const p2RowWins = [topRow, middleRow, bottomRow].filter(r => r.winner === 'p2').length;

  const p1Scoop = p1RowWins === 3;
  const p2Scoop = p2RowWins === 3;

  // Rad-poäng: +1 per vunnen rad, -1 per förlorad (ties = 0)
  const p1RowPoints = topRow.p1Points + middleRow.p1Points + bottomRow.p1Points;

  // Scoop-bonus
  const p1ScoopBonus = p1Scoop ? SCOOP_BONUS : (p2Scoop ? -SCOOP_BONUS : 0);

  // Royalty-differens
  const royaltyDiff = p1Royalties.total - p2Royalties.total;

  const p1Net = p1RowPoints + p1ScoopBonus + royaltyDiff;
  const p2Net = -p1Net;

  const descParts: string[] = [];
  descParts.push(`Rader: P1 ${p1RowWins}–${p2RowWins} P2 (${p1RowPoints > 0 ? '+' : ''}${p1RowPoints}p)`);
  if (p1Scoop) descParts.push(`P1 scoop +${SCOOP_BONUS}p`);
  if (p2Scoop) descParts.push(`P2 scoop +${SCOOP_BONUS}p`);
  descParts.push(`Royalties P1 ${p1Royalties.total}p / P2 ${p2Royalties.total}p`);
  descParts.push(`Netto P1: ${p1Net > 0 ? '+' : ''}${p1Net}p`);

  return buildResult({
    p1Net, p2Net,
    p1Foul, p2Foul,
    p1Royalties, p2Royalties,
    rows: { top: topRow, middle: middleRow, bottom: bottomRow },
    p1RowWins, p2RowWins,
    p1Scoop, p2Scoop,
    description: descParts.join(' | '),
  });
}

// ---------------------------------------------------------------
// Intern logik
// ---------------------------------------------------------------

/** Jämför en rad och returnerar poäng för P1 på den raden */
function scoreRow(p1Hand: HandResult, p2Hand: HandResult): RowScore {
  const cmp = compareHands(p1Hand, p2Hand);
  if (cmp > 0) {
    return { p1Points: 1, winner: 'p1', p1Hand, p2Hand };
  } else if (cmp < 0) {
    return { p1Points: -1, winner: 'p2', p1Hand, p2Hand };
  } else {
    return { p1Points: 0, winner: 'tie', p1Hand, p2Hand };
  }
}

/** Bygger ett ScorecardResult-objekt från beräknade delar */
function buildResult(parts: {
  p1Net: number;
  p2Net: number;
  p1Foul: boolean;
  p2Foul: boolean;
  p1Royalties: RoyaltyResult;
  p2Royalties: RoyaltyResult;
  rows: { top: RowScore | null; middle: RowScore | null; bottom: RowScore | null };
  p1RowWins: number;
  p2RowWins: number;
  p1Scoop: boolean;
  p2Scoop: boolean;
  description: string;
}): ScorecardResult {
  return parts as ScorecardResult;
}

// ============================================================
// heuristics.ts — Snabb heuristik för OFC-solvern
// ============================================================
//
// Ansvar:
//   1. filterPlacements  — eliminera uppenbart dåliga placeringar
//                          innan Monte Carlo-simulering.
//   2. scorePlacement    — poängsätt en TurnPlacement med enkla
//                          heuristiker (draws, royalties, foul-risk).
//   3. greedyCompletion  — givet ett halvfärdigt bräde + återstående
//                          kort, fyll i dem snabbt och rimligt.
//                          Hanterar jokrar (väljer bästa identitet).
//   4. resolveJokerIdentity — bestäm vilken identitet en joker ska
//                          anta i en given kontext.
//
// FL-hantering:
//   C(13,3)*C(10,5) = 72 072 placeringar för 13 kort.
//   filterFantasyLandPlacements begränsar till topp-N (default 100)
//   innan Monte Carlo startar.
// ============================================================

import type {
  Card,
  RegularCard,
  Board,
  RowName,
  HandRank,
} from '../engine/types';
import { ROW_CAPACITY } from '../engine/types';
import { ALL_RANKS, ALL_SUITS, RANK_ORDER, HAND_RANK_ORDER } from '../engine/constants';
import { isJoker, isRegularCard, makeCard } from '../engine/card';
import { evaluate3, evaluate5, compareHands } from '../engine/handEval';
import { isFoul } from '../engine/foulCheck';
import { calcTopRoyalty, calcRowRoyalty5 } from '../engine/royalties';
import type { TurnPlacement, CardPlacement } from './placement';

// ============================================================
// Publika typer
// ============================================================

export interface ScoredPlacement {
  placement: TurnPlacement;
  /** Heuristiskt poäng (högre = bättre) */
  score: number;
}

// ============================================================
// 1. Snabbfiltrering — ta bort uppenbart dåliga placeringar
// ============================================================

/**
 * Filtrerar och rangordnar en lista av TurnPlacement med heuristik.
 * Returnerar de topN bästa, sorterade fallande efter poäng.
 *
 * Används för vanlig OFC och Pineapple (typiskt 3–9 alternativ).
 *
 * @param placements  Alla lagliga placeringar
 * @param board       Spelarens nuvarande bräde
 * @param topN        Max antal placeringar att returnera
 */
export function filterPlacements(
  placements: TurnPlacement[],
  board: Board,
  topN = 50,
): TurnPlacement[] {
  if (placements.length === 0) return [];

  const scored = placements.map((p) => ({
    placement: p,
    score: scorePlacement(p, board),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topN).map((s) => s.placement);
}

/**
 * Specialversion för Fantasy Land — filtrerar 72 072 → topN.
 *
 * Strategi: Vi utvärderar varje FL-placering med en snabb
 * poängsättning (undviker foul, maximerar royalties + draws).
 * Kostsamt men nödvändigt — vi kör detta EN gång per FL-hand.
 *
 * @param placements  Alla lagliga FL-placeringar
 * @param topN        Max antal att behålla (default 100)
 */
export function filterFantasyLandPlacements(
  placements: TurnPlacement[],
  topN = 100,
): TurnPlacement[] {
  if (placements.length === 0) return [];

  // Nollskapa ett tomt bräde att använda som referens
  const emptyBoard: Board = {
    top:    { name: 'top',    cards: [null, null, null] },
    middle: { name: 'middle', cards: [null, null, null, null, null] },
    bottom: { name: 'bottom', cards: [null, null, null, null, null] },
  };

  const scored: ScoredPlacement[] = placements.map((p) => ({
    placement: p,
    score: scoreFantasyLandPlacement(p, emptyBoard),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topN).map((s) => s.placement);
}

// ============================================================
// 2. Poängsättning av placeringar
// ============================================================

/**
 * Heuristisk poäng för en TurnPlacement givet nuvarande bräde.
 *
 * Faktorer (i viktighetsordning):
 *   - Foul-risk: stora negativa straff för riskfyllda placeringar
 *   - Royalty-potential: belönar händer med royalty-värde
 *   - Draw-potential: belönar "draws" (4-till-flush, 4-till-stege)
 *   - Fantasy Land-potential på topp: bonus för QQ+
 *   - Kickers: marginell bonus för höga kort i bra position
 */
export function scorePlacement(
  placement: TurnPlacement,
  board: Board,
): number {
  // Simulera brädet efter placeringen
  const newBoard = applyPlacement(board, placement);
  return scoreBoard(newBoard);
}

/**
 * Poängsätter en FL-placering (komplett bräde, 3+5+5 kort).
 * Inkluderar foul-straff och fullständig royalty-beräkning.
 */
function scoreFantasyLandPlacement(
  placement: TurnPlacement,
  emptyBoard: Board,
): number {
  const board = applyPlacement(emptyBoard, placement);

  const topCards    = board.top.cards.filter((c): c is Card => c !== null);
  const middleCards = board.middle.cards.filter((c): c is Card => c !== null);
  const bottomCards = board.bottom.cards.filter((c): c is Card => c !== null);

  // Måste ha exakt 3+5+5
  if (topCards.length !== 3 || middleCards.length !== 5 || bottomCards.length !== 5) {
    return -1000;
  }

  // Stor straff för foul
  if (isFoul(topCards, middleCards, bottomCards)) {
    return -500;
  }

  // Royalties
  const topRoy    = calcTopRoyalty(topCards);
  const midRoy    = calcRowRoyalty5(middleCards, 'middle');
  const botRoy    = calcRowRoyalty5(bottomCards, 'bottom');
  const totalRoy  = topRoy + midRoy + botRoy;

  // FL-stanna-krav: bonus om vi uppfyller repeat-FL
  const repeatFLBonus = calcRepeatFLBonus(topCards, middleCards, bottomCards);

  // Handstyrka (normaliserat 0–10)
  const topStrength    = handStrengthScore(topCards, 'top');
  const middleStrength = handStrengthScore(middleCards, 'middle');
  const bottomStrength = handStrengthScore(bottomCards, 'bottom');

  return (
    totalRoy * 5 +          // royalties viktigast
    repeatFLBonus * 3 +     // att stanna kvar i FL är värdefullt
    topStrength +
    middleStrength * 1.5 +
    bottomStrength * 2
  );
}

/**
 * Poängsätter ett (möjligen halvfärdigt) bräde.
 */
function scoreBoard(board: Board): number {
  let score = 0;

  const topCards    = board.top.cards.filter((c): c is Card => c !== null);
  const middleCards = board.middle.cards.filter((c): c is Card => c !== null);
  const bottomCards = board.bottom.cards.filter((c): c is Card => c !== null);

  // --- Foul-risk för ifyllda rader ---
  // Om alla tre är fyllda: kontrollera faktisk foul
  if (topCards.length === 3 && middleCards.length === 5 && bottomCards.length === 5) {
    if (isFoul(topCards, middleCards, bottomCards)) {
      return -500;
    }
    score += calcTopRoyalty(topCards) * 5;
    score += calcRowRoyalty5(middleCards, 'middle') * 5;
    score += calcRowRoyalty5(bottomCards, 'bottom') * 5;
    score += handStrengthScore(topCards, 'top');
    score += handStrengthScore(middleCards, 'middle') * 1.5;
    score += handStrengthScore(bottomCards, 'bottom') * 2;
    return score;
  }

  // --- Partiellt ifyllt bräde ---

  // Foul-risk-estimat: straffar om topp ser starkare ut än middle/bottom
  score -= estimateFoulRisk(topCards, middleCards, bottomCards);

  // Draw-potential per rad
  score += drawScore(bottomCards, 'bottom') * 2.0;
  score += drawScore(middleCards, 'middle') * 1.5;
  score += drawScore(topCards, 'top') * 1.0;

  // Partiell royalty-potential
  score += partialRoyaltyScore(topCards, 'top');
  score += partialRoyaltyScore(middleCards, 'middle') * 1.5;
  score += partialRoyaltyScore(bottomCards, 'bottom') * 2.0;

  // FL-entré-potential: bonus för höga par/triss på topp
  score += flEntryBonus(topCards);

  return score;
}

// ============================================================
// 3. Heuristik-hjälpfunktioner
// ============================================================

/**
 * Estimerar foul-risk för ett halvfärdigt bräde.
 * Returnerar ett strafftillskott (positivt = dåligt).
 */
function estimateFoulRisk(
  topCards: Card[],
  middleCards: Card[],
  bottomCards: Card[],
): number {
  let risk = 0;

  // Om topp redan har par/triss: det begränsar vad middle kan vara
  if (topCards.length >= 2) {
    const topEval = topCards.length === 3
      ? evaluate3(topCards)
      : quickPartialEval(topCards);

    // Topp med starka händer = hög foul-risk
    if (topEval && HAND_RANK_ORDER[topEval.rank] >= HAND_RANK_ORDER['pair']) {
      // Middle måste slå topp: straffar om middle är svag
      if (middleCards.length >= 2) {
        const midEval = quickPartialEval(middleCards);
        if (midEval && compareHands(topEval, midEval) >= 0) {
          risk += 30;
        }
      } else {
        risk += 5; // lite risk om middle är tom
      }
    }
  }

  // Om middle är starkare än bottom: risk
  if (middleCards.length >= 3 && bottomCards.length >= 3) {
    const midEval = quickPartialEval(middleCards);
    const botEval = quickPartialEval(bottomCards);
    if (midEval && botEval && compareHands(midEval, botEval) > 0) {
      risk += 20;
    }
  }

  return risk;
}

/**
 * Enkel "draw"-poäng för en rad.
 * Belönar 4-till-flush och 4-till-stege (och 3-till-flush/stege).
 */
function drawScore(cards: Card[], row: RowName): number {
  if (cards.length < 2) return 0;

  const regs = cards.filter(isRegularCard);
  const jokerCount = cards.filter(isJoker).length;

  let score = 0;

  // Flush-draw
  if (row !== 'top') {
    const suitCounts: Record<string, number> = {};
    for (const c of regs) {
      suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
    }
    const maxSuit = Math.max(...Object.values(suitCounts), 0);
    const effectiveSuit = maxSuit + jokerCount;

    if (effectiveSuit >= 5) score += 8;        // färdig flush (royalty)
    else if (effectiveSuit === 4) score += 5;   // 4-till-flush (nut draw)
    else if (effectiveSuit === 3) score += 2;   // 3-till-flush
  }

  // Straight-draw
  if (row !== 'top' && regs.length + jokerCount >= 3) {
    score += straightDrawScore(regs, jokerCount);
  }

  return score;
}

/**
 * Poängsätter straight-draws baserat på connectedness.
 */
function straightDrawScore(regs: RegularCard[], jokerCount: number): number {
  if (regs.length === 0) return 0;

  const values = Array.from(new Set(regs.map((c) => RANK_ORDER[c.rank]))).sort(
    (a, b) => a - b,
  );

  // Ace kan vara låg (1) eller hög (14)
  if (values.includes(14)) {
    values.unshift(1);
  }

  let bestConsecutive = 1;
  let current = 1;

  for (let i = 1; i < values.length; i++) {
    if (values[i] - values[i - 1] === 1) {
      current++;
      if (current > bestConsecutive) bestConsecutive = current;
    } else if (values[i] - values[i - 1] <= 2) {
      // Gap av 1: kan fyllas med joker
      current++;
      if (current > bestConsecutive) bestConsecutive = current;
    } else {
      current = 1;
    }
  }

  const effective = bestConsecutive + jokerCount;

  if (effective >= 5) return 6;  // gjord stege
  if (effective === 4) return 4; // open-ended eller gutshot med joker
  if (effective === 3) return 1;
  return 0;
}

/**
 * Partiell royalty-poäng: belönar par/triss redan på brädet.
 */
function partialRoyaltyScore(cards: Card[], row: RowName): number {
  if (cards.length < 2) return 0;

  const regs = cards.filter(isRegularCard);
  const jokerCount = cards.filter(isJoker).length;

  // Räkna rank-frekvenser
  const freq: Record<number, number> = {};
  for (const c of regs) {
    const v = RANK_ORDER[c.rank];
    freq[v] = (freq[v] || 0) + 1;
  }

  const counts = Object.values(freq).sort((a, b) => b - a);
  const topCount = (counts[0] || 0) + jokerCount;

  if (row === 'top') {
    // Toppraden: par QQ+ är värdefullt (FL-inträde)
    if (topCount >= 3) {
      // Triss på topp = FL + royalty
      const tripRank = Object.entries(freq)
        .filter(([, c]) => c >= 2)
        .map(([v]) => parseInt(v))
        .sort((a, b) => b - a)[0] || (jokerCount >= 1 ? 14 : 0);
      return tripRank >= 2 ? 10 + tripRank : 0;
    }
    if (topCount >= 2) {
      const pairRank = Object.entries(freq)
        .filter(([, c]) => c >= 1)
        .map(([v]) => parseInt(v))
        .sort((a, b) => b - a)[0] || (jokerCount >= 1 ? 14 : 0);
      // QQ=12, KK=13, AA=14 ger FL-inträde
      if (pairRank >= 12) return 8;
      if (pairRank >= 6) return 2;
      return 0;
    }
    return 0;
  }

  // Middle/bottom: poängsätt matchande kort
  if (topCount >= 4) return 8;  // gjort/nära fyrtal
  if (topCount >= 3) return 5;  // triss/nära kåk
  if (topCount >= 2) return 2;  // par
  return 0;
}

/**
 * Bonus för FL-inträdes-potential på topp.
 */
function flEntryBonus(topCards: Card[]): number {
  if (topCards.length === 0) return 0;

  const regs = topCards.filter(isRegularCard);
  const jokerCount = topCards.filter(isJoker).length;

  if (jokerCount >= 2) return 15; // 2 jokrar = garanterad triss = FL
  if (jokerCount >= 1) {
    // 1 joker + 1 hög reg-kort: goda chanser till par/triss
    const hasHighCard = regs.some((c) => RANK_ORDER[c.rank] >= 12);
    return hasHighCard ? 8 : 3;
  }

  // Inga jokrar: kolla om vi har par på topp
  if (regs.length >= 2) {
    const freq: Record<number, number> = {};
    for (const c of regs) {
      const v = RANK_ORDER[c.rank];
      freq[v] = (freq[v] || 0) + 1;
    }
    for (const [vStr, cnt] of Object.entries(freq)) {
      const v = parseInt(vStr);
      if (cnt >= 2 && v >= 12) return 10; // par av Q+
      if (cnt >= 3) return 12;            // triss
    }
  }

  return 0;
}

/**
 * Beräknar bonus om brädet uppfyller repeat-FL-krav:
 *   bottom ≥ fyrtal, ELLER middle ≥ kåk, ELLER top = triss
 */
function calcRepeatFLBonus(
  topCards: Card[],
  middleCards: Card[],
  bottomCards: Card[],
): number {
  let bonus = 0;

  if (topCards.length === 3) {
    const t = evaluate3(topCards);
    if (t.rank === 'trips') bonus = Math.max(bonus, 3);
  }

  if (middleCards.length === 5) {
    const m = evaluate5(middleCards);
    if (HAND_RANK_ORDER[m.rank] >= HAND_RANK_ORDER['full_house']) {
      bonus = Math.max(bonus, 4);
    }
  }

  if (bottomCards.length === 5) {
    const b = evaluate5(bottomCards);
    if (HAND_RANK_ORDER[b.rank] >= HAND_RANK_ORDER['quads']) {
      bonus = Math.max(bonus, 5);
    }
  }

  return bonus;
}

/**
 * Normaliserad handstyrka för ett komplett (3 eller 5 kort) segment.
 * Returnerar 0–10.
 */
function handStrengthScore(cards: Card[], row: RowName): number {
  if (row === 'top' && cards.length === 3) {
    const r = evaluate3(cards);
    return (HAND_RANK_ORDER[r.rank] / HAND_RANK_ORDER['trips']) * 10;
  }
  if (cards.length === 5) {
    const r = evaluate5(cards);
    return (HAND_RANK_ORDER[r.rank] / HAND_RANK_ORDER['royal_flush']) * 10;
  }
  return 0;
}

/**
 * Snabb partiell evaluering av 2–4 kort (returnerar null vid fel).
 * Används för foul-riskestimering utan att kräver komplett rad.
 */
function quickPartialEval(cards: Card[]) {
  if (cards.length === 3) {
    try { return evaluate3(cards); } catch { return null; }
  }
  if (cards.length === 5) {
    try { return evaluate5(cards); } catch { return null; }
  }
  // 2 eller 4 kort: approximera med par-check
  const regs = cards.filter(isRegularCard);
  const jokerCount = cards.filter(isJoker).length;
  if (regs.length === 0) return null;

  const freq: Record<number, number> = {};
  for (const c of regs) {
    const v = RANK_ORDER[c.rank];
    freq[v] = (freq[v] || 0) + 1;
  }
  const topPair = Object.entries(freq)
    .filter(([, c]) => c + jokerCount >= 2)
    .map(([v]) => parseInt(v))
    .sort((a, b) => b - a)[0];

  if (topPair !== undefined) {
    return {
      rank: 'pair' as HandRank,
      tiebreakers: [topPair],
      description: `Pair (partial)`,
    };
  }
  const highVal = Math.max(...regs.map((c) => RANK_ORDER[c.rank]));
  return {
    rank: 'high_card' as HandRank,
    tiebreakers: [highVal],
    description: `High card (partial)`,
  };
}

// ============================================================
// 4. Joker-identitetsresolution
// ============================================================

/**
 * Bestämmer vilken identitet (RegularCard) en joker bör anta
 * för att maximera värdet i en given rad-kontext.
 *
 * Används av greedyCompletion för att simulera välj-bästa-identity.
 *
 * @param existingCards  Korten som redan finns i raden (exkl. jokern)
 * @param row            Vilken rad jokern placeras i
 * @param usedCards      Alla kort som redan är "använda" på brädet
 *                       (jokern kan anta identiteter som redan finns)
 */
export function resolveJokerIdentity(
  existingCards: Card[],
  row: RowName,
  _usedCards: Card[] = [],
): RegularCard {
  const regs = existingCards.filter(isRegularCard);
  const totalSlots = ROW_CAPACITY[row];
  const slotsLeft = totalSlots - existingCards.length; // inkl. denna joker

  // Strategi 1: Komplettera till flush om möjlig
  if (row !== 'top' && regs.length >= 2) {
    const suitCounts: Record<string, number> = {};
    for (const c of regs) {
      suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
    }
    const bestSuit = Object.entries(suitCounts)
      .sort(([, a], [, b]) => b - a)[0];

    if (bestSuit) {
      const [suit, count] = bestSuit;
      // Om flush är uppnåelig (count + jokrar >= 5 - slotsLeft)
      if (count + 1 >= totalSlots - (slotsLeft - 1)) {
        // Välj Ace i den färgen (max royalty)
        return makeCard('A', suit as RegularCard['suit']);
      }
    }
  }

  // Strategi 2: Komplettera till triss/par
  if (regs.length >= 1) {
    const freq: Record<number, number> = {};
    for (const c of regs) {
      const v = RANK_ORDER[c.rank];
      freq[v] = (freq[v] || 0) + 1;
    }
    // Hitta rank med flest förekomster
    const best = Object.entries(freq)
      .sort(([, a], [, b]) => b - a)[0];

    if (best) {
      const [vStr, count] = best;
      const v = parseInt(vStr);
      // Hitta en suit vi inte redan har för denna rank
      const existingSuits = regs
        .filter((c) => RANK_ORDER[c.rank] === v)
        .map((c) => c.suit);
      const freeSuit = ALL_SUITS.find((s) => !existingSuits.includes(s));

      if (freeSuit) {
        const rank = ALL_RANKS.find((r) => RANK_ORDER[r] === v)!;

        // Top: triss (rank utan hänsyn) ger FL, men undvik overkill
        if (row === 'top' && count >= 2) {
          return makeCard(rank, freeSuit);
        }

        // Middle/bottom: triss/kåk/fyrtal
        if (count >= 2 && row !== 'top') {
          return makeCard(rank, freeSuit);
        }
      }
    }
  }

  // Strategi 3: Fallback — välj As (högsta korten hjälper mest)
  // Välj en suit som inte är representerad bland befintliga
  const existingSuits = new Set(regs.map((c) => c.suit));
  const freeSuit = ALL_SUITS.find((s) => !existingSuits.has(s)) || 'spades';

  return makeCard('A', freeSuit as RegularCard['suit']);
}

// ============================================================
// 5. Greedy completion
// ============================================================

/**
 * Givet ett halvfärdigt bräde och en lista med återstående kort,
 * fyll i korten på ett snabbt och rimligt sätt (för simulering).
 *
 * Algoritm:
 *   1. Sortera korten efter "prioritet" (starka kort → starka rader)
 *   2. Placera jokers sist (deras identitet bestäms av kontexten)
 *   3. Undvik foul: lägg starka kort i bottom, svaga i top
 *
 * Returnerar ett nytt Board där alla lediga platser är fyllda.
 * Om det inte finns tillräckligt med kort för att fylla brädet
 * lämnas resterande platser tomma (för partiell simulering).
 *
 * @param board         Halvfärdigt bräde
 * @param remainingCards Kort att fördela
 */
export function greedyCompletion(board: Board, remainingCards: Card[]): Board {
  // Kopia av brädet att mutera
  const result: Board = cloneBoard(board);

  if (remainingCards.length === 0) return result;

  // Separera reguljära kort och jokrar
  const regularCards = remainingCards.filter(isRegularCard) as RegularCard[];
  const jokers = remainingCards.filter(isJoker);

  // Sortera reguljära kort efter rank (fallande) för greedy-tilldelning
  regularCards.sort(
    (a, b) => RANK_ORDER[b.rank] - RANK_ORDER[a.rank],
  );

  // Lediga platser per rad
  const freeTop    = countFreeSlots(result, 'top');
  const freeMid    = countFreeSlots(result, 'middle');
  const freeBot    = countFreeSlots(result, 'bottom');

  // --- Fördela reguljära kort ---
  // Strategi: Vi vill ha bottom > middle > top (foul-undvikande)
  //   → Fyll bottom med starka kort, middle med medel, top med svaga

  // Dela in korten i tre grupper (proportionellt mot lediga platser)
  // freeTop + freeMid + freeBot = total lediga platser (används ej direkt)
  const allToPlace = [...regularCards];

  // Fördela: de sista (svagaste) korten → top, mellersta → middle, starkaste → bottom
  const forBottom: RegularCard[] = [];
  const forMiddle: RegularCard[] = [];
  const forTop:    RegularCard[] = [];

  for (let i = 0; i < allToPlace.length; i++) {
    const card = allToPlace[i];

    if (forBottom.length < freeBot) {
      forBottom.push(card);
    } else if (forMiddle.length < freeMid) {
      forMiddle.push(card);
    } else if (forTop.length < freeTop) {
      forTop.push(card);
    }
    // Om alla platser är fyllda: extra kort ignoreras
  }

  // Placera korten
  placeCardsInRow(result, 'bottom', forBottom);
  placeCardsInRow(result, 'middle', forMiddle);
  placeCardsInRow(result, 'top',    forTop);

  // --- Fördela jokrar ---
  // Jokers placeras sist: de tar de återstående platserna
  // och resolves till bästa identitet i sin kontext
  for (const joker of jokers) {
    const placed = placeJokerGreedy(result, joker);
    if (!placed) break; // inga fler platser
  }

  return result;
}

/**
 * Placerar en joker på den bästa lediga platsen (greedy).
 * Returnerar true om jokern placerades, false om brädet är fullt.
 */
function placeJokerGreedy(board: Board, _joker: Card): boolean {
  // Välj den rad som har flest lediga platser (prioritera bottom > middle > top)
  const candidates: RowName[] = ['bottom', 'middle', 'top'];

  for (const row of candidates) {
    const freeIdx = firstFreeSlot(board, row);
    if (freeIdx === -1) continue;

    const existingCards = board[row].cards.filter((c): c is Card => c !== null);
    const allUsed = getAllCardsOnBoard(board);
    const identity = resolveJokerIdentity(existingCards, row, allUsed);

    // Skapa en resolved joker med vald identitet
    const resolvedJoker: Card = {
      kind: 'joker',
      resolvedAs: identity,
    };

    board[row].cards[freeIdx] = resolvedJoker;
    return true;
  }

  return false;
}

// ============================================================
// 6. Hjälpfunktioner
// ============================================================

/** Applicerar en TurnPlacement på ett bräde och returnerar kopia */
export function applyPlacement(board: Board, placement: TurnPlacement): Board {
  const result = cloneBoard(board);

  for (const p of placement.placements) {
    const row = result[p.row];
    // Hitta den angivna slotIndex eller första lediga
    const idx = p.slotIndex < row.cards.length ? p.slotIndex : firstFreeSlot(result, p.row);
    if (idx !== -1 && row.cards[idx] === null) {
      row.cards[idx] = p.card;
    } else {
      // Fallback: sätt i första lediga slot
      const free = firstFreeSlot(result, p.row);
      if (free !== -1) row.cards[free] = p.card;
    }
  }

  return result;
}

/** Skapar en djup kopia av ett Board */
function cloneBoard(board: Board): Board {
  return {
    top:    { name: 'top',    cards: [...board.top.cards] },
    middle: { name: 'middle', cards: [...board.middle.cards] },
    bottom: { name: 'bottom', cards: [...board.bottom.cards] },
  };
}

/** Antal lediga platser i en rad */
function countFreeSlots(board: Board, row: RowName): number {
  return board[row].cards.filter((c) => c === null).length;
}

/** Index på första lediga slot i en rad, eller -1 */
function firstFreeSlot(board: Board, row: RowName): number {
  return board[row].cards.findIndex((c) => c === null);
}

/** Placerar en lista av kort i lediga slots i en rad */
function placeCardsInRow(board: Board, row: RowName, cards: RegularCard[]): void {
  for (const card of cards) {
    const idx = firstFreeSlot(board, row);
    if (idx === -1) break;
    board[row].cards[idx] = card;
  }
}

/** Alla kort på brädet (exkl. null) */
function getAllCardsOnBoard(board: Board): Card[] {
  return [
    ...board.top.cards,
    ...board.middle.cards,
    ...board.bottom.cards,
  ].filter((c): c is Card => c !== null);
}

// ============================================================
// 7. Återexporterade typer för konsumenter
// ============================================================

export type { TurnPlacement, CardPlacement };

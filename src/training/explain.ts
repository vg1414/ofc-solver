// ============================================================
// explain.ts — Regelbaserad förklaring: ditt drag mot bästa draget
// ============================================================
//
// Ingen AI — bara solverns egna siffror:
//  1. Vilka kort som hamnade i olika rader (eller kastades) jämfört
//     med bästa draget. Jokrar räknas som lika (samma som moveKey).
//  2. Foul-risk och FL-chans för båda dragen (solvern räknar dem redan,
//     på samma blandningar eftersom ditt drag är låst/pinned).
//  3. En slutsats: vilken av sakerna som väger tyngst. Syns varken foul
//     eller FL tydligt kommer skillnaden från radernas styrka mot
//     motståndaren (vunna rader och royalties).
// ============================================================

import type { Card, RowName } from '../engine/types';
import { PERFECT_MAX, cardKey, moveKey, type Judgement, type Move } from './moves';

export type Slot = RowName | 'discard';

export interface CardDiff {
  card: Card;
  mine: Slot;
  best: Slot;
}

export interface Explanation {
  /** Kort som ligger olika i ditt drag och bästa draget */
  diffs: CardDiff[];
  /** Meningar att visa, i ordning */
  lines: string[];
  /** Slutsatsen (fet) */
  verdict: string;
}

/** Skillnader under detta räknas som brus (procentenheter som andel) */
const FOUL_EPS = 0.03;
const FL_EPS = 0.02;

const pct = (p: number) => `${Math.round(p * 100)} %`;
const pts = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

function slots(m: { placements: { card: Card; row: RowName }[]; discards: Card[] }) {
  return [...m.placements.map((p) => ({ card: p.card, slot: p.row as Slot })), ...m.discards.map((card) => ({ card, slot: 'discard' as Slot }))];
}

/** Kort som ligger på olika platser. Kort som ligger lika paras ihop först, så jokrar och dubbletter blir rätt */
export function cardDiffs(mine: Move, best: { placements: { card: Card; row: RowName }[]; discards: Card[] }): CardDiff[] {
  const a = slots(mine);
  const b = slots(best);
  const usedA = new Set<number>();
  const usedB = new Set<number>();
  a.forEach((x, i) => {
    const k = b.findIndex((y, j) => !usedB.has(j) && cardKey(y.card) === cardKey(x.card) && y.slot === x.slot);
    if (k >= 0) {
      usedA.add(i);
      usedB.add(k);
    }
  });
  const out: CardDiff[] = [];
  a.forEach((x, i) => {
    if (usedA.has(i)) return;
    const k = b.findIndex((y, j) => !usedB.has(j) && cardKey(y.card) === cardKey(x.card));
    if (k < 0) return;
    usedB.add(k);
    out.push({ card: x.card, mine: x.slot, best: b[k].slot });
  });
  return out;
}

export function explainMove(move: Move, j: Judgement, fl = false): Explanation {
  const same = !!j.player && moveKey(move) === moveKey(j.best);
  if (same) return { diffs: [], lines: [], verdict: 'Du valde samma drag som solvern.' };

  const diffs = cardDiffs(move, j.best);
  const lines: string[] = [];
  const player = j.player;

  if (j.playerEv >= j.bestEv || j.diff <= PERFECT_MAX) {
    return { diffs, lines, verdict: 'Annat drag än solverns, men lika bra — skillnaden ryms i slumpens felmarginal.' };
  }

  const pf = player?.foulProbability;
  const bf = j.best.foulProbability;
  const pl = player?.flProbability;
  const bl = j.best.flProbability;
  const hasFoul = !fl && pf !== undefined && bf !== undefined;
  const hasFl = !fl && pl !== undefined && bl !== undefined;
  const dFoul = hasFoul ? pf! - bf! : 0; // > 0: bästa draget är säkrare
  const dFl = hasFl ? bl! - pl! : 0; // > 0: bästa draget ger mer FL

  if (hasFoul && Math.abs(dFoul) >= FOUL_EPS) lines.push(`Foul-risk: ${pct(pf!)} med ditt drag, ${pct(bf!)} med bästa draget.`);
  if (hasFl && Math.abs(dFl) >= FL_EPS) lines.push(`FL-chans: ${pct(pl!)} med ditt drag, ${pct(bl!)} med bästa draget.`);
  lines.push(`Det kostar i snitt ${pts.format(j.diff)} poäng varje gång läget uppstår.`);

  const safer = dFoul >= FOUL_EPS;
  const riskier = dFoul <= -FOUL_EPS;
  const moreFl = dFl >= FL_EPS;
  const lessFl = dFl <= -FL_EPS;

  let verdict: string;
  if (fl) verdict = 'I Fantasy Land avgörs det av radernas styrka, royalties och chansen till repeat-FL.';
  else if (!player) verdict = 'Ditt drag fanns inte bland solverns alternativ, så jämförelsen är ungefärlig.';
  else if (safer && moreFl) verdict = 'Bästa draget är både säkrare och ger större chans till Fantasy Land.';
  else if (safer && lessFl) verdict = 'Bästa draget offrar lite FL-chans för att minska risken att foula.';
  else if (riskier && moreFl) verdict = 'Bästa draget tar mer risk för att jaga Fantasy Land — det lönar sig här.';
  else if (riskier) verdict = 'Bästa draget tar lite mer foul-risk, men vinner det tillbaka med starkare rader mot motståndaren.';
  else if (safer) verdict = 'Bästa draget vinner främst på att minska risken att foula.';
  else if (moreFl) verdict = 'Bästa draget vinner främst på högre chans till Fantasy Land.';
  else if (lessFl) verdict = 'Bästa draget ger lite lägre FL-chans, men starkare rader mot motståndaren.';
  else verdict = 'Foul-risk och FL-chans är nästan lika — skillnaden kommer från hur raderna står sig mot motståndaren (vunna rader och royalties).';

  return { diffs, lines, verdict };
}

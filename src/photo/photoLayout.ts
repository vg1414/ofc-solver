// ============================================================
// photoLayout.ts — Gör om fotoläsningen till ett läge i appen
// ============================================================
// Fotokonventionen (Davids): raderna på bordet = brädet, uppifrån och ner.
// Ett kort som ligger för sig självt = kortet som ska läggas härnäst.
// Alla kort i en enda rad utan bräde = en öppningshand.
// 13 kort eller fler = Fantasy Land-hand (alla kort till FL-lösaren, antalet räknas
// ut av sig självt). Enda undantaget: sista rundan i Pineapple, 11 lagda + 3 lösa = 14.
// (12 lagda + 1 i Vanlig har bara en ledig plats, så det fotar ingen. Pineapple ger aldrig 13.)
//
// Här finns bara rena funktioner (inga anrop), så att de kan testas.
// ============================================================

import type { Card, RowName } from '../engine/types';
import { ROW_CAPACITY } from '../engine/types';
import { parseCard } from '../engine/card';

/** Vart en fotad rad hör: en rad på brädet, eller handen (kort att lägga) */
export type PhotoTarget = RowName | 'hand';

export interface PhotoRow {
  target: PhotoTarget;
  cards: Card[];
}

export interface PhotoAnswer {
  rows: string[][];
  loose: string[];
  uncertain: string[];
  model?: string;
  note?: string;
}

export const TARGET_LABEL: Record<PhotoTarget, string> = {
  top: 'Toppen',
  middle: 'Mitten',
  bottom: 'Botten',
  hand: 'Att lägga',
};

function toCards(list: string[]): Card[] {
  const out: Card[] = [];
  for (const s of list) {
    try {
      out.push(parseCard(s));
    } catch {
      // Workern skickar bara giltiga kort – hoppa över ifall något ändå slinker igenom
    }
  }
  return out;
}

/**
 * Gissar vilken rad på brädet varje fotad rad är.
 * Högst 5 kort totalt (även lösa) → öppningshand. 13–16 kort (utom
 * Pineapples 11 + 3) → Fantasy Land (alla i en rad "Att lägga"). 3 rader → topp/mitten/botten
 * (omvänt om bara den sista raden ryms i toppen).
 * 2 rader → topp+mitten om första raden får plats i toppen (≤ 3 kort), annars
 * mitten+botten. Användaren kan alltid ändra i arket.
 */
export function guessRows(answer: PhotoAnswer, allowHand = true): PhotoRow[] {
  const rows = answer.rows.map(toCards).filter((r) => r.length);
  // Tre rader där bara den sista ryms i toppen: fotot är upp och ner, så vänd ordningen
  if (rows.length === 3 && rows[0].length > 3 && rows[2].length <= 3) rows.reverse();
  const loose = toCards(answer.loose);
  // Högst 5 kort totalt = en öppningshand, hur raderna än ligger och även om
  // något kort ligger för sig självt (ett lagt bräde mitt i handen har minst
  // 5 kort + kortet som ska läggas, alltså minst 6)
  const total = rows.reduce((n, r) => n + r.length, 0) + loose.length;
  if (allowHand && total > 0 && total <= 5) return [{ target: 'hand', cards: [...rows.flat(), ...loose] }];
  if (allowHand && isFlCount(rows, loose.length)) return [{ target: 'hand', cards: [...rows.flat(), ...loose] }];
  let targets: RowName[];
  if (rows.length >= 3) targets = ['top', 'middle', 'bottom'];
  else if (rows.length === 2) targets = rows[0].length <= 3 ? ['top', 'middle'] : ['middle', 'bottom'];
  else targets = rows[0] && rows[0].length <= 3 ? ['top'] : ['middle'];

  const out: PhotoRow[] = rows.slice(0, 3).map((cards, i) => ({ target: targets[i], cards }));
  if (loose.length) out.push({ target: allowHand ? 'hand' : 'bottom', cards: loose });
  return out;
}

/** Ser fotot ut som en Fantasy Land-hand? Avgörs av antalet kort (se överst i filen). */
function isFlCount(rows: Card[][], loose: number): boolean {
  const total = rows.reduce((n, r) => n + r.length, 0) + loose;
  if (total === 14 && loose === 3) {
    // Pineapple, sista rundan: 11 kort som ryms på brädet (3/5/5) + 3 att välja bland
    const fitsBoard = rows.length === 3 && rows[0].length <= 3 && rows[1].length <= 5 && rows[2].length <= 5;
    return !fitsBoard;
  }
  return total >= 13 && total <= 16;
}

export function cardId(c: Card): string {
  return c.kind === 'joker' ? 'JK' : c.rank + c.suit[0];
}

/** Är kortet ett av dem modellen var osäker på? */
export function isUncertain(c: Card, answer: PhotoAnswer | null): boolean {
  return !!answer?.uncertain.includes(cardId(c));
}

/** Samlar raderna till ett bräde + en hand. Flera rader med samma mål slås ihop. */
export function collect(rows: PhotoRow[]): Record<PhotoTarget, Card[]> {
  const out: Record<PhotoTarget, Card[]> = { top: [], middle: [], bottom: [], hand: [] };
  for (const r of rows) out[r.target].push(...r.cards);
  return out;
}

/**
 * Vad som är fel med läget, på svenska (tom lista = går att använda).
 * `takenElsewhere` = kort som redan ligger på det andra brädet.
 */
export function problems(rows: PhotoRow[], takenElsewhere: Card[] = [], allowHand = true): string[] {
  const out: string[] = [];
  const c = collect(rows);
  for (const r of ['top', 'middle', 'bottom'] as RowName[]) {
    if (c[r].length > ROW_CAPACITY[r]) out.push(`${TARGET_LABEL[r]} har ${c[r].length} kort (max ${ROW_CAPACITY[r]})`);
  }
  const placed = c.top.length + c.middle.length + c.bottom.length;
  if (!allowHand && c.hand.length) out.push('Motståndarens bräde kan inte ha kort att lägga');
  if (placed === 0 && c.hand.length === 0) out.push('Inga kort');
  if (placed === 0 && c.hand.length > 5 && c.hand.length < 13) out.push('En öppningshand har högst 5 kort (Fantasy Land 13–16)');
  if (placed > 0 && placed < 13 && c.hand.length > 3) out.push('Högst 3 kort att lägga');
  if (placed + c.hand.length > 16) out.push('Fantasy Land har högst 16 kort');

  const all = [...rows.flatMap((r) => r.cards), ...takenElsewhere];
  if (all.filter((x) => x.kind === 'joker').length > 2) out.push('Fler än 2 jokrar');
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const x of all) {
    if (x.kind === 'joker') continue;
    const id = cardId(x);
    if (seen.has(id)) dup.add(id);
    seen.add(id);
  }
  for (const id of dup) out.push(`${id.replace('T', '10')} finns två gånger`);
  return out;
}

/**
 * En Fantasy Land-hand med alla korten (13–16): antingen bara kort "att lägga",
 * eller ett fullt bräde (13) med 0–3 kort till.
 */
export function flHand(rows: PhotoRow[]): Card[] | null {
  const c = collect(rows);
  const placed = c.top.length + c.middle.length + c.bottom.length;
  const total = placed + c.hand.length;
  if (total < 13 || total > 16) return null;
  if (placed !== 0 && placed !== 13) return null;
  return [...c.top, ...c.middle, ...c.bottom, ...c.hand];
}

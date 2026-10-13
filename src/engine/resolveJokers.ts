// ============================================================
// resolveJokers.ts — Bestäm jokrarna på ett färdigt bräde
// ============================================================
//
// Husregel: jokern väljs för HELA brädet så att handen inte foular.
// settle() (solverns kärna) räknar ut vilket värde varje rad ska få.
// Här byts varje joker mot ett riktigt kort som ger just det värdet,
// så att resten av appen (poäng, beskrivningar, FL) kan värdera
// raderna var för sig utan att jokern blir "fel" kort.
//
// Exempel: topp ★74, mitt A-10-7-5-3. Ensam blir toppen 77 (par),
// men då foular brädet. Rätt val är ★ = A → A74, som är lägre än mitten.
// ============================================================

import type { Card, RegularCard } from './types';
import { ALL_RANKS, ALL_SUITS } from './constants';
import { settle, toInts, plain3, plain5, isJ } from '../core/eval';

export interface ResolvedBoard {
  top: Card[];
  middle: Card[];
  bottom: Card[];
}

const fromInt = (c: number): RegularCard => ({ kind: 'card', rank: ALL_RANKS[c >> 2], suit: ALL_SUITS[c & 3] });

/** Byter jokrarna i en rad mot kort som ger exakt värdet `target` */
function fillRow(cards: Card[], ints: number[], target: number): Card[] {
  const jokers = ints.map((c, i) => (isJ(c) ? i : -1)).filter((i) => i >= 0);
  if (jokers.length === 0) return cards;
  const ev = ints.length === 5 ? plain5 : plain3;
  const buf = ints.slice();
  const [a, b] = jokers;
  for (let x = 0; x < 52; x++) {
    buf[a] = x;
    if (b === undefined) {
      if (ev(buf) === target) return cards.map((c, i) => (i === a ? fromInt(x) : c));
      continue;
    }
    for (let y = x; y < 52; y++) {
      buf[b] = y;
      if (ev(buf) === target) return cards.map((c, i) => (i === a ? fromInt(x) : i === b ? fromInt(y) : c));
    }
  }
  return cards; // ska inte hända
}

/**
 * Returnerar brädet med jokrarna utbytta mot de kort husregeln ger.
 * Om brädet foular hur jokrarna än väljs returneras det oförändrat.
 */
export function resolveJokers(top: Card[], middle: Card[], bottom: Card[]): ResolvedBoard {
  const all = [...top, ...middle, ...bottom];
  if (!all.some((c) => c.kind === 'joker') || top.length !== 3 || middle.length !== 5 || bottom.length !== 5) {
    return { top, middle, bottom };
  }
  const ints = toInts(all);
  const t = ints.slice(0, 3), m = ints.slice(3, 8), b = ints.slice(8);
  const s = settle(t, m, b);
  if (s.foul) return { top, middle, bottom };
  return {
    top: fillRow(top, t, s.top),
    middle: fillRow(middle, m, s.mid),
    bottom: fillRow(bottom, b, s.bot),
  };
}

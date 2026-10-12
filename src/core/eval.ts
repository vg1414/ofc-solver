// ============================================================
// core/eval.ts — Snabb handvärdering på heltal (ny solver-kärna)
// ============================================================
//
// Kort = heltal: rank*4 + suit (rank 0=2 … 12=A), jokrar = 52, 53.
// Handvärde = ett heltal: kategori*16^5 + kickers i bas 16.
// Samma skala för 3- och 5-kortshänder → topp kan jämföras direkt
// mot middle (AKQ < AKQJ9, KK5 < KK543). Lika värde = ingen foul.
//
// Jokrar: varje rad får en lista över alla värden den KAN anta.
// settle() väljer sedan bottom → middle → topp så att varje rad blir
// så stark som möjligt utan att bli starkare än raden under (= jokern
// väljs för att undvika foul, vilket är husregeln).
// ============================================================

import type { Card } from '../engine/types';
import { RANK_ORDER, ALL_SUITS } from '../engine/constants';

export const JOKER_A = 52;
export const JOKER_B = 53;
export const isJ = (c: number) => c >= 52;

// Kategorier (royal flush > 5-tal enligt husregel)
export const HC = 0, PAIR = 1, TWO_PAIR = 2, TRIPS = 3, STRAIGHT = 4, FLUSH = 5,
  FULL_HOUSE = 6, QUADS = 7, STRAIGHT_FLUSH = 8, FIVE_KIND = 9, ROYAL = 10;

const B = 1 << 20; // 16^5
export const catOf = (v: number) => Math.floor(v / B);
/** Rank (2–14) för paret/trissen i en topphand */
const firstKicker = (v: number) => (v >> 16) & 15;

// ---------------------------------------------------------------
// Konvertering från UI-kort
// ---------------------------------------------------------------

export function toInt(card: Card, jokerIdx = 0): number {
  if (card.kind === 'joker') return jokerIdx === 0 ? JOKER_A : JOKER_B;
  return (RANK_ORDER[card.rank] - 2) * 4 + ALL_SUITS.indexOf(card.suit);
}

/** Konverterar en lista kort; jokrar får 52 resp. 53 i ordning */
export function toInts(cards: Card[]): number[] {
  let j = 0;
  return cards.map((c) => (c.kind === 'joker' ? toInt(c, j++) : toInt(c)));
}

// ---------------------------------------------------------------
// Värdering utan jokrar
// ---------------------------------------------------------------

// Snabb värdering utan allokeringar (körs miljontals gånger)
const cnt = new Int8Array(13);
const S16 = [1 << 16, 1 << 12, 1 << 8, 1 << 4, 1];

export function plain5(cards: number[]): number {
  cnt.fill(0);
  let mask = 0;
  const s0 = cards[0] & 3;
  let flush = true;
  for (let i = 0; i < 5; i++) {
    const c = cards[i];
    cnt[c >> 2]++;
    mask |= 1 << (c >> 2);
    if ((c & 3) !== s0) flush = false;
  }
  // Grupper: hitta största/näst största antal
  let q = -1, t = -1, p1 = -1, p2 = -1, distinct = 0;
  for (let r = 12; r >= 0; r--) {
    const n = cnt[r];
    if (!n) continue;
    distinct++;
    if (n === 5) return FIVE_KIND * B + (r + 2) * S16[0];
    if (n === 4) q = r;
    else if (n === 3) t = r;
    else if (n === 2) { if (p1 < 0) p1 = r; else p2 = r; }
  }
  if (distinct === 5) {
    let high = -1;
    if (mask === 0x100f) high = 3;                    // hjulet A-5
    else { const lo = 31 - Math.clz32(mask & -mask); if (mask >> lo === 31) high = lo + 4; }
    if (high >= 0) {
      const cat = flush ? (high === 12 ? ROYAL : STRAIGHT_FLUSH) : STRAIGHT;
      return cat * B + (high + 2) * S16[0];
    }
    return (flush ? FLUSH : HC) * B + kick(mask, 5, 0);
  }
  if (q >= 0) return QUADS * B + (q + 2) * S16[0] + (31 - Math.clz32(mask & ~(1 << q)) + 2) * S16[1];
  if (t >= 0 && p1 >= 0) return FULL_HOUSE * B + (t + 2) * S16[0] + (p1 + 2) * S16[1];
  if (flush) return FLUSH * B + kick(mask, 5, 0);
  if (t >= 0) return TRIPS * B + (t + 2) * S16[0] + kick(mask & ~(1 << t), 2, 1);
  if (p2 >= 0) return TWO_PAIR * B + (p1 + 2) * S16[0] + (p2 + 2) * S16[1] + kick(mask & ~(1 << p1) & ~(1 << p2), 1, 2);
  return PAIR * B + (p1 + 2) * S16[0] + kick(mask & ~(1 << p1), 3, 1);
}

/** Packar de n högsta rankerna i mask som kickers från position pos */
function kick(mask: number, n: number, pos: number): number {
  let v = 0;
  for (let r = 12; r >= 0 && n > 0; r--) if (mask & (1 << r)) { v += (r + 2) * S16[pos++]; n--; }
  return v;
}

export function plain3(cards: number[]): number {
  const a = cards[0] >> 2, b = cards[1] >> 2, c = cards[2] >> 2;
  if (a === b && b === c) return TRIPS * B + (a + 2) * S16[0];
  if (a === b) return PAIR * B + (a + 2) * S16[0] + (c + 2) * S16[1];
  if (a === c) return PAIR * B + (a + 2) * S16[0] + (b + 2) * S16[1];
  if (b === c) return PAIR * B + (b + 2) * S16[0] + (a + 2) * S16[1];
  return HC * B + kick((1 << a) | (1 << b) | (1 << c), 3, 0);
}

// ---------------------------------------------------------------
// Värdering med jokrar → alla möjliga värden (fallande, unika)
// ---------------------------------------------------------------

const cache = new Map<number, number[]>();

/** Alla värden en rad (3 eller 5 kort) kan anta. Utan jokrar: ett värde. */
export function rowValues(cards: number[]): number[] {
  const regs = cards.filter((c) => !isJ(c));
  const j = cards.length - regs.length;
  const size = cards.length;
  if (j === 0) return [size === 5 ? plain5(regs) : plain3(regs)];

  let key = size * 4 + j;
  for (const c of regs.slice().sort((a, b) => a - b)) key = key * 64 + c;
  const hit = cache.get(key);
  if (hit) return hit;

  // Färg spelar bara roll i 5-kortshänder där alla vanliga kort har samma färg
  const suits: number[] = [];
  if (size === 5 && regs.length > 0 && regs.every((c) => (c & 3) === (regs[0] & 3))) {
    suits.push(regs[0] & 3, ((regs[0] & 3) + 1) & 3);
  } else {
    suits.push(regs.length > 0 ? ((regs[0] & 3) + 1) & 3 : 0);
  }
  const subs: number[] = [];
  for (let r = 0; r < 13; r++) for (const s of suits) subs.push(r * 4 + s);

  const ev = size === 5 ? plain5 : plain3;
  const buf = [...regs, 0, 0].slice(0, size);
  const n = regs.length;
  const set = new Set<number>();
  if (j === 1) {
    for (const a of subs) { buf[n] = a; set.add(ev(buf)); }
  } else {
    for (let i = 0; i < subs.length; i++) {
      buf[n] = subs[i];
      for (let k = i; k < subs.length; k++) { buf[n + 1] = subs[k]; set.add(ev(buf)); }
    }
  }
  const list = [...set].sort((a, b) => b - a);
  if (cache.size > 200000) cache.clear();
  cache.set(key, list);
  return list;
}

/** Högsta värde i listan som är ≤ tak, eller -1 om inget finns */
export function maxAtMost(list: number[], cap: number): number {
  for (const v of list) if (v <= cap) return v;
  return -1;
}

// ---------------------------------------------------------------
// Royalties & Fantasy Land
// ---------------------------------------------------------------

const BOT_ROY = [0, 0, 0, 0, 2, 4, 6, 10, 15, 20, 25];
const MID_ROY = [0, 0, 0, 2, 4, 8, 12, 20, 30, 40, 50];

export function royaltyOf(v: number, row: 0 | 1 | 2): number {
  const cat = catOf(v);
  if (row === 2) return BOT_ROY[cat];
  if (row === 1) return MID_ROY[cat];
  const r = firstKicker(v);
  if (cat === TRIPS) return r + 8;        // 222=10 … AAA=22
  if (cat === PAIR && r >= 6) return r - 5; // 66=1 … AA=9
  return 0;
}

/** Antal FL-kort topphanden ger (0 = ingen FL) */
export function flEntryCards(topV: number): number {
  const cat = catOf(topV);
  if (cat === TRIPS) return 16;
  if (cat === PAIR) {
    const r = firstKicker(topV);
    if (r >= 12) return r + 1; // QQ=13, KK=14, AA=15
  }
  return 0;
}

/** Stanna kvar i FL: triss topp, kåk+ middle eller fyrtal+ bottom */
export function qualifiesRepeat(topV: number, midV: number, botV: number): boolean {
  return catOf(topV) === TRIPS || catOf(midV) >= FULL_HOUSE || catOf(botV) >= QUADS;
}

// ---------------------------------------------------------------
// Avgör ett komplett bräde
// ---------------------------------------------------------------

export interface Settled {
  foul: boolean;
  top: number;
  mid: number;
  bot: number;
  roy: number;
}

export const FOULED: Settled = { foul: true, top: -1, mid: -1, bot: -1, roy: 0 };

/** Bästa giltiga uppställning (jokrar väljs för att undvika foul) */
export function settle(top: number[], mid: number[], bot: number[]): Settled {
  const b = rowValues(bot)[0];
  const m = maxAtMost(rowValues(mid), b);
  if (m < 0) return FOULED;
  const t = maxAtMost(rowValues(top), m);
  if (t < 0) return FOULED;
  return { foul: false, top: t, mid: m, bot: b, roy: royaltyOf(t, 0) + royaltyOf(m, 1) + royaltyOf(b, 2) };
}

/** Poäng för spelare A mot B (2 spelare: 1p/rad, +3 scoop, foul = 6 + royalties) */
export function scoreVs(a: Settled, b: Settled): number {
  if (a.foul && b.foul) return 0;
  if (a.foul) return -(6 + b.roy);
  if (b.foul) return 6 + a.roy;
  const w = Math.sign(a.top - b.top) + Math.sign(a.mid - b.mid) + Math.sign(a.bot - b.bot);
  const scoop = w === 3 ? 3 : w === -3 ? -3 : 0;
  return w + scoop + a.roy - b.roy;
}

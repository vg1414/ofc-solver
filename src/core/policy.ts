// ============================================================
// core/policy.ts — "Spelaren" som spelar klart händer i simuleringen
// ============================================================
//
// Solvern provar ett drag genom att spela klart handen tusentals
// gånger. Då behövs en simulerad spelare som placerar varje nytt kort
// vettigt — UTAN att se framtida kort (som en riktig människa).
//
// Spelaren poängsätter varje möjlig placering med boardValue():
//   + förväntade royalties per rad (par/triss/kåk/färg/stege-chanser,
//     räknat på hur många "outs" som finns kvar i leken)
//   + värdet av Fantasy Land om toppen ser ut att nå QQ+
//   − risken för foul (topp starkare än middle, middle än bottom)
// och väljer den placering som ger högst värde.
// ============================================================

import {
  rowValues, settle, royaltyOf, flEntryCards, catOf, isJ,
  HC, PAIR, TWO_PAIR, TRIPS, STRAIGHT, FLUSH, FULL_HOUSE, QUADS, FIVE_KIND,
} from './eval';
import { FL_VALUE } from './flValue';

export const CAP = [3, 5, 5];

/** Vikter för spelarens heuristik (inställda med scripts/tune.ts) */
export const P = { share: 0.9, p2: 0.9, fresh: 0.03, flush: 0.8, straight: 0.75, topTrips: 0.25, topPair: 0.25, foul: 6, fl: 1, hcBase: 0 };

/** Okända kort ur spelarens perspektiv */
export interface Unseen {
  rank: Int8Array; // 13
  suit: Int8Array; // 4
  jokers: number;
  total: number;
  /** Själva korten (för att slumpa möjliga framtider) */
  cards: number[];
}

export function makeUnseen(cards: number[]): Unseen {
  const u: Unseen = { rank: new Int8Array(13), suit: new Int8Array(4), jokers: 0, total: 0, cards: [] };
  for (const c of cards) addUnseen(u, c, 1);
  return u;
}

export function addUnseen(u: Unseen, c: number, d: number): void {
  u.total += d;
  if (d > 0) u.cards.push(c);
  else { const i = u.cards.indexOf(c); if (i >= 0) { u.cards[i] = u.cards[u.cards.length - 1]; u.cards.pop(); } }
  if (isJ(c)) u.jokers += d;
  else { u.rank[c >> 2] += d; u.suit[c & 3] += d; }
}

// ---------------------------------------------------------------
// Sannolikhetshjälp
// ---------------------------------------------------------------

/** P(minst k träffar på n dragningar med träffchans p) — binomial */
function atLeast(k: number, n: number, p: number): number {
  if (k <= 0) return 1;
  if (k > n || p <= 0) return 0;
  if (p >= 1) return 1;
  let term = Math.pow(1 - p, n); // P(0)
  let below = term;
  for (let i = 1; i < k; i++) {
    term *= ((n - i + 1) / i) * (p / (1 - p));
    below += term;
  }
  return Math.max(0, 1 - below);
}

// Kategori från gruppstorlekar (störst först)
function catFromCounts(c1: number, c2: number): number {
  if (c1 >= 5) return FIVE_KIND;
  if (c1 === 4) return QUADS;
  if (c1 === 3) return c2 >= 2 ? FULL_HOUSE : TRIPS;
  if (c1 === 2) return c2 >= 2 ? TWO_PAIR : PAIR;
  return HC;
}

const MID_ROY_CAT = [0, 0, 0, 2, 4, 8, 12, 20, 30, 40, 50];
const BOT_ROY_CAT = [0, 0, 0, 0, 2, 4, 6, 10, 15, 20, 25];

/** Ett möjligt slutresultat för en rad: styrka (kategori + rank/16), sannolikhet, royalty */
interface Outcome { s: number; p: number; roy: number }

const strOf = (v: number) => v / 1048576; // handvärde → kategori + bråkdel

// ---------------------------------------------------------------
// Skattning per rad → lista av möjliga slutresultat
// ---------------------------------------------------------------

function estimate5(cards: number[], row: 1 | 2, u: Unseen, draws: number): Outcome[] {
  const free = 5 - cards.length;
  if (free === 0) {
    const v = rowValues(cards)[0];
    return [{ s: strOf(v), p: 1, roy: royaltyOf(v, row) }];
  }
  const table = row === 1 ? MID_ROY_CAT : BOT_ROY_CAT;
  let j = 0;
  const cnt = new Int8Array(13);
  let suitMask = 0, regs = 0, hi = 0;
  for (const c of cards) {
    if (isJ(c)) { j++; continue; }
    cnt[c >> 2]++; suitMask |= 1 << (c & 3); regs++;
    if ((c >> 2) > hi) hi = c >> 2;
  }
  // Största gruppen (c1, rank r1) och näst största (c2)
  let c1 = 0, c2 = 0, r1 = hi;
  for (let r = 12; r >= 0; r--) {
    const n = cnt[r];
    if (!n) continue;
    if (n > c1) { c2 = c1; c1 = n; r1 = r; } else if (n > c2) c2 = n;
  }
  // Outs: på största gruppen (A) resp. på övriga ranker i raden (B)
  let outsB = 0;
  for (let r = 0; r < 13; r++) if (cnt[r] && r !== r1) outsB += u.rank[r];
  const outsA = (c1 > 0 ? u.rank[r1] : 0) + u.jokers;
  c1 += j;
  const U = Math.max(1, u.total);
  const pA = free >= 1 ? atLeast(1, draws, outsA / U) * P.share : 0;
  const pB = free >= 1 && outsB > 0 ? atLeast(1, draws, outsB / U) * P.share : 0;
  const pAB = free >= 2 ? pA * pB * P.p2 : 0;
  const catA = catFromCounts(c1 + 1, c2);
  const catB = c2 >= 1 ? catFromCounts(c1, c2 + 1) : catFromCounts(c1, 2);
  const catAB = c2 >= 1 ? catFromCounts(c1 + 1, c2 + 1) : catFromCounts(c1 + 1, 2);
  const cat0 = catFromCounts(c1, c2);
  const onlyA = pA - pAB, onlyB = Math.max(0, pB - pAB);
  const pNone = Math.max(0, 1 - onlyA - onlyB - pAB);
  // Nya par bland tomma platser (två okända kort med samma rank)
  const pFresh = free >= 2 && c1 <= 1 ? Math.min(0.45, P.fresh * draws * (free - 1)) * pNone : 0;

  // Färg: alla vanliga kort i samma färg, behöver `free` till av den färgen
  let pFl = 0;
  if (regs > 0 && (suitMask & (suitMask - 1)) === 0) {
    const s = 31 - Math.clz32(suitMask);
    pFl = atLeast(free, draws, (u.suit[s] + u.jokers) / U) * P.flush;
  }
  // Stege: inga par, rankerna ryms i ett 5-fönster
  let pSt = 0;
  if (c1 - j <= 1 && regs > 0) {
    for (let lo = -1; lo <= 8; lo++) { // lo=-1 = hjulet (A låg)
      let inWin = 0, p = 1;
      const miss: number[] = [];
      for (let r = 0; r < 13; r++) if (cnt[r]) {
        const rr = lo === -1 && r === 12 ? -1 : r;
        if (rr >= lo && rr <= lo + 4) inWin++;
      }
      if (inWin !== regs) continue;
      for (let k = 0; k < 5; k++) {
        const rr = lo + k === -1 ? 12 : lo + k;
        if (!cnt[rr]) miss.push(u.rank[rr] + u.jokers);
      }
      miss.sort((a, b) => a - b);
      for (let k = j; k < miss.length; k++) p *= atLeast(1, draws - (k - j), miss[k] / U);
      if (p > pSt) pSt = p;
    }
    pSt *= P.straight;
  }
  const pDraw = Math.min(1, pFl + pSt * (1 - pFl));
  const keep = 1 - pDraw;
  const out: Outcome[] = [];
  const add = (cat: number, p: number, r: number) => { if (p > 1e-4) out.push({ s: cat + r / 16, p, roy: table[cat] }); };
  add(cat0, (pNone - pFresh) * keep, cat0 === HC ? hi : r1);
  add(PAIR, pFresh * keep, hi);
  add(catA, onlyA * keep, r1);
  add(catB, onlyB * keep, cat0 === HC ? hi : r1);
  add(catAB, pAB * keep, r1);
  add(FLUSH, pFl, 12);
  add(STRAIGHT, pDraw - pFl, hi);
  return out;
}

function estimate3(cards: number[], u: Unseen, draws: number): Outcome[] {
  const free = 3 - cards.length;
  if (free === 0) {
    // topp med joker: settle väljer lägsta som behövs — bästa räcker som skattning
    const v = rowValues(cards)[0];
    return [{ s: strOf(v), p: 1, roy: royaltyOf(v, 0) }];
  }
  if (cards.length === 0) return [{ s: 0.45, p: 1, roy: 0 }];
  let j = 0, c1 = 0, r1 = -1, hitOuts = u.jokers;
  const cnt = new Int8Array(13);
  for (const c of cards) {
    if (isJ(c)) { j++; continue; }
    const r = c >> 2;
    if (!cnt[r]) hitOuts += u.rank[r];
    cnt[r]++;
    if (cnt[r] > c1 || (cnt[r] === c1 && r > r1)) { c1 = cnt[r]; r1 = r; }
  }
  if (r1 < 0) r1 = 12; // bara jokrar
  c1 += j;
  const U = Math.max(1, u.total);
  const pHit = atLeast(1, draws, hitOuts / U);
  const pairRoy = (r: number) => (r >= 4 ? r - 3 : 0); // r: 0=2 … 4=6 → 1p
  const out: Outcome[] = [];
  if (c1 >= 3) out.push({ s: TRIPS + r1 / 16, p: 1, roy: r1 + 10 });
  else if (c1 === 2) {
    const pT = pHit * P.topTrips;
    out.push({ s: PAIR + r1 / 16, p: 1 - pT, roy: pairRoy(r1) });
    if (pT > 0) out.push({ s: TRIPS + r1 / 16, p: pT, roy: r1 + 10 });
  } else {
    const pP = pHit * P.topPair; // man väljer inte alltid att lägga paret i toppen
    out.push({ s: HC + r1 / 16, p: 1 - pP, roy: 0 });
    if (pP > 0) out.push({ s: PAIR + r1 / 16, p: pP, roy: pairRoy(r1) });
  }
  return out;
}

// ---------------------------------------------------------------
// Brädvärde
// ---------------------------------------------------------------

/** P(rad a slutar starkare än rad b) */
function pGreater(a: Outcome[], b: Outcome[]): number {
  let p = 0;
  for (const x of a) for (const y of b) if (x.s > y.s) p += x.p * y.p;
  return p;
}

const isFlTop = (s: number) => s >= TRIPS || (s >= PAIR + 10 / 16 && s < PAIR + 1);

/** Heuristiskt värde (i poäng) för ett bräde med `draws` kort kvar att se */
export function boardValue(rows: number[][], u: Unseen, draws: number): number {
  const full = rows[0].length === 3 && rows[1].length === 5 && rows[2].length === 5;
  if (full) {
    const s = settle(rows[0], rows[1], rows[2]);
    if (s.foul) return -P.foul;
    const fl = flEntryCards(s.top);
    return s.roy + (fl ? FL_VALUE[fl] : 0) + 0.15 * (catOf(s.mid) + catOf(s.bot));
  }
  const t = estimate3(rows[0], u, draws);
  const m = estimate5(rows[1], 1, u, draws);
  const b = estimate5(rows[2], 2, u, draws);

  const fTM = pGreater(t, m);
  const fMB = pGreater(m, b);
  const pFoul = Math.min(1, fTM + fMB - fTM * fMB);
  const ok = 1 - pFoul;

  // FL: topp QQ+ som middle faktiskt slår
  let pFL = 0;
  for (const x of t) if (isFlTop(x.s)) for (const y of m) if (y.s >= x.s) pFL += x.p * y.p;
  pFL *= 1 - fMB;

  const er = (o: Outcome[]) => o.reduce((a, x) => a + x.p * x.roy, 0);
  const es = (o: Outcome[]) => o.reduce((a, x) => a + x.p * Math.floor(x.s), 0);
  return ok * (er(t) + er(m) + er(b) + 0.15 * (es(m) + es(b))) + pFL * FL_VALUE[14] * P.fl - pFoul * P.foul;
}


// ---------------------------------------------------------------
// Beslut
// ---------------------------------------------------------------

/** Alla sätt att lägga ut `cards` på brädet (rad per kort), utan dubbletter */
export function allAssignments(rows: number[][], cards: number[]): number[][] {
  const out: number[][] = [];
  const room = [CAP[0] - rows[0].length, CAP[1] - rows[1].length, CAP[2] - rows[2].length];
  const cur: number[] = [];
  const seen = new Set<string>();
  const rec = (i: number) => {
    if (i === cards.length) {
      // samma kort till samma rader i annan ordning = samma placering
      const key = [0, 1, 2].map((r) => cards.filter((_, k) => cur[k] === r).sort().join('.')).join('|');
      if (!seen.has(key)) { seen.add(key); out.push([...cur]); }
      return;
    }
    for (let r = 0; r < 3; r++) {
      if (room[r] === 0) continue;
      room[r]--; cur.push(r);
      rec(i + 1);
      cur.pop(); room[r]++;
    }
  };
  rec(0);
  return out;
}

/** Heuristiskt värde efter att korten lagts enligt a (rad per kort, -1 = kastas) */
export function valueWith(rows: number[][], cs: number[], a: number[], u: Unseen, draws: number): number {
  for (let k = 0; k < cs.length; k++) if (a[k] >= 0) rows[a[k]].push(cs[k]);
  const v = boardValue(rows, u, draws);
  for (let k = 0; k < cs.length; k++) if (a[k] >= 0) rows[a[k]].pop();
  return v;
}

/** Alla placeringar av korten; med discard kastas exakt ett kort */
export function allOptions(rows: number[][], cards: number[], discard: boolean): number[][] {
  if (!discard) return allAssignments(rows, cards);
  const out: number[][] = [];
  for (let d = 0; d < cards.length; d++)
    for (const a of allAssignments(rows, cards.filter((_, k) => k !== d))) out.push([...a.slice(0, d), -1, ...a.slice(d)]);
  return out;
}

// ============================================================
// core/sim.ts — Monte Carlo: spela klart händer och mät EV
// ============================================================
//
// För varje kandidat-drag spelas handen klart många gånger:
//   1. De okända korten blandas (samma blandningar för alla kandidater
//      → rättvis jämförelse, mindre slumpbrus).
//   2. Kort delas ut ett i taget (Pineapple: 3, ett kastas) och
//      policy.ts placerar dem — ingen framtidsblick.
//   3. Brädet avgörs (jokrar väljs för att undvika foul) och poängsätts
//      mot motståndaren + värdet av ev. Fantasy Land.
// Dåliga kandidater sållas bort successivt så att tiden läggs på de
// jämna fallen ("successive halving").
// ============================================================

import { settle, scoreVs, flEntryCards, FOULED } from './eval';
import type { Settled } from './eval';
import { makeUnseen, addUnseen, CAP } from './policy';
import { choose, LA, bestCompletion } from './lookahead';
import type { Unseen } from './policy';
import { FL_VALUE } from './flValue';
import { POOL_DATA } from './poolData';

export type Variant = 'regular' | 'pineapple';

// ---------------------------------------------------------------
// Slump med frö (så att alla kandidater får samma blandningar)
// ---------------------------------------------------------------

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled(cards: number[], rand: () => number): number[] {
  const a = cards.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const k = Math.floor(rand() * (i + 1));
    const t = a[i]; a[i] = a[k]; a[k] = t;
  }
  return a;
}

export const FULL_DECK = Array.from({ length: 54 }, (_, i) => i);

const freeOf = (rows: number[][]) => 13 - rows[0].length - rows[1].length - rows[2].length;

// ---------------------------------------------------------------
// Spela klart ett bräde
// ---------------------------------------------------------------

/**
 * Fyller `rows` (muteras) med kort från deck[pos…]. Returnerar ny pos.
 * `u` = okända kort ur spelarens perspektiv (uppdateras när kort ses).
 */
export function playOut(rows: number[][], deck: number[], pos: number, u: Unseen, variant: Variant): number {
  let free = freeOf(rows);
  while (free > 0) {
    if (variant === 'pineapple' && free >= 2) {
      const cs = [deck[pos], deck[pos + 1], deck[pos + 2]];
      pos += 3;
      for (const c of cs) addUnseen(u, c, -1);
      const a = choose(rows, cs, u, variant, true);
      for (let k = 0; k < 3; k++) if (a[k] >= 0) rows[a[k]].push(cs[k]);
      free -= 2;
    } else {
      const c = deck[pos++];
      addUnseen(u, c, -1);
      rows[choose(rows, [c], u, variant, false)[0]].push(c);
      free--;
    }
  }
  return pos;
}

/** Spelar en hel hand från tomt bräde (öppning + resten) */
export function playFullHand(deck: number[], pos: number, variant: Variant): { s: Settled; pos: number } {
  const rows: number[][] = [[], [], []];
  const u = makeUnseen(deck.slice(pos));
  const open = deck.slice(pos, pos + 5);
  pos += 5;
  for (const c of open) addUnseen(u, c, -1);
  const a = choose(rows, open, u, variant, false);
  for (let k = 0; k < 5; k++) rows[a[k]].push(open[k]);
  pos = playOut(rows, deck, pos, u, variant);
  return { s: settle(rows[0], rows[1], rows[2]), pos };
}

// ---------------------------------------------------------------
// Motståndar-pool (när motståndarens bräde är okänt)
// ---------------------------------------------------------------

const pools: Partial<Record<Variant, Settled[]>> = {};

/** Färdigspelade motståndarbräden (självspel med samma policy), cachas */
export function opponentPool(variant: Variant, n = 1500): Settled[] {
  const cached = pools[variant];
  if (cached && cached.length >= n) return cached;
  // Förberäknad pool (scripts/buildPool.ts) om den finns
  const vi = variant === 'regular' ? 0 : 1;
  const pre: Settled[] = [];
  for (let i = 0; i + 5 < POOL_DATA.length; i += 6) {
    if (POOL_DATA[i] !== vi) continue;
    pre.push(POOL_DATA[i + 1] ? FOULED : { foul: false, top: POOL_DATA[i + 2], mid: POOL_DATA[i + 3], bot: POOL_DATA[i + 4], roy: POOL_DATA[i + 5] });
  }
  if (pre.length >= 500) { pools[variant] = pre; return pre; }
  // Reserv: snabb heuristisk spelare (används bara om poolData saknas)
  const rand = rng(12345);
  const out: Settled[] = [];
  const saved = LA.samples;
  LA.samples = 0;
  for (let i = 0; i < n; i++) out.push(playFullHand(shuffled(FULL_DECK, rand), 0, variant).s);
  LA.samples = saved;
  pools[variant] = out;
  return out;
}

// ---------------------------------------------------------------
// Utvärdering av kandidater
// ---------------------------------------------------------------

export interface Candidate {
  /** Rad per kort i handen (-1 = kastas) */
  assign: number[];
  /** Låst: sållas aldrig bort, räknas lika noga som bästa draget */
  pinned?: boolean;
}

export interface CandidateResult {
  assign: number[];
  ev: number;
  sims: number;
  /** Andel simuleringar som slutade i Fantasy Land */
  flRate: number;
  /** Andel simuleringar som slutade i foul */
  foulRate: number;
  /** Överlevde till slutet (eller var låst) → fullt räknad med stark spelare */
  finalist: boolean;
  /** Var låst via `pinned` */
  pinned: boolean;
  /** Standardfel för EV-skillnaden mot bästa draget (parvis, samma blandningar). Bara för finalister. */
  evDiffSE?: number;
}

export interface EvalInput {
  rows: number[][];        // spelarens bräde före draget
  hand: number[];          // korten som ska placeras
  unseen: number[];        // alla kort spelaren inte sett
  opponent?: number[][];   // motståndarens synliga bräde (om känt)
  variant: Variant;
  maxSims: number;         // simuleringar för de bästa kandidaterna
  maxMs: number;
  onProgress?: (p: number) => void;
}

const SCREEN_KEEP = 12;
const SCREEN_SIMS = 60;

export function evaluateCandidates(input: EvalInput, cands: Candidate[]): CandidateResult[] {
  const { rows, hand, unseen, opponent, variant, maxSims, maxMs, onProgress } = input;
  const start = Date.now();
  const knownOpp = opponent && opponent.some((r) => r.length > 0) ? opponent : undefined;
  const pool = knownOpp ? [] : opponentPool(variant);
  const rand = rng(987654321);

  const decks: number[][] = [];
  const oppIdx: number[] = [];
  const scenario = (i: number) => {
    while (decks.length <= i) {
      decks.push(shuffled(unseen, rand));
      oppIdx.push(Math.floor(rand() * Math.max(1, pool.length)));
    }
    return decks[i];
  };

  const stats = cands.map((c) => ({ c, sum: 0, n: 0, fl: 0, foul: 0, stage: 2, vals: [] as number[] }));
  let alive = stats.slice();

  // Progress 0–100 som aldrig går bakåt. Skickas bara när den ökat minst 1.
  let last = 0;
  const report = (p: number) => {
    const v = Math.min(100, Math.floor(p));
    if (v >= last + 1) { last = v; onProgress?.(v); }
  };
  // Med grovsållning: sållningen får 0–20 %, huvudloopen 20–100 %.
  const screening = alive.length > SCREEN_KEEP * 2;
  const mainFrom = screening ? 20 : 0;

  const runOne = (st: (typeof stats)[number], i: number) => {
    const deck = scenario(i);
    const r: number[][] = [rows[0].slice(), rows[1].slice(), rows[2].slice()];
    for (let k = 0; k < hand.length; k++) if (st.c.assign[k] >= 0) r[st.c.assign[k]].push(hand[k]);
    const u = makeUnseen(unseen);
    const pos = playOut(r, deck, 0, u, variant);
    const me = settle(r[0], r[1], r[2]);
    let opp: Settled;
    if (knownOpp) {
      const o = [knownOpp[0].slice(), knownOpp[1].slice(), knownOpp[2].slice()];
      const ou = makeUnseen(deck.slice(pos));
      playOut(o, deck, pos, ou, variant);
      opp = o.every((x, k) => x.length === CAP[k]) ? settle(o[0], o[1], o[2]) : FOULED;
    } else opp = pool[oppIdx[i]];
    let v = scoreVs(me, opp);
    const fl = me.foul ? 0 : flEntryCards(me.top);
    if (fl) { v += FL_VALUE[fl]; st.fl++; }
    if (me.foul) st.foul++;
    st.sum += v; st.n++; st.vals.push(v);
  };

  // Steg 1 (många kandidater, t.ex. öppningshand): sålla snabbt på två
  // oberoende sätt och låt de bästa från BÅDA listorna gå vidare:
  //   a) snabba heuristiska spelaren (försiktig)
  //   b) bästa möjliga slutuppställning givet framtiden (optimistisk)
  if (screening) {
    // Två varv över kandidaterna (a och b) → 2 × antal steg à 0–20 %
    const steps = alive.length * 2;
    let done = 0;
    const saved = LA.samples;
    LA.samples = 0;
    for (const st of alive) {
      for (let i = 0; i < SCREEN_SIMS; i++) runOne(st, i);
      report(20 * ++done / steps);
    }
    LA.samples = saved;
    const placed = cands[0].assign.filter((x) => x >= 0).length;
    const freeAfter = 13 - rows[0].length - rows[1].length - rows[2].length - placed;
    const optimistic = new Map<(typeof stats)[number], number>();
    for (const st of alive) {
      const r: number[][] = [rows[0].slice(), rows[1].slice(), rows[2].slice()];
      for (let k = 0; k < hand.length; k++) if (st.c.assign[k] >= 0) r[st.c.assign[k]].push(hand[k]);
      let sum = 0;
      for (let i = 0; i < SCREEN_SIMS / 2; i++) sum += bestCompletion(r, scenario(i).slice(0, freeAfter));
      optimistic.set(st, sum);
      report(20 * ++done / steps);
    }
    const byA = alive.slice().sort((x, y) => y.sum - x.sum).slice(0, SCREEN_KEEP);
    const byB = alive.slice().sort((x, y) => optimistic.get(y)! - optimistic.get(x)!).slice(0, SCREEN_KEEP);
    const keep = new Set([...byA, ...byB, ...alive.filter((st) => st.c.pinned)]);
    for (const st of alive) st.stage = keep.has(st) ? 2 : 1;
    alive = [...keep];
    for (const st of alive) { st.sum = 0; st.n = 0; st.fl = 0; st.foul = 0; st.vals = []; }
    report(20);
  }

  // Steg 2: stark spelare. Ett drag slås ut först när det är statistiskt
  // sämre än ledaren: parvis jämförelse på samma blandningar, där
  // skillnaden måste vara större än 2 standardfel.
  const mean = (st: (typeof stats)[number], n: number) => { let x = 0; for (let i = 0; i < n; i++) x += st.vals[i]; return x / n; };
  const worse = (st: (typeof stats)[number], lead: (typeof stats)[number], n: number) => {
    let sum = 0, sq = 0;
    for (let i = 0; i < n; i++) { const d = st.vals[i] - lead.vals[i]; sum += d; sq += d * d; }
    const m = sum / n, sd = Math.sqrt(Math.max(0, sq / n - m * m));
    return m + 2 * sd / Math.sqrt(n) < 0;
  };
  const timeUp = () => Date.now() - start > maxMs;
  // Huvudloopens egen andel 0–1: simuleringar gjorda eller tid förbrukad av
  // den tid som var kvar när loopen började (det som går fortast vinner).
  const mainStart = Date.now();
  const mainMs = Math.max(1, maxMs - (mainStart - start));
  let batch = 25;
  while (true) {
    const target = Math.min(maxSims, Math.min(...alive.map((s) => s.n)) + batch);
    for (const st of alive) while (st.n < target && !timeUp()) runOne(st, st.n);
    const n = Math.min(...alive.map((s) => s.n));
    const own = Math.min(1, Math.max(n / maxSims, (Date.now() - mainStart) / mainMs));
    report(Math.min(99, mainFrom + (100 - mainFrom) * own));
    // Ensam kvar = avgjort, utom för låsta drag som alltid räknas klart
    if (n >= maxSims || (alive.length <= 1 && !alive.some((st) => st.c.pinned)) || timeUp() || n === 0) break;
    let lead = alive[0];
    for (const st of alive) if (mean(st, n) > mean(lead, n)) lead = st;
    if (n >= 100) alive = alive.filter((st) => st === lead || st.c.pinned || !worse(st, lead, n));
    // Tidsspärr: för många jämna kandidater → behåll de 12 bästa (låsta räknas inte)
    if (alive.length > 12 && n >= 100) {
      const free = alive.filter((st) => !st.c.pinned);
      if (free.length > 12) alive = [...free.sort((x, y) => mean(y, n) - mean(x, n)).slice(0, 12), ...alive.filter((st) => st.c.pinned)];
    }
    batch = Math.min(200, Math.ceil(batch * 1.5));
  }
  for (const st of alive) st.stage = 3;
  report(100);

  const out = stats
    .map((s) => ({ st: s, stage: s.stage, assign: s.c.assign, ev: s.sum / Math.max(1, s.n), sims: s.n, flRate: s.fl / Math.max(1, s.n), foulRate: s.foul / Math.max(1, s.n), finalist: s.stage === 3, pinned: !!s.c.pinned }))
    .sort((a, b) => b.stage - a.stage || b.sims - a.sims || b.ev - a.ev); // överlevt längst först

  // Precision för finalisterna: standardfelet för skillnaden mot bästa
  // draget, räknat parvis på samma blandningar (vals[i] = blandning i).
  const best = out[0].st;
  return out.map(({ st, ...r }) => {
    if (!r.finalist) return r;
    const n = Math.min(st.n, best.n);
    if (st === best || n < 2) return { ...r, evDiffSE: 0 };
    let sum = 0, sq = 0;
    for (let i = 0; i < n; i++) { const d = st.vals[i] - best.vals[i]; sum += d; sq += d * d; }
    const m = sum / n;
    return { ...r, evDiffSE: Math.sqrt(Math.max(0, (sq - n * m * m) / (n - 1)) / n) };
  });
}

export { freeOf, CAP };

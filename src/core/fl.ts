// ============================================================
// core/fl.ts — Exakt Fantasy Land-lösare
// ============================================================
//
// I Fantasy Land är alla kort kända, så ingen slump behövs för vår
// egen hand. Vi går igenom VARJE sätt att välja bottom (5), middle (5)
// och topp (3) av korten (resten kastas) — upp till ~40 miljoner för
// 16 kort — och värderar varje giltig uppställning:
//   royalties + chans att vinna varje rad mot en typisk motståndare
//   + värdet av att stanna kvar i FL.
// De bästa 40 räknas sedan om exakt mot hela motståndar-poolen
// (inkl. scoop-bonus).
// ============================================================

import { rowValues, maxAtMost, royaltyOf, qualifiesRepeat, scoreVs, settledOf, settle } from './eval';
import type { Settled } from './eval';
import { FL_VALUE } from './flValue';

export interface FLResult {
  /** Rad per kort: 0=topp, 1=middle, 2=bottom, -1=kastas */
  assign: number[];
  ev: number;
  repeat: boolean;
  royalties: number;
}

function subsets(idx: number[], k: number): number[] {
  const out: number[] = [];
  const rec = (start: number, left: number, mask: number) => {
    if (left === 0) { out.push(mask); return; }
    for (let i = start; i <= idx.length - left; i++) rec(i + 1, left - 1, mask | (1 << idx[i]));
  };
  rec(0, k, 0);
  return out;
}

/**
 * Förväntade poäng per rad mot poolen: P(vinst) − P(förlust) + royalty × P(vinst).
 * Royaltyn får man bara när man vinner raden (husregel) — eller när
 * motståndaren foular (då vinner man alla rader).
 */
function rowEdge(pool: Settled[]) {
  const ok = pool.filter((s) => !s.foul);
  const pF = 1 - ok.length / Math.max(1, pool.length);
  const sorted = [0, 1, 2].map((r) => ok.map((s) => (r === 0 ? s.top : r === 1 ? s.mid : s.bot)).sort((a, b) => a - b));
  const memo = [new Map<number, number>(), new Map<number, number>(), new Map<number, number>()];
  const lowerBound = (a: number[], v: number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; } return lo; };
  return (row: 0 | 1 | 2, v: number): number => {
    let x = memo[row].get(v);
    if (x === undefined) {
      const a = sorted[row];
      const below = lowerBound(a, v), notAbove = lowerBound(a, v + 1);
      const n = Math.max(1, a.length);
      const win = below / n;
      x = (1 - pF) * (win - (a.length - notAbove) / n) + royaltyOf(v, row) * (pF + (1 - pF) * win);
      memo[row].set(v, x);
    }
    return x;
  };
}

export function solveFantasyLand(cards: number[], pool: Settled[], keep = 40): FLResult[] {
  const n = cards.length;
  const all = cards.map((_, i) => i);
  const edge = rowEdge(pool);
  const repeatValue = FL_VALUE[13];

  // Värdelistor per delmängd (jokrar → flera möjliga värden)
  const lists = new Map<number, number[]>();
  const listOf = (mask: number) => {
    let l = lists.get(mask);
    if (!l) {
      const cs: number[] = [];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) cs.push(cards[i]);
      l = rowValues(cs);
      lists.set(mask, l);
    }
    return l;
  };

  const best: { score: number; t: number; m: number; b: number }[] = [];
  let threshold = -Infinity;
  const push = (score: number, t: number, m: number, b: number) => {
    best.push({ score, t, m, b });
    if (best.length > keep * 3) {
      best.sort((x, y) => y.score - x.score);
      best.length = keep;
      threshold = best[keep - 1].score;
    }
  };

  const tops = subsets(all, 3);
  let maxTop = -Infinity;
  for (const t of tops) maxTop = Math.max(maxTop, edge(0, listOf(t)[0]));
  const bound = maxTop + repeatValue;

  for (const b of subsets(all, 5)) {
    const vb = listOf(b)[0];
    const fb = edge(2, vb);
    const restB = all.filter((i) => !(b & (1 << i)));
    for (const m of subsets(restB, 5)) {
      const vm = maxAtMost(listOf(m), vb);
      if (vm < 0) continue;
      const fbm = fb + edge(1, vm);
      if (fbm + bound <= threshold) continue;
      const restM = restB.filter((i) => !(m & (1 << i)));
      for (const t of subsets(restM, 3)) {
        const vt = maxAtMost(listOf(t), vm);
        if (vt < 0) continue;
        const score = fbm + edge(0, vt) + (qualifiesRepeat(vt, vm, vb) ? repeatValue : 0);
        if (score > threshold) push(score, t, m, b);
      }
    }
  }

  best.sort((x, y) => y.score - x.score);
  const finalists = best.slice(0, keep);

  // Exakt omräkning mot hela poolen
  const results: FLResult[] = finalists.map(({ t, m, b }) => {
    const vb = listOf(b)[0];
    const vm = maxAtMost(listOf(m), vb);
    const vt = maxAtMost(listOf(t), vm);
    const me = settledOf(vt, vm, vb);
    const roy = me.roy;
    let sum = 0;
    for (const o of pool) sum += scoreVs(me, o);
    const repeat = qualifiesRepeat(vt, vm, vb);
    const assign = cards.map((_, i) => (t & (1 << i) ? 0 : m & (1 << i) ? 1 : b & (1 << i) ? 2 : -1));
    return { assign, ev: sum / Math.max(1, pool.length) + (repeat ? repeatValue : 0), repeat, royalties: roy };
  });
  results.sort((x, y) => y.ev - x.ev);
  return results;
}

/**
 * Värdet av EN given uppställning (t.ex. spelarens egen i "Jämför").
 * Samma värdering som de exakta finalisterna ovan: snittpoäng mot hela
 * poolen + repeat-värdet. Jokrarna väljs så att brädet inte foular (settle).
 * @param assign rad per kort: 0=topp, 1=middle, 2=bottom, -1=kastas
 */
export function evaluateFLAssign(cards: number[], assign: number[], pool: Settled[]): FLResult {
  const rows: number[][] = [[], [], []];
  cards.forEach((c, i) => { if (assign[i] >= 0) rows[assign[i]].push(c); });
  const me = settle(rows[0], rows[1], rows[2]);
  let sum = 0;
  for (const o of pool) sum += scoreVs(me, o);
  const repeat = !me.foul && qualifiesRepeat(me.top, me.mid, me.bot);
  return { assign, ev: sum / Math.max(1, pool.length) + (repeat ? FL_VALUE[13] : 0), repeat, royalties: me.roy };
}

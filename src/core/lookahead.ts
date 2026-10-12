// ============================================================
// core/lookahead.ts — Spelarens beslut: "titta framåt" med provframtider
// ============================================================
//
// För varje kort provar spelaren varje möjlig rad. För varje alternativ
// slumpas några möjliga framtider (de kort som ska fylla brädet), och
// för varje framtid räknas den BÄSTA möjliga slutuppställningen ut
// (royalties + FL-värde, foul = straff). Alternativet med högst snitt
// vinner. Spelaren vet alltså inte vilka kort som faktiskt kommer —
// men förstår vad varje rad kräver (t.ex. att bottom måste slå AA).
// Samma provframtider används för alla alternativ → rättvis jämförelse.
// ============================================================

import { plain3, plain5, rowValues, maxAtMost, royaltyOf, flEntryCards, catOf, isJ } from './eval';
import { FL_VALUE } from './flValue';
import { CAP, P, allOptions, valueWith } from './policy';
import type { Unseen } from './policy';

export const LA = { samples: 12, prefilter: 10, strength: 0.15 };

let seed = 1234567;
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

function sample(pool: number[], n: number): number[] {
  const a = pool.slice();
  const m = Math.min(n, a.length);
  for (let i = 0; i < m; i++) {
    const k = i + Math.floor(rand() * (a.length - i));
    const t = a[i]; a[i] = a[k]; a[k] = t;
  }
  return a.slice(0, m);
}

/** Alla värden en rad kan anta (snabbväg utan jokrar) */
function vals(cs: number[]): number[] {
  if (!cs.some(isJ)) return [cs.length === 5 ? plain5(cs) : plain3(cs)];
  return rowValues(cs);
}

const POP = new Uint8Array(256).map((_, i) => { let n = 0, x = i; while (x) { x &= x - 1; n++; } return n; });

// Återanvända buffertar (inga allokeringar i den heta loopen)
const bufB = [0, 0, 0, 0, 0], bufM = [0, 0, 0, 0, 0], bufT = [0, 0, 0];
const midVal = new Float64Array(256), topVal = new Float64Array(256);
const midList: (number[] | undefined)[] = new Array(256);
const topList: (number[] | undefined)[] = new Array(256);

function fill(buf: number[], base: number[], extra: number[], mask: number): number[] {
  let n = 0;
  for (let i = 0; i < base.length; i++) buf[n++] = base[i];
  for (let i = 0; mask; i++, mask >>= 1) if (mask & 1) buf[n++] = extra[i];
  return buf;
}

/**
 * Bästa slutvärde när `extra` fördelas på brädets lediga platser
 * (exakt genomgång av alla fördelningar).
 */
export function bestCompletion(rows: number[][], extra: number[]): number {
  const fm = CAP[1] - rows[1].length, fb = CAP[2] - rows[2].length;
  const R = extra.length;
  const full = (1 << R) - 1;
  const jk = rows[0].some(isJ) || rows[1].some(isJ) || rows[2].some(isJ) || extra.some(isJ);
  midVal.fill(-2, 0, full + 1);
  topVal.fill(-2, 0, full + 1);
  let best = -P.foul;
  for (let bm = 0; bm <= full; bm++) {
    if (POP[bm] !== fb) continue;
    const vb = vals(fill(bufB, rows[2], extra, bm))[0];
    const restB = full & ~bm;
    for (let mm = restB; ; mm = (mm - 1) & restB) {
      if (POP[mm] === fm) {
        let vm: number;
        if (jk) {
          let ml = midVal[mm] === -2 ? undefined : midList[mm];
          if (!ml) { ml = vals(fill(bufM, rows[1], extra, mm)).slice(); midList[mm] = ml; midVal[mm] = 0; }
          vm = maxAtMost(ml, vb);
        } else {
          if (midVal[mm] === -2) midVal[mm] = plain5(fill(bufM, rows[1], extra, mm));
          vm = midVal[mm] <= vb ? midVal[mm] : -1;
        }
        if (vm >= 0) {
          const tm = restB & ~mm;
          let vt: number;
          if (jk) {
            let tl = topVal[tm] === -2 ? undefined : topList[tm];
            if (!tl) { tl = vals(fill(bufT, rows[0], extra, tm)).slice(); topList[tm] = tl; topVal[tm] = 0; }
            vt = maxAtMost(tl, vm);
          } else {
            if (topVal[tm] === -2) topVal[tm] = plain3(fill(bufT, rows[0], extra, tm));
            vt = topVal[tm] <= vm ? topVal[tm] : -1;
          }
          if (vt >= 0) {
            const fl = flEntryCards(vt);
            const v = royaltyOf(vt, 0) + royaltyOf(vm, 1) + royaltyOf(vb, 2)
              + (fl ? FL_VALUE[fl] : 0) + LA.strength * (catOf(vm) + catOf(vb));
            if (v > best) best = v;
          }
        }
      }
      if (mm === 0) break;
    }
  }
  return best;
}

function withPlaced(rows: number[][], cs: number[], a: number[], fn: () => number): number {
  for (let k = 0; k < cs.length; k++) if (a[k] >= 0) rows[a[k]].push(cs[k]);
  const v = fn();
  for (let k = 0; k < cs.length; k++) if (a[k] >= 0) rows[a[k]].pop();
  return v;
}

/**
 * Väljer placering (rad per kort, -1 = kastas) för `cards`.
 * Heuristiken sållar fram de bästa kandidaterna, provframtider avgör.
 */
export function choose(
  rows: number[][], cards: number[], u: Unseen, variant: 'regular' | 'pineapple', discard: boolean,
): number[] {
  const opts = allOptions(rows, cards, discard);
  if (opts.length === 1) return opts[0];
  const placed = cards.length - (discard ? 1 : 0);
  const freeAfter = 13 - rows[0].length - rows[1].length - rows[2].length - placed;
  const draws = freeAfter * (variant === 'pineapple' ? 1.5 : 1);

  let cands = opts;
  if (LA.samples === 0) {
    // Snabbläge: bara heuristiken
    let best = opts[0], bv = -Infinity;
    for (const o of opts) { const v = valueWith(rows, cards, o, u, draws); if (v > bv) { bv = v; best = o; } }
    return best;
  }
  if (opts.length > LA.prefilter) {
    cands = opts
      .map((a) => ({ a, v: valueWith(rows, cards, a, u, draws) }))
      .sort((x, y) => y.v - x.v)
      .slice(0, LA.prefilter)
      .map((x) => x.a);
  }
  const futures: number[][] = [];
  const n = freeAfter === 0 ? 1 : LA.samples;
  for (let k = 0; k < n; k++) futures.push(sample(u.cards, freeAfter));

  let best = cands[0], bv = -Infinity;
  for (const a of cands) {
    const v = withPlaced(rows, cards, a, () => {
      let sum = 0;
      for (const f of futures) sum += bestCompletion(rows, f);
      return sum / futures.length;
    });
    if (v > bv) { bv = v; best = a; }
  }
  return best;
}

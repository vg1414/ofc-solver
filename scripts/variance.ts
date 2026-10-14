// Mäter slumpbruset i solvern: standardfel för EV-skillnaden mot bästa draget
// (evDiffSE) i några fasta lägen. Alla kandidater är låsta → lika många sim.
// sh scripts/run.sh scripts/variance.ts [sims] [pool-händer per spel]
import { evaluateCandidates, SIM } from '../src/core/sim';
import type { Variant } from '../src/core/sim';
import { toInts } from '../src/core/eval';
import { parseCard } from '../src/engine/card';

const sims = Number(process.argv[2] || 400);
const ints = (s: string) => (s ? toInts(s.split(' ').map(parseCard)) : []);
const rowsOf = (t: string, m: string, b: string) => [ints(t), ints(m), ints(b)];

interface Pos { name: string; variant: Variant; rows: number[][]; opp?: number[][]; hand: string; cands: string[] }
const positions: Pos[] = [
  { name: 'Öppning AA (pool)', variant: 'regular', rows: rowsOf('', '', ''), hand: 'Ah Ad 7c 8c 2s', cands: ['TTBBM', 'MMBBB', 'BBMMT'] },
  { name: 'Öppning PP KK99 (pool)', variant: 'pineapple', rows: rowsOf('', '', ''), hand: 'Kh Kd 9s 9c 4h', cands: ['TTBBM', 'MMBBT', 'BBMMT'] },
  { name: 'Mitt i, känd motst.', variant: 'regular', rows: rowsOf('Qs', '9h 9d', 'Ac Kc Qc'), opp: rowsOf('2h', '5s 5d', 'Jh Jd 7s'), hand: '8c', cands: ['T', 'M', 'B'] },
  { name: 'Mitt i (pool)', variant: 'regular', rows: rowsOf('Qs', '9h 9d', 'Ac Kc Qc'), hand: '8c', cands: ['T', 'M', 'B'] },
  { name: 'PP mitt i (pool)', variant: 'pineapple', rows: rowsOf('Kh', 'Th Td', '5c 6c 7c'), hand: 'Kd 8c 2s', cands: ['TB-', 'BT-', '-BM', 'MB-'] },
  // Jämna fall: nästan likadana drag (det är här solvern måste välja)
  { name: 'Jämn: öppning AA (pool)', variant: 'regular', rows: rowsOf('', '', ''), hand: 'Ah Ad 7c 8c 2s', cands: ['TTBBM', 'TTBMB', 'TTMBB'] },
  { name: 'Jämn: PP mitt i (pool)', variant: 'pineapple', rows: rowsOf('Kh', 'Th Td', '5c 6c 7c'), hand: 'Kd 8c 2s', cands: ['TB-', 'TM-', 'T-B'] },
  { name: 'Jämn: småkort (känd)', variant: 'regular', rows: rowsOf('Qs', '9h 9d 4c', 'Ac Kc Qc 5s'), opp: rowsOf('2h 3c', '5d 5h', 'Jh Jd 7s 7h'), hand: '3d', cands: ['M', 'B', 'T'] },
];
if (process.argv[3]) SIM.oppSamples = Number(process.argv[3]);

let total = 0;
for (const p of positions) {
  const hand = ints(p.hand);
  const seen = new Set([...hand, ...p.rows.flat(), ...(p.opp ?? []).flat()]);
  const unseen = Array.from({ length: 54 }, (_, i) => i).filter((i) => !seen.has(i));
  const cands = p.cands.map((c) => ({ assign: [...c].map((ch) => (ch === '-' ? -1 : 'TMB'.indexOf(ch))), pinned: true }));
  const t0 = Date.now();
  const res = evaluateCandidates({ rows: p.rows, hand, unseen, opponent: p.opp, variant: p.variant, maxSims: sims, maxMs: 600000 }, cands);
  const ms = Date.now() - t0;
  total += ms;
  const fmt = (a: number[]) => a.map((x) => (x < 0 ? '-' : 'TMB'[x])).join('');
  console.log(`\n${p.name}  (${ms} ms, ${sims} sim)`);
  for (const r of res) console.log(`  ${fmt(r.assign).padEnd(6)} EV ${r.ev.toFixed(3).padStart(7)}   SE(diff) ${(r.evDiffSE ?? 0).toFixed(3)}`);
}
console.log(`\nTotalt ${total} ms`);

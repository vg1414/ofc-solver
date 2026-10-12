// Kalibrering: solverns fria val vs en spelares egen linje (samma blandningar)
// sh scripts/run.sh scripts/calib.ts
import { evaluateCandidates } from '../src/core/sim';
import { allAssignments } from '../src/core/policy';
import { toInts } from '../src/core/eval';
import { parseCard } from '../src/engine/card';

const R = '23456789TJQKA', S = 'cdhs';
const nm = (c: number) => (c >= 52 ? 'Jk' : R[c >> 2] + S[c & 3]);
const ROWN = ['T', 'M', 'B'];

interface Spot { name: string; top?: string; mid?: string; bot?: string; hand: string; mine: string }
const spots: Spot[] = [
  { name: '1', hand: 'Ks Kd 9h 8h 3c', mine: 'MMBBM' },
  { name: '2', hand: 'Qc Jc Tc 4d 4s', mine: 'BBBMM' },
  { name: '3', hand: 'Jk As 6d 5d 2h', mine: 'BMBBM' },
  { name: '4', hand: 'Qh Qs 7d 7c 2s', mine: 'BBBBT' },
  { name: '5', hand: 'Ah Kh 4c 4d 3s', mine: 'MTBBB' },
  { name: '6', top: 'Kc', mid: '8s 8d 5h', bot: 'Ad Jd 6d 2d', hand: 'Kh', mine: 'T' },
  { name: '7', top: 'Qd 3s', mid: 'Ts Th 9c 4d', bot: '7h 7s 7c Kd', hand: 'Qc', mine: 'T' },
];
const only = process.argv[2]?.split(',');
const sims = Number(process.argv[3] || 2500);

for (const sp of spots) {
  if (only && !only.includes(sp.name)) continue;
  const parse = (x?: string) => (x ? x.split(' ').map(parseCard) : []);
  const all = toInts([...parse(sp.top), ...parse(sp.mid), ...parse(sp.bot), ...parse(sp.hand)]);
  const nt = parse(sp.top).length, nmid = parse(sp.mid).length, nb = parse(sp.bot).length;
  const rows = [all.slice(0, nt), all.slice(nt, nt + nmid), all.slice(nt + nmid, nt + nmid + nb)];
  const hand = all.slice(nt + nmid + nb);
  const unseen = Array.from({ length: 54 }, (_, i) => i).filter((i) => !all.includes(i));
  const t0 = Date.now();
  // 1) Fri sökning (som appen, Normal)
  const free = evaluateCandidates({ rows, hand, unseen, variant: 'regular', maxSims: 800, maxMs: 30000 },
    allAssignments(rows, hand).map((a) => ({ assign: a })));
  const key = (a: number[]) => a.map((r) => ROWN[r]).join('');
  const set = new Map<string, number[]>();
  for (const r of free.slice(0, 3)) set.set(key(r.assign), r.assign);
  set.set(sp.mine, [...sp.mine].map((c) => ROWN.indexOf(c)));
  // 2) Noggrann jämförelse
  const res = evaluateCandidates({ rows, hand, unseen, variant: 'regular', maxSims: sims, maxMs: 240000 },
    [...set.values()].map((a) => ({ assign: a })));
  console.log(`\n=== ${sp.name}: ${sp.top ? `T[${sp.top}] M[${sp.mid}] B[${sp.bot}] + ` : ''}${sp.hand}   (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  for (const r of res) {
    const lay = [0, 1, 2].map((row) => ROWN[row] + ':' + hand.filter((_, k) => r.assign[k] === row).map(nm).join(' ')).join('  ');
    const tag = key(r.assign) === sp.mine ? '  <= DIN' : '';
    console.log(`  EV ${r.ev.toFixed(2).padStart(6)}  FL ${(100 * r.flRate).toFixed(0).padStart(2)}%  foul ${(100 * r.foulRate).toFixed(0).padStart(2)}%  [${r.sims}]  ${lay}${tag}`);
  }
}

// Bygger motståndar-poolen i förväg (stark spelare) och sparar den i
// src/core/poolData.ts så att appen slipper räkna fram den vid start.
// Körs: sh scripts/run.sh scripts/buildPool.ts [antal] [provframtider]
import { writeFileSync } from 'node:fs';
import { playFullHand, shuffled, rng, FULL_DECK } from '../src/core/sim';
import { LA } from '../src/core/lookahead';

const N = Number(process.argv[2] || 2000);
LA.samples = Number(process.argv[3] || 16);
const rand = rng(424242);
const rows: number[] = [];
let foul = 0;
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  for (const variant of ['regular', 'pineapple'] as const) {
    const { s } = playFullHand(shuffled(FULL_DECK, rand), 0, variant);
    if (variant === 'regular' && s.foul) foul++;
    rows.push(variant === 'regular' ? 0 : 1, s.foul ? 1 : 0, s.top, s.mid, s.bot, s.roy);
  }
  if (i % 200 === 0) console.log(i, `${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
writeFileSync(
  'src/core/poolData.ts',
  `// Genererad av scripts/buildPool.ts — ändra inte för hand.\n` +
  `// Färdigspelade motståndarbräden: [variant(0=vanlig,1=pineapple), foul, topp, middle, bottom, royalties] × ${N * 2}\n` +
  `export const POOL_DATA: number[] = [${rows.join(',')}];\n`,
);
console.log(`klar: ${N} händer per variant, foul (vanlig) ${(100 * foul / N).toFixed(1)}%`);

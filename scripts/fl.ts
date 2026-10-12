// Visar Fantasy Land-lösarens bästa uppställningar: sh scripts/run.sh scripts/fl.ts "As Ah ... Jk"
import { solveFantasyLandMode } from '../src/solver/solver';
import { parseCard } from '../src/engine/card';
import type { Card } from '../src/engine/types';
const SY: Record<string, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const nm = (c: Card) => (c.kind === 'joker' ? 'Jk' : c.rank + SY[c.suit]);
const t0 = Date.now();
const r = solveFantasyLandMode(process.argv[2].split(' ').map(parseCard));
console.log(`${Date.now() - t0} ms`);
for (const o of r.options.slice(0, Number(process.argv[3] || 5))) {
  const row = (x: string) => o.placements.filter((p) => p.row === x).map((p) => nm(p.card)).join(' ');
  console.log(`#${o.rank} EV ${o.ev.toFixed(2)}${o.repeatFL ? '  ↻FL' : ''}\n   T: ${row('top')}   M: ${row('middle')}   B: ${row('bottom')}   kastas: ${o.discards.map(nm).join(' ')}`);
}

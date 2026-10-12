// Visar solverns svar på några öppningshänder + tidsåtgång
import { solveOpeningHand } from '../src/solver/solver';
import { parseCard } from '../src/engine/card';
const hands = (process.argv[2] || 'Ah Ad 7c 8c 2s,Qs Qd 9h 9c 4d,Kh Jh 9h 5h 2c,Jk 8s 8d 4c 3h').split(',');
for (const h of hands) {
  const t0 = Date.now();
  const r = solveOpeningHand(h.split(' ').map(parseCard), [], { simulations: Number(process.argv[3] || 800) });
  const fmt = (o: typeof r.best) => ['top', 'middle', 'bottom'].map((row) => row[0].toUpperCase() + ':' + o.placements.filter((p) => p.row === row).map((p) => p.card.kind === 'joker' ? 'Jk' : p.card.rank + p.card.suit[0]).join(' ')).join('  ');
  console.log(`\n${h}   (${Date.now() - t0} ms)`);
  for (const o of r.options.slice(0, 4)) console.log(`  #${o.rank} EV ${o.ev.toFixed(2).padStart(6)}  FL ${(100 * o.flProbability!).toFixed(0).padStart(2)}%  foul ${(100 * o.foulProbability!).toFixed(0).padStart(2)}%  [${o.simulations}]  ${fmt(o)}`);
}

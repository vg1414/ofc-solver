// Jämför policy-vikter: varje variant spelar samma händer mot samma motståndar-pool
import { playFullHand, shuffled, rng, FULL_DECK, opponentPool } from '../src/core/sim';
import { P } from '../src/core/policy';
import { LA } from '../src/core/lookahead';
import { scoreVs, flEntryCards } from '../src/core/eval';
import { FL_VALUE } from '../src/core/flValue';
const variant = (process.argv[2] as any) || 'regular';
const N = Number(process.argv[3] || 3000);
const base = { ...P };
const baseLA = { ...LA };
// Motståndare: heuristisk spelare (fast referens)
LA.samples = 0;
const pool = opponentPool(variant, 2000);
function run(label: string, over: Partial<typeof P> & { la?: Partial<typeof LA> }) {
  Object.assign(P, base, over);
  Object.assign(LA, baseLA, over.la ?? {});
  const rand = rng(77); let sum = 0, foul = 0, fl = 0;
  for (let i = 0; i < N; i++) {
    const { s } = playFullHand(shuffled(FULL_DECK, rand), 0, variant);
    let v = scoreVs(s, pool[i % pool.length]); const f = s.foul ? 0 : flEntryCards(s.top);
    if (f) { v += FL_VALUE[f]; fl++; } if (s.foul) foul++; sum += v;
  }
  console.log(label.padEnd(28), 'EV', (sum / N).toFixed(3), ' foul', (100 * foul / N).toFixed(1) + '%', ' FL', (100 * fl / N).toFixed(1) + '%');
}
const variants: [string, Partial<typeof P> & { la?: Partial<typeof LA> }][] = JSON.parse(process.argv[4] || '[["base",{}]]');
for (const [l, o] of variants) run(l, o);

// Räknar ut vad Fantasy Land är värt: löser slumpade FL-händer exakt
// och mäter snittvinst + chans att stanna kvar. Skriver ut nya FL_VALUE.
import { opponentPool, shuffled, rng, FULL_DECK } from '../src/core/sim';
import { solveFantasyLand } from '../src/core/fl';
import { FL_VALUE } from '../src/core/flValue';
const N = Number(process.argv[2] || 60);
const pool = opponentPool('regular', 2000);
for (let iter = 0; iter < 3; iter++) {
  const res: Record<number, { ev: number; rep: number }> = {};
  for (const n of [13, 14, 15, 16]) {
    const rand = rng(n * 1000 + iter); let ev = 0, rep = 0; const t0 = Date.now();
    for (let i = 0; i < N; i++) {
      const r = solveFantasyLand(shuffled(FULL_DECK, rand).slice(0, n), pool)[0];
      ev += r.ev - (r.repeat ? FL_VALUE[13] : 0); if (r.repeat) rep++;
    }
    res[n] = { ev: ev / N, rep: rep / N };
    console.log(`iter ${iter} n=${n}: snitt ${res[n].ev.toFixed(2)}p, repeat ${(100 * rep / N).toFixed(0)}%, ${((Date.now() - t0) / N).toFixed(0)} ms/hand`);
  }
  const v13 = res[13].ev / (1 - res[13].rep);
  for (const n of [13, 14, 15, 16]) FL_VALUE[n] = Math.round((res[n].ev + res[n].rep * v13) * 10) / 10;
  console.log('FL_VALUE =', JSON.stringify(FL_VALUE));
}

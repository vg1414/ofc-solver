// Foul-andel om man SÅG alla framtida kort (undre gräns för foul): sh scripts/run.sh scripts/clair.ts "Ah Ad 7c 8c 2s" MMBBT
import { bestCompletion } from '../src/core/lookahead';
import { P } from '../src/core/policy';
import { toInts } from '../src/core/eval';
import { shuffled, rng } from '../src/core/sim';
import { parseCard } from '../src/engine/card';
const hand = toInts(process.argv[2].split(' ').map(parseCard));
const unseen = Array.from({ length: 54 }, (_, i) => i).filter((i) => !hand.includes(i));
for (const line of process.argv[3].split(',')) {
  const rows: number[][] = [[], [], []];
  [...line].forEach((ch, k) => rows['TMB'.indexOf(ch)].push(hand[k]));
  const rand = rng(9); let foul = 0; const N = 2000;
  for (let i = 0; i < N; i++) if (bestCompletion(rows, shuffled(unseen, rand).slice(0, 8)) <= -P.foul) foul++;
  console.log(line, 'foul även med perfekt framtidskunskap:', (100 * foul / N).toFixed(1) + '%');
}

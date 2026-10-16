// Mäter svårighetsfiltret för träningsscenarion: hur många lägen som var
// givna (slängdes), vilka rundor som blev kvar och hur lång tid det tar.
//   sh scripts/run.sh scripts/scenDifficulty.ts regular 20
import { solveFromBoard } from '../src/solver/solver';
import { generateScenario, scenarioDifficulty } from '../src/training/scenarios';
import type { SolverInput } from '../src/hooks/useSolver';

const variant = (process.argv[2] as 'regular' | 'pineapple') || 'regular';
const N = Number(process.argv[3] || 20);
const jokers = process.argv[4] === 'joker';

let checks = 0, hard = 0, traps = 0;
const solve = async (i: SolverInput) => {
  const r = solveFromBoard(i.board, i.cards, i.deadCards, i.variant, i.options, i.opponentBoard);
  if (i.options?.naive) {
    const d = scenarioDifficulty(r);
    checks++;
    if (d.hard) hard++;
    if (d.trap) traps++;
  }
  return r;
};

const rounds: Record<number, number> = {};
const t0 = Date.now();
for (let k = 0; k < N; k++) {
  const s = await generateScenario(solve, variant, () => true, Math.random, { jokers });
  rounds[s.round] = (rounds[s.round] ?? 0) + 1;
}
const sec = (Date.now() - t0) / 1000;
console.log(`${variant}${jokers ? ' joker' : ''}: ${N} scenarion, ${checks} bedömda lägen, ${(100 * hard / checks).toFixed(0)} % svåra (${traps} fällor)`);
console.log(`rundor: ${JSON.stringify(rounds)}  ·  ${(sec / N).toFixed(1)} s per scenario`);

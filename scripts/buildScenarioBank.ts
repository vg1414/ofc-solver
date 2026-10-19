// Bygger banken med förberäknade träningsscenarion (public/scenarios/).
// Varje scenario spelas fram som i appen (generateScenario + svårighetsfiltret)
// och bedöms på Noggrann (SCENARIO_EVAL). Se src/training/scenarioBank.ts.
//
// Två steg, så att flera processer kan räkna samtidigt (ett scenario tar 10–40 s):
//   sh scripts/run.sh scripts/buildScenarioBank.ts gen regular vanlig 150 a   → scenarios-tmp/regular-vanlig.a.jsonl
//   sh scripts/run.sh scripts/buildScenarioBank.ts merge                      → public/scenarios/*.json
// gen fortsätter där den slutade om filen redan finns (en rad per scenario).
//
// Ändras bara solverns EV (inte vilka lägen som är svåra): räkna om de lägen
// som redan finns i public/scenarios i stället för att spela fram nya:
//   … reeval <regular|pineapple> <vanlig|joker> <del> <antal delar>   (t.ex. 0 8 … 7 8)
// och sedan merge. Töm scenarios-tmp först (den gamla bankens rader).
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { solveFromBoard } from '../src/solver/solver';
import type { SolverInput } from '../src/hooks/useSolver';
import type { GameVariant } from '../src/engine/types';
import { SCENARIO_EVAL, generateScenario, scenarioInput } from '../src/training/scenarios';
import { BANK_VERSION, bankKey, decScenario, encScenario, type BankFile, type BankScenario } from '../src/training/scenarioBank';

const TMP = 'scenarios-tmp';
const OUT = 'public/scenarios';
const [cmd, variantArg, modeArg, countArg, shardArg] = process.argv.slice(2);

const solve = async (i: SolverInput) => solveFromBoard(i.board, i.cards, i.deadCards, i.variant, i.options, i.opponentBoard);

if (cmd === 'gen') {
  const variant = variantArg as GameVariant;
  const jokers = modeArg === 'joker';
  const N = Number(countArg || 50);
  const shard = shardArg || 'a';
  mkdirSync(TMP, { recursive: true });
  const file = `${TMP}/${bankKey(variant, jokers)}.${shard}.jsonl`;
  let have = existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).length : 0;
  const t0 = Date.now();
  while (have < N) {
    const s = await generateScenario(solve, variant, () => true, Math.random, { jokers });
    const res = await solve(scenarioInput(s, SCENARIO_EVAL));
    appendFileSync(file, JSON.stringify(encScenario(s, res, `${shard}${have}`)) + '\n');
    have++;
    const sec = (Date.now() - t0) / 1000;
    console.log(`${file}: ${have}/${N}  (${sec.toFixed(0)} s)`);
  }
} else if (cmd === 'reeval') {
  const variant = variantArg as GameVariant;
  const jokers = modeArg === 'joker';
  const part = Number(countArg), parts = Number(shardArg);
  const key = bankKey(variant, jokers);
  const src = (JSON.parse(readFileSync(`${OUT}/${key}.json`, 'utf8')) as BankFile).scenarios.filter((_, i) => i % parts === part);
  mkdirSync(TMP, { recursive: true });
  const file = `${TMP}/${key}.r${part}.jsonl`;
  const have = existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).length : 0;
  const t0 = Date.now();
  for (let i = have; i < src.length; i++) {
    const s = decScenario(src[i], variant, jokers);
    const res = await solve(scenarioInput(s, SCENARIO_EVAL));
    appendFileSync(file, JSON.stringify(encScenario(s, res, src[i].id)) + '\n');
    console.log(`${file}: ${i + 1}/${src.length}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
} else if (cmd === 'merge') {
  mkdirSync(OUT, { recursive: true });
  const groups = new Map<string, BankScenario[]>();
  for (const f of readdirSync(TMP).filter((f) => f.endsWith('.jsonl')).sort()) {
    const key = f.split('.')[0];
    const rows = readFileSync(`${TMP}/${f}`, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as BankScenario);
    groups.set(key, [...(groups.get(key) ?? []), ...rows]);
  }
  for (const [key, scenarios] of groups) {
    const [variant, mode] = key.split('-');
    const file: BankFile = { v: BANK_VERSION, variant: variant as GameVariant, jokers: mode === 'joker', built: new Date().toISOString().slice(0, 10), scenarios };
    const text = JSON.stringify(file);
    writeFileSync(`${OUT}/${key}.json`, text);
    const rounds: Record<number, number> = {};
    scenarios.forEach((s) => (rounds[s.r] = (rounds[s.r] ?? 0) + 1));
    console.log(`${key}: ${scenarios.length} scenarion, ${(text.length / 1024).toFixed(0)} kB, rundor ${JSON.stringify(rounds)}`);
  }
} else {
  console.log('Användning: gen <regular|pineapple> <vanlig|joker> <antal> <shard>  |  reeval <variant> <läge> <del> <delar>  |  merge');
}

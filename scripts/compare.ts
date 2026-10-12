// Jämför utvalda uppställningar av en öppningshand med många simuleringar
// sh scripts/run.sh scripts/compare.ts "Ah Ad 7c 8c 2s" "BBBBT,MMBBM,..." [sims]
import { evaluateCandidates } from '../src/core/sim';
import { toInts } from '../src/core/eval';
import { parseCard } from '../src/engine/card';
const hand = toInts(process.argv[2].split(' ').map(parseCard));
const lines = process.argv[3].split(',');
const sims = Number(process.argv[4] || 6000);
import { LA } from "../src/core/lookahead";
if (process.argv[5]) LA.samples = Number(process.argv[5]);
const unseen = Array.from({ length: 54 }, (_, i) => i).filter((i) => !hand.includes(i));
const cands = lines.map((l) => ({ assign: [...l].map((ch) => 'TMB'.indexOf(ch)) }));
const res = evaluateCandidates({ rows: [[], [], []], hand, unseen, variant: 'regular', maxSims: sims, maxMs: 600000 }, cands);
// stoppa inte tidigt: kör alla till fulla sims
for (const r of res) console.log([...r.assign].map((a) => 'TMB'[a]).join(''), 'EV', r.ev.toFixed(2), ' FL', (100 * r.flRate).toFixed(1) + '%', ' foul', (100 * r.foulRate).toFixed(1) + '%', ' sims', r.sims);

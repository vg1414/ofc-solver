// ============================================================
// core/flValue.ts — Vad Fantasy Land är värt (i poäng)
// ============================================================
//
// Uträknat av scripts/computeFlValue.ts: simulerar tusentals FL-händer,
// löser varje exakt och mäter snittvinsten mot en normal motståndare
// (inkl. chansen att stanna kvar i FL). Index = antal FL-kort.
// Senast uträknat 2026-10-13 med 1000 händer per kortantal, 3 varv,
// med husregeln att royalty bara går till radens vinnare:
//   sh scripts/run.sh scripts/computeFlValue.ts 1000
// ============================================================

export const FL_VALUE: Record<number, number> = { 13: 19.7, 14: 26.3, 15: 33.8, 16: 42.2 };

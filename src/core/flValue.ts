// ============================================================
// core/flValue.ts — Vad Fantasy Land är värt (i poäng)
// ============================================================
//
// Uträknat av scripts/computeFlValue.ts: simulerar tusentals FL-händer,
// löser varje exakt och mäter snittvinsten mot en normal motståndare
// (inkl. chansen att stanna kvar i FL). Index = antal FL-kort.
// Kör `npx tsx scripts/computeFlValue.ts` för att räkna om.
// ============================================================

export const FL_VALUE: Record<number, number> = { 13: 19, 14: 28, 15: 35, 16: 41 };

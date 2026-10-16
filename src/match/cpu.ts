// ============================================================
// cpu.ts — Datorn som motståndare i Spela-fliken
// ============================================================
// Datorn sitter alltid på plats 2 (seat 1) och ser bara det en spelare
// får se (viewFor): din öppning är dold i runda 1, ditt FL-bräde likaså.
//
// Nivåerna skiljer sig på två sätt:
//   1. Hur noga solvern räknar (simuleringar + max tid per drag).
//   2. Hur ofta datorn väljer något annat än bästa draget. Bland de 8
//      bästa alternativen lottas ett, där vikten är exp(−förlust / T).
//      Litet T = nästan alltid bästa. Stort T = väljer ofta ett drag som
//      är lite sämre, och någon gång ett klart sämre (som en nybörjare).
//      Proffs och Svår (T = 0) tar alltid solverns bästa drag.
// ============================================================

import type { DetailedPlacementOption, DetailedSolverResult } from '../solver/solver';
import type { Move } from '../training/moves';

export type DuelCpuLevel = 'easy' | 'medium' | 'hard' | 'pro';

export const DUEL_CPU_LEVELS: Record<DuelCpuLevel, { label: string; sub: string; simulations: number; maxMs: number; temp: number }> = {
  easy: { label: 'Lätt', sub: 'gör misstag', simulations: 200, maxMs: 1500, temp: 0.6 },
  medium: { label: 'Medel', sub: 'ibland fel', simulations: 300, maxMs: 2000, temp: 0.15 },
  hard: { label: 'Svår', sub: 'solvern', simulations: 800, maxMs: 3000, temp: 0 },
  pro: { label: 'Proffs', sub: 'noggrann', simulations: 2000, maxMs: 8000, temp: 0 },
};

export const DUEL_CPU_IDS = Object.keys(DUEL_CPU_LEVELS) as DuelCpuLevel[];

export const isCpuLevel = (v: unknown): v is DuelCpuLevel => typeof v === 'string' && v in DUEL_CPU_LEVELS;

/** Hur många av de bästa alternativen som kan lottas */
const POOL = 8;

/** Datorns val bland solverns alternativ, enligt nivån */
export function pickCpuOption(res: DetailedSolverResult, level: DuelCpuLevel, rand: () => number = Math.random): DetailedPlacementOption {
  const t = DUEL_CPU_LEVELS[level].temp;
  if (t <= 0 || res.options.length < 2) return res.best;
  const pool = [res.best, ...res.options.filter((o) => o !== res.best).sort((a, b) => b.ev - a.ev)].slice(0, POOL);
  const top = res.best.ev;
  const w = pool.map((o) => Math.exp(-Math.max(0, top - o.ev) / t));
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= w[i];
    if (r <= 0) return pool[i];
  }
  return pool[0];
}

export function cpuMove(res: DetailedSolverResult, level: DuelCpuLevel, rand?: () => number): Move {
  const o = pickCpuOption(res, level, rand);
  return { placements: o.placements.map((p) => ({ ...p })), discards: [...o.discards] };
}

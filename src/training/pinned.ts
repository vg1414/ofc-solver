// ============================================================
// pinned.ts — "Lås" spelarens drag i solvern (förberett, avstängt)
// ============================================================
//
// Problemet: solvern sållar bort svaga drag tidigt. Ett bortsållat drag
// har färre simuleringar (och vid öppningshänder en svagare simulerad
// spelare), så dess EV blir osäkrare och ofta lite för låg.
//
// Lösningen (byggs i solver-motorn av en annan session): ett fält
// `pinned` i SolverOptions som tvingar solvern att räkna ett visst drag
// lika noga som bästa draget, på exakt samma kortlekar.
//
// SÅ SLÅR MAN PÅ DET när fältet finns i src/solver/solver.ts:
//   1. Sätt SOLVER_HAS_PINNED = true
//   2. Justera pinnedOptions() så att formen matchar solverns typ
// Då kör träningen om bedömningen med spelarens drag låst varje gång
// draget sållades bort tidigt, och notisen om osäker EV försvinner.
// ============================================================

import type { SolverOptions } from '../solver/solver';
import type { Move } from './moves';

export const SOLVER_HAS_PINNED = false;

export function pinnedOptions(options: SolverOptions, move: Move): SolverOptions {
  return {
    ...options,
    pinned: {
      placements: move.placements.map((p) => ({ card: p.card, row: p.row })),
      discards: move.discards,
    },
  } as SolverOptions;
}

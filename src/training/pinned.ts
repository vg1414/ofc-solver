// ============================================================
// pinned.ts — "Lås" spelarens drag i solvern
// ============================================================
//
// Problemet: solvern sållar bort svaga drag tidigt. Ett bortsållat drag
// har färre simuleringar (och vid öppningshänder en svagare simulerad
// spelare), så dess EV blir osäkrare och ofta lite för låg.
//
// Lösningen: fältet `pinned` i SolverOptions tvingar solvern att räkna
// ett visst drag lika noga som bästa draget, på exakt samma kortlekar.
// Träningen kör om bedömningen med spelarens drag låst varje gång draget
// inte var finalist (se wasScreenedEarly i moves.ts), och notisen om
// osäker EV försvinner.
// ============================================================

import type { SolverOptions } from '../solver/solver';
import type { Move } from './moves';

export const SOLVER_HAS_PINNED = true;

export function pinnedOptions(options: SolverOptions, move: Move): SolverOptions {
  return {
    ...options,
    pinned: [[
      ...move.placements.map((p) => ({ card: p.card, row: p.row })),
      ...move.discards.map((card) => ({ card, row: 'discard' as const })),
    ]],
  };
}

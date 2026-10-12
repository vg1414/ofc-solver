// ============================================================
// solverOrder.ts — Visningsordning för solverns alternativ
// ============================================================
// Solvern returnerar alternativen i "överlevnadsordning": det drag som
// klarade sig längst i utslagningen först, sedan efter antal simuleringar.
// Det gör att listan kan se osorterad ut (ett drag längre ner kan ha högre
// EV än det ovanför).
//
// För visning sorteras därför alla alternativ efter EV — med ett undantag:
// solverns bästa drag (result.best) står alltid först. Det är det drag som
// räknats flest gånger med den starka simulerade spelaren. Ett tidigt
// bortsållat drag kan av slumpen ha fått ett högre EV på få simuleringar,
// och ska inte kunna knuffa ner det.
// ============================================================

import type { DetailedSolverResult } from '../solver/solver';

export function sortForDisplay(result: DetailedSolverResult): DetailedSolverResult {
  const best = result.best;
  const rest = result.options.filter((o) => o !== best).sort((a, b) => b.ev - a.ev);
  const options = [best, ...rest].map((o, i) => ({ ...o, rank: i + 1 }));
  return { ...result, options, best: options[0] };
}

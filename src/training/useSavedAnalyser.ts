// ============================================================
// useSavedAnalyser.ts — Räknar sparade drag på Noggrann i bakgrunden
// ============================================================
//
// Monteras en gång i App, så den jobbar oavsett vilken flik som syns.
// Den har en egen worker (useSolverJobs) och tar ett drag i taget:
//   1. Hitta sparade drag som saknar en noggrann bedömning
//      (needsAnalysis), senast sparade först.
//   2. Räkna draget på Noggrann (2000 sim) med ditt drag låst (pinned),
//      eller exakt om det är Fantasy Land.
//   3. Spara bedömningen (updateSavedJudgement) → listan och arket under
//      "Sparade drag" visar den direkt.
// Status (vilket drag, hur långt) delas via setAnalysisStatus.
// Ett drag som misslyckas hoppas över tills man trycker "Försök igen".
// Drag som inte hunnit räknas när appen stängs tas nästa gång.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import type { SolverOptions } from '../solver/solver';
import { judge } from './moves';
import { pinnedOptions } from './pinned';
import { needsAnalysis, setAnalysisStatus, updateSavedJudgement, useAnalysisStatus, useSavedMoves } from './savedMoves';
import { CANCELLED, useSolverJobs } from './useSolverJobs';

const THOROUGH: SolverOptions = { simulations: 2000 };

export function useSavedAnalyser() {
  const saved = useSavedMoves();
  const { failed } = useAnalysisStatus();
  const { solve, progress } = useSolverJobs();
  const running = useRef<string | null>(null);
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (running.current) return;
    const next = saved.find((s) => needsAnalysis(s) && !failed.includes(s.id));
    if (!next) return;
    running.current = next.id;
    setAnalysisStatus({ id: next.id, progress: null });
    solve({ ...next.input, options: next.fl ? {} : pinnedOptions(THOROUGH, next.move) })
      .then((res) => updateSavedJudgement(next.id, judge(res, next.move), true))
      .catch((e: Error) => {
        if (e.message !== CANCELLED) setAnalysisStatus({ failed: [...failed, next.id] });
      })
      .finally(() => {
        running.current = null;
        setAnalysisStatus({ id: null, progress: null });
        setDone((n) => n + 1);
      });
  }, [saved, failed, done, solve]);

  useEffect(() => {
    if (running.current) setAnalysisStatus({ progress });
  }, [progress]);
}

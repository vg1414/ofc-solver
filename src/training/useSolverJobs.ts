// ============================================================
// useSolverJobs.ts — useSolver() som "await"-bar kö
// ============================================================
//
// useSolver() är byggd för Solver-fliken: man startar en körning och
// läser resultatet ur React-state. Träningsläget behöver i stället
// köra många beräkningar efter varandra (datorn spelar fram ett bräde
// drag för drag), så här packas samma hook in i Promises:
//
//   const jobs = useSolverJobs();
//   const result = await jobs.solve({ board, cards, ... });
//
// Under huven:
//  - Varje anrop läggs i en kö. Bara ett jobb åt gången skickas till
//    workern (en worker räknar ändå bara en sak i taget).
//  - När useSolver() har ett nytt resultat (isLoading går från true till
//    false) löses jobbets Promise med resultatet — eller avvisas vid fel.
//  - cancel() avbryter allt: workern stängs (cancelSolver) och alla
//    väntande jobb avvisas med CANCELLED.
//
// Varje useSolverJobs() har en egen worker, så två instanser kan räkna
// samtidigt (t.ex. bedöma ditt drag medan nästa scenario spelas fram).
// ============================================================

import { useCallback, useEffect, useRef } from 'react';
import { useSolver, type SolverInput } from '../hooks/useSolver';
import type { DetailedSolverResult } from '../solver/solver';

export const CANCELLED = 'cancelled';

interface Job {
  input: SolverInput;
  resolve: (r: DetailedSolverResult) => void;
  reject: (e: Error) => void;
}

export function useSolverJobs() {
  const s = useSolver();
  const queue = useRef<Job[]>([]);
  const current = useRef<Job | null>(null);
  const sawLoading = useRef(false);
  const runSolver = s.runSolver; // stabil (useCallback i useSolver)

  const pump = useCallback(() => {
    if (current.current || queue.current.length === 0) return;
    const job = queue.current.shift()!;
    current.current = job;
    sawLoading.current = false;
    runSolver(job.input);
  }, [runSolver]);

  // Följ useSolver-state: när en körning är klar → lös jobbets Promise
  useEffect(() => {
    const job = current.current;
    if (!job) return;
    if (s.isLoading) {
      sawLoading.current = true;
      return;
    }
    // Fel kan komma direkt utan att isLoading slagits på (t.ex. inga kort)
    if (s.error) {
      current.current = null;
      job.reject(new Error(s.error));
      pump();
      return;
    }
    if (sawLoading.current && s.result) {
      current.current = null;
      job.resolve(s.result);
      pump();
    }
  }, [s.isLoading, s.result, s.error, pump]);

  const solve = useCallback(
    (input: SolverInput) =>
      new Promise<DetailedSolverResult>((resolve, reject) => {
        queue.current.push({ input, resolve, reject });
        pump();
      }),
    [pump],
  );

  const cancelSolver = s.cancelSolver;
  const cancel = useCallback(() => {
    const pending = [...(current.current ? [current.current] : []), ...queue.current];
    current.current = null;
    queue.current = [];
    cancelSolver();
    for (const j of pending) j.reject(new Error(CANCELLED));
  }, [cancelSolver]);

  // Avvisa väntande jobb om komponenten försvinner
  useEffect(() => () => cancel(), [cancel]);

  return { solve, cancel, progress: s.progress, busy: s.isLoading };
}

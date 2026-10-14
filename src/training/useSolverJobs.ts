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
//  - Varje körning får ett id av runSolver(). När useSolver() säger att
//    just den körningen är klar (doneId) löses jobbets Promise med
//    resultatet — eller avvisas vid fel. (Tidigare väntade vi på att se
//    isLoading gå true → false, men gick solvern snabbt kunde React slå
//    ihop båda ändringarna, och då hängde jobbet för evigt.)
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
  /** Körningens id från runSolver (sätts när jobbet startar) */
  id?: number;
  reject: (e: Error) => void;
}

export function useSolverJobs() {
  const s = useSolver();
  const queue = useRef<Job[]>([]);
  const current = useRef<Job | null>(null);
  const runSolver = s.runSolver; // stabil (useCallback i useSolver)

  const pump = useCallback(() => {
    if (current.current || queue.current.length === 0) return;
    const job = queue.current.shift()!;
    current.current = job;
    job.id = runSolver(job.input);
  }, [runSolver]);

  // Följ useSolver-state: när en körning är klar → lös jobbets Promise
  useEffect(() => {
    const job = current.current;
    if (!job || job.id === undefined || s.doneId !== job.id) return;
    current.current = null;
    if (s.error) job.reject(new Error(s.error));
    else if (s.result) job.resolve(s.result);
    else job.reject(new Error('Solvern gav inget resultat.'));
    pump();
  }, [s.doneId, s.result, s.error, pump]);

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

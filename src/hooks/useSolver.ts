// ============================================================
// useSolver.ts — React hook för kommunikation med solver worker
// ============================================================
//
// Hanterar hela livscykeln för solver-beräkningar:
//   1. Skapar och återanvänder Web Worker
//   2. Skickar solver-anrop asynkront
//   3. Exponerar loading-state och resultat till UI
//   4. Rensar upp worker vid unmount
//
// Användning:
//   const { result, isLoading, error, runSolver, cancelSolver } = useSolver();
//   runSolver({ board, cards, deadCards, variant, options });
// ============================================================

import { useRef, useState, useCallback, useEffect } from 'react';
import type { Board, Card, GameVariant } from '../engine/types';
import type {
  DetailedSolverResult,
  SolverOptions,
  SolverWorkerMessage,
  SolverWorkerResponse,
} from '../solver/solver';

// ============================================================
// Typer
// ============================================================

export interface SolverInput {
  board: Board;
  cards: Card[];
  deadCards?: Card[];
  variant?: GameVariant;
  options?: SolverOptions;
}

export interface UseSolverState {
  result: DetailedSolverResult | null;
  isLoading: boolean;
  error: string | null;
  /** Antal simuleringar från senaste körning */
  lastSimulations: number;
}

export interface UseSolverReturn extends UseSolverState {
  /** Kör solvern med givet input. Avbryter ev. pågående beräkning. */
  runSolver: (input: SolverInput) => void;
  /** Avbryter pågående beräkning och återställer loading-state */
  cancelSolver: () => void;
  /** Rensar resultatet (men behåller worker) */
  clearResult: () => void;
}

// ============================================================
// Hook
// ============================================================

export function useSolver(): UseSolverReturn {
  const workerRef = useRef<Worker | null>(null);
  // Räknare för att ignorera svar från gamla anrop
  const requestIdRef = useRef(0);

  const [state, setState] = useState<UseSolverState>({
    result: null,
    isLoading: false,
    error: null,
    lastSimulations: 0,
  });

  // Skapa worker en gång
  const getWorker = useCallback((): Worker => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/solver.worker.ts', import.meta.url),
        { type: 'module' },
      );
    }
    return workerRef.current;
  }, []);

  // Avregistrera worker vid unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const runSolver = useCallback(
    (input: SolverInput) => {
      const { board, cards, deadCards = [], variant = 'regular', options } = input;

      if (cards.length === 0) {
        setState((s) => ({ ...s, error: 'Inga kort att beräkna.', isLoading: false }));
        return;
      }

      // Öka request-id; svar med lägre id ignoreras
      const currentId = ++requestIdRef.current;

      setState((s) => ({ ...s, isLoading: true, error: null }));

      const worker = getWorker();

      const handleMessage = (event: MessageEvent<SolverWorkerResponse>) => {
        // Ignorera svar från föregående anrop
        if (requestIdRef.current !== currentId) return;

        worker.removeEventListener('message', handleMessage);
        worker.removeEventListener('error', handleError);

        const data = event.data;
        if (data.type === 'result') {
          setState({
            result: data.result,
            isLoading: false,
            error: null,
            lastSimulations: data.result.simulations,
          });
        } else {
          setState((s) => ({
            ...s,
            isLoading: false,
            error: data.message,
          }));
        }
      };

      const handleError = (event: ErrorEvent) => {
        if (requestIdRef.current !== currentId) return;
        worker.removeEventListener('message', handleMessage);
        worker.removeEventListener('error', handleError);
        setState((s) => ({
          ...s,
          isLoading: false,
          error: `Worker-fel: ${event.message}`,
        }));
      };

      worker.addEventListener('message', handleMessage);
      worker.addEventListener('error', handleError);

      const msg: SolverWorkerMessage = {
        type: 'solveFromBoard',
        board,
        cards,
        deadCards,
        variant,
        options,
      };
      worker.postMessage(msg);
    },
    [getWorker],
  );

  const cancelSolver = useCallback(() => {
    // Avsluta worker och skapa ny nästa gång
    workerRef.current?.terminate();
    workerRef.current = null;
    requestIdRef.current++;
    setState((s) => ({ ...s, isLoading: false }));
  }, []);

  const clearResult = useCallback(() => {
    setState((s) => ({ ...s, result: null, error: null }));
  }, []);

  return {
    ...state,
    runSolver,
    cancelSolver,
    clearResult,
  };
}

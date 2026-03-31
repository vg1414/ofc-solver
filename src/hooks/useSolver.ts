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
import type { Board, Card, GameVariant, SolverMode } from '../engine/types';
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
  opponentBoard?: Board;
  options?: SolverOptions;
  /** Solver-läge: 'normal' | 'opening' | 'fantasyLand' (default: 'normal') */
  mode?: SolverMode;
}

export interface UseSolverState {
  result: DetailedSolverResult | null;
  isLoading: boolean;
  error: string | null;
  /** Antal simuleringar från senaste körning */
  lastSimulations: number;
  /** Beräkningsprogress 0–100 (null = ej startad/klar) */
  progress: number | null;
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
    progress: null,
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
      const { board, cards, deadCards = [], variant = 'regular', opponentBoard, options, mode = 'normal' } = input;

      if (cards.length === 0) {
        setState((s) => ({ ...s, error: 'Inga kort att beräkna.', isLoading: false }));
        return;
      }

      // Öka request-id; svar med lägre id ignoreras
      const currentId = ++requestIdRef.current;

      setState((s) => ({ ...s, isLoading: true, error: null, progress: 0 }));

      const worker = getWorker();

      const handleMessage = (event: MessageEvent<SolverWorkerResponse>) => {
        // Ignorera svar från föregående anrop
        if (requestIdRef.current !== currentId) return;

        const data = event.data;

        // Progress-uppdatering — håll loading-state, uppdatera bara progress
        if (data.type === 'progress') {
          setState((s) => ({ ...s, progress: data.percent }));
          return;
        }

        worker.removeEventListener('message', handleMessage);
        worker.removeEventListener('error', handleError);

        if (data.type === 'result') {
          setState({
            result: data.result,
            isLoading: false,
            error: null,
            lastSimulations: data.result.simulations,
            progress: 100,
          });
        } else {
          setState((s) => ({
            ...s,
            isLoading: false,
            error: data.message,
            progress: null,
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
          progress: null,
        }));
      };

      worker.addEventListener('message', handleMessage);
      worker.addEventListener('error', handleError);

      let msg: SolverWorkerMessage;
      if (mode === 'opening') {
        msg = { type: 'solve_opening', cards, deadCards, options };
      } else if (mode === 'fantasyLand') {
        msg = { type: 'solve_fl', cards, deadCards, options };
      } else {
        msg = { type: 'solveFromBoard', board, cards, deadCards, variant, opponentBoard, options };
      }
      worker.postMessage(msg);
    },
    [getWorker],
  );

  const cancelSolver = useCallback(() => {
    // Avsluta worker och skapa ny nästa gång
    workerRef.current?.terminate();
    workerRef.current = null;
    requestIdRef.current++;
    setState((s) => ({ ...s, isLoading: false, progress: null }));
  }, []);

  const clearResult = useCallback(() => {
    setState((s) => ({ ...s, result: null, error: null, progress: null }));
  }, []);

  return {
    ...state,
    runSolver,
    cancelSolver,
    clearResult,
  };
}

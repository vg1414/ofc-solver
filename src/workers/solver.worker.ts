// ============================================================
// solver.worker.ts — Web Worker för OFC-solver
// ============================================================
//
// Kör solver-beräkningar i bakgrunden så att UI inte fryser.
// Kommunicerar via postMessage med typade meddelanden definierade
// i solver.ts (SolverWorkerMessage / SolverWorkerResponse).
//
// Exempel på användning från main thread:
//
//   const worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
//   worker.postMessage({ type: 'solveFromBoard', board, cards, deadCards, variant, options });
//   worker.onmessage = (e) => { ... e.data.result ... };
// ============================================================

import { solveFromBoard, solve } from '../solver/solver';
import type { SolverWorkerMessage, SolverWorkerResponse } from '../solver/solver';

self.onmessage = (event: MessageEvent<SolverWorkerMessage>) => {
  const msg = event.data;

  const sendProgress = (percent: number) => {
    self.postMessage({ type: 'progress', percent } as SolverWorkerResponse);
  };

  try {
    if (msg.type === 'solveFromBoard') {
      const result = solveFromBoard(
        msg.board,
        msg.cards,
        msg.deadCards,
        msg.variant,
        {
          ...msg.options,
          onProgress: sendProgress,
        },
      );
      self.postMessage({ type: 'result', result } as SolverWorkerResponse);
    } else if (msg.type === 'solve') {
      const result = solve(msg.state, msg.playerId, msg.opponentId, {
        ...msg.options,
        onProgress: sendProgress,
      });
      self.postMessage({ type: 'result', result } as SolverWorkerResponse);
    } else {
      self.postMessage({ type: 'error', message: 'Okänd meddelandetyp' } as SolverWorkerResponse);
    }
  } catch (err: any) {
    self.postMessage({ type: 'error', message: err.message || String(err) } as SolverWorkerResponse);
  }
};

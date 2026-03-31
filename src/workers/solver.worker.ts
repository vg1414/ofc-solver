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

import { handleSolverMessage } from '../solver/solver';
import type { SolverWorkerMessage, SolverWorkerResponse } from '../solver/solver';

self.onmessage = (event: MessageEvent<SolverWorkerMessage>) => {
  const msg = event.data;

  const sendProgress = (percent: number) => {
    self.postMessage({ type: 'progress', percent } as SolverWorkerResponse);
  };

  // Injicera progress-callback i options
  const msgWithProgress = {
    ...msg,
    options: {
      ...msg.options,
      onProgress: sendProgress,
    },
  } as SolverWorkerMessage;

  const response = handleSolverMessage(msgWithProgress);
  self.postMessage(response);
};

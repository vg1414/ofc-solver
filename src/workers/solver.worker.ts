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
import type { SolverWorkerMessage } from '../solver/solver';

self.onmessage = (event: MessageEvent<SolverWorkerMessage>) => {
  const response = handleSolverMessage(event.data);
  self.postMessage(response);
};

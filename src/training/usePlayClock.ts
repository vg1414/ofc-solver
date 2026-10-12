// ============================================================
// usePlayClock.ts — Speltid för tidsläget i Hel hand
// ============================================================
// Räknar millisekunder medan `running` är sant OCH sidan syns.
// Byter man till Solver-fliken, låser telefonen eller byter app
// stannar klockan, så att man inte "förlorar" tid man inte spelat.
// Tiden samlas i en ref (`banked`) + starttiden för pågående pass;
// en interval-timer uppdaterar visningen fyra gånger i sekunden.
// ============================================================

import { useEffect, useRef, useState } from 'react';

export function usePlayClock(running: boolean): number {
  const banked = useRef(0);
  const since = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const now = () => banked.current + (since.current === null ? 0 : performance.now() - since.current);
    const sync = () => {
      const go = running && document.visibilityState === 'visible';
      if (go && since.current === null) since.current = performance.now();
      if (!go && since.current !== null) {
        banked.current += performance.now() - since.current;
        since.current = null;
      }
      setElapsed(now());
    };
    sync();
    const id = window.setInterval(() => setElapsed(now()), 250);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', sync);
      // Pausa: spara det som hunnit gå
      if (since.current !== null) {
        banked.current += performance.now() - since.current;
        since.current = null;
      }
    };
  }, [running]);

  return elapsed;
}

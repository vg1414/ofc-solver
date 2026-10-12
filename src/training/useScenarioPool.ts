// ============================================================
// useScenarioPool.ts — Kö med färdiga scenarion, förberedda i förväg
// ============================================================
//
// Datorn behöver några sekunder för att spela fram ett realistiskt
// scenario. För att du aldrig ska behöva vänta fylls en kö på i
// bakgrunden (egen solver-worker), redan medan du står på startsidan:
//
//  - Upp till POOL_SIZE scenarion hålls redo per variant + läge
//    (t.ex. "Pineapple, Joker"). Byter du inställning fylls den kön på,
//    och de andra ligger kvar till nästa gång.
//  - take() plockar det äldsta scenariot och väcker genast loopen så att
//    ett nytt börjar spelas fram — medan du funderar på det du fick.
//  - Överblivna scenarion när omgången är slut ligger kvar till nästa.
//  - `active = false` (t.ex. när du är i Solver-fliken) pausar
//    genereringen, så den inte stjäl kraft från dina solverberäkningar.
// ============================================================

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { GameVariant } from '../engine/types';
import { generateScenario, type Scenario } from './scenarios';
import { CANCELLED, useSolverJobs } from './useSolverJobs';

export const POOL_SIZE = 3;

export function useScenarioPool(variant: GameVariant, jokers: boolean, active: boolean) {
  const gen = useSolverJobs();
  const pools = useRef(new Map<string, Scenario[]>());
  const wake = useRef<(() => void) | null>(null);
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [error, setError] = useState<string | null>(null);
  const key = `${variant}:${jokers ? 'joker' : 'vanlig'}`;
  const { solve, cancel } = gen;

  useEffect(() => {
    if (!active) return;
    let alive = true;
    const isAlive = () => alive;
    (async () => {
      while (alive) {
        if ((pools.current.get(key)?.length ?? 0) >= POOL_SIZE) {
          // Kön är full — sov tills någon tar ett scenario (eller vi stängs)
          await new Promise<void>((r) => (wake.current = r));
          continue;
        }
        try {
          const s = await generateScenario(solve, variant, isAlive, Math.random, { jokers });
          pools.current.set(key, [...(pools.current.get(key) ?? []), s]);
          setError(null);
          rerender();
        } catch (e) {
          if (!alive) return;
          const msg = e instanceof Error ? e.message : String(e);
          if (msg !== CANCELLED) setError(msg);
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    })();
    return () => {
      alive = false;
      wake.current?.();
      wake.current = null;
      cancel();
    };
  }, [key, variant, jokers, active, solve, cancel]);

  /** Plocka nästa färdiga scenario (null om inget är klart än) */
  const take = useCallback((): Scenario | null => {
    const list = pools.current.get(key) ?? [];
    if (list.length === 0) return null;
    const [s, ...rest] = list;
    pools.current.set(key, rest);
    wake.current?.();
    wake.current = null;
    rerender();
    return s;
  }, [key]);

  return { take, ready: pools.current.get(key)?.length ?? 0, error };
}

export type ScenarioPool = ReturnType<typeof useScenarioPool>;

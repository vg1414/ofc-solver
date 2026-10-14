// ============================================================
// useScenarioPool.ts — Kö med färdiga scenarion, förberedda i förväg
// ============================================================
//
// Datorn behöver några sekunder för att spela fram ett realistiskt
// scenario. För att du aldrig ska behöva vänta fylls en kö på i
// bakgrunden, redan medan du står på startsidan. Två workers jobbar
// samtidigt (telefoner har flera kärnor):
//
//  - Framspelaren fyller kön först: upp till POOL_SIZE scenarion per
//    variant + läge (t.ex. "Pineapple, Joker"). Byter du inställning
//    fylls den kön på, och de andra ligger kvar till nästa gång.
//  - Bedömaren räknar varje scenario på Noggrann (`evaluation`), äldsta
//    först, så att svaret finns direkt när du lagt ditt drag. Den väntar
//    aldrig på framspelaren och tvärtom — jokerbedömningar är ~4× så
//    tunga som vanliga och fick förut nästa scenario att dröja.
//    Tas ett scenario mitt i bedömningen avbryts den och ScenarioRun
//    räknar själv.
//  - take() plockar det äldsta scenariot och väcker båda loopar så att
//    ett nytt börjar spelas fram — medan du funderar på det du fick.
//  - Överblivna scenarion när omgången är slut ligger kvar till nästa.
//  - `active = false` (t.ex. när du är i Solver-fliken) pausar båda,
//    så de inte stjäl kraft från dina solverberäkningar.
// ============================================================

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { GameVariant } from '../engine/types';
import { SCENARIO_EVAL, generateScenario, scenarioInput, type Scenario } from './scenarios';
import { CANCELLED, useSolverJobs } from './useSolverJobs';

export const POOL_SIZE = 3;

export function useScenarioPool(variant: GameVariant, jokers: boolean, active: boolean) {
  const gen = useSolverJobs();
  const judge = useSolverJobs();
  const pools = useRef(new Map<string, Scenario[]>());
  /** Loopar som sover tills något ändras i kön */
  const sleepers = useRef<(() => void)[]>([]);
  /** Id för scenariot som bedöms just nu (null = ingen bedömning pågår) */
  const evaluating = useRef<string | null>(null);
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [error, setError] = useState<string | null>(null);
  const key = `${variant}:${jokers ? 'joker' : 'vanlig'}`;
  const { solve: genSolve, cancel: genCancel } = gen;
  const { solve: judgeSolve, cancel: judgeCancel } = judge;

  const wakeAll = useCallback(() => {
    const s = sleepers.current;
    sleepers.current = [];
    s.forEach((r) => r());
  }, []);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    const isAlive = () => alive;
    const sleep = () => new Promise<void>((r) => sleepers.current.push(r));
    const list = () => pools.current.get(key) ?? [];

    /** Kör ett steg; fel visas, avbrott (CANCELLED) tyst */
    const step = async (work: () => Promise<void>) => {
      try {
        await work();
        setError(null);
        rerender();
      } catch (e) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (msg !== CANCELLED) {
          setError(msg);
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    };

    // Framspelaren: håll kön full
    (async () => {
      while (alive) {
        if (list().length >= POOL_SIZE) {
          await sleep();
          continue;
        }
        await step(async () => {
          const s = await generateScenario(genSolve, variant, isAlive, Math.random, { jokers });
          pools.current.set(key, [...list(), s]);
          wakeAll(); // bedömaren har något nytt att räkna på
        });
      }
    })();

    // Bedömaren: räkna äldsta obedömda scenariot
    (async () => {
      while (alive) {
        const todo = list().find((s) => !s.evaluation);
        if (!todo) {
          await sleep();
          continue;
        }
        evaluating.current = todo.id;
        await step(async () => {
          const res = await judgeSolve(scenarioInput(todo, SCENARIO_EVAL));
          // Togs scenariot medan vi räknade finns det inte kvar → resultatet slängs
          pools.current.set(key, list().map((s) => (s.id === todo.id ? { ...s, evaluation: res } : s)));
        });
        evaluating.current = null;
      }
    })();

    return () => {
      alive = false;
      wakeAll();
      genCancel();
      judgeCancel();
    };
  }, [key, variant, jokers, active, genSolve, genCancel, judgeSolve, judgeCancel, wakeAll]);

  /** Plocka nästa färdiga scenario (null om inget är klart än) */
  const take = useCallback((): Scenario | null => {
    const list = pools.current.get(key) ?? [];
    if (list.length === 0) return null;
    const [s, ...rest] = list;
    pools.current.set(key, rest);
    // Räknade bedömaren just på det här scenariot? Avbryt — ScenarioRun
    // räknar själv, så att två workers inte gör samma jobb samtidigt.
    if (evaluating.current === s.id) judgeCancel();
    wakeAll();
    rerender();
    return s;
  }, [key, judgeCancel, wakeAll]);

  return { take, ready: pools.current.get(key)?.length ?? 0, error };
}

export type ScenarioPool = ReturnType<typeof useScenarioPool>;

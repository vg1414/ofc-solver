// ============================================================
// ScenarioRun.tsx — Scenarioträning (poängjakt)
// ============================================================
//
// Två solver-workers arbetar samtidigt:
//  - `gen`  spelar fram kommande scenarion (datorn spelar båda bräden).
//           Den håller en buffert på 2 färdiga scenarion i förväg.
//  - `ev`   bedömer scenariot du ser just nu (Noggrann, 2000 sim). Den
//           startar direkt när scenariot visas, så resultatet oftast är
//           klart när du har lagt dina kort.
//
// Faser:  loading → play → (judging) → feedback → loading … → summary
//   loading  väntar på nästa scenario från bufferten
//   play     du lägger dina kort
//   judging  du är klar men solvern räknar fortfarande (progress visas)
//   feedback gradering + ditt drag mot bästa draget
//   summary  sammanfattning + topplista
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameVariant } from '../../engine/types';
import type { DetailedSolverResult, SolverOptions } from '../../solver/solver';
import { countPlaced, judge, type Judgement, type Move } from '../../training/moves';
import { generateScenario, scenarioLabel, type Scenario } from '../../training/scenarios';
import { CANCELLED, useSolverJobs } from '../../training/useSolverJobs';
import { SOLVER_HAS_PINNED, pinnedOptions } from '../../training/pinned';
import { useMoveBuilder } from '../../training/useMoveBuilder';
import { useRevealAboveDock } from '../../training/useRevealAboveDock';
import { DragProvider } from '../dnd/DragContext';
import BoardView from '../board/BoardView';
import DockLayout from './DockLayout';
import PlayDock from './PlayDock';
import ReviewBoard from './ReviewBoard';
import ScenarioFeedback from './ScenarioFeedback';
import ScenarioSummary, { type ScenarioDone } from './ScenarioSummary';
import { OpponentMini, RunHeader, SolverChip, Spinner, useCountUp } from './TrainingBits';

/** Bedömningsnivå: Noggrann */
const EVAL_OPTIONS: SolverOptions = { simulations: 2000 };
const BUFFER = 2;

interface ScenarioRunProps {
  variant: GameVariant;
  count: number;
  onExit: () => void;
  onRestart: () => void;
}

type Phase = 'loading' | 'play' | 'judging' | 'feedback' | 'summary';

export default function ScenarioRun({ variant, count, onExit, onRestart }: ScenarioRunProps) {
  const gen = useSolverJobs();
  const ev = useSolverJobs();

  const [buffer, setBuffer] = useState<Scenario[]>([]);
  const [genError, setGenError] = useState<string | null>(null);
  const [current, setCurrent] = useState<Scenario | null>(null);
  const [result, setResult] = useState<{ id: string; res: DetailedSolverResult; pinned: boolean } | null>(null);
  // true medan bedömningen körs om med spelarens drag låst
  const [rerun, setRerun] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [locked, setLocked] = useState<Move | null>(null);
  const [done, setDone] = useState<ScenarioDone[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');

  // ---------- Generatorn: håll bufferten fylld ----------
  const made = useRef(0);
  const bufLen = useRef(0);
  const wake = useRef<(() => void) | null>(null);
  const { solve: genSolve, cancel: genCancel } = gen;

  useEffect(() => {
    let alive = true;
    const isAlive = () => alive;
    (async () => {
      while (alive && made.current < count) {
        if (bufLen.current >= BUFFER) {
          await new Promise<void>((r) => (wake.current = r));
          continue;
        }
        try {
          const s = await generateScenario(genSolve, variant, isAlive);
          if (!alive) return;
          made.current++;
          bufLen.current++;
          setGenError(null);
          setBuffer((b) => [...b, s]);
        } catch (e) {
          if (!alive) return;
          const msg = e instanceof Error ? e.message : String(e);
          if (msg !== CANCELLED) setGenError(msg);
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    })();
    return () => {
      alive = false;
      wake.current?.();
      genCancel();
    };
  }, [count, variant, genSolve, genCancel]);

  // ---------- Bedömning ----------
  const { solve: evSolve, cancel: evCancel } = ev;
  const startEval = useCallback(
    (s: Scenario, pin?: Move) => {
      setRerun(!!pin);
      evSolve({
        board: s.board,
        cards: s.hand,
        deadCards: s.deadCards,
        variant: s.variant,
        opponentBoard: countPlaced(s.opponentBoard) > 0 ? s.opponentBoard : undefined,
        options: pin ? pinnedOptions(EVAL_OPTIONS, pin) : EVAL_OPTIONS,
      })
        .then((res) => setResult({ id: s.id, res, pinned: !!pin }))
        .catch((e: Error) => {
          if (e.message !== CANCELLED) setEvalError(e.message);
        });
    },
    [evSolve],
  );

  // Ta nästa scenario ur bufferten och börja räkna direkt
  useEffect(() => {
    if (phase !== 'loading' || buffer.length === 0) return;
    const [s, ...rest] = buffer;
    bufLen.current = rest.length;
    wake.current?.();
    wake.current = null;
    setBuffer(rest);
    setCurrent(s);
    setResult(null);
    setEvalError(null);
    setLocked(null);
    setPhase('play');
    startEval(s);
  }, [phase, buffer, startEval]);

  // Klar + resultat finns → bedöm
  useEffect(() => {
    if (phase !== 'judging' || !current || !locked || !result || result.id !== current.id) return;
    const j = judge(result.res, locked);
    if (SOLVER_HAS_PINNED && j.screened && !result.pinned) {
      // Räkna om med ditt drag låst, lika noga som bästa draget
      setResult(null);
      startEval(current, locked);
      return;
    }
    setDone((d) => [...d, { scenario: current, move: locked, j }]);
    setPhase('feedback');
  }, [phase, current, locked, result, startEval]);

  const lock = (m: Move) => {
    setLocked(m);
    setPhase('judging');
  };

  const next = () => {
    if (done.length >= count) {
      evCancel();
      genCancel();
      setPhase('summary');
    } else setPhase('loading');
  };

  const total = done.reduce((n, d) => n + d.j.points, 0);
  const shownTotal = useCountUp(total);

  if (phase === 'summary') {
    return <ScenarioSummary done={done} variant={variant} count={count} onRestart={onRestart} onExit={onExit} />;
  }

  const header = (
    <RunHeader
      label="Scenario"
      index={phase === 'loading' ? done.length : done.length - (phase === 'feedback' ? 1 : 0)}
      count={count}
      dots={done.map((d) => d.j.grade)}
      score={Math.round(shownTotal)}
      scoreLabel={`av ${count * 100}`}
      onExit={onExit}
    />
  );

  if (phase === 'loading' || !current) {
    return (
      <DockLayout dock={<Spinner title="Datorn spelar fram…" sub={genError ?? 'Ett riktigt parti spelas upp till din tur'} />}>
        {header}
        <div className="felt flex min-h-[260px] items-center justify-center rounded-[26px] p-6 text-center">
          <p className="max-w-[260px] text-[13px] font-semibold text-[color:var(--felt-label)] opacity-80">
            Båda bräden spelas fram av solvern, drag för drag — så att läget ser ut som i en riktig hand.
          </p>
        </div>
      </DockLayout>
    );
  }

  return (
    <ScenarioStage
      key={current.id}
      scenario={current}
      header={header}
      phase={phase}
      ready={!!result && result.id === current.id}
      progress={ev.progress}
      rerun={rerun}
      evalError={evalError}
      judgement={phase === 'feedback' ? done[done.length - 1]?.j ?? null : null}
      lockedMove={locked}
      onLock={lock}
      onNext={next}
      nextLabel={done.length >= count ? 'Visa resultat ★' : 'Nästa scenario →'}
      onRetryEval={() => {
        setEvalError(null);
        startEval(current);
      }}
    />
  );
}

// ============================================================
// Ett scenario: bräde + din hand, sedan feedback
// ============================================================

interface StageProps {
  scenario: Scenario;
  header: React.ReactNode;
  phase: Phase;
  ready: boolean;
  progress: number | null;
  /** Bedömningen körs om med spelarens drag låst */
  rerun: boolean;
  evalError: string | null;
  judgement: Judgement | null;
  lockedMove: Move | null;
  onLock: (m: Move) => void;
  onNext: () => void;
  nextLabel: string;
  onRetryEval: () => void;
}

function ScenarioStage({ scenario, header, phase, ready, progress, rerun, evalError, judgement, lockedMove, onLock, onNext, nextLabel, onRetryEval }: StageProps) {
  const mb = useMoveBuilder(scenario.board, scenario.hand, scenario.place);
  const playing = phase === 'play';
  const boardRef = useRef<HTMLDivElement>(null);
  useRevealAboveDock(boardRef, phase === 'feedback');

  let dock: React.ReactNode;
  if (phase === 'feedback' && judgement) {
    dock = <ScenarioFeedback j={judgement} onNext={onNext} nextLabel={nextLabel} />;
  } else if (phase === 'judging') {
    dock = evalError ? (
      <EvalError msg={evalError} onRetry={onRetryEval} />
    ) : (
      <Spinner
        title="Solvern räknar klart…"
        sub={rerun ? 'Räknar om ditt drag lika noga som bästa draget' : 'Noggrann nivå · ditt drag bedöms strax'}
        progress={progress}
      />
    );
  } else {
    dock = (
      <PlayDock
        mb={mb}
        place={scenario.place}
        total={scenario.hand.length}
        onDone={() => onLock(mb.move)}
        doneLabel="✓ Lås draget"
        top={evalError ? <EvalError msg={evalError} onRetry={onRetryEval} /> : <SolverChip ready={ready} progress={progress} />}
      />
    );
  }

  return (
    <DragProvider onDrop={mb.drop}>
      <DockLayout dock={dock}>
        {header}
        <OpponentMini board={scenario.opponentBoard} />
        <div className="px-1 -mb-1">
          <span className="eyebrow">{scenarioLabel(scenario)}</span>
        </div>
        <div ref={boardRef}>
        {phase === 'feedback' && judgement && lockedMove ? (
          <ReviewBoard board={scenario.board} move={lockedMove} judgement={judgement} />
        ) : (
          <BoardView
            board={mb.board}
            heldCard={playing ? mb.heldCard : null}
            interactive={playing}
            onPlace={mb.placeAt}
            onRemove={playing ? mb.remove : undefined}
            canRemove={mb.isMine}
            maxCardWidth={92}
          />
        )}
        </div>
      </DockLayout>
    </DragProvider>
  );
}

function EvalError({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-danger-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-danger animate-fade-in">
      <span className="flex-1">Solvern: {msg}</span>
      <button type="button" onClick={onRetry} className="font-bold underline">
        Försök igen
      </button>
    </div>
  );
}

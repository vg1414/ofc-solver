// ============================================================
// ScenarioRun.tsx — Scenarioträning (poängjakt)
// ============================================================
//
// Två solver-workers arbetar samtidigt:
//  - scenariokön (useScenarioPool, ägs av TrainingView) spelar fram
//           kommande scenarion i förväg — redan från startsidan.
//  - `ev`   bedömer scenariot du ser just nu (Noggrann, 2000 sim) — men
//           bara om kön inte redan hann bedöma det (Scenario.evaluation),
//           och när ditt drag måste räknas om med draget låst.
//
// Faser:  loading → play → (judging) → feedback → loading … → summary
//   loading  väntar på nästa scenario från kön
//   play     du lägger dina kort
//   judging  du är klar men solvern räknar fortfarande (progress visas)
//   feedback gradering + ditt drag mot bästa draget
//   summary  sammanfattning + topplista
// Draglistan (MoveHistory) visar alla avklarade scenarion i omgången;
// ett tryck öppnar arket med bästa draget och förklaringen.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameVariant } from '../../engine/types';
import type { DetailedSolverResult } from '../../solver/solver';
import { countPlaced, judge, type Judgement, type Move } from '../../training/moves';
import { SCENARIO_EVAL, scenarioInput, scenarioLabel, type Scenario } from '../../training/scenarios';
import type { ScenarioPool } from '../../training/useScenarioPool';
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
import MoveHistory from './MoveHistory';
import ShareBoards from '../share/ShareBoards';
import { applyMove } from '../../training/moves';
import { MoveExplain, MoveReviewSheet } from './CoachReview';
import { newRunId, toggleSaved, useSavedMoves } from '../../training/savedMoves';

interface ScenarioRunProps {
  variant: GameVariant;
  /** Jokerträning: minst en joker i handen i varje scenario */
  jokers?: boolean;
  /** Kön med färdiga scenarion */
  pool: ScenarioPool;
  count: number;
  onExit: () => void;
  onRestart: () => void;
}

type Phase = 'loading' | 'play' | 'judging' | 'feedback' | 'summary';

export default function ScenarioRun({ variant, jokers = false, pool, count, onExit, onRestart }: ScenarioRunProps) {
  const ev = useSolverJobs();

  const [current, setCurrent] = useState<Scenario | null>(null);
  const [result, setResult] = useState<{ id: string; res: DetailedSolverResult; pinned: boolean } | null>(null);
  // true medan bedömningen körs om med spelarens drag låst
  const [rerun, setRerun] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [locked, setLocked] = useState<Move | null>(null);
  const [done, setDone] = useState<ScenarioDone[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  /** Öppet scenario i draglistans ark (index i done) */
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [runId] = useState(newRunId);
  const savedList = useSavedMoves();
  const savedKeys = new Set(savedList.filter((x) => x.id.startsWith(runId + ':')).map((x) => x.id.slice(runId.length + 1)));
  const toggleSave = (i: number) => {
    const d = done[i];
    if (!d) return;
    const sc = d.scenario;
    toggleSaved({
      id: `${runId}:${i}`,
      source: jokers ? 'joker' : 'scenario',
      variant: sc.variant,
      label: sc.round === 1 ? 'Öppningshand' : `Runda ${sc.round}`,
      board: sc.board,
      move: d.move,
      input: {
        board: sc.board,
        cards: sc.hand,
        deadCards: sc.deadCards,
        variant: sc.variant,
        opponentBoard: countPlaced(sc.opponentBoard) > 0 ? sc.opponentBoard : undefined,
        mode: 'normal',
      },
      fl: false,
      j: d.j,
      thorough: true,
    });
  };

  // ---------- Bedömning ----------
  const { solve: evSolve, cancel: evCancel } = ev;
  const startEval = useCallback(
    (s: Scenario, pin?: Move) => {
      setRerun(!!pin);
      evSolve(scenarioInput(s, pin ? pinnedOptions(SCENARIO_EVAL, pin) : SCENARIO_EVAL))
        .then((res) => setResult({ id: s.id, res, pinned: !!pin }))
        .catch((e: Error) => {
          if (e.message !== CANCELLED) setEvalError(e.message);
        });
    },
    [evSolve],
  );

  // Ta nästa scenario ur kön och börja räkna direkt.
  // takenFor skyddar mot att samma plats tar två scenarion (StrictMode kör effekter två gånger).
  const { take, ready } = pool;
  const takenFor = useRef(-1);
  useEffect(() => {
    if (phase !== 'loading' || ready === 0 || takenFor.current === done.length) return;
    const s = take();
    if (!s) return;
    takenFor.current = done.length;
    // Bedömningen följer inte med i current (den ligger i result)
    const { evaluation, ...scenario } = s;
    setCurrent(scenario);
    setEvalError(null);
    setLocked(null);
    setPhase('play');
    if (evaluation) {
      // Kön har redan bedömt scenariot → svaret finns direkt
      setRerun(false);
      setResult({ id: s.id, res: evaluation, pinned: false });
    } else {
      setResult(null);
      startEval(scenario);
    }
  }, [phase, ready, take, done.length, startEval]);

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
      setPhase('summary');
    } else setPhase('loading');
  };

  const total = done.reduce((n, d) => n + d.j.points, 0);
  const shownTotal = useCountUp(total);

  if (phase === 'summary') {
    return <ScenarioSummary done={done} mode={jokers ? 'joker' : 'scenario'} variant={variant} count={count} onRestart={onRestart} onExit={onExit} />;
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

  const history = (
    <MoveHistory
      items={done.map((d, i) => ({
        key: String(i),
        group: jokers ? '★ Joker' : 'Scenarion',
        label: `${i + 1}. ${d.scenario.round === 1 ? 'Öppningshand' : `Runda ${d.scenario.round}`}`,
        move: d.move,
        j: d.j,
      }))}
      onOpen={(k) => setOpenIdx(Number(k))}
      empty="Avklarade scenarion dyker upp här."
      saved={savedKeys}
      onToggleSave={(k) => toggleSave(Number(k))}
    />
  );
  const opened = openIdx !== null ? done[openIdx] : null;
  const sheet = (
    <MoveReviewSheet
      open={!!opened}
      onClose={() => setOpenIdx(null)}
      itemKey={String(openIdx)}
      subtitle={opened ? `Scenario ${openIdx! + 1} · ${scenarioLabel(opened.scenario)}` : ''}
      board={opened?.scenario.board}
      move={opened?.move}
      j={opened?.j ?? null}
      thorough="✓ Noggrann (2000 sim)"
      extra={opened && <OpponentMini board={opened.scenario.opponentBoard} />}
      saved={openIdx !== null && savedKeys.has(String(openIdx))}
      onToggleSave={openIdx !== null ? () => toggleSave(openIdx) : undefined}
    />
  );

  if (phase === 'loading' || !current) {
    return (
      <>
      <DockLayout side={history} dock={<Spinner title="Datorn spelar fram…" sub={pool.error ?? 'Ett riktigt parti spelas upp till din tur'} />}>
        {header}
        <div className="felt flex min-h-[260px] items-center justify-center rounded-[26px] p-6 text-center">
          <p className="max-w-[260px] text-[13px] font-semibold text-[color:var(--felt-label)] opacity-80">
            Båda bräden spelas fram av solvern, drag för drag — så att läget ser ut som i en riktig hand.
          </p>
        </div>
      </DockLayout>
      {sheet}
      </>
    );
  }

  return (
    <>
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
      side={history}
    />
    {sheet}
    </>
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
  side?: React.ReactNode;
}

function ScenarioStage({ scenario, header, phase, ready, progress, rerun, evalError, judgement, lockedMove, onLock, onNext, nextLabel, onRetryEval, side }: StageProps) {
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
      <DockLayout dock={dock} side={side}>
        {header}
        <OpponentMini board={scenario.opponentBoard} />
        <div className="px-1 -mb-1">
          <span className="eyebrow">{scenarioLabel(scenario)}</span>
        </div>
        <div ref={boardRef} className="relative">
        <ShareBoards
          boards={() => [
            { name: 'Du', board: phase === 'feedback' && lockedMove ? applyMove(scenario.board, lockedMove.placements) : mb.board },
            ...(countPlaced(scenario.opponentBoard) > 0 ? [{ name: 'Motståndare', board: scenario.opponentBoard }] : []),
          ]}
        />
        {phase === 'feedback' && judgement && lockedMove ? (
          <div className="flex flex-col gap-2">
            <ReviewBoard board={scenario.board} move={lockedMove} judgement={judgement} />
            <MoveExplain move={lockedMove} j={judgement} />
          </div>
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

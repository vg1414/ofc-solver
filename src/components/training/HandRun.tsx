// ============================================================
// HandRun.tsx — Hela händer mot datorn
// ============================================================
//
// Spelets tillstånd (HandState) är en vanlig, oföränderlig struktur:
//   kortlek + position, båda platserna (bräde, kastade kort, FL),
//   hela turordningen och vilken tur vi är på.
// Varje gång en tur är klar skapas ett nytt HandState med nextTurn(),
// som delar ut korten till nästa tur — eller räknar poäng när alla är klara.
//
//  - Datorns tur: en effekt startar solvern (Normal, 3 s max) i en egen
//    worker, lägger draget och går vidare efter en kort paus så att man
//    hinner se korten landa.
//  - Din tur: du lägger korten och trycker Klar.
//  - Coach-läge: en tredje worker bedömer varje drag du gör (Normal-nivå)
//    i en kö. Resultatet dyker upp som en liten bricka när det är klart.
//  - Den som börjar växlar varje hand. Fantasy Land-brädet syns inte
//    för motståndaren förrän handen är slut (som vid ett riktigt bord).
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Card, GameVariant } from '../../engine/types';
import type { SolverOptions } from '../../solver/solver';
import {
  CPU_OPTIONS,
  applyToSeat,
  computerMove,
  newDeck,
  newSeat,
  settleHand,
  solverInput,
  turnOrder,
  type HandOutcome,
  type Seat,
  type SeatId,
  type Turn,
} from '../../training/game';
import { judge, type Judgement, type Move } from '../../training/moves';
import { CANCELLED, useSolverJobs } from '../../training/useSolverJobs';
import { useMoveBuilder } from '../../training/useMoveBuilder';
import { useRevealAboveDock } from '../../training/useRevealAboveDock';
import { DragProvider } from '../dnd/DragContext';
import BoardView from '../board/BoardView';
import DockLayout from './DockLayout';
import PlayDock from './PlayDock';
import { RunHeader, useCountUp } from './TrainingBits';
import { GradeBadge } from './ScenarioFeedback';
import { evFmt } from './ReviewBoard';
import HandOver from './HandOver';
import HandSummary, { type HandRecord } from './HandSummary';

/** Coachen: Normal-nivå, men max 10 s per drag så att den hänger med */
const COACH_OPTIONS: SolverOptions = { simulations: 800, maxMs: 10000 };
const CPU_PAUSE_MS = 450;

export interface HandState {
  no: number;
  first: SeatId;
  deck: Card[];
  pos: number;
  seats: [Seat, Seat];
  turns: Turn[];
  idx: number;
  dealt: Card[];
  outcome: HandOutcome | null;
}

function nextTurn(h: HandState): HandState {
  if (h.idx >= h.turns.length) return { ...h, dealt: [], outcome: settleHand(h.seats[0], h.seats[1]) };
  const t = h.turns[h.idx];
  return { ...h, dealt: h.deck.slice(h.pos, h.pos + t.count), pos: h.pos + t.count };
}

function startHand(no: number, first: SeatId, fl: [number, number], variant: GameVariant): HandState {
  return nextTurn({
    no,
    first,
    deck: newDeck(),
    pos: 0,
    seats: [newSeat(fl[0]), newSeat(fl[1])],
    turns: turnOrder(variant, first, fl),
    idx: 0,
    dealt: [],
    outcome: null,
  });
}

function played(h: HandState, seat: SeatId, move: Move): HandState {
  const seats: [Seat, Seat] = [...h.seats];
  seats[seat] = applyToSeat(seats[seat], move);
  return nextTurn({ ...h, seats, idx: h.idx + 1 });
}

export interface CoachEntry {
  key: string;
  hand: number;
  round: number;
  j: Judgement | null;
}

interface HandRunProps {
  variant: GameVariant;
  count: number;
  coach: boolean;
  onExit: () => void;
  onRestart: () => void;
}

export default function HandRun({ variant, count, coach, onExit, onRestart }: HandRunProps) {
  const cpu = useSolverJobs();
  const coachJobs = useSolverJobs();
  const [h, setH] = useState<HandState>(() => startHand(1, Math.random() < 0.5 ? 0 : 1, [0, 0], variant));
  const [records, setRecords] = useState<HandRecord[]>([]);
  const [coachLog, setCoachLog] = useState<CoachEntry[]>([]);
  const [toast, setToast] = useState<CoachEntry | null>(null);
  const [cpuError, setCpuError] = useState<string | null>(null);
  const [summary, setSummary] = useState(false);
  const [retry, setRetry] = useState(0);

  const turn = h.outcome ? null : h.turns[h.idx];
  const myTurn = turn?.seat === 0;
  const mb = useMoveBuilder(h.seats[0].board, myTurn ? h.dealt : [], turn?.place ?? 0);
  const { reset: mbReset } = mb;

  // ---------- Datorns tur ----------
  const { solve: cpuSolve, cancel: cpuCancel } = cpu;
  useEffect(() => {
    if (!turn || turn.seat !== 1) return;
    let alive = true;
    let finished = false;
    setCpuError(null);
    computerMove(cpuSolve, {
      seat: h.seats[1],
      cards: h.dealt,
      variant,
      opponent: h.seats[0].fl > 0 ? undefined : h.seats[0].board,
      fl: turn.fl,
      options: CPU_OPTIONS,
    })
      .then(async (move) => {
        finished = true;
        await new Promise((r) => setTimeout(r, CPU_PAUSE_MS));
        if (alive) setH((prev) => (prev.no === h.no && prev.idx === h.idx ? played(prev, 1, move) : prev));
      })
      .catch((e: Error) => {
        finished = true;
        if (alive && e.message !== CANCELLED) setCpuError(e.message);
      });
    return () => {
      alive = false;
      if (!finished) cpuCancel();
    };
    // Kör en gång per tur (h.no + h.idx identifierar turen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h.no, h.idx, retry]);

  // ---------- Din tur ----------
  const { solve: coachSolve } = coachJobs;
  const confirm = () => {
    if (!turn || !myTurn || !mb.done) return;
    const move = mb.move;
    if (coach) {
      const key = `${h.no}-${h.idx}`;
      const entry: CoachEntry = { key, hand: h.no, round: turn.round, j: null };
      setCoachLog((l) => [...l, entry]);
      coachSolve(
        solverInput({
          seat: h.seats[0],
          cards: h.dealt,
          variant,
          opponent: h.seats[1].fl > 0 ? undefined : h.seats[1].board,
          fl: turn.fl,
          options: turn.fl ? {} : COACH_OPTIONS,
        }),
      )
        .then((res) => {
          const done = { ...entry, j: judge(res, move) };
          setCoachLog((l) => l.map((e) => (e.key === key ? done : e)));
          setToast(done);
        })
        .catch(() => setCoachLog((l) => l.filter((e) => e.key !== key)));
    }
    mbReset();
    setH((prev) => played(prev, 0, move));
  };

  // Coach-brickan försvinner efter en stund
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // ---------- Handen klar ----------
  const recorded = useRef(0);
  useEffect(() => {
    if (!h.outcome || recorded.current >= h.no) return;
    recorded.current = h.no;
    const o = h.outcome;
    setRecords((r) => [...r, { no: h.no, net: o.score.p1Net, outcome: o, fl: [h.seats[0].fl, h.seats[1].fl] }]);
  }, [h]);

  const nextHand = () => {
    if (!h.outcome) return;
    if (h.no >= count) {
      cpuCancel();
      setSummary(true);
      return;
    }
    setToast(null);
    setH(startHand(h.no + 1, h.first === 0 ? 1 : 0, h.outcome.nextFl, variant));
  };

  // Din tur eller handen klar: se till att ditt bräde syns ovanför panelen
  const myBoardRef = useRef<HTMLDivElement>(null);
  useRevealAboveDock(myBoardRef, h.outcome ? `o${h.no}` : myTurn ? `t${h.no}-${h.idx}` : null);

  const total = records.reduce((n, r) => n + r.net, 0);
  const shownTotal = useCountUp(total);
  const dots = useMemo(() => records.map((r) => (r.net > 0 ? 'good' : r.net < 0 ? 'miss' : null) as 'good' | 'miss' | null), [records]);

  if (summary) {
    return <HandSummary records={records} coachLog={coachLog} variant={variant} count={count} onRestart={onRestart} onExit={onExit} />;
  }

  const hidden = !h.outcome && h.seats[1].fl > 0; // datorns FL-bräde syns först i slutet
  const cpuThinking = turn?.seat === 1;

  const coachPill = toast?.j && (
    <div key={toast.key} className="flex items-center gap-2 self-start rounded-full bg-surface/90 py-1 pl-1 pr-3 text-[12px] font-bold shadow-[var(--shadow-soft)] animate-badge-in">
      <GradeBadge grade={toast.j.grade} size={22} />
      <span className="text-ink-2">Coach:</span>
      <span className="tabular text-ink">{toast.j.diff > 0.0001 ? `${evFmt.format(-toast.j.diff)} EV` : 'bästa draget!'}</span>
    </div>
  );

  let dock: React.ReactNode;
  if (h.outcome) {
    dock = <HandOver outcome={h.outcome} last={h.no >= count} coachLog={coachLog.filter((c) => c.hand === h.no)} onNext={nextHand} top={coachPill} />;
  } else if (myTurn && turn) {
    dock = (
      <PlayDock
        mb={mb}
        place={turn.place}
        total={h.dealt.length}
        onDone={confirm}
        doneLabel="✓ Klar"
        top={
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">{turn.fl ? `Fantasy Land · ${h.dealt.length} kort` : turn.round === 1 ? 'Öppningshand' : `Runda ${turn.round}`}</span>
            {coachPill}
          </div>
        }
      />
    );
  } else {
    dock = (
      <div className="flex flex-col gap-2.5 py-1">
        {coachPill}
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-[var(--glow)] animate-logo-spin" style={{ background: 'var(--grad)' }}>
            ★
          </span>
          <div className="flex-1">
            <div className="title-serif text-[19px]">
              Datorn tänker <span className="think text-accent"><span /><span /><span /></span>
            </div>
            <div className="text-[12px] font-medium text-ink-3">{turn?.fl ? 'Lägger sin Fantasy Land-hand' : `Runda ${turn?.round} · ${h.dealt.length} kort`}</div>
          </div>
        </div>
        {cpuError && (
          <div className="flex items-center gap-2 rounded-2xl bg-danger-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-danger">
            <span className="flex-1">Solvern: {cpuError}</span>
            <button type="button" className="font-bold underline" onClick={() => setRetry((n) => n + 1)}>
              Försök igen
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <DragProvider onDrop={mb.drop}>
      <DockLayout dock={dock}>
        <RunHeader
          label="Hand"
          index={h.no - 1}
          count={count}
          dots={dots}
          score={`${total > 0 ? '+' : ''}${Math.round(shownTotal)}`}
          scoreLabel="poäng"
          onExit={onExit}
        />

        {/* Datorns bräde */}
        <div className="flex items-center gap-2 px-1 -mb-1">
          <span className="eyebrow">Datorn</span>
          {h.seats[1].fl > 0 && <FlChip n={h.seats[1].fl} />}
          {cpuThinking && <span className="think text-accent-ink" aria-label="Datorn tänker"><span /><span /><span /></span>}
          {h.first === 1 && <span className="ml-auto text-[10.5px] font-bold text-ink-3">börjar</span>}
        </div>
        {hidden ? (
          <div className="felt flex h-[150px] items-center justify-center rounded-[26px] p-4 text-center text-[13px] font-semibold text-[color:var(--felt-label)]">
            ★ Datorn spelar Fantasy Land — brädet visas när handen är klar
          </div>
        ) : (
          <div className={`transition-opacity duration-300 ${myTurn ? 'opacity-80' : ''}`}>
            <BoardView board={h.seats[1].board} maxCardWidth={40} fouled={!!h.outcome?.score.p2Foul} />
          </div>
        )}

        {/* Ditt bräde */}
        <div className="flex items-center gap-2 px-1 -mb-1 mt-1">
          <span className="eyebrow">Du</span>
          {h.seats[0].fl > 0 && <FlChip n={h.seats[0].fl} />}
          {h.first === 0 && <span className="ml-auto text-[10.5px] font-bold text-ink-3">börjar</span>}
        </div>
        <div ref={myBoardRef}>
        <BoardView
          board={myTurn ? mb.board : h.seats[0].board}
          heldCard={myTurn ? mb.heldCard : null}
          interactive={myTurn}
          onPlace={mb.placeAt}
          onRemove={myTurn ? mb.remove : undefined}
          canRemove={mb.isMine}
          fouled={!!h.outcome?.score.p1Foul}
          maxCardWidth={84}
        />
        </div>
      </DockLayout>
    </DragProvider>
  );
}

function FlChip({ n }: { n: number }) {
  return (
    <span className="rounded-full px-2 py-[1px] text-[10.5px] font-extrabold text-white shadow-[var(--glow-fl)]" style={{ background: 'var(--grad-fl)' }}>
      ★ FL {n}
    </span>
  );
}

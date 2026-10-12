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
//    i en kö. Resultatet dyker upp som en liten bricka när det är klart,
//    med solverns bästa drag som minikort. Ett tryck öppnar ett ark där
//    man växlar mellan sitt drag och bästa draget på brädet.
//  - Den som börjar växlar varje hand. Fantasy Land-brädet syns inte
//    för motståndaren förrän handen är slut (som vid ett riktigt bord).
//  - Sessionen (session.ts): antal händer, minuter eller fritt spel.
//    Efter varje hand avgör sessionOver() om det var den sista. Står
//    någon på FL och regeln är "spelas ut" fortsätter det med extra
//    händer (`extraFrom`) tills ingen är i FL längre.
//  - ✕ under pågående session öppnar ett ark: visa resultat, fortsätt
//    eller avsluta utan resultat.
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
import { countPlaced, judge, type Move } from '../../training/moves';
import { CANCELLED, useSolverJobs } from '../../training/useSolverJobs';
import { useMoveBuilder } from '../../training/useMoveBuilder';
import { useRevealAboveDock } from '../../training/useRevealAboveDock';
import { DragProvider } from '../dnd/DragContext';
import BoardView from '../board/BoardView';
import DockLayout from './DockLayout';
import PlayDock from './PlayDock';
import { useCountUp } from './TrainingBits';
import SessionHeader, { type Dot } from './SessionHeader';
import BottomSheet from '../ui/BottomSheet';
import { flPending, sessionOver, targetReached, type HandSettings } from '../../training/session';
import { usePlayClock } from '../../training/usePlayClock';
import { CoachPill, CoachSheet, type CoachEntry } from './CoachReview';
import HandOver from './HandOver';
import HandSummary from './HandSummary';
import { HandStrip, ScoreSheet, type HandRecord } from './Scoreboard';

/** Coachen: Normal-nivå, men max 10 s per drag så att den hänger med */
const COACH_OPTIONS: SolverOptions = { simulations: 800, maxMs: 10000 };
const CPU_PAUSE_MS = 450;
/** Risk-mätaren utan coach: Snabb-nivå räcker för en ungefärlig procentsats */
const RISK_OPTIONS: SolverOptions = { simulations: 300, maxMs: 3000 };

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

export type { CoachEntry };

interface HandRunProps {
  variant: GameVariant;
  settings: HandSettings;
  /** Träna-fliken syns (annars står klockan still) */
  active?: boolean;
  onExit: () => void;
  onRestart: () => void;
}

export default function HandRun({ variant, settings, active = true, onExit, onRestart }: HandRunProps) {
  const { coach, length } = settings;
  const cpu = useSolverJobs();
  const coachJobs = useSolverJobs();
  const [h, setH] = useState<HandState>(() => startHand(1, Math.random() < 0.5 ? 0 : 1, [0, 0], variant));
  const [records, setRecords] = useState<HandRecord[]>([]);
  const [coachLog, setCoachLog] = useState<CoachEntry[]>([]);
  const [toast, setToast] = useState<CoachEntry | null>(null);
  const [review, setReview] = useState<CoachEntry | null>(null);
  /** Foul-risk och FL-chans efter ditt senaste drag (null = räknar) */
  const [risk, setRisk] = useState<{ key: string; hand: number; foul: number | null; fl: number | null } | null>(null);
  const [cpuError, setCpuError] = useState<string | null>(null);
  /** null = spelar; annars slutresultatet (complete = sessionen gick hela vägen) */
  const [summary, setSummary] = useState<{ complete: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  /** Första handen som bara spelas för att FL ska spelas ut */
  const [extraFrom, setExtraFrom] = useState<number | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const elapsed = usePlayClock(active && !summary);

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
    const key = `${h.no}-${h.idx}`;
    // Sista draget fyller brädet — då finns ingen risk kvar att räkna på
    const last = countPlaced(h.seats[0].board) + move.placements.length >= 13;
    // Draget bedöms alltid när det finns något att visa: coachen och/eller
    // risk-mätaren (foul/FL). Utan coach räcker en snabbare räkning.
    if (coach || (!turn.fl && !last)) {
      const entry: CoachEntry = { key, hand: h.no, round: turn.round, fl: turn.fl, board: h.seats[0].board, move, j: null };
      if (coach) setCoachLog((l) => [...l, entry]);
      if (!turn.fl && !last) setRisk({ key, hand: h.no, foul: null, fl: null });
      coachSolve(
        solverInput({
          seat: h.seats[0],
          cards: h.dealt,
          variant,
          opponent: h.seats[1].fl > 0 ? undefined : h.seats[1].board,
          fl: turn.fl,
          options: turn.fl ? {} : coach ? COACH_OPTIONS : RISK_OPTIONS,
        }),
      )
        .then((res) => {
          const j = judge(res, move);
          if (!turn.fl && !last) {
            const o = j.player ?? j.best;
            setRisk((r) => (r?.key === key ? { ...r, foul: o.foulProbability ?? null, fl: o.flProbability ?? null } : r));
          }
          if (!coach) return;
          const done = { ...entry, j };
          setCoachLog((l) => l.map((e) => (e.key === key ? done : e)));
          setToast(done);
        })
        .catch(() => {
          setCoachLog((l) => l.filter((e) => e.key !== key));
          setRisk((r) => (r?.key === key ? null : r));
        });
    }
    mbReset();
    setH((prev) => played(prev, 0, move));
  };

  // Coach-brickan försvinner efter en stund (längre om det fanns ett bättre drag att titta på)
  useEffect(() => {
    if (!toast || review) return;
    const t = window.setTimeout(() => setToast(null), toast.j && toast.j.diff > 0.0001 ? 9000 : 4000);
    return () => window.clearTimeout(t);
  }, [toast, review]);

  // ---------- Handen klar ----------
  const recorded = useRef(0);
  useEffect(() => {
    if (!h.outcome || recorded.current >= h.no) return;
    recorded.current = h.no;
    const o = h.outcome;
    setRecords((r) => [...r, { no: h.no, net: o.score.p1Net, outcome: o, fl: [h.seats[0].fl, h.seats[1].fl], boards: [h.seats[0].board, h.seats[1].board] }]);
  }, [h]);

  // Var det sista handen? (räknas om varje tick, så tiden kan ta slut medan resultatet visas)
  const reached = targetReached(length, h.no, elapsed);
  const last = !!h.outcome && sessionOver(settings, h.no, elapsed, h.outcome.nextFl);
  const playOutFl = !!h.outcome && reached && flPending(settings.flEnd, h.outcome.nextFl);
  const extra = extraFrom !== null && h.no >= extraFrom;

  const finish = (complete: boolean) => {
    cpuCancel();
    setExitOpen(false);
    setSummary({ complete });
  };

  const nextHand = () => {
    if (!h.outcome) return;
    if (last) return finish(true);
    if (reached && extraFrom === null) setExtraFrom(h.no + 1);
    setToast(null);
    setH(startHand(h.no + 1, h.first === 0 ? 1 : 0, h.outcome.nextFl, variant));
  };

  // Fritt spel: "Avsluta här" efter en hand — men inte om FL måste spelas ut
  const stopBlocked = !!h.outcome && flPending(settings.flEnd, h.outcome.nextFl);
  const onStop = length.kind === 'free' ? () => !stopBlocked && finish(true) : undefined;

  const askExit = () => {
    if (records.length === 0) return onExit();
    setExitOpen(true);
  };

  // Din tur eller handen klar: se till att ditt bräde syns ovanför panelen
  const myBoardRef = useRef<HTMLDivElement>(null);
  useRevealAboveDock(myBoardRef, h.outcome ? `o${h.no}` : myTurn ? `t${h.no}-${h.idx}` : null);

  const total = records.reduce((n, r) => n + r.net, 0);
  const shownTotal = useCountUp(total);
  const dots = useMemo(() => records.map((r): Dot => (r.net > 0 ? 'good' : r.net < 0 ? 'miss' : null)), [records]);

  if (summary) {
    return (
      <HandSummary
        records={records}
        coachLog={coachLog}
        variant={variant}
        settings={settings}
        elapsed={elapsed}
        complete={summary.complete}
        onRestart={onRestart}
        onExit={onExit}
      />
    );
  }

  const hidden = !h.outcome && h.seats[1].fl > 0; // datorns FL-bräde syns först i slutet
  const cpuThinking = turn?.seat === 1;

  const coachPill = toast?.j && <CoachPill key={toast.key} entry={toast} onOpen={setReview} />;

  let dock: React.ReactNode;
  if (h.outcome) {
    dock = (
      <HandOver
        outcome={h.outcome}
        last={last}
        playOutFl={playOutFl}
        flSkipped={reached && settings.flEnd === 'stop' && (h.outcome.nextFl[0] > 0 || h.outcome.nextFl[1] > 0)}
        coachLog={coachLog.filter((c) => c.hand === h.no)}
        onReview={setReview}
        onScore={() => setScoreOpen(true)}
        onNext={nextHand}
        onStop={onStop}
        stopBlocked={stopBlocked}
        top={coachPill}
      />
    );
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
        <SessionHeader
          length={length}
          handNo={h.no}
          dots={dots}
          elapsed={elapsed}
          extra={extra}
          score={`${total > 0 ? '+' : ''}${Math.round(shownTotal)}`}
          onExit={askExit}
          onScore={() => setScoreOpen(true)}
        />
        <HandStrip records={records} onOpen={() => setScoreOpen(true)} />

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
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 -mb-1 mt-1">
          <span className="eyebrow">Du</span>
          {h.seats[0].fl > 0 && <FlChip n={h.seats[0].fl} />}
          {risk && risk.hand === h.no && !h.outcome && <RiskMeter foul={risk.foul} fl={risk.fl} />}
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

      <CoachSheet entry={review} onClose={() => setReview(null)} />
      <ScoreSheet open={scoreOpen} onClose={() => setScoreOpen(false)} records={records} current={h.no} />

      <BottomSheet open={exitOpen} onClose={() => setExitOpen(false)} title="Avsluta sessionen?">
        <div className="flex flex-col gap-2.5">
          <p className="text-[13px] text-ink-2">
            Du har spelat {records.length} {records.length === 1 ? 'hand' : 'händer'} och står på{' '}
            <b className={total > 0 ? 'text-accent-ink' : total < 0 ? 'text-danger' : 'text-ink'}>
              {total > 0 ? '+' : ''}
              {total} p
            </b>
            .{!h.outcome && ' Handen som pågår räknas inte.'}
            {length.kind === 'hands' && ' En avbruten session kommer inte med på topplistan.'}
          </p>
          <button type="button" onClick={() => finish(length.kind === 'free')} className="btn-primary h-12 rounded-full text-[15px] font-bold">
            Visa resultat ★
          </button>
          <button type="button" onClick={() => setExitOpen(false)} className="btn-ghost h-11 rounded-full text-[14px] font-bold">
            Fortsätt spela
          </button>
          <button type="button" onClick={onExit} className="h-10 rounded-full text-[13px] font-bold text-danger">
            Avsluta utan resultat
          </button>
        </div>
      </BottomSheet>
    </DragProvider>
  );
}

/** Löpande foul-risk och FL-chans för ditt bräde efter senaste draget */
function RiskMeter({ foul, fl }: { foul: number | null; fl: number | null }) {
  const pct = (p: number) => `${Math.round(p * 100)} %`;
  if (foul === null && fl === null) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-sunken px-2 py-[1px] text-[10.5px] font-bold text-ink-3" aria-live="polite">
        <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
        räknar risk…
      </span>
    );
  }
  const f = foul ?? 0;
  const danger = f >= 0.25;
  return (
    <span className="flex items-center gap-1 animate-badge-in" aria-live="polite" title="Räknat från ditt bräde efter senaste draget">
      <span
        className={`flex items-center gap-1 rounded-full px-2 py-[1px] text-[10.5px] font-extrabold tabular ${danger ? 'bg-danger-soft text-danger' : 'bg-sunken text-ink-2'}`}
      >
        <span className="relative h-1.5 w-7 overflow-hidden rounded-full bg-line-strong">
          <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500" style={{ width: `${Math.max(4, f * 100)}%`, background: danger ? 'var(--danger)' : 'var(--ink-3)' }} />
        </span>
        Foul {pct(f)}
      </span>
      {fl !== null && (
        <span className="rounded-full bg-fl-soft px-2 py-[1px] text-[10.5px] font-extrabold tabular text-fl">★ FL {pct(fl)}</span>
      )}
    </span>
  );
}

function FlChip({ n }: { n: number }) {
  return (
    <span className="rounded-full px-2 py-[1px] text-[10.5px] font-extrabold text-white shadow-[var(--glow-fl)]" style={{ background: 'var(--grad-fl)' }}>
      ★ FL {n}
    </span>
  );
}

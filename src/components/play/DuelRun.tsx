// ============================================================
// DuelRun.tsx — Ett parti mellan 2 spelare på samma telefon
// ============================================================
//
// Allt spel går via spelmotorn (match/match.ts): ett drag blir en action
// som skickas med dispatch(), och skärmen ritas från viewFor(state, seat),
// alltså bara det som spelaren med turen får se. Online senare byts
// useLocalMatch mot en hook som skickar actionen över nätet.
//
//  - Den som har turen ("viewer") ser sitt bräde nederst, stort och
//    klickbart, och motståndarens litet överst. Brädena byter plats vid
//    varje överlämning. När handen är klar står den som lade sist kvar.
//  - Vems tur: en stor banner i spelarens färg (grön/blå) som glider in
//    från spelarens håll, skärmkanten lyser i samma färg, och Klar-knappen
//    har färgen + texten "ge till Anna" när telefonen ska lämnas över.
//  - Fantasy Land: korten döljs bakom en "Visa mina kort"-skärm tills
//    FL-spelaren själv trycker, och brädet visas inte för motståndaren
//    förrän handen är klar (viewFor döljer det).
//  - Senaste dragets kort har streckad ram (useRecentSlots): motståndarens
//    (när brädet syns) och dina egna när handen är klar. Öppningshandens
//    kort har en fast mörk ram hela handen.
//  - Draglistan (MoveHistory, utan betyg — ingen solverhjälp här) visar
//    dragen för den som har turen. ☆ sparar ett drag för analys senare
//    under Träna → Sparade drag (savedMoves.ts). Listan finns bara medan
//    sidan är öppen; ett återupptaget parti börjar med en tom lista.
//  - Sessionen: samma regler som mot datorn (antal händer, minuter,
//    fritt spel, FL spelas ut eller inte) — motorn avgör när det är slut.
//  - Mot datorn (config.cpu): du är alltid spelare 1 och ser ditt bräde
//    nederst. På datorns tur räknar solvern (egen worker) fram ett drag
//    utifrån datorns vy (viewFor seat 1 — din öppning är dold i runda 1),
//    nivån väljer drag (match/cpu.ts) och draget skickas som en vanlig
//    action. Ingen överlämning och ingen dold FL-skärm.
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SeatId } from '../../training/game';
import { currentTurn, isLastHand, playsOutFl, totals, viewFor, type MatchState } from '../../match/match';
import { clearSavedMatch, useLocalMatch } from '../../match/useLocalMatch';
import { genitive } from '../../match/names';
import { flPending, targetReached } from '../../training/session';
import { usePlayClock } from '../../training/usePlayClock';
import { useMoveBuilder } from '../../training/useMoveBuilder';
import { useRevealAboveDock } from '../../training/useRevealAboveDock';
import { useFitBoards } from '../../training/useFitBoards';
import { haptic } from '../cards/cardStyle';
import { countPlaced, type Move } from '../../training/moves';
import type { Board } from '../../engine/types';
import type { SolverInput } from '../../hooks/useSolver';
import { solverInput } from '../../training/game';
import { toggleSaved, useSavedMoves } from '../../training/savedMoves';
import MoveHistory from '../training/MoveHistory';
import ShareBoards from '../share/ShareBoards';
import { useRecentSlots } from '../../training/useRecentSlots';
import { DragProvider } from '../dnd/DragContext';
import BoardView from '../board/BoardView';
import BottomSheet from '../ui/BottomSheet';
import DockLayout from '../training/DockLayout';
import PlayDock from '../training/PlayDock';
import HandOver from '../training/HandOver';
import SessionHeader, { type Dot } from '../training/SessionHeader';
import { cpuTone, HandStrip, ScoreSheet, signed } from '../training/Scoreboard';
import DuelSummary from './DuelSummary';
import { cpuMove, DUEL_CPU_LEVELS } from '../../match/cpu';
import { CANCELLED, useSolverJobs } from '../../training/useSolverJobs';

/** Kort paus innan datorns drag syns, så att man hinner se att det är datorns tur */
const CPU_PAUSE_MS = 450;

interface Props {
  initial: MatchState;
  initialElapsed: number;
  /** Spela-fliken syns (annars står klockan still) */
  active?: boolean;
  onExit: () => void;
  onRestart: () => void;
}

const other = (s: SeatId): SeatId => (s === 0 ? 1 : 0);

interface DuelEntry {
  key: string;
  seat: SeatId;
  hand: number;
  label: string;
  fl: boolean;
  board: Board;
  move: Move;
  input: SolverInput;
}
/** CSS-variabler för en spelares färg (grön = 1, blå = 2) */
const seatVars = (s: SeatId) => ({ '--grad': `var(--grad-p${s + 1})`, '--glow': `var(--glow-p${s + 1})` }) as React.CSSProperties;

export default function DuelRun({ initial, initialElapsed, active = true, onExit, onRestart }: Props) {
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const elapsed = usePlayClock(active && !initial.finished && finishedAt === null, initialElapsed);
  const { state, dispatch } = useLocalMatch(initial, elapsed);
  const h = state.hand;
  const turn = currentTurn(state);
  const cpu = state.config.cpu;
  const cpuTurn = !!cpu && turn?.seat === 1;
  // Den som har turen tittar. När handen är klar: den som lade sista draget.
  // Mot datorn: alltid du (spelare 1).
  const viewer: SeatId = cpu ? 0 : (turn?.seat ?? h.turns[h.turns.length - 1].seat);
  /** Den som har turen (bannern) */
  const actor: SeatId = turn?.seat ?? viewer;
  const view = viewFor(state, viewer);
  const me = view.seats[viewer];
  const opp = view.seats[other(viewer)];
  const names = state.config.names;
  const turnKey = `${h.no}-${h.idx}`;
  const { recent, opening, openings } = useRecentSlots(h.no, [h.seats[0].board, h.seats[1].board]);

  // Fantasy Land: korten visas först när FL-spelaren själv trycker "Visa"
  const [revealed, setRevealed] = useState<string | null>(null);
  const covered = !cpu && !!turn?.fl && revealed !== turnKey;

  const mb = useMoveBuilder(me.board!, covered ? [] : view.dealt, turn?.place ?? 0);
  const [error, setError] = useState<string | null>(null);

  // Vem som spelar efter det här draget — byts spelare, ska telefonen lämnas över
  const nextSeat = h.turns[h.idx + 1]?.seat;
  const handOver = !cpu && nextSeat !== undefined && nextSeat !== viewer;

  // ---------- Datorns tur ----------
  const cpuJobs = useSolverJobs();
  const { solve: cpuSolve, cancel: cpuCancel } = cpuJobs;
  const [cpuError, setCpuError] = useState<string | null>(null);
  const [cpuRetry, setCpuRetry] = useState(0);
  useEffect(() => {
    if (!cpu || !turn || turn.seat !== 1 || state.finished) return;
    let alive = true;
    let finished = false;
    setCpuError(null);
    const lvl = DUEL_CPU_LEVELS[cpu];
    // Bara det datorn får se: din öppning är dold i runda 1, ditt FL-bräde likaså
    const cv = viewFor(state, 1);
    cpuSolve(
      solverInput({
        seat: h.seats[1],
        cards: h.dealt,
        variant: state.config.variant,
        opponent: cv.seats[0].board ?? undefined,
        fl: turn.fl,
        options: { simulations: lvl.simulations, maxMs: lvl.maxMs },
      }),
    )
      .then(async (res) => {
        finished = true;
        const move = cpuMove(res, cpu);
        await new Promise((r) => setTimeout(r, CPU_PAUSE_MS));
        if (!alive) return;
        const err = dispatch({ type: 'move', hand: h.no, turn: h.idx, seat: 1, move });
        if (err) setCpuError(err);
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
  }, [h.no, h.idx, cpuRetry, !!state.finished]);

  // Dragen i partiet (för draglistan och ☆ spara)
  const [log, setLog] = useState<DuelEntry[]>([]);
  const savedList = useSavedMoves();
  const savedKeys = useMemo(() => new Set(savedList.filter((x) => x.id.startsWith(state.id + ':')).map((x) => x.id.slice(state.id.length + 1))), [savedList, state.id]);

  const confirm = () => {
    if (!turn || !mb.done) return;
    const move = mb.move;
    const err = dispatch({ type: 'move', hand: h.no, turn: view.turnIdx, seat: viewer, move });
    if (err) return setError(err);
    const seat = state.hand.seats[viewer];
    setLog((l) => [
      ...l,
      {
        key: `${h.no}-${view.turnIdx}`,
        seat: viewer,
        hand: h.no,
        label: turn.fl ? 'Fantasy Land' : turn.round === 1 ? 'Öppningshand' : `Runda ${turn.round}`,
        fl: turn.fl,
        board: seat.board,
        move,
        // Bara det spelaren såg: motståndarens bräde som det visades (dolt = okänt)
        input: solverInput({ seat, cards: view.dealt, variant: state.config.variant, opponent: opp.board ?? undefined, fl: turn.fl, options: {} }),
      },
    ]);
    setError(null);
    mb.reset();
    haptic(handOver ? [10, 40, 10] : 8);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---------- Sessionen ----------
  const [exitOpen, setExitOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const length = state.config.length;
  const reached = targetReached(length, h.no, elapsed);
  const last = isLastHand(state, elapsed);
  const playOutFl = playsOutFl(state, elapsed);
  const extra = state.extraFrom !== null && h.no >= state.extraFrom;
  const stopBlocked = !!h.outcome && flPending(state.config.flEnd, h.outcome.nextFl);

  const nextHand = () => {
    dispatch({ type: 'nextHand', hand: h.no, elapsedMs: elapsed });
    window.scrollTo({ top: 0 });
  };
  const finish = (complete: boolean) => {
    setExitOpen(false);
    setFinishedAt(elapsed);
    dispatch({ type: 'finish', complete });
  };
  const onStop = length.kind === 'free' ? () => !stopBlocked && finish(true) : undefined;

  const askExit = () => {
    if (state.records.length === 0) {
      clearSavedMatch();
      return onExit();
    }
    setExitOpen(true);
  };

  const [t1] = totals(state);
  // Mot datorn: blå prick = du vann handen, röd = datorn vann
  const dots = useMemo(
    () => state.records.map((r): Dot => (r.net > 0 ? (cpu ? 'p2' : 'p1') : r.net < 0 ? (cpu ? 'miss' : 'p2') : null)),
    [state.records, cpu],
  );

  /** Handen klar: bara intjänade royalties på brädena (husregel: radens vinnare) */
  const earnedFor = (seat: SeatId) => (h.outcome ? (seat === 0 ? h.outcome.score.p1Royalties : h.outcome.score.p2Royalties) : undefined);

  // Ditt bräde ska synas ovanför panelen när det blir din tur
  const myBoardRef = useRef<HTMLDivElement>(null);
  useRevealAboveDock(myBoardRef, h.outcome ? `o${h.no}` : covered ? null : `t${turnKey}`);
  // Telefon: båda brädena + panelen på skärmen samtidigt (se useFitBoards)
  const fitRef = useRef<HTMLDivElement>(null);
  const oppBoardRef = useRef<HTMLDivElement>(null);
  const fit = useFitBoards(fitRef, myBoardRef, oppBoardRef, !!turn && !covered && !turn.fl && turn.round > 1);

  if (state.finished) {
    return <DuelSummary state={state} elapsed={finishedAt ?? elapsed} onRestart={onRestart} onExit={onExit} openings={openings} />;
  }

  // ---------- Panelen längst ner ----------
  const turnText = !turn
    ? ''
    : turn.fl
      ? `Fantasy Land · ${turn.count} kort`
      : turn.round === 1
        ? 'Öppningshand · 5 kort'
        : `Runda ${turn.round} · ${turn.count === 1 ? '1 kort' : `${turn.count} kort, kasta 1`}`;

  let dock: React.ReactNode;
  if (h.outcome) {
    dock = (
      <HandOver
        outcome={h.outcome}
        last={last}
        playOutFl={playOutFl}
        flSkipped={reached && state.config.flEnd === 'stop' && (h.outcome.nextFl[0] > 0 || h.outcome.nextFl[1] > 0)}
        coachLog={[]}
        onScore={() => setScoreOpen(true)}
        onNext={nextHand}
        onStop={onStop}
        stopBlocked={stopBlocked}
        names={names}
      />
    );
  } else if (turn && covered) {
    dock = (
      <div className="flex flex-col items-center gap-2.5 py-1 text-center" style={seatVars(viewer)}>
        <span className="flex h-12 w-12 items-center justify-center rounded-full text-[20px] text-white shadow-[var(--glow-fl)] animate-floaty" style={{ background: 'var(--grad-fl)' }}>
          ★
        </span>
        <div>
          <div className="title-serif text-[21px]">{genitive(me.name)} Fantasy Land</div>
          <div className="text-[12.5px] font-medium text-ink-2">
            Ge telefonen till {me.name}. {view.dealt.length} kort — se till att {opp.name} inte tittar.
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            haptic([8, 30, 8]);
            setRevealed(turnKey);
          }}
          className="btn-primary h-12 w-full rounded-full text-[15px] font-bold"
        >
          Jag är {me.name} — visa mina kort
        </button>
      </div>
    );
  } else if (turn && cpuTurn) {
    dock = (
      <div className="flex flex-col gap-2 py-0.5" style={seatVars(1)}>
        <div
          key={`${h.no}-cpu`}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-white animate-turn-swap"
          style={{ background: 'var(--grad-p2)', boxShadow: 'var(--glow-p2)', '--swap-from': '32px' } as React.CSSProperties}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/25 text-[12px] font-extrabold">2</span>
          <span className="truncate text-[15px] font-extrabold">{genitive(names[1])} tur</span>
          <span className="ml-auto shrink-0 text-[11.5px] font-semibold text-white/85">{turnText}</span>
        </div>
        {cpuError ? (
          <div className="flex items-center gap-2">
            <span className="flex-1 text-[12px] font-bold text-danger">{cpuError}</span>
            <button type="button" onClick={() => setCpuRetry((n) => n + 1)} className="btn-ghost h-9 rounded-full px-3 text-[13px] font-bold">
              Försök igen
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-1.5 text-[13px] font-semibold text-ink-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-p2" aria-hidden="true" />
            Datorn tänker{turn.fl ? ' (Fantasy Land)' : ''}…
          </div>
        )}
      </div>
    );
  } else if (turn) {
    dock = (
      <div style={seatVars(viewer)}>
        <PlayDock
          mb={mb}
          place={turn.place}
          total={view.dealt.length}
          onDone={confirm}
          doneLabel={handOver ? `✓ Klar – ge till ${names[nextSeat!]}` : '✓ Klar'}
          compact
          top={
            <div className="flex flex-col gap-1.5">
              {/* Panelen syns alltid, även när sidan skrollat förbi bannern */}
              <div
                key={`${h.no}-${viewer}`}
                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-white animate-turn-swap"
                style={{ background: `var(--grad-p${viewer + 1})`, boxShadow: `var(--glow-p${viewer + 1})`, '--swap-from': viewer === 0 ? '-32px' : '32px' } as React.CSSProperties}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/25 text-[12px] font-extrabold">{viewer + 1}</span>
                <span className="truncate text-[15px] font-extrabold">{genitive(me.name)} tur</span>
                <span className="ml-auto shrink-0 text-[11.5px] font-semibold text-white/85">{turnText}</span>
              </div>
              {error && <span className="self-start rounded-full bg-danger-soft px-2 py-[1px] text-[11px] font-bold text-danger">{error}</span>}
            </div>
          }
        />
      </div>
    );
  }

  return (
    <DragProvider onDrop={mb.drop}>
      {/* Skärmkanten lyser i färgen för den som har turen */}
      {turn && <div className="turn-edge" style={{ '--edge': `color-mix(in srgb, var(--p${actor + 1}) 75%, transparent)` } as React.CSSProperties} aria-hidden="true" />}

      <DockLayout
        dock={dock}
        side={
          <MoveHistory
            title={`${genitive(me.name)} drag`}
            items={log
              .filter((e) => e.seat === viewer)
              .map((e) => ({ key: e.key, group: `Hand ${e.hand}`, label: e.label, move: e.move, j: null, fl: e.fl }))}
            hideGrades
            empty="Dina drag dyker upp här. Tryck ☆ för att spara ett drag och analysera det under Träna."
            saved={savedKeys}
            onToggleSave={(key) => {
              const e = log.find((x) => x.key === key);
              if (!e) return;
              toggleSaved({
                id: `${state.id}:${e.key}`,
                source: 'duel',
                variant: state.config.variant,
                label: `${names[e.seat]} · Hand ${e.hand} · ${e.label}`,
                board: e.board,
                move: e.move,
                input: e.input,
                fl: e.fl,
                j: null,
                thorough: false,
              });
            }}
          />
        }
      >
        <SessionHeader
          length={length}
          handNo={h.no}
          dots={dots}
          elapsed={elapsed}
          extra={extra}
          score={
            cpu ? (
              <span className={cpuTone(t1)}>{signed(t1)}</span>
            ) : (
              <span className={t1 > 0 ? 'text-p1-ink' : t1 < 0 ? 'text-p2-ink' : 'text-ink-2'}>{t1 === 0 ? '±0' : `+${Math.abs(t1)}`}</span>
            )
          }
          onExit={askExit}
          onScore={() => setScoreOpen(true)}
        />

        {/* Vems tur — stor och omöjlig att missa. På telefon visas den i
            panelen i stället (och skärmkanten lyser), så att brädena får plats */}
        {turn ? (
          <div
            key={`${h.no}-${actor}`}
            className="hidden wide:flex items-center gap-3 rounded-[24px] px-4 py-3 text-white animate-turn-swap"
            style={{ background: `var(--grad-p${actor + 1})`, boxShadow: `var(--glow-p${actor + 1})`, '--swap-from': actor === 0 ? '-48px' : '48px' } as React.CSSProperties}
            role="status"
            aria-live="assertive"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/25 text-[19px] font-extrabold ring-2 ring-white/60">{actor + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-serif text-[26px] font-extrabold leading-tight">{genitive(names[actor])} tur</div>
              <div className="text-[12.5px] font-semibold text-white/85">{turnText}</div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-[24px] bg-sunken/80 px-4 py-3 animate-fade-in">
            <span className="text-[22px]">🏁</span>
            <div className="font-serif text-[22px] font-extrabold text-ink">Hand {h.no} är klar</div>
          </div>
        )}

        <div className="hidden wide:block">
          <HandStrip records={state.records} onOpen={() => setScoreOpen(true)} names={names} cpu={!!cpu} />
        </div>

        <div ref={fitRef} className="flex flex-col gap-3">
        {/* Motståndarens bräde (litet, överst) */}
        <SeatLabel seat={other(viewer)} name={opp.name} fl={opp.fl} starts={h.first === other(viewer)} />
        <div ref={oppBoardRef} style={fit ? ({ '--card-h-cap': `${fit.opp}px` } as React.CSSProperties) : undefined}>
        {opp.board ? (
          <div className="opacity-85">
            <BoardView board={opp.board} recent={recent[other(viewer)]} opening={opening[other(viewer)]} maxCardWidth={40} fouled={other(viewer) === 0 ? !!h.outcome?.score.p1Foul : !!h.outcome?.score.p2Foul} earnedRoyalties={earnedFor(other(viewer))} />
          </div>
        ) : (
          // Lika hög som motståndarens bräde, så att inget hoppar när det visas
          <div className="felt flex h-[calc(min(40px,var(--card-h-cap,40px))*4.44+48px)] flex-col items-center justify-center gap-1 rounded-[26px] p-4 text-center text-[13px] font-semibold text-[color:var(--felt-label)]">
            {opp.hidden === 'opening' ? (
              <>
                <span className="text-[22px]" aria-hidden="true">🂠</span>
                {countPlaced(state.hand.seats[other(viewer)].board) > 0
                  ? `${genitive(opp.name)} öppning är dold — den visas när du lagt din`
                  : `${opp.name} lägger sin öppning efter dig — dold tills båda lagt`}
              </>
            ) : (
              `★ ${opp.name} spelar Fantasy Land — brädet visas när handen är klar`
            )}
          </div>
        )}
        </div>

        {/* Ditt bräde (stort, nederst) — ram i din färg när det är din tur */}
        <div className="mt-1">
          <SeatLabel seat={viewer} name={me.name} fl={me.fl} starts={h.first === viewer} you={!!turn && !cpuTurn} />
        </div>
        <div
          ref={myBoardRef}
          key={`b${viewer}`}
          className={`relative rounded-[30px] transition-shadow duration-500 ${turn ? 'animate-fade-in' : ''}`}
          style={{
            ...(turn && !cpuTurn ? { boxShadow: `0 0 0 3px color-mix(in srgb, var(--p${viewer + 1}) 70%, transparent), var(--glow-p${viewer + 1})` } : {}),
            ...(fit ? { '--card-h-cap': `${fit.me}px` } : {}),
          } as React.CSSProperties}
        >
          <ShareBoards
            boards={() => [
              { name: me.name, board: turn && !cpuTurn ? mb.board : me.board!, fouled: viewer === 0 ? !!h.outcome?.score.p1Foul : !!h.outcome?.score.p2Foul, royalties: earnedFor(viewer), recent: turn ? undefined : recent[viewer], opening: opening[viewer] },
              // Motståndarens bräde bara om det syns (dold öppning / FL delas inte)
              ...(opp.board ? [{ name: opp.name, board: opp.board, fouled: other(viewer) === 0 ? !!h.outcome?.score.p1Foul : !!h.outcome?.score.p2Foul, royalties: earnedFor(other(viewer)), recent: recent[other(viewer)], opening: opening[other(viewer)] }] : []),
            ]}
          />
          <BoardView
            board={turn && !cpuTurn ? mb.board : me.board!}
            recent={turn && !cpuTurn ? undefined : recent[viewer]}
            opening={opening[viewer]}
            heldCard={turn && !cpuTurn ? mb.heldCard : null}
            interactive={!!turn && !covered && !cpuTurn}
            onPlace={mb.placeAt}
            onRemove={turn && !cpuTurn ? mb.remove : undefined}
            canRemove={mb.isMine}
            fouled={viewer === 0 ? !!h.outcome?.score.p1Foul : !!h.outcome?.score.p2Foul}
            earnedRoyalties={earnedFor(viewer)}
            maxCardWidth={84}
          />
        </div>
        </div>
      </DockLayout>

      <ScoreSheet open={scoreOpen} onClose={() => setScoreOpen(false)} records={state.records} current={h.no} names={names} openings={openings} cpu={!!cpu} />

      <BottomSheet open={exitOpen} onClose={() => setExitOpen(false)} title="Avsluta partiet?">
        <div className="flex flex-col gap-2.5">
          <p className="text-[13px] text-ink-2">
            {cpu ? 'Du har' : 'Ni har'} spelat {state.records.length} {state.records.length === 1 ? 'hand' : 'händer'}.
            {t1 !== 0 && (
              <>
                {' '}
                <b className={cpu ? cpuTone(t1) : t1 > 0 ? 'text-p1-ink' : 'text-p2-ink'}>
                  {t1 > 0 ? names[0] : names[1]} leder med {Math.abs(t1)} p
                </b>
                .
              </>
            )}
            {!h.outcome && ' Handen som pågår räknas inte.'} Partiet är sparat, så {cpu ? 'du' : 'ni'} kan också bara byta flik och fortsätta senare.
          </p>
          <button type="button" onClick={() => finish(length.kind === 'free')} className="btn-primary h-12 rounded-full text-[15px] font-bold">
            Visa resultat ★
          </button>
          <button type="button" onClick={() => setExitOpen(false)} className="btn-ghost h-11 rounded-full text-[14px] font-bold">
            Fortsätt spela
          </button>
          <button
            type="button"
            onClick={() => {
              clearSavedMatch();
              onExit();
            }}
            className="h-10 rounded-full text-[13px] font-bold text-danger"
          >
            Avsluta utan resultat
          </button>
        </div>
      </BottomSheet>
    </DragProvider>
  );
}

function SeatLabel({ seat, name, fl, starts, you }: { seat: SeatId; name: string; fl: number; starts: boolean; you?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 -mb-1">
      <span className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.08em]" style={{ color: `var(--p${seat + 1}-ink)` }}>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--grad-p${seat + 1})` }} />
        {name}
        {you && <span className="rounded-full px-1.5 py-[1px] text-[10px] text-white" style={{ background: `var(--grad-p${seat + 1})` }}>din tur</span>}
      </span>
      {fl > 0 && (
        <span className="rounded-full px-2 py-[1px] text-[10.5px] font-extrabold text-white shadow-[var(--glow-fl)]" style={{ background: 'var(--grad-fl)' }}>
          ★ FL {fl}
        </span>
      )}
      {starts && <span className="ml-auto text-[10.5px] font-bold text-ink-3">börjar</span>}
    </div>
  );
}

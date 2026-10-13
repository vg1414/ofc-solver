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
//  - Sessionen: samma regler som mot datorn (antal händer, minuter,
//    fritt spel, FL spelas ut eller inte) — motorn avgör när det är slut.
// ============================================================

import { useMemo, useRef, useState } from 'react';
import type { SeatId } from '../../training/game';
import { currentTurn, isLastHand, playsOutFl, totals, viewFor, type MatchState } from '../../match/match';
import { clearSavedMatch, useLocalMatch } from '../../match/useLocalMatch';
import { genitive } from '../../match/names';
import { flPending, targetReached } from '../../training/session';
import { usePlayClock } from '../../training/usePlayClock';
import { useMoveBuilder } from '../../training/useMoveBuilder';
import { useRevealAboveDock } from '../../training/useRevealAboveDock';
import { haptic } from '../cards/cardStyle';
import { countPlaced } from '../../training/moves';
import { DragProvider } from '../dnd/DragContext';
import BoardView from '../board/BoardView';
import BottomSheet from '../ui/BottomSheet';
import DockLayout from '../training/DockLayout';
import PlayDock from '../training/PlayDock';
import HandOver from '../training/HandOver';
import SessionHeader, { type Dot } from '../training/SessionHeader';
import { HandStrip, ScoreSheet } from '../training/Scoreboard';
import DuelSummary from './DuelSummary';

interface Props {
  initial: MatchState;
  initialElapsed: number;
  /** Spela-fliken syns (annars står klockan still) */
  active?: boolean;
  onExit: () => void;
  onRestart: () => void;
}

const other = (s: SeatId): SeatId => (s === 0 ? 1 : 0);
/** CSS-variabler för en spelares färg (grön = 1, blå = 2) */
const seatVars = (s: SeatId) => ({ '--grad': `var(--grad-p${s + 1})`, '--glow': `var(--glow-p${s + 1})` }) as React.CSSProperties;

export default function DuelRun({ initial, initialElapsed, active = true, onExit, onRestart }: Props) {
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const elapsed = usePlayClock(active && !initial.finished && finishedAt === null, initialElapsed);
  const { state, dispatch } = useLocalMatch(initial, elapsed);
  const h = state.hand;
  const turn = currentTurn(state);
  // Den som har turen tittar. När handen är klar: den som lade sista draget.
  const viewer: SeatId = turn?.seat ?? h.turns[h.turns.length - 1].seat;
  const view = viewFor(state, viewer);
  const me = view.seats[viewer];
  const opp = view.seats[other(viewer)];
  const names = state.config.names;
  const turnKey = `${h.no}-${h.idx}`;

  // Fantasy Land: korten visas först när FL-spelaren själv trycker "Visa"
  const [revealed, setRevealed] = useState<string | null>(null);
  const covered = !!turn?.fl && revealed !== turnKey;

  const mb = useMoveBuilder(me.board!, covered ? [] : view.dealt, turn?.place ?? 0);
  const [error, setError] = useState<string | null>(null);

  // Vem som spelar efter det här draget — byts spelare, ska telefonen lämnas över
  const nextSeat = h.turns[h.idx + 1]?.seat;
  const handOver = nextSeat !== undefined && nextSeat !== viewer;

  const confirm = () => {
    if (!turn || !mb.done) return;
    const err = dispatch({ type: 'move', hand: h.no, turn: view.turnIdx, seat: viewer, move: mb.move });
    if (err) return setError(err);
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
  const dots = useMemo(() => state.records.map((r): Dot => (r.net > 0 ? 'p1' : r.net < 0 ? 'p2' : null)), [state.records]);

  // Ditt bräde ska synas ovanför panelen när det blir din tur
  const myBoardRef = useRef<HTMLDivElement>(null);
  useRevealAboveDock(myBoardRef, h.outcome ? `o${h.no}` : covered ? null : `t${turnKey}`);

  if (state.finished) {
    return <DuelSummary state={state} elapsed={finishedAt ?? elapsed} onRestart={onRestart} onExit={onExit} />;
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
  } else if (turn) {
    dock = (
      <div style={seatVars(viewer)}>
        <PlayDock
          mb={mb}
          place={turn.place}
          total={view.dealt.length}
          onDone={confirm}
          doneLabel={handOver ? `✓ Klar – ge till ${names[nextSeat!]}` : '✓ Klar'}
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
      {turn && <div className="turn-edge" style={{ '--edge': `color-mix(in srgb, var(--p${viewer + 1}) 75%, transparent)` } as React.CSSProperties} aria-hidden="true" />}

      <DockLayout dock={dock}>
        <SessionHeader
          length={length}
          handNo={h.no}
          dots={dots}
          elapsed={elapsed}
          extra={extra}
          score={<span className={t1 > 0 ? 'text-p1-ink' : t1 < 0 ? 'text-p2-ink' : 'text-ink-2'}>{t1 === 0 ? '±0' : `+${Math.abs(t1)}`}</span>}
          onExit={askExit}
          onScore={() => setScoreOpen(true)}
        />

        {/* Vems tur — stor och omöjlig att missa */}
        {turn ? (
          <div
            key={`${h.no}-${viewer}`}
            className="flex items-center gap-3 rounded-[24px] px-4 py-3 text-white animate-turn-swap"
            style={{ background: `var(--grad-p${viewer + 1})`, boxShadow: `var(--glow-p${viewer + 1})`, '--swap-from': viewer === 0 ? '-48px' : '48px' } as React.CSSProperties}
            role="status"
            aria-live="assertive"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/25 text-[19px] font-extrabold ring-2 ring-white/60">{viewer + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-serif text-[26px] font-extrabold leading-tight">{genitive(me.name)} tur</div>
              <div className="text-[12.5px] font-semibold text-white/85">{turnText}</div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-[24px] bg-sunken/80 px-4 py-3 animate-fade-in">
            <span className="text-[22px]">🏁</span>
            <div className="font-serif text-[22px] font-extrabold text-ink">Hand {h.no} är klar</div>
          </div>
        )}

        <HandStrip records={state.records} onOpen={() => setScoreOpen(true)} names={names} />

        {/* Motståndarens bräde (litet, överst) */}
        <SeatLabel seat={other(viewer)} name={opp.name} fl={opp.fl} starts={h.first === other(viewer)} />
        {opp.board ? (
          <div className="opacity-85">
            <BoardView board={opp.board} maxCardWidth={40} fouled={other(viewer) === 0 ? !!h.outcome?.score.p1Foul : !!h.outcome?.score.p2Foul} />
          </div>
        ) : (
          <div className="felt flex h-[150px] flex-col items-center justify-center gap-1 rounded-[26px] p-4 text-center text-[13px] font-semibold text-[color:var(--felt-label)]">
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

        {/* Ditt bräde (stort, nederst) — ram i din färg när det är din tur */}
        <div className="mt-1">
          <SeatLabel seat={viewer} name={me.name} fl={me.fl} starts={h.first === viewer} you={!!turn} />
        </div>
        <div
          ref={myBoardRef}
          key={`b${viewer}`}
          className={`rounded-[30px] transition-shadow duration-500 ${turn ? 'animate-fade-in' : ''}`}
          style={turn ? { boxShadow: `0 0 0 3px color-mix(in srgb, var(--p${viewer + 1}) 70%, transparent), var(--glow-p${viewer + 1})` } : undefined}
        >
          <BoardView
            board={turn ? mb.board : me.board!}
            heldCard={turn ? mb.heldCard : null}
            interactive={!!turn && !covered}
            onPlace={mb.placeAt}
            onRemove={turn ? mb.remove : undefined}
            canRemove={mb.isMine}
            fouled={viewer === 0 ? !!h.outcome?.score.p1Foul : !!h.outcome?.score.p2Foul}
            maxCardWidth={84}
          />
        </div>
      </DockLayout>

      <ScoreSheet open={scoreOpen} onClose={() => setScoreOpen(false)} records={state.records} current={h.no} names={names} />

      <BottomSheet open={exitOpen} onClose={() => setExitOpen(false)} title="Avsluta partiet?">
        <div className="flex flex-col gap-2.5">
          <p className="text-[13px] text-ink-2">
            Ni har spelat {state.records.length} {state.records.length === 1 ? 'hand' : 'händer'}.
            {t1 !== 0 && (
              <>
                {' '}
                <b className={t1 > 0 ? 'text-p1-ink' : 'text-p2-ink'}>
                  {t1 > 0 ? names[0] : names[1]} leder med {Math.abs(t1)} p
                </b>
                .
              </>
            )}
            {!h.outcome && ' Handen som pågår räknas inte.'} Partiet är sparat, så ni kan också bara byta flik och fortsätta senare.
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

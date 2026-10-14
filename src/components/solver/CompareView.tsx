// ============================================================
// CompareView.tsx — Jämför två egna läggningar (Solver-fliken)
// ============================================================
//
// Flöde:
//   1. A = din läggning. Vanlig hand: den du just lade på brädet.
//      Fantasy Land: du lägger den här först (steg "a").
//   2. "Jämför mot…" → B börjar som en kopia av A. Flytta kort mellan
//      raderna (dra, eller tryck två gånger för att ta tillbaka ett kort).
//      ↶ återställer B till A.
//   3. "Jämför" kör solvern med BÅDA läggningarna låsta (options.pinned):
//      de räknas lika noga, på exakt samma blandningar, och solverns eget
//      bästa drag räknas fram samtidigt som referens. Fantasy Land räknas
//      exakt (ingen slump).
//   4. Resultatet: A, B och ★ solverns bästa sida vid sida (litet bräde,
//      EV, foul-risk, FL-chans). Tryck på en ruta → den visas stort på
//      brädet. Skillnaden A–B har en felmarginal (evDiffSEPin0 = parvis
//      standardfel mot A); är skillnaden mindre än 2 standardfel säger vi
//      "lika bra". Välj sedan vad som ska ligga kvar: Behåll A / B / bästa.
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Board, Card, GameVariant, RowName } from '../../engine/types';
import { createEmptyBoard } from '../../engine/types';
import type { DetailedPlacementOption, PinnedMove } from '../../solver/solver';
import { useSolver } from '../../hooks/useSolver';
import { applyMove, findOption, moveKey, type Move } from '../../training/moves';
import { useMoveBuilder } from '../../training/useMoveBuilder';
import { DragProvider } from '../dnd/DragContext';
import BoardView from '../board/BoardView';
import PlayingCard from '../cards/PlayingCard';
import { haptic } from '../cards/cardStyle';
import DockLayout from '../training/DockLayout';
import PlayDock from '../training/PlayDock';
import Segmented from '../ui/Segmented';
import { SolverProgress } from './ResultsPanel';
import { isFoul } from '../../engine/foulCheck';
import { rowCards } from '../../training/moves';

export interface CompareSetup {
  mode: 'normal' | 'fantasyLand';
  /** Brädet före draget (tomt i Fantasy Land) */
  base: Board;
  /** Korten i draget (Pineapple: inkl. kortet som kastas) */
  hand: Card[];
  /** Antal kort som ska läggas (13 i Fantasy Land) */
  place: number;
  /** Läggning A. null = A läggs först här (Fantasy Land) */
  a: Move | null;
  deadCards: Card[];
  variant: GameVariant;
  opponentBoard?: Board;
  simulations: number;
}

interface CompareViewProps {
  setup: CompareSetup;
  /** Tillbaka utan att ändra något (A ligger kvar) */
  onClose: () => void;
  /** Lägg den valda läggningen på brädet */
  onKeep: (move: Move) => void;
  /** false = går inte att lägga ut (Fantasy Land när brädet inte är tomt) */
  canKeep: boolean;
}

type Phase = 'a' | 'b' | 'run' | 'done';
type Pick = 'a' | 'b' | 'best';

const evFmt = new Intl.NumberFormat('sv-SE', { signDisplay: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numFmt = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (p?: number) => (p === undefined ? '–' : p > 0 && p < 0.01 ? '<1 %' : `${Math.round(p * 100)} %`);

const toPinned = (m: Move): PinnedMove => [
  ...m.placements.map((p) => ({ card: p.card, row: p.row })),
  ...m.discards.map((card) => ({ card, row: 'discard' as const })),
];

const ROWS: RowName[] = ['top', 'middle', 'bottom'];

/** Litet bräde utan etiketter, för rutorna i resultatet */
function MiniBoard({ board, w }: { board: Board; w: number }) {
  return (
    <div className="flex flex-col gap-[3px]">
      {ROWS.map((r) => (
        <div key={r} className="flex gap-[2px]">
          {board[r].cards.map((c, i) =>
            c ? (
              <PlayingCard key={i} card={c} width={w} compact />
            ) : (
              <div key={i} className="rounded-[3px] bg-sunken shadow-[inset_0_0_0_1px_var(--line)]" style={{ width: w, height: w * 1.4 }} />
            ),
          )}
        </div>
      ))}
    </div>
  );
}

export default function CompareView({ setup, onClose, onKeep, canKeep }: CompareViewProps) {
  const { mode, base, hand, place } = setup;
  const fl = mode === 'fantasyLand';
  const mbA = useMoveBuilder(base, hand, place);
  const mbB = useMoveBuilder(base, hand, place);
  const [phase, setPhase] = useState<Phase>(setup.a ? 'b' : 'a');
  const [peekA, setPeekA] = useState(false);
  const [pick, setPick] = useState<Pick>('b');
  const [flash, setFlash] = useState<string | null>(null);
  const { result, error, progress, doneId, runSolver, cancelSolver } = useSolver();
  /** Id för jämförelsens körning (useSolver doneId säger när just den är klar) */
  const runId = useRef(0);

  // Vanlig hand: A finns redan → B börjar som en kopia av A
  const loadA = mbA.load;
  const loadB = mbB.load;
  useEffect(() => {
    if (!setup.a) return;
    loadA(setup.a.placements);
    loadB(setup.a.placements);
    // Bara när vyn öppnas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 2000);
    return () => window.clearTimeout(t);
  }, [flash]);

  const a = setup.a ?? mbA.move;
  const same = mbB.done && moveKey(mbB.move) === moveKey(a);

  // B:s ↶ återställer till A (inte till tomt)
  const builderB = useMemo(() => ({ ...mbB, reset: () => mbB.load(a.placements) }), [mbB, a]);
  const active = phase === 'a' ? mbA : builderB;

  const toB = () => {
    if (!mbA.done) return;
    haptic(8);
    mbB.load(mbA.move.placements);
    setPhase('b');
  };

  const run = () => {
    if (!mbB.done) return;
    if (same) {
      setFlash('B är likadan som A — flytta minst ett kort');
      haptic([4, 30, 4]);
      return;
    }
    haptic(8);
    setPhase('run');
    setPeekA(false);
    const options = { simulations: setup.simulations, pinned: [toPinned(a), toPinned(mbB.move)] };
    if (fl) runId.current = runSolver({ board: createEmptyBoard(), cards: hand, deadCards: [], options, mode: 'fantasyLand' });
    else
      runId.current = runSolver({
        board: base,
        cards: hand,
        deadCards: setup.deadCards,
        variant: setup.variant,
        opponentBoard: setup.opponentBoard,
        options,
        mode: 'normal',
      });
  };

  // Solvern klar → resultatet (eller tillbaka till B med felet)
  useEffect(() => {
    if (phase !== 'run' || doneId !== runId.current) return;
    if (error) setFlash(error);
    setPhase(error ? 'b' : 'done');
    if (!error) haptic([8, 40, 8]);
  }, [phase, doneId, error]);

  const backToB = () => {
    cancelSolver();
    setPhase('b');
  };

  // ---------- Resultatet ----------
  const res = phase === 'done' ? result : null;
  const oa = res ? findOption(res, a) : undefined;
  const ob = res ? findOption(res, mbB.move) : undefined;
  const best = res?.best;
  const bestKey = best ? moveKey(best) : '';
  const bestIs: Pick | null = !best ? null : oa && moveKey(oa) === bestKey ? 'a' : ob && moveKey(ob) === bestKey ? 'b' : 'best';

  const verdict = (() => {
    if (!oa || !ob) return null;
    const d = ob.ev - oa.ev;
    const se = fl ? 0 : (ob.evDiffSEPin0 ?? 0);
    const tie = fl ? Math.abs(d) < 0.005 : Math.abs(d) < 2 * se;
    const head = tie
      ? fl
        ? 'A och B är exakt lika bra'
        : 'A och B är lika bra'
      : `${d > 0 ? 'B' : 'A'} är ${numFmt.format(Math.abs(d))} poäng bättre`;
    const sub = tie
      ? fl
        ? 'Fantasy Land räknas exakt, så de är verkligen lika.'
        : `Skillnaden (${numFmt.format(Math.abs(d))}) ryms i slumpens felmarginal (±${numFmt.format(2 * se)}).`
      : fl
        ? 'Fantasy Land räknas exakt, så skillnaden är säker.'
        : se > 0
          ? `Säker skillnad: mer än felmarginalen (±${numFmt.format(2 * se)}).`
          : '';
    const winner = tie ? null : d > 0 ? ob : oa;
    const toBest =
      best && bestIs === 'best'
        ? `Solverns bästa är ${numFmt.format(best.ev - Math.max(oa.ev, ob.ev))} bättre än ${tie ? 'båda' : d > 0 ? 'B' : 'A'}.`
        : bestIs === 'a'
          ? 'A är samma som solverns bästa drag.'
          : bestIs === 'b'
            ? 'B är samma som solverns bästa drag.'
            : '';
    return { head, sub, winner, toBest, tie };
  })();

  // Vald ruta från början = vinnaren (B vid lika), så att man inte råkar behålla den sämre
  const winnerPick: Pick = verdict?.winner && verdict.winner === oa ? 'a' : 'b';
  useEffect(() => {
    if (phase === 'done') setPick(winnerPick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result]);

  const optOf = (p: Pick): DetailedPlacementOption | undefined => (p === 'a' ? oa : p === 'b' ? ob : best);
  const boardOf = (o: DetailedPlacementOption | undefined) => (o ? (o.resultBoard ?? applyMove(base, o.placements)) : base);
  // Fantasy Land har ingen foul-procent (allt är känt) — kolla brädet direkt
  const flFouled = (o: DetailedPlacementOption | undefined) => {
    if (!o) return false;
    const b = boardOf(o);
    return isFoul(rowCards(b, 'top'), rowCards(b, 'middle'), rowCards(b, 'bottom'));
  };
  const picks: Pick[] = bestIs === 'best' ? ['a', 'b', 'best'] : ['a', 'b'];

  // ---------- Brädet ----------
  let shown: Board;
  let interactive = false;
  if (phase === 'a') {
    shown = mbA.board;
    interactive = true;
  } else if (phase === 'done') {
    shown = boardOf(optOf(pick));
  } else if (peekA) {
    shown = setup.a ? applyMove(base, setup.a.placements) : mbA.board;
  } else {
    shown = mbB.board;
    interactive = phase === 'b';
  }
  // Dragets kort streckade (inte när hela brädet är nytt: öppning/FL)
  const moveSlots = (o: { placements: { row: RowName; slotIndex: number }[] }) => o.placements.map((p) => ({ row: p.row, slot: p.slotIndex }));
  const fresh = fl || ROWS.every((r) => base[r].cards.every((c) => c === null));
  const recent = fresh
    ? undefined
    : phase === 'done'
      ? optOf(pick) && moveSlots(optOf(pick)!)
      : peekA
        ? moveSlots(a)
        : undefined;

  const label = phase === 'a' ? 'Läggning A' : phase === 'done' ? (pick === 'best' ? '★ Solverns bästa' : `Läggning ${pick.toUpperCase()}`) : peekA ? 'Läggning A' : 'Läggning B';

  // ---------- Panelen ----------
  let dock: React.ReactNode;
  if (phase === 'a' || phase === 'b') {
    const status =
      phase === 'a'
        ? 'Lägg din uppställning. Kort som blir över kastas.'
        : flash ?? (same ? 'B är en kopia av A — flytta ett eller flera kort' : 'Klar att jämföra');
    dock = (
      <PlayDock
        mb={active}
        place={place}
        total={hand.length}
        onDone={phase === 'a' ? toB : run}
        doneLabel={phase === 'a' ? 'Jämför mot… →' : '⇄ Jämför A och B'}
        compact={!fl}
        top={
          <div className="flex items-center gap-2">
            <span className="eyebrow">{phase === 'a' ? 'Steg 1 · Läggning A' : 'Steg 2 · Läggning B'}</span>
            <span className={`ml-auto text-right text-[11.5px] font-semibold leading-tight ${flash ? 'text-danger' : 'text-ink-3'}`}>{status}</span>
          </div>
        }
      />
    );
  } else if (phase === 'run') {
    dock = <SolverProgress progress={progress} onCancel={backToB} maxSeconds={fl ? 10 : setup.simulations <= 300 ? 8 : setup.simulations <= 800 ? 20 : 45} />;
  } else {
    dock = (
      <div className="flex flex-col gap-3">
        {verdict && (
          <div className={`rounded-[20px] px-3.5 py-2.5 ${verdict.tie ? 'bg-sunken' : 'bg-accent-soft'}`}>
            <div className="title-serif text-[19px] leading-tight">{verdict.head}</div>
            {verdict.sub && <div className="mt-0.5 text-[12px] font-medium text-ink-2">{verdict.sub}</div>}
            {verdict.toBest && <div className="mt-0.5 text-[12px] font-semibold text-gold">{verdict.toBest}</div>}
          </div>
        )}
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${picks.length}, minmax(0, 1fr))` }}>
          {picks.map((p) => {
            const o = optOf(p);
            const win = verdict?.winner && o === verdict.winner;
            const isBest = p === 'best' || bestIs === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  haptic(4);
                  setPick(p);
                }}
                className={`flex flex-col items-center gap-1.5 rounded-[18px] px-1.5 py-2 transition-[transform,box-shadow] duration-200 active:scale-[0.97] ${
                  pick === p ? 'bg-surface shadow-[0_0_0_2px_var(--accent)]' : 'bg-sunken/70'
                }`}
              >
                <span className="flex items-center gap-1 text-[12px] font-extrabold">
                  {p === 'best' ? <span className="text-gold">★ Bästa</span> : <span>{p.toUpperCase()}</span>}
                  {p !== 'best' && isBest && <span className="text-gold">★</span>}
                  {win && <span className="rounded-full bg-accent px-1.5 text-[9.5px] text-white">vinner</span>}
                </span>
                <MiniBoard board={boardOf(o)} w={picks.length === 3 ? 17 : 22} />
                <span className="text-[17px] font-extrabold tabular text-ink">{o ? evFmt.format(o.ev) : '–'}</span>
                {!fl ? (
                  <span className="text-[10.5px] font-semibold leading-tight text-ink-3 tabular">
                    Foul {pct(o?.foulProbability)} · FL {pct(o?.flProbability)}
                  </span>
                ) : flFouled(o) ? (
                  <span className="text-[10.5px] font-bold text-danger">✕ Foul</span>
                ) : (
                  o?.repeatFL && <span className="text-[10.5px] font-bold text-fl">★ Repeat-FL</span>
                )}
              </button>
            );
          })}
        </div>
        {!canKeep && <p className="text-[11.5px] text-ink-3">Töm ditt bräde (Ny hand) för att kunna lägga ut en uppställning.</p>}
        <div className="flex flex-wrap gap-2">
          {picks.map((p) => {
            const o = optOf(p);
            return (
              <button
                key={p}
                type="button"
                disabled={!o || !canKeep}
                onClick={() => {
                  if (!o) return;
                  haptic([10, 30, 14]);
                  onKeep(p === 'a' ? a : p === 'b' ? mbB.move : { placements: o.placements, discards: o.discards });
                }}
                className={`${p === pick ? 'btn-primary' : 'btn-ghost'} h-11 flex-1 rounded-full px-3 text-[13px] font-bold`}
              >
                {fl ? 'Lägg ut' : 'Behåll'} {p === 'best' ? '★' : p.toUpperCase()}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => setPhase('b')} className="self-center px-2 py-1 text-[12.5px] font-bold text-accent-ink">
          ← Ändra B och jämför igen
        </button>
      </div>
    );
  }

  return (
    <DragProvider onDrop={active.drop}>
      <DockLayout dock={dock}>
        <div className="glass flex items-center gap-3 rounded-[20px] px-3.5 py-2">
          <div className="min-w-0 flex-1">
            <div className="title-serif text-[19px] leading-tight">Jämför läggningar</div>
            <div className="text-[11.5px] font-medium text-ink-3">{fl ? `Fantasy Land · ${hand.length} kort` : 'Vanlig hand'}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Stäng jämförelsen" className="btn-ghost flex h-9 w-9 items-center justify-center rounded-full">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {phase === 'b' && (
          <Segmented<'a' | 'b'>
            size="sm"
            ariaLabel="Visa läggning"
            value={peekA ? 'a' : 'b'}
            onChange={(v) => {
              haptic(4);
              setPeekA(v === 'a');
            }}
            options={[
              { value: 'a', label: 'Titta på A' },
              { value: 'b', label: 'Ändra B' },
            ]}
          />
        )}

        <div className="px-1 -mb-1">
          <span className="eyebrow">{label}</span>
        </div>
        <BoardView
          board={shown}
          recent={recent}
          heldCard={interactive ? active.heldCard : null}
          interactive={interactive}
          onPlace={active.placeAt}
          onRemove={interactive ? active.remove : undefined}
          canRemove={active.isMine}
          maxCardWidth={84}
        />
        {phase === 'b' && !peekA && <p className="px-1 text-[11.5px] text-ink-3">Dra ett kort till en annan rad, eller tryck två gånger på det för att ta tillbaka det. ↶ återställer till A.</p>}
        {setup.opponentBoard && (
          <>
            <div className="px-1 -mb-1 mt-1">
              <span className="eyebrow">Motståndaren</span>
            </div>
            <div className="opacity-85">
              <BoardView board={setup.opponentBoard} maxCardWidth={36} />
            </div>
          </>
        )}
      </DockLayout>
    </DragProvider>
  );
}

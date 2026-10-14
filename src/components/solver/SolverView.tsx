// ============================================================
// SolverView.tsx — Hela Solver-fliken
// ============================================================
//
// Layout (mobil, stående):
//   [Läge: Vanlig hand | Fantasy Land]
//   [Bräde (eller "Din hand" i FL)]
//   Öppningen är inget eget läge: tomt bräde = öppningshand (upp till 5 kort).
//   ─── fast panel längst ner ("dock") ───
//   [Din hand]  [4×13-rutnät]  [Joker] [Beräkna]
//   Under beräkning: progress + Avbryt. Efter: resultatlistan.
//
// Desktop / liggande telefon ("wide"): två kolumner, docken till höger.
//
// Flöde i Normal-läget:
//   - Tomt bräde → första handen: välj upp till 5 kort till handen.
//     "Beräkna" ger bästa öppning och "Lägg så här" lägger ut alla.
//   - Därefter ett kort i taget: tryck kort → tryck/dra till rad.
//   - Solverns förslag syns som spökkort direkt på brädet.
//
// Jämför (CompareView): när ett helt drag ligger på brädet (öppningen,
// ett kort, eller Pineapple: två kort + det tredje kvar i handen) dyker
// "⇄ Jämför mot…" upp. Draget hittas bakifrån i _history (lastMove).
// I Fantasy Land: "⇄ Lägg själv och jämför" när handen är full.
// ============================================================

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Board, Card, FLCardCount, RowName, SolverMode } from '../../engine/types';
import { createEmptyBoard } from '../../engine/types';
import type { DetailedPlacementOption } from '../../solver/solver';
import { useGameStore } from '../../store/gameStore';
import { useSolver } from '../../hooks/useSolver';
import { useSwipeDown } from '../../hooks/useSwipeDown';
import { DragProvider } from '../dnd/DragContext';
import type { BoardSlot, DropTarget } from '../dnd/dragCore';
import BoardView from '../board/BoardView';
import ShareBoards from '../share/ShareBoards';
import type { ShareBoard, ShareHand } from '../../share/boardImage';
import { applyMove as applyPlacements, cloneBoard, placementsOn, type Move } from '../../training/moves';
import CompareView, { type CompareSetup } from './CompareView';
import CardGrid, { JokerButton, type TileState } from '../cards/CardGrid';
import HandTray from '../cards/HandTray';
import SortButtons from '../cards/SortButtons';
import { sortOrder, type SortMode } from '../cards/handSort';
import PlayingCard from '../cards/PlayingCard';
import { haptic, sameCard } from '../cards/cardStyle';
import Segmented from '../ui/Segmented';
import ResultsPanel, { SolverProgress } from './ResultsPanel';
import ResultBoardPreview from './ResultBoardPreview';
import { simPreset } from './simPresets';

const ROWS: RowName[] = ['top', 'middle', 'bottom'];

function countPlaced(board: Board) {
  return ROWS.reduce((n, r) => n + board[r].cards.filter((c) => c !== null).length, 0);
}

function cardKey(c: Card) {
  return c.kind === 'joker' ? 'JK' : c.rank + c.suit;
}

type HistoryRec = { row: RowName; slotIndex: number; card: Card; player: 'me' | 'opponent' };

/**
 * Det senaste hela draget på mitt bräde, eller null:
 *  - öppningen: exakt 5 kort ute, inget kvar i handen
 *  - därefter 1 kort (Pineapple: 2 kort + kortet som är kvar i handen = kastas)
 * Korten tas bakifrån ur historiken och måste fortfarande ligga där.
 */
function lastMove(board: Board, history: HistoryRec[], tray: Card[], held: Card | null, pineapple: boolean): { base: Board; hand: Card[]; place: number; a: Move } | null {
  if (held) return null;
  const placed = countPlaced(board);
  const mine = history.filter((h) => h.player === 'me');
  let k: number;
  let discards: Card[] = [];
  if (placed === 5 && mine.length === 5 && tray.length === 0) k = 5;
  else if (placed > 5 && pineapple && tray.length === 1) {
    k = 2;
    discards = [tray[0]];
  } else if (placed > 5 && !pineapple && tray.length === 0) k = 1;
  else return null;
  const recs = mine.slice(-k);
  if (recs.length < k || !recs.every((r) => sameCard(board[r.row].cards[r.slotIndex], r.card))) return null;
  const base = cloneBoard(board);
  for (const r of recs) base[r.row].cards[r.slotIndex] = null;
  return {
    base,
    hand: [...recs.map((r) => r.card), ...discards],
    place: k,
    a: { placements: recs.map((r) => ({ card: r.card, row: r.row, slotIndex: r.slotIndex })), discards },
  };
}

interface SolverViewProps {
  simulations: number;
}

export default function SolverView({ simulations }: SolverViewProps) {
  const g = useGameStore();
  const {
    myBoard, opponentBoard, activePlayer, setActivePlayer, selectedCard, selectCard, clearSelectedCard,
    removeCard, undoLastPlacement, resetGame, usedCards, usedJokers, deadCards, variant, phase,
    myFouled, myRoyalties, myHandDescriptions, isFantasyLand, fantasyLandCards, solverMode, setSolverMode,
    selectedCards, flCardCount, setFLCardCount, toggleCardSelection, addSelectedCard, removeSelectedCardAt,
    clearSelectedCards, _history,
  } = g;

  const { result, isLoading, error, progress, runSolver, cancelSolver, clearResult } = useSolver();
  const [previewIndex, setPreviewIndex] = useState(0);
  const [usedOpp, setUsedOpp] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  // FL-handens visningsordning (ändrar inte handen). Börjar osorterad.
  const [flSort, setFlSort] = useState<SortMode>('dealt');
  const [compare, setCompare] = useState<CompareSetup | null>(null);

  const placed = countPlaced(myBoard);
  const oppPlaced = countPlaced(opponentBoard);
  const normal = solverMode === 'normal';
  const onMine = activePlayer === 'me';

  // Handen i Normal-läget: valda kort (första handen) + ev. lyft kort
  const trayActive = normal && onMine && (placed === 0 || selectedCards.length > 0);
  const trayCapacity = placed === 0 ? 5 : selectedCards.length;

  const handCards: Card[] = useMemo(() => {
    if (!normal) return selectedCards;
    if (!trayActive) return selectedCard ? [selectedCard] : [];
    const inTray = selectedCard && selectedCards.some((c) => sameCard(c, selectedCard));
    return selectedCard && !inTray ? [...selectedCards, selectedCard] : selectedCards;
  }, [normal, trayActive, selectedCards, selectedCard]);

  const handKey = handCards.map(cardKey).sort().join(',');
  // Tom FL-hand → nästa hand börjar osorterad
  if (selectedCards.length === 0 && flSort !== 'dealt') setFlSort('dealt');
  const flOrder = useMemo(() => sortOrder(selectedCards, normal ? 'dealt' : flSort), [selectedCards, normal, flSort]);

  // Resultatet gäller ett visst läge — ändras brädet, handen eller inställningarna rensas det
  useEffect(() => {
    clearResult();
  }, [myBoard, opponentBoard, handKey, solverMode, variant, flCardCount, clearResult]);

  useEffect(() => setPreviewIndex(0), [result]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 1800);
    return () => window.clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (!result) return;
    haptic([8, 40, 8]);
    // Se till att brädet (med spökkorten) syns ovanför panelen:
    // mät brädets underkant mot panelens överkant och scrolla mellanskillnaden.
    const t = window.setTimeout(() => {
      const b = boardWrapRef.current?.getBoundingClientRect();
      const d = dockRef.current?.getBoundingClientRect();
      if (!b || !d || window.matchMedia('(min-width: 1024px)').matches) return;
      const overlap = b.bottom - d.top + 10;
      if (overlap > 0) window.scrollBy({ top: overlap, behavior: 'smooth' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [result]);

  // ---------- Kortval ----------

  const jokersInHand = handCards.filter((c) => c.kind === 'joker').length;
  const jokersLeft = 2 - usedJokers - jokersInHand;
  const heldIsJoker = selectedCard?.kind === 'joker';

  const isUsed = useCallback(
    (card: Card) => card.kind === 'card' && usedCards.some((u) => sameCard(u, card)),
    [usedCards],
  );

  const stateOf = useCallback(
    (card: Card): TileState => {
      if (isUsed(card)) return 'used';
      if (normal && selectedCard && sameCard(selectedCard, card) && card.kind === 'card') return 'held';
      if ((trayActive || !normal) && selectedCards.some((c) => sameCard(c, card))) return 'marked';
      return 'free';
    },
    [isUsed, normal, selectedCard, trayActive, selectedCards],
  );

  const handFull = !normal ? selectedCards.length >= (solverMode === 'fantasyLand' ? flCardCount : 5) : selectedCards.length >= 5;

  const tapCard = (card: Card) => {
    haptic(5);
    // Fantasy Land: bygg en hand
    if (!normal) {
      if (card.kind === 'joker') {
        if (jokersLeft > 0 && !handFull) addSelectedCard(card);
        else if (handFull) setFlash('Handen är full');
        return;
      }
      if (!selectedCards.some((c) => sameCard(c, card)) && handFull) {
        setFlash(`Max ${solverMode === 'fantasyLand' ? flCardCount : 5} kort`);
        return;
      }
      toggleCardSelection(card);
      return;
    }

    // Normal, första handen (tomt bräde): samla upp till 5 kort
    if (trayActive && placed === 0) {
      if (card.kind === 'joker') {
        if (jokersLeft > 0 && !handFull) addSelectedCard(card);
        else if (handFull) setFlash('Max 5 kort i första handen');
        return;
      }
      const inTray = selectedCards.some((c) => sameCard(c, card));
      if (!inTray && handFull) {
        setFlash('Max 5 kort i första handen');
        return;
      }
      if (inTray && sameCard(selectedCard, card)) clearSelectedCard();
      toggleCardSelection(card);
      return;
    }

    // Normal: ett kort i taget — tryck igen för att släppa
    if (card.kind === 'joker' ? heldIsJoker : sameCard(selectedCard, card)) clearSelectedCard();
    else selectCard(card);
  };

  const tapHandCard = (i: number) => {
    const card = handCards[i];
    haptic(5);
    if (!normal) {
      removeSelectedCardAt(i);
      return;
    }
    // Normal: lyft/sänk kortet för tryck-att-placera
    if (sameCard(selectedCard, card) && (card.kind === 'card' || heldIsJoker)) clearSelectedCard();
    else selectCard(card);
  };

  /** Lägg ett kort på aktivt bräde och plocka bort det ur handen */
  const placeOn = useCallback(
    (card: Card, row: RowName, slot: number) => {
      const st = useGameStore.getState();
      const board = st.activePlayer === 'me' ? st.myBoard : st.opponentBoard;
      if (board[row].cards[slot] !== null) return false;
      st.selectCard(card);
      st.placeCard(row, slot);
      const idx = st.selectedCards.findIndex((c) => sameCard(c, card));
      if (idx >= 0) useGameStore.getState().removeSelectedCardAt(idx);
      haptic(12);
      return true;
    },
    [],
  );

  /** Flytta ett lagt kort: ledig plats = flytta, annat kort = byt plats, utanför brädet = ta bort */
  const moveOnBoard = useCallback((from: BoardSlot, t: DropTarget | null) => {
    const st = useGameStore.getState();
    const player = st.activePlayer;
    const board = player === 'me' ? st.myBoard : st.opponentBoard;
    const card = board[from.row].cards[from.slot];
    if (!card) return false;
    if (!t || (!t.row && !t.board)) {
      st.removeCard(from.row, from.slot, player);
      haptic(12);
      return true;
    }
    if (!t.row) return false; // mellan raderna: inget händer
    const row = t.row;
    let slot = t.slot ?? -1;
    let other: Card | null = null;
    if (t.filled !== undefined) {
      if (row === from.row && t.filled === from.slot) return false;
      other = board[row].cards[t.filled];
      slot = t.filled;
    }
    if (slot < 0) slot = board[row].cards.findIndex((c) => c === null);
    if (slot < 0) {
      haptic([4, 30, 4]);
      return false;
    }
    // Lägg ut via storen (selectCard + placeCard) och behåll ett ev. lyft kort
    const held = st.selectedCard;
    const put = (c: Card, r: RowName, i: number) => {
      useGameStore.getState().selectCard(c);
      useGameStore.getState().placeCard(r, i);
    };
    st.removeCard(from.row, from.slot, player);
    if (other) {
      useGameStore.getState().removeCard(row, slot, player);
      put(card, row, slot);
      put(other, from.row, from.slot);
    } else {
      put(card, row, slot);
    }
    if (held) useGameStore.getState().selectCard(held);
    else useGameStore.getState().clearSelectedCard();
    haptic(12);
    return true;
  }, []);

  const onDrop = useCallback(
    (card: Card, t: DropTarget | null, source?: BoardSlot) => {
      if (source) return moveOnBoard(source, t);
      if (!t) return false;
      const st = useGameStore.getState();

      // Släppt på "Din hand": lägg till kortet i handen (öppningshand eller FL-hand)
      if (t.hand) {
        const fl = st.solverMode === 'fantasyLand';
        const accepts = fl || (st.solverMode === 'normal' && st.activePlayer === 'me' && countPlaced(st.myBoard) === 0);
        if (!accepts) return false;
        const max = fl ? st.flCardCount : 5;
        if (card.kind === 'card' && st.selectedCards.some((c) => sameCard(c, card))) return false;
        if (card.kind === 'joker' && st.usedJokers + st.selectedCards.filter((c) => c.kind === 'joker').length >= 2) return false;
        if (st.selectedCards.length >= max) {
          setFlash('Handen är full');
          haptic([4, 30, 4]);
          return false;
        }
        st.addSelectedCard(card);
        haptic(12);
        return true;
      }

      if (st.solverMode !== 'normal' || !t.row) return false;
      const board = st.activePlayer === 'me' ? st.myBoard : st.opponentBoard;
      const slot = t.slot ?? board[t.row].cards.findIndex((c) => c === null);
      if (slot < 0) {
        haptic([4, 30, 4]);
        return false;
      }
      return placeOn(card, t.row, slot);
    },
    [placeOn, moveOnBoard],
  );

  const onBoardPlace = (row: RowName, slot: number) => {
    if (selectedCard) placeOn(selectedCard, row, slot);
  };

  // ---------- Solver ----------

  const canRun = !isLoading && (normal ? onMine && handCards.length > 0 : selectedCards.length > 0);
  const preset = simPreset(simulations);

  const run = () => {
    if (!canRun) return;
    haptic(8);
    const options = { simulations };
    if (!normal) {
      setUsedOpp(false);
      runSolver({ board: createEmptyBoard(), cards: selectedCards, deadCards, variant, options, mode: solverMode });
      return;
    }
    const hasOpp = oppPlaced > 0;
    setUsedOpp(hasOpp);
    runSolver({
      board: myBoard,
      cards: handCards,
      deadCards,
      variant,
      opponentBoard: hasOpp ? opponentBoard : undefined,
      options,
      mode: 'normal',
    });
  };

  const canApply = normal ? onMine : placed === 0;

  const apply = (opt: DetailedPlacementOption) => {
    const st = useGameStore.getState();
    if (!normal) {
      st.setSolverMode('normal');
    }
    st.setActivePlayer('me');
    for (const p of opt.placements) {
      useGameStore.getState().selectCard(p.card);
      useGameStore.getState().placeCard(p.row, p.slotIndex);
    }
    useGameStore.getState().clearSelectedCards();
    useGameStore.getState().clearSelectedCard();
    haptic([10, 30, 14]);
  };

  // ---------- Jämför ----------
  const seed = normal && onMine ? lastMove(myBoard, _history, selectedCards, selectedCard, variant === 'pineapple') : null;
  const flFull = !normal && selectedCards.length === flCardCount;

  const startCompare = () => {
    haptic(8);
    clearResult();
    if (seed) {
      setCompare({ mode: 'normal', ...seed, deadCards, variant, opponentBoard: oppPlaced > 0 ? opponentBoard : undefined, simulations });
    } else if (flFull) {
      setCompare({ mode: 'fantasyLand', base: createEmptyBoard(), hand: selectedCards, place: 13, a: null, deadCards: [], variant, simulations });
    }
  };

  /** Lägg den valda läggningen på brädet (Vanlig hand: byt ut A; FL: lägg ut som "Lägg så här") */
  const keepCompared = (m: Move) => {
    const c = compare;
    setCompare(null);
    if (!c) return;
    if (c.mode === 'fantasyLand') {
      apply({ placements: m.placements, discards: m.discards } as DetailedPlacementOption);
      return;
    }
    const st = useGameStore.getState();
    st.setActivePlayer('me');
    for (const p of c.a!.placements) useGameStore.getState().removeCard(p.row, p.slotIndex, 'me');
    for (const p of m.placements) {
      useGameStore.getState().selectCard(p.card);
      useGameStore.getState().placeCard(p.row, p.slotIndex);
    }
    // Pineapple: kortet som kastas ligger kvar i handen, som efter ett vanligt drag
    useGameStore.getState().clearSelectedCards();
    for (const d of m.discards) useGameStore.getState().addSelectedCard(d);
    useGameStore.getState().clearSelectedCard();
  };

  const newHand = () => {
    cancelSolver();
    resetGame();
    clearResult();
    haptic(10);
  };

  // Spökkort för förhandsvisat alternativ (bara Normal-läget, på mitt bräde)
  const ghosts = normal && onMine && result && !isLoading ? (result.options[previewIndex]?.placements ?? []) : [];

  // ---------- Dela som bild ----------
  // Med ett förslag: förslaget inlagt på mitt bräde (streckade kort) + EV.
  // Utan förslag: läget + korten att lägga, som ett pussel ("Hur lägger du?").
  const shareBoards = (): ShareBoard[] => {
    const opt = showResults ? result?.options[previewIndex] : undefined;
    const mine: ShareBoard = opt
      ? {
          name: 'Du',
          board: opt.resultBoard ?? applyPlacements(myBoard, opt.placements),
          // Öppning / Fantasy Land = hela brädet nytt, då streckas inget
          recent: normal && placed > 0 ? placementsOn(myBoard, opt.placements).map((p) => ({ row: p.row, slot: p.slotIndex })) : undefined,
        }
      : { name: 'Du', board: myBoard, fouled: myFouled };
    return [mine, ...(oppPlaced > 0 ? [{ name: 'Motståndare', board: opponentBoard }] : [])];
  };
  const shareHand = (): ShareHand | undefined => {
    const opt = showResults ? result?.options[previewIndex] : undefined;
    if (opt) {
      const ev = new Intl.NumberFormat('sv-SE', { signDisplay: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(opt.ev);
      const pct = (p?: number) => (p === undefined ? '' : `${Math.round(p * 100)} %`);
      return {
        prefix: 'SOLVERNS FÖRSLAG',
        label: [
          `EV ${ev}`,
          normal && opt.flProbability !== undefined ? `FL ${pct(opt.flProbability)}` : '',
          normal && opt.foulProbability !== undefined ? `Foul ${pct(opt.foulProbability)}` : '',
          opt.discards.length ? 'kastar' : '',
        ]
          .filter(Boolean)
          .join(' · '),
        cards: opt.discards,
        note: previewIndex === 0 ? '★ Bästa draget' : `Alternativ ${previewIndex + 1}`,
      };
    }
    if (handCards.length === 0) return undefined;
    const n = handCards.length;
    return {
      cards: handCards,
      label: !normal ? `Fantasy Land · ${n} kort` : variant === 'pineapple' && placed > 0 ? 'Lägg 2, kasta 1' : `Lägg ${n === 1 ? '1 kort' : `${n} kort`}`,
    };
  };

  // ---------- Dock: mät höjd så att sidan får plats ovanför ----------

  const dockRef = useRef<HTMLDivElement>(null);
  const boardWrapRef = useRef<HTMLDivElement>(null);
  const [dockH, setDockH] = useState(280);
  useLayoutEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDockH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const swipe = useSwipeDown<HTMLDivElement>({ onClose: clearResult, enabled: !!result && !isLoading });
  useEffect(() => {
    swipe.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, isLoading]);

  const showResults = !!result && !isLoading;
  const resultsScrollRef = useRef<HTMLDivElement>(null);
  const flLabel: Record<FLCardCount, string> = { 13: 'QQ', 14: 'KK', 15: 'AA', 16: 'Triss' };
  const runLabel = normal ? (placed === 0 && handCards.length > 1 ? 'Bästa öppning' : 'Beräkna bästa drag') : 'Lös Fantasy Land';
  const needed = solverMode === 'fantasyLand' ? flCardCount : 5;

  const hint = (() => {
    if (!normal) return `${selectedCards.length} av ${needed} kort valda`;
    if (!onMine) return selectedCard ? 'Tryck på en plats på motståndarens bräde' : 'Välj motståndarens kort';
    if (placed === 0 && selectedCards.length === 0 && !selectedCard) return 'Första handen: välj upp till 5 kort';
    if (selectedCard) return 'Tryck på en rad – eller dra kortet dit';
    if (trayActive) return 'Tryck ett kort för att lägga det själv, eller beräkna';
    if (phase === 'scoring') return 'Handen är klar';
    return 'Välj ditt nästa kort';
  })();

  if (compare) {
    return <CompareView setup={compare} onClose={() => setCompare(null)} onKeep={keepCompared} canKeep={compare.mode === 'normal' || placed === 0} />;
  }

  return (
    <DragProvider onDrop={onDrop}>
      <div
        className="wide:grid wide:grid-cols-[minmax(0,1fr)_minmax(300px,420px)] wide:gap-5 wide:items-start"
        style={{ '--dock-h': `${dockH}px` } as React.CSSProperties}
      >
        {/* ===== Huvudyta ===== */}
        <section className="flex flex-col gap-3 pb-[calc(var(--dock-h)+16px)] wide:pb-4 min-w-0">
          <Segmented<SolverMode>
            ariaLabel="Solver-läge"
            variant="brand"
            value={solverMode}
            onChange={(m) => {
              haptic(4);
              setSolverMode(m);
            }}
            disabled={isLoading}
            options={[
              { value: 'normal', label: 'Vanlig hand' },
              { value: 'fantasyLand', label: 'Fantasy Land' },
            ]}
          />

          {normal ? (
            <>
              {/* Mitt / motståndarens bräde */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Segmented<'me' | 'opponent'>
                    size="sm"
                    ariaLabel="Vilket bräde"
                    value={activePlayer}
                    onChange={(p) => {
                      haptic(4);
                      clearSelectedCard();
                      setActivePlayer(p);
                    }}
                    options={[
                      { value: 'me', label: `Mitt bräde${placed ? ` · ${placed}` : ''}` },
                      { value: 'opponent', label: `Motståndare${oppPlaced ? ` · ${oppPlaced}` : ''}` },
                    ]}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    undoLastPlacement();
                    haptic(6);
                  }}
                  disabled={_history.length === 0 || isLoading}
                  aria-label="Ångra senaste kortet"
                  className="btn-ghost h-10 rounded-full px-3.5 text-[13px] font-bold"
                >
                  ↶ Ångra
                </button>
                <button
                  type="button"
                  onClick={newHand}
                  className="btn-ghost h-10 rounded-full px-3.5 text-[13px] font-bold"
                >
                  Ny hand
                </button>
              </div>

              {onMine && (
                <div className="px-1 -mb-1">
                  <span className="eyebrow">{placed === 0 ? 'Öppningshand' : placed === 13 ? 'Klar hand' : `${placed} av 13 kort`}</span>
                </div>
              )}
              <div ref={boardWrapRef} className="relative">
              {(placed > 0 || oppPlaced > 0 || handCards.length > 0) && <ShareBoards boards={shareBoards} hand={shareHand} />}
              <BoardView
                key={activePlayer}
                board={onMine ? myBoard : opponentBoard}
                heldCard={showResults ? null : selectedCard}
                interactive
                onPlace={onBoardPlace}
                onRemove={(row, slot) => removeCard(row, slot, activePlayer)}
                ghosts={ghosts}
                fouled={onMine && myFouled}
                maxCardWidth={92}
              />
              </div>

              {/* Litet förhandsbräde för den andra spelaren */}
              {(onMine ? oppPlaced : placed) > 0 && (
                <button
                  type="button"
                  onClick={() => setActivePlayer(onMine ? 'opponent' : 'me')}
                  className="glass flex items-center gap-3 self-start rounded-[20px] px-3 py-2 text-left transition-transform duration-200 active:scale-[0.97]"
                >
                  <ResultBoardPreview board={onMine ? opponentBoard : myBoard} cardWidth={16} />
                  <span className="text-[11px] font-semibold text-ink-3">
                    {onMine ? 'Motståndaren' : 'Mitt bräde'}
                    <br />
                    <span className="text-accent-ink">Visa →</span>
                  </span>
                </button>
              )}

              {/* Färdig hand */}
              {phase === 'scoring' && onMine && (
                <div
                  className={`glass overflow-hidden rounded-[24px] p-4 animate-rise-in ${myFouled ? '!bg-danger-soft' : ''}`}
                  role="status"
                >
                  <div className={`font-serif text-[20px] font-extrabold ${myFouled ? 'text-danger' : 'title-serif'}`}>
                    {myFouled ? '✕ Foul — raderna ligger i fel ordning' : '✓ Komplett hand'}
                  </div>
                  {!myFouled && (
                    <dl className="mt-2 grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1 text-[13px]">
                      {(['top', 'middle', 'bottom'] as const).map((r) => (
                        <div key={r} className="contents">
                          <dt className="font-semibold text-ink-2">{r === 'top' ? 'Toppen' : r === 'middle' ? 'Mitten' : 'Botten'}</dt>
                          <dd className="text-ink">{myHandDescriptions[r]}</dd>
                          <dd className="text-right font-bold text-gold tabular">{myRoyalties[r] > 0 ? `+${myRoyalties[r]}p` : ''}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {!myFouled && myRoyalties.total > 0 && (
                    <div className="mt-2 text-[14px] font-bold text-gold">Royalties totalt: +{myRoyalties.total}p</div>
                  )}
                  {isFantasyLand && (
                    <div className="mt-3 rounded-2xl px-3.5 py-2.5 text-[14px] font-bold text-white shadow-[var(--glow-fl)] animate-badge-in" style={{ background: 'var(--grad-fl)' }}>
                      ★ Fantasy Land! Du får {fantasyLandCards} kort nästa hand.
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={newHand}
                    className="btn-primary mt-3 w-full rounded-full py-3 text-[15px] font-bold"
                  >
                    Ny hand
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {solverMode === 'fantasyLand' && (
                <Segmented<FLCardCount>
                  size="sm"
                  ariaLabel="Antal kort i Fantasy Land"
                  value={flCardCount}
                  onChange={setFLCardCount}
                  disabled={isLoading}
                  options={([13, 14, 15, 16] as FLCardCount[]).map((n) => ({ value: n, label: `${n} kort`, sub: flLabel[n] }))}
                />
              )}
              <div className="glass rounded-[24px] p-4">
                <div className="mb-2.5 flex items-baseline justify-between">
                  <h2 className="title-serif text-[21px]">Din Fantasy Land-hand</h2>
                  <span className="text-[12px] font-bold tabular text-ink-3">
                    {selectedCards.length}/{needed}
                  </span>
                </div>
                <HandTray
                  cards={flOrder.map((i) => selectedCards[i])}
                  capacity={needed}
                  onTapCard={(i) => tapHandCard(flOrder[i])}
                  dropZone
                  wrap
                  cardWidth="min(44px, calc((100vw - 100px) / 8))"
                />
                <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-ink-3">
                  <span>Tryck på ett kort för att ta bort det</span>
                  {selectedCards.length > 0 && (
                    <button type="button" onClick={clearSelectedCards} className="font-bold text-danger">
                      Rensa
                    </button>
                  )}
                </div>
                {selectedCards.length > 1 && (
                  <div className="mt-2">
                    <SortButtons mode={flSort} onChange={setFlSort} />
                  </div>
                )}
              </div>
              {flFull && (
                <button type="button" onClick={startCompare} disabled={isLoading} className="btn-ghost h-11 rounded-full text-[13.5px] font-bold">
                  ⇄ Lägg själv och jämför
                </button>
              )}
              {solverMode === 'fantasyLand' && (
                <p className="px-1 text-[12px] text-ink-2">
                  QQ i topp = 13 kort, KK = 14, AA = 15, triss = 16. Solvern går igenom alla uppställningar exakt.
                </p>
              )}
              {!canApply && result && (
                <p className="px-1 text-[12px] text-ink-3">Töm ditt bräde (Ny hand) för att kunna lägga ut ett förslag.</p>
              )}
            </>
          )}
        </section>

        {/* ===== Dock ===== */}
        <aside
          ref={dockRef}
          className="fixed inset-x-2 bottom-[max(8px,env(safe-area-inset-bottom))] z-30 wide:sticky wide:inset-x-auto wide:bottom-auto wide:top-[84px] wide:z-0"
        >
          <div
            ref={swipe.ref}
            {...swipe.handlers}
            className="glass mx-auto max-w-xl wide:max-w-none rounded-[28px] !shadow-[var(--shadow-big)] overflow-hidden wide:max-h-[calc(100dvh-100px)] wide:overflow-y-auto"
            style={{ touchAction: showResults ? 'pan-y' : undefined }}
          >
            {showResults ? (
              <div className="flex flex-col">
                <div className="flex justify-center pt-2 pb-1.5 wide:hidden" style={{ touchAction: 'none' }}>
                  <div className="h-1.5 w-10 rounded-full bg-line-strong" />
                </div>
                <div ref={resultsScrollRef} className="max-h-[58dvh] wide:max-h-none overflow-y-auto overscroll-contain px-3 pb-2 wide:pt-3">
                  <ResultsPanel
                    result={result}
                    mode={solverMode}
                    previewIndex={previewIndex}
                    onPreview={(i) => {
                      haptic(4);
                      setPreviewIndex(i);
                      resultsScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onApply={canApply ? apply : undefined}
                    onClose={clearResult}
                    usedOpponentBoard={usedOpp}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 px-3 pt-3 pb-3">
                {isLoading ? (
                  <SolverProgress progress={progress} onCancel={cancelSolver} maxSeconds={solverMode === 'fantasyLand' ? 10 : preset.seconds} />
                ) : (
                  <>
                    {/* Hand + tips */}
                    <div className="flex min-h-[46px] items-center gap-2.5">
                      {normal && handCards.length > 0 && (
                        <HandTray
                          cards={handCards}
                          capacity={trayActive ? trayCapacity : 1}
                          heldIndex={selectedCard ? handCards.findIndex((c) => sameCard(c, selectedCard)) : -1}
                          draggable
                          dropZone={trayActive && placed === 0}
                          onTapCard={tapHandCard}
                          cardWidth="32px"
                        />
                      )}
                      {normal && handCards.length === 0 && placed === 0 && onMine && (
                        <HandTray cards={[]} capacity={5} onTapCard={() => {}} cardWidth="32px" dropZone />
                      )}
                      {!normal && selectedCards.length > 0 && (
                        <div className="flex -space-x-3">
                          {selectedCards.slice(-6).map((c, i) => (
                            <PlayingCard key={i} card={c} width={26} compact />
                          ))}
                        </div>
                      )}
                      <span
                        className={`flex-1 text-[12px] font-semibold leading-snug ${flash ? 'text-danger' : 'text-ink-2'}`}
                        aria-live="polite"
                      >
                        {flash ?? hint}
                      </span>
                    </div>

                    {seed && (
                      <button type="button" onClick={startCompare} className="btn-ghost h-10 rounded-full text-[13px] font-bold animate-fade-in">
                        ⇄ Jämför mot… <span className="font-semibold text-ink-3">ändra draget, se vilket som är bäst</span>
                      </button>
                    )}

                    <CardGrid stateOf={stateOf} onTap={tapCard} draggable />

                    {error && (
                      <div className="rounded-2xl bg-danger-soft px-3.5 py-2.5 text-[13px] font-semibold text-danger animate-fade-in">{error}</div>
                    )}

                    <div className="flex gap-2">
                      <JokerButton
                        left={Math.max(0, jokersLeft)}
                        state={normal && heldIsJoker && !trayActive ? 'held' : 'free'}
                        draggable
                        onTap={tapCard}
                      />
                      <button
                        type="button"
                        onClick={run}
                        disabled={!canRun}
                        className="btn-primary h-12 flex-1 rounded-full text-[15px] font-bold"
                      >
                        ★ {runLabel}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="wide:hidden pb-2 text-center text-[10px] text-ink-3">Made by: David Hefner</div>
          </div>
        </aside>
      </div>
    </DragProvider>
  );
}

import { useState, useEffect, useCallback } from 'react';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import BoardView from './components/board/BoardView';
import CardPicker from './components/cards/CardPicker';
import SolverPanel from './components/solver/SolverPanel';
import SolverControls from './components/solver/SolverControls';
import ScoreTracker from './components/scoring/ScoreTracker';
import ScoreHistory from './components/scoring/ScoreHistory';
import SessionSummary from './components/scoring/SessionSummary';
import Bookkeeping from './components/bookkeeping/Bookkeeping';
import { useGameStore } from './store/gameStore';
import { useSolver } from './hooks/useSolver';
import type { RowName } from './engine/types';
import { createEmptyBoard } from './engine/types';

type Tab = 'solver' | 'score' | 'book';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('solver');

  const {
    myBoard,
    opponentBoard,
    activePlayer,
    setActivePlayer,
    selectedCard,
    usedCards,
    usedJokers,
    selectCard,
    placeCard,
    deadCards,
    variant,
    phase,
    removeCard,
    myFouled,
    myRoyalties,
    myHandDescriptions,
    isFantasyLand,
    fantasyLandCards,
    currentCards,
    solverMode,
    selectedCards,
    flCardCount,
    toggleCardSelection,
    clearSelectedCards,
  } = useGameStore();

  const { result, isLoading, error, lastSimulations, progress, runSolver, cancelSolver, clearResult } = useSolver();
  // Håller koll på om senaste solver-körning använde motståndarens bräde
  const [solverUsedOpponentBoard, setSolverUsedOpponentBoard] = useState(false);

  // --- Hantera slot-klick ---
  const handleSlotClick = (row: RowName, slotIndex: number) => {
    if (!selectedCard) return;
    placeCard(row, slotIndex);
  };

  const activeBoard = activePlayer === 'me' ? myBoard : opponentBoard;

  // Highlightade slots (lediga platser där kort kan placeras)
  const highlightedSlots = selectedCard
    ? (['top', 'middle', 'bottom'] as RowName[]).map((row) => ({
        row,
        slots: activeBoard[row].cards
          .map((c, i) => (c === null ? i : -1))
          .filter((i) => i >= 0),
      }))
    : [];

  // --- Kör solver ---
  const handleRunSolver = useCallback(
    (simulations: number) => {
      const solverOptions = {
        simulations,
        heuristicOnly: simulations <= 200,
        topCandidates: 50,
        maxMs: simulations >= 3000 ? 8000 : 5000,
      };

      // Opening-läge: kör med valda kort (max 5), tomt bräde
      if (solverMode === 'opening') {
        if (selectedCards.length === 0) return;
        setSolverUsedOpponentBoard(false);
        runSolver({
          board: createEmptyBoard(),
          cards: selectedCards,
          deadCards,
          variant,
          options: solverOptions,
          mode: 'opening',
        });
        return;
      }

      // Fantasy Land-läge: kör med valda kort (13–16), tomt bräde
      if (solverMode === 'fantasyLand') {
        if (selectedCards.length === 0) return;
        setSolverUsedOpponentBoard(false);
        runSolver({
          board: createEmptyBoard(),
          cards: selectedCards,
          deadCards,
          variant,
          options: solverOptions,
          mode: 'fantasyLand',
        });
        return;
      }

      // Normalt läge
      const hasOpponentCards = (['top', 'middle', 'bottom'] as const).some(
        (row) => opponentBoard[row].cards.some((c) => c !== null)
      );
      const effectiveOpponentBoard = hasOpponentCards ? opponentBoard : undefined;
      setSolverUsedOpponentBoard(hasOpponentCards);

      if (selectedCard) {
        runSolver({
          board: myBoard,
          cards: [selectedCard],
          deadCards,
          variant,
          opponentBoard: effectiveOpponentBoard,
          options: solverOptions,
          mode: 'normal',
        });
        return;
      }

      if (currentCards.length > 0) {
        runSolver({
          board: myBoard,
          cards: currentCards,
          deadCards,
          variant,
          opponentBoard: effectiveOpponentBoard,
          options: solverOptions,
          mode: 'normal',
        });
        return;
      }
    },
    [solverMode, selectedCards, selectedCard, currentCards, myBoard, opponentBoard, deadCards, variant, runSolver],
  );

  // --- Auto-rensa resultat vid nytt kort-val ---
  useEffect(() => {
    if (selectedCard) {
      clearResult();
    }
  }, [selectedCard, clearResult]);

  return (
    <div className="min-h-screen bg-[#0f1923] text-slate-200 flex flex-col">
      <Header />

      {/* Flikar */}
      <div className="flex border-b border-slate-700/60 bg-[#0d1f2d]">
        <button
          onClick={() => setActiveTab('solver')}
          className={`flex-1 sm:flex-none px-3 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition-colors border-b-2 ${
            activeTab === 'solver'
              ? 'border-green-500 text-green-400'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          ♠ Solver
        </button>
        <button
          onClick={() => setActiveTab('score')}
          className={`flex-1 sm:flex-none px-3 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition-colors border-b-2 ${
            activeTab === 'score'
              ? 'border-green-500 text-green-400'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Poängräknare
        </button>
        <button
          onClick={() => setActiveTab('book')}
          className={`flex-1 sm:flex-none px-3 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition-colors border-b-2 ${
            activeTab === 'book'
              ? 'border-green-500 text-green-400'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Bokföring
        </button>
      </div>

      <main className="flex-1 p-2 sm:p-4 max-w-5xl mx-auto w-full">

        {/* === SOLVER-FLIKEN === */}
        {activeTab === 'solver' && (
          <div className="flex flex-col gap-3 sm:gap-4 animate-fade-in">
            {/* Bräden — visas bara i normalt läge */}
            {solverMode === 'normal' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <BoardView
                    board={myBoard}
                    label="Ditt bräde"
                    isActive={activePlayer === 'me'}
                    onActivate={() => setActivePlayer('me')}
                    highlightedSlots={activePlayer === 'me' ? highlightedSlots : []}
                    onSlotClick={activePlayer === 'me' ? handleSlotClick : undefined}
                    onCardRemove={(row, slotIndex) => removeCard(row, slotIndex, 'me')}
                    isFouled={myFouled}
                    royalties={phase === 'scoring' ? myRoyalties : undefined}
                  />
                  <BoardView
                    board={opponentBoard}
                    label="Motståndarens bräde"
                    isActive={activePlayer === 'opponent'}
                    onActivate={() => setActivePlayer('opponent')}
                    highlightedSlots={activePlayer === 'opponent' ? highlightedSlots : []}
                    onSlotClick={activePlayer === 'opponent' ? handleSlotClick : undefined}
                    onCardRemove={(row, slotIndex) => removeCard(row, slotIndex, 'opponent')}
                  />
                </div>

                {/* Kort valt-meddelande */}
                {selectedCard && (
                  <div className="bg-green-900/20 border border-green-700/40 rounded-lg px-4 py-2 text-sm text-green-300">
                    Kort valt — klicka på en tom plats på{' '}
                    {activePlayer === 'me' ? 'ditt' : 'motståndarens'} bräde för att placera det.
                  </div>
                )}

                {/* Scoring-resultat vid komplett bräde */}
                {phase === 'scoring' && (
                  <div className={`rounded-lg px-4 py-3 border ${myFouled ? 'bg-red-900/20 border-red-700/40' : 'bg-green-900/20 border-green-700/40'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-lg ${myFouled ? 'text-red-400' : 'text-green-400'}`}>
                        {myFouled ? '✕' : '✓'}
                      </span>
                      <span className={`text-sm font-semibold ${myFouled ? 'text-red-300' : 'text-green-300'}`}>
                        {myFouled ? 'FOULED — Ogiltigt bräde' : 'Komplett hand'}
                      </span>
                    </div>
                    {!myFouled && (
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400">Topp: </span>
                          <span className="text-slate-200">{myHandDescriptions.top}</span>
                          {myRoyalties.top > 0 && <span className="text-yellow-400 ml-1">+{myRoyalties.top}p</span>}
                        </div>
                        <div>
                          <span className="text-slate-400">Mitten: </span>
                          <span className="text-slate-200">{myHandDescriptions.middle}</span>
                          {myRoyalties.middle > 0 && <span className="text-yellow-400 ml-1">+{myRoyalties.middle}p</span>}
                        </div>
                        <div>
                          <span className="text-slate-400">Botten: </span>
                          <span className="text-slate-200">{myHandDescriptions.bottom}</span>
                          {myRoyalties.bottom > 0 && <span className="text-yellow-400 ml-1">+{myRoyalties.bottom}p</span>}
                        </div>
                      </div>
                    )}
                    {!myFouled && myRoyalties.total > 0 && (
                      <div className="mt-2 text-sm text-yellow-300 font-semibold">
                        Totala royalties: +{myRoyalties.total}p
                      </div>
                    )}
                    {isFantasyLand && (
                      <div className="mt-2 text-sm text-purple-300 font-semibold">
                        Fantasy Land! Du får {fantasyLandCards} kort nästa hand.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Solver kontroller + panel */}
            <SolverControls
              isLoading={isLoading}
              onRunSolver={handleRunSolver}
              onCancelSolver={cancelSolver}
              onNewHand={clearResult}
            />

            <SolverPanel
              result={result}
              isLoading={isLoading}
              error={error}
              lastSimulations={lastSimulations}
              progress={progress}
              usedOpponentBoard={solverUsedOpponentBoard}
            />

            {/* Kortväljare */}
            <CardPicker
              usedCards={usedCards}
              usedJokers={usedJokers}
              selectedCard={selectedCard}
              onCardSelect={selectCard}
              multiSelect={solverMode !== 'normal'}
              selectedCards={selectedCards}
              onToggleCard={toggleCardSelection}
              maxCards={solverMode === 'fantasyLand' ? flCardCount : solverMode === 'opening' ? 5 : undefined}
              onRemoveSelectedCard={toggleCardSelection}
              onClearSelectedCards={clearSelectedCards}
            />
          </div>
        )}

        {/* === POÄNGRÄKNARE-FLIKEN === */}
        {activeTab === 'score' && (
          <div className="flex flex-col gap-3 sm:gap-4 animate-fade-in">
            <SessionSummary />
            <ScoreTracker />
            <ScoreHistory />
          </div>
        )}

        {/* === BOKFÖRINGS-FLIKEN === */}
        {activeTab === 'book' && <div className="animate-fade-in"><Bookkeeping /></div>}
      </main>

      <Footer />
    </div>
  );
}

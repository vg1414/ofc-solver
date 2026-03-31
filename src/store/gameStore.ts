import { create } from 'zustand';
import type { Card, RowName, GameVariant, GamePhase, Board, SolverMode, FLCardCount } from '../engine/types';
import { createEmptyBoard } from '../engine/types';
import { isFoul } from '../engine/foulCheck';
import { calcAllRoyalties } from '../engine/royalties';
import { getFantasyLandEntryCards } from '../engine/gameState';
import { evaluate3, evaluate5 } from '../engine/handEval';

// ============================================================
// gameStore.ts — Zustand store för allt speltillstånd
// ============================================================

// --- Hjälpfunktioner ---

function countPlaced(board: Board): number {
  let count = 0;
  for (const row of ['top', 'middle', 'bottom'] as RowName[]) {
    for (const c of board[row].cards) {
      if (c !== null) count++;
    }
  }
  return count;
}

function isBoardFull(board: Board): boolean {
  return countPlaced(board) === 13;
}

function getRowCards(board: Board, row: RowName): Card[] {
  return board[row].cards.filter((c): c is Card => c !== null);
}

// --- Types ---

interface PlacementRecord {
  row: RowName;
  slotIndex: number;
  card: Card;
  player: 'me' | 'opponent';
}

interface GameStore {
  // --- Spelläge ---
  variant: GameVariant;
  phase: GamePhase;
  round: number;

  // --- Aktivt bräde ---
  activePlayer: 'me' | 'opponent';

  // --- Bräden ---
  myBoard: Board;
  opponentBoard: Board;

  // --- Kort i hand ---
  currentCards: Card[];
  selectedCard: Card | null;

  // --- Använda kort (för att gråa ut i picker) ---
  usedCards: Card[];
  usedJokers: number;

  // --- Dead cards (alla sedda kort) ---
  deadCards: Card[];

  // --- Solver-läge ---
  solverMode: SolverMode;
  selectedCards: Card[];
  flCardCount: FLCardCount;

  // --- Fantasy Land ---
  isFantasyLand: boolean;
  fantasyLandCards: number; // 13-16

  // --- Foul & royalties (beräknas vid komplett bräde) ---
  myFouled: boolean;
  myRoyalties: { top: number; middle: number; bottom: number; total: number };
  myHandDescriptions: { top: string; middle: string; bottom: string };

  // --- Historik ---
  _history: PlacementRecord[];

  // --- Actions ---
  setVariant: (v: GameVariant) => void;
  setActivePlayer: (p: 'me' | 'opponent') => void;
  selectCard: (card: Card) => void;
  clearSelectedCard: () => void;
  placeCard: (row: RowName, slotIndex: number) => void;
  addCurrentCard: (card: Card) => void;
  removeCurrentCard: (index: number) => void;
  resetGame: () => void;
  removeCard: (row: RowName, slotIndex: number, player: 'me' | 'opponent') => void;
  undoLastPlacement: () => void;
  enterFantasyLand: (cardCount: number) => void;
  exitFantasyLand: () => void;

  // --- Solver-läge actions ---
  setSolverMode: (mode: SolverMode) => void;
  toggleCardSelection: (card: Card) => void;
  clearSelectedCards: () => void;
  setFLCardCount: (count: FLCardCount) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  // --- Initialt tillstånd ---
  variant: 'regular',
  phase: 'placing',
  round: 1,
  activePlayer: 'me',
  myBoard: createEmptyBoard(),
  opponentBoard: createEmptyBoard(),
  currentCards: [],
  selectedCard: null,
  usedCards: [],
  usedJokers: 0,
  deadCards: [],
  solverMode: 'normal',
  selectedCards: [],
  flCardCount: 13,
  isFantasyLand: false,
  fantasyLandCards: 0,
  myFouled: false,
  myRoyalties: { top: 0, middle: 0, bottom: 0, total: 0 },
  myHandDescriptions: { top: '', middle: '', bottom: '' },
  _history: [],

  // --- Actions ---

  setVariant: (v) => set({ variant: v }),

  setActivePlayer: (p) => set({ activePlayer: p }),

  selectCard: (card) => set({ selectedCard: card }),

  clearSelectedCard: () => set({ selectedCard: null }),

  addCurrentCard: (card) =>
    set((s) => ({ currentCards: [...s.currentCards, card] })),

  removeCurrentCard: (index) =>
    set((s) => ({
      currentCards: s.currentCards.filter((_, i) => i !== index),
    })),

  placeCard: (row, slotIndex) => {
    const { selectedCard, activePlayer, myBoard, opponentBoard, usedCards, usedJokers, _history } = get();
    if (!selectedCard) return;

    const board = activePlayer === 'me' ? myBoard : opponentBoard;
    const slot = board[row].cards[slotIndex];
    if (slot !== null) return;

    const newBoard = {
      ...board,
      [row]: {
        ...board[row],
        cards: board[row].cards.map((c: Card | null, i: number) =>
          i === slotIndex ? selectedCard : c
        ),
      },
    };

    const newUsedJokers =
      selectedCard.kind === 'joker' ? usedJokers + 1 : usedJokers;
    const newUsedCards =
      selectedCard.kind === 'card' ? [...usedCards, selectedCard] : usedCards;

    const updates: Partial<GameStore> = {
      ...(activePlayer === 'me' ? { myBoard: newBoard } : { opponentBoard: newBoard }),
      selectedCard: null,
      usedCards: newUsedCards,
      usedJokers: newUsedJokers,
      deadCards: [...get().deadCards, selectedCard],
      _history: [..._history, { row, slotIndex, card: selectedCard, player: activePlayer }],
    };

    // Om mitt bräde nu är fullt: beräkna foul, royalties, hand-beskrivningar
    if (activePlayer === 'me' && isBoardFull(newBoard)) {
      const topCards = getRowCards(newBoard, 'top');
      const midCards = getRowCards(newBoard, 'middle');
      const botCards = getRowCards(newBoard, 'bottom');

      if (topCards.length === 3 && midCards.length === 5 && botCards.length === 5) {
        const fouled = isFoul(topCards, midCards, botCards);
        const royalties = fouled
          ? { top: 0, middle: 0, bottom: 0, total: 0 }
          : calcAllRoyalties(topCards, midCards, botCards);

        const topDesc = evaluate3(topCards).description;
        const midDesc = evaluate5(midCards).description;
        const botDesc = evaluate5(botCards).description;

        // Kolla FL-inträde
        const flCards = getFantasyLandEntryCards(topCards);

        updates.myFouled = fouled;
        updates.myRoyalties = royalties;
        updates.myHandDescriptions = { top: topDesc, middle: midDesc, bottom: botDesc };
        updates.phase = 'scoring';

        if (!fouled && flCards > 0) {
          updates.isFantasyLand = true;
          updates.fantasyLandCards = flCards;
        }
      }
    }

    set(updates);
  },

  removeCard: (row, slotIndex, player) => {
    const { myBoard, opponentBoard, usedCards, usedJokers, deadCards, _history } = get();
    const board = player === 'me' ? myBoard : opponentBoard;
    const card = board[row].cards[slotIndex];
    if (card === null) return;

    const newBoard = {
      ...board,
      [row]: {
        ...board[row],
        cards: board[row].cards.map((c: Card | null, i: number) => i === slotIndex ? null : c),
      },
    };

    const newUsedJokers = card.kind === 'joker' ? Math.max(0, usedJokers - 1) : usedJokers;
    const newUsedCards = card.kind === 'card'
      ? usedCards.filter(
          (c) => !(c.kind === 'card' &&
            c.rank === (card as { kind: 'card'; rank: string; suit: string }).rank &&
            c.suit === (card as { kind: 'card'; rank: string; suit: string }).suit)
        )
      : usedCards;

    // Ta bara bort första matchande kort ur deadCards
    let removed = false;
    const newDeadCardsDeduped = deadCards.filter((c) => {
      if (removed) return true;
      const match = card.kind === 'joker'
        ? c.kind === 'joker'
        : c.kind === 'card' && card.kind === 'card' && c.rank === card.rank && c.suit === card.suit;
      if (match) { removed = true; return false; }
      return true;
    });

    const newHistory = _history.filter(
      (h) => !(h.player === player && h.row === row && h.slotIndex === slotIndex)
    );

    set({
      ...(player === 'me' ? { myBoard: newBoard } : { opponentBoard: newBoard }),
      usedCards: newUsedCards,
      usedJokers: newUsedJokers,
      deadCards: newDeadCardsDeduped,
      _history: newHistory,
      phase: 'placing',
      myFouled: false,
      myRoyalties: { top: 0, middle: 0, bottom: 0, total: 0 },
      myHandDescriptions: { top: '', middle: '', bottom: '' },
    });
  },

  undoLastPlacement: () => {
    const { _history, myBoard, opponentBoard, usedCards, usedJokers, deadCards } = get();
    if (_history.length === 0) return;

    const last = _history[_history.length - 1];
    const board = last.player === 'me' ? myBoard : opponentBoard;
    const newBoard = {
      ...board,
      [last.row]: {
        ...board[last.row],
        cards: board[last.row].cards.map((c: Card | null, i: number) =>
          i === last.slotIndex ? null : c
        ),
      },
    };

    const newUsedJokers =
      last.card.kind === 'joker' ? Math.max(0, usedJokers - 1) : usedJokers;
    const newUsedCards =
      last.card.kind === 'card'
        ? usedCards.filter(
            (c) =>
              !(c.kind === 'card' &&
                c.rank === (last.card as { kind: 'card'; rank: string; suit: string }).rank &&
                c.suit === (last.card as { kind: 'card'; rank: string; suit: string }).suit)
          )
        : usedCards;

    const newDeadCards = [...deadCards];
    newDeadCards.pop();

    set({
      ...(last.player === 'me' ? { myBoard: newBoard } : { opponentBoard: newBoard }),
      usedCards: newUsedCards,
      usedJokers: newUsedJokers,
      deadCards: newDeadCards,
      _history: _history.slice(0, -1),
      phase: 'placing',
      myFouled: false,
      myRoyalties: { top: 0, middle: 0, bottom: 0, total: 0 },
      myHandDescriptions: { top: '', middle: '', bottom: '' },
    });
  },

  enterFantasyLand: (cardCount) =>
    set({ isFantasyLand: true, fantasyLandCards: cardCount }),

  exitFantasyLand: () =>
    set({ isFantasyLand: false, fantasyLandCards: 0 }),

  // --- Solver-läge actions ---

  setSolverMode: (mode) =>
    set({ solverMode: mode, selectedCards: [], selectedCard: null }),

  toggleCardSelection: (card) => {
    const { selectedCards, solverMode, flCardCount } = get();
    const maxCards = solverMode === 'fantasyLand' ? flCardCount : 5;

    const idx = selectedCards.findIndex((c) => {
      if (card.kind === 'joker' && c.kind === 'joker') return true;
      if (card.kind === 'card' && c.kind === 'card') return c.rank === card.rank && c.suit === card.suit;
      return false;
    });

    if (idx !== -1) {
      set({ selectedCards: selectedCards.filter((_, i) => i !== idx) });
    } else if (selectedCards.length < maxCards) {
      set({ selectedCards: [...selectedCards, card] });
    }
  },

  clearSelectedCards: () => set({ selectedCards: [] }),

  setFLCardCount: (count) => set({ flCardCount: count, selectedCards: [] }),

  resetGame: () =>
    set({
      phase: 'placing',
      round: 1,
      activePlayer: 'me',
      myBoard: createEmptyBoard(),
      opponentBoard: createEmptyBoard(),
      currentCards: [],
      selectedCard: null,
      usedCards: [],
      usedJokers: 0,
      deadCards: [],
      solverMode: 'normal',
      selectedCards: [],
      flCardCount: 13,
      isFantasyLand: false,
      fantasyLandCards: 0,
      myFouled: false,
      myRoyalties: { top: 0, middle: 0, bottom: 0, total: 0 },
      myHandDescriptions: { top: '', middle: '', bottom: '' },
      _history: [],
    }),
}));

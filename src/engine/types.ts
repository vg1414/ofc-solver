// ============================================================
// types.ts — Alla datatyper & interfaces för OFC Solver
// ============================================================

// --- Kort ---

export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T'
  | 'J' | 'Q' | 'K' | 'A';

/** Ett vanligt kort */
export interface RegularCard {
  kind: 'card';
  rank: Rank;
  suit: Suit;
}

/** En joker (wildcard) */
export interface JokerCard {
  kind: 'joker';
  /** Vilken identitet jokern för tillfället antar (sätts under handvärdering) */
  resolvedAs?: RegularCard;
}

export type Card = RegularCard | JokerCard;

// --- Rader ---

export type RowName = 'top' | 'middle' | 'bottom';

/** Maxantal kort per rad */
export const ROW_CAPACITY: Record<RowName, number> = {
  top: 3,
  middle: 5,
  bottom: 5,
};

export interface Row {
  name: RowName;
  cards: (Card | null)[];
}

// --- Handrankningar (ordning = lägre index = svagare) ---

export type HandRank =
  | 'high_card'
  | 'pair'
  | 'two_pair'
  | 'trips'       // triss
  | 'straight'
  | 'flush'
  | 'full_house'
  | 'quads'       // fyrtal
  | 'straight_flush'
  | 'royal_flush'
  | 'five_of_a_kind'; // möjlig med joker

/** Resultatet från handvärderaren */
export interface HandResult {
  rank: HandRank;
  /** Tiebreaker-kickers i fallande ordning (numeriska rankindex 2–14) */
  tiebreakers: number[];
  /** Beskrivning för UI, t.ex. "Flush, A-high" */
  description: string;
}

// --- Speltillstånd ---

export type GameVariant = 'regular' | 'pineapple';

export interface Board {
  top: Row;
  middle: Row;
  bottom: Row;
}

export function createEmptyBoard(): Board {
  return {
    top: { name: 'top', cards: [null, null, null] },
    middle: { name: 'middle', cards: [null, null, null, null, null] },
    bottom: { name: 'bottom', cards: [null, null, null, null, null] },
  };
}

export interface PlayerState {
  id: number;
  board: Board;
  isFantasyLand: boolean;
  /** Antal kort i FL-hand (13–16). 0 = ej i FL. */
  fantasyLandCards: number;
}

export type GamePhase =
  | 'setup'        // Innan spelet börjat
  | 'dealing'      // Kort delas ut
  | 'placing'      // Spelaren placerar kort
  | 'fantasy_land' // FL-fas (specialplacering)
  | 'scoring'      // Handen är klar, poäng räknas
  | 'finished';    // Sessionen slut

export interface GameState {
  variant: GameVariant;
  phase: GamePhase;
  round: number;          // 1–9
  players: PlayerState[];
  /** Kort som är "döda" (redan sedda/använda, ej i leken) */
  deadCards: Card[];
  /** Kort som spelaren håller i handen just nu */
  currentCards: Card[];
  /** Pineapple: kortets som kastas (index i currentCards) */
  discardIndex: number | null;
}

// --- Solver ---

export interface PlacementOption {
  row: RowName;
  slotIndex: number;
  /** Förväntat värde för denna placering */
  ev: number;
  /** Rangordning (1 = bäst) */
  rank: number;
}

export interface SolverResult {
  options: PlacementOption[];
  /** Bästa rekommenderade placering */
  best: PlacementOption;
  /** Antal simuleringar som körts */
  simulations: number;
}

// --- Poäng & bokföring ---

export interface RoyaltyResult {
  top: number;
  middle: number;
  bottom: number;
  total: number;
}

export interface ScoreEntry {
  handNumber: number;
  date: string;
  points: number;
  notes?: string;
}

export interface SessionState {
  entries: ScoreEntry[];
  totalPoints: number;
}

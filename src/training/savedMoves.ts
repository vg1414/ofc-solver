// ============================================================
// savedMoves.ts — Drag du markerat (★) för att analysera senare
// ============================================================
//
// Ett sparat drag innehåller allt som behövs för att räkna om det:
// brädet innan, korten, motståndarens bräde och ditt drag (som en
// SolverInput utan options). Bedömningen (`j`) sparas om den fanns;
// annars räknas den fram när draget öppnas under "Sparade drag".
//
// Lagras i localStorage (bara på den här enheten), max MAX_SAVED.
// En liten "store" med prenumeranter gör att alla komponenter som
// använder useSavedMoves() ritas om när något sparas eller tas bort.
// ============================================================

import { useSyncExternalStore } from 'react';
import type { Board, GameVariant } from '../engine/types';
import type { SolverInput } from '../hooks/useSolver';
import type { Judgement, Move } from './moves';

export type SavedSource = 'hand' | 'scenario' | 'joker' | 'duel';

export const SOURCE_LABEL: Record<SavedSource, string> = { hand: 'Hel hand', scenario: 'Scenario', joker: '★ Joker', duel: 'Spela' };

export interface SavedMove {
  /** Unikt per omgång + drag, t.ex. "lq3x9a:2-5" */
  id: string;
  savedAt: number;
  source: SavedSource;
  variant: GameVariant;
  /** T.ex. "Hand 2 · Runda 7" */
  label: string;
  board: Board;
  move: Move;
  /** Solverinput utan options — för att räkna (om) draget */
  input: SolverInput;
  fl: boolean;
  j: Judgement | null;
  /** Bedömningen är gjord på Noggrann nivå */
  thorough: boolean;
}

const KEY = 'ofc-saved-moves';
export const MAX_SAVED = 200;

let cache: SavedMove[] | null = null;
const listeners = new Set<() => void>();

function read(): SavedMove[] {
  if (cache) return cache;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    cache = Array.isArray(v) ? (v as SavedMove[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(list: SavedMove[]) {
  cache = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* privat läge / fullt — listan finns kvar tills sidan laddas om */
  }
  listeners.forEach((l) => l());
}

export function getSaved(): SavedMove[] {
  return read();
}

export function isSaved(id: string): boolean {
  return read().some((s) => s.id === id);
}

/** Spara (senaste först) eller ta bort om det redan är sparat. Returnerar true om det nu är sparat */
export function toggleSaved(item: Omit<SavedMove, 'savedAt'>): boolean {
  const list = read();
  if (list.some((s) => s.id === item.id)) {
    write(list.filter((s) => s.id !== item.id));
    return false;
  }
  // Inga options i input — de bestäms när draget räknas om
  const clean: SavedMove = { ...item, input: { ...item.input, options: undefined }, savedAt: Date.now() };
  write([clean, ...list].slice(0, MAX_SAVED));
  return true;
}

export function removeSaved(id: string) {
  write(read().filter((s) => s.id !== id));
}

/** Uppdatera bedömningen för ett sparat drag (gör inget om det inte är sparat) */
export function updateSavedJudgement(id: string, j: Judgement, thorough: boolean) {
  const list = read();
  if (!list.some((s) => s.id === id)) return;
  write(list.map((s) => (s.id === id ? { ...s, j, thorough } : s)));
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Alla sparade drag, senaste först. Komponenten ritas om när listan ändras */
export function useSavedMoves(): SavedMove[] {
  return useSyncExternalStore(subscribe, read, read);
}

/** Unikt id för en omgång (en session eller ett parti) */
export function newRunId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

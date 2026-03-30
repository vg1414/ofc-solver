import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ScoreEntry, SessionState } from '../engine/types';

// ============================================================
// scoreStore.ts — Zustand store för poänghistorik
// Sparas i localStorage så data finns kvar vid omstart.
// ============================================================

interface ScoreStore extends SessionState {
  addEntry: (points: number, notes?: string) => void;
  removeEntry: (handNumber: number) => void;
  clearSession: () => void;
}

export const useScoreStore = create<ScoreStore>()(
  persist(
    (set, get) => ({
      entries: [],
      totalPoints: 0,

      addEntry: (points, notes) => {
        const { entries } = get();
        const handNumber = entries.length + 1;
        const date = new Date().toLocaleDateString('sv-SE');
        const newEntry: ScoreEntry = { handNumber, date, points, notes };
        set({
          entries: [...entries, newEntry],
          totalPoints: get().totalPoints + points,
        });
      },

      removeEntry: (handNumber) => {
        const { entries } = get();
        const entry = entries.find((e) => e.handNumber === handNumber);
        if (!entry) return;
        const newEntries = entries
          .filter((e) => e.handNumber !== handNumber)
          .map((e, i) => ({ ...e, handNumber: i + 1 }));
        set({
          entries: newEntries,
          totalPoints: get().totalPoints - entry.points,
        });
      },

      clearSession: () => set({ entries: [], totalPoints: 0 }),
    }),
    { name: 'ofc-score-session' }
  )
);

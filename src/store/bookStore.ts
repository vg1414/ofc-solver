import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================
// bookStore.ts — Zustand store för session-bokföring
// Sparas i localStorage så data aldrig försvinner.
// En "session" = ett pokertillfälle (datum, motståndare, poäng, pengar)
// ============================================================

export interface BookSession {
  id: string;
  date: string;          // 'YYYY-MM-DD'
  opponent: string;      // Motståndarens namn
  points: number;        // Resultat i poäng (+/-)
  moneyAmount: number;   // Resultat i pengar (+/-)
  moneyCurrency: string; // 'SEK', 'EUR', 'USD', osv.
  notes?: string;
  createdAt: number;     // timestamp för sortering
}

interface BookStore {
  sessions: BookSession[];
  addSession: (s: Omit<BookSession, 'id' | 'createdAt'>) => void;
  removeSession: (id: string) => void;
  updateSession: (id: string, updates: Partial<Omit<BookSession, 'id' | 'createdAt'>>) => void;
}

export const useBookStore = create<BookStore>()(
  persist(
    (set, get) => ({
      sessions: [],

      addSession: (s) => {
        const newSession: BookSession = {
          ...s,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
        };
        set({ sessions: [newSession, ...get().sessions] });
      },

      removeSession: (id) => {
        set({ sessions: get().sessions.filter((s) => s.id !== id) });
      },

      updateSession: (id, updates) => {
        set({
          sessions: get().sessions.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        });
      },
    }),
    { name: 'ofc-bookkeeping' }
  )
);

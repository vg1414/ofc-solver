// ============================================================
// leaderboard.ts — Lokala topplistor (localStorage)
// ============================================================
// En lista (topp 10) per läge × variant × antal scenarion/händer,
// t.ex. nyckeln "ofc-lb:scenario:pineapple:10".
// Högre poäng är bättre i båda lägena. Vid lika poäng står det äldsta
// resultatet först (den som kom dit först behåller platsen).
// ============================================================

import type { GameVariant } from '../engine/types';

export type TrainingMode = 'scenario' | 'hand';

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  /** ISO-datum */
  date: string;
}

export const TOP_N = 10;
const NAME_KEY = 'ofc-lb-name';

export function boardKey(mode: TrainingMode, variant: GameVariant, count: number): string {
  return `ofc-lb:${mode}:${variant}:${count}`;
}

function sortEntries(list: LeaderboardEntry[]): LeaderboardEntry[] {
  return list.slice().sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
}

/** Skulle `score` komma in på listan? */
export function qualifies(list: LeaderboardEntry[], score: number): boolean {
  if (list.length < TOP_N) return true;
  return score > sortEntries(list)[TOP_N - 1].score;
}

/** Ny lista med resultatet insorterat (max TOP_N) */
export function insertEntry(list: LeaderboardEntry[], entry: LeaderboardEntry): LeaderboardEntry[] {
  return sortEntries([...list, entry]).slice(0, TOP_N);
}

// ---------- localStorage (kan saknas i privat läge — då blir listan bara tom) ----------

export function loadBoard(key: string): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(key);
    const v = raw ? (JSON.parse(raw) as LeaderboardEntry[]) : [];
    return Array.isArray(v) ? sortEntries(v.filter((e) => e && typeof e.score === 'number')) : [];
  } catch {
    return [];
  }
}

export function saveBoard(key: string, list: LeaderboardEntry[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* privat läge — inget att göra */
  }
}

export function lastName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function rememberName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* privat läge */
  }
}

export function makeEntry(name: string, score: number): LeaderboardEntry {
  return { id: `e${Date.now()}${Math.floor(Math.random() * 1e6)}`, name: name.trim().slice(0, 20) || 'Anonym', score, date: new Date().toISOString() };
}

// ============================================================
// useLeaderboardRun.ts — Topplistan efter en avslutad omgång
// ============================================================
// När omgången är klar (`finished` blir true) läses listan in. Räcker
// poängen till topp 10 öppnas namn-arket. Sparar man sorteras
// resultatet in, listan sparas och namnet kommer ihåg till nästa gång.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { insertEntry, lastName, loadBoard, makeEntry, qualifies, rememberName, saveBoard, type LeaderboardEntry } from './leaderboard';

export function useLeaderboardRun(key: string, score: number, finished: boolean) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(() => loadBoard(key));
  const [askName, setAskName] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [handled, setHandled] = useState(false);

  useEffect(() => {
    if (!finished || handled) return;
    setHandled(true);
    const list = loadBoard(key);
    setEntries(list);
    if (qualifies(list, score)) setAskName(true);
  }, [finished, handled, key, score]);

  // Vilken plats resultatet skulle få (för namn-arket)
  const rank = entries.filter((e) => e.score >= score).length + 1;

  const save = useCallback(
    (name: string) => {
      const entry = makeEntry(name, score);
      const list = insertEntry(loadBoard(key), entry);
      saveBoard(key, list);
      rememberName(entry.name);
      setEntries(list);
      setHighlightId(entry.id);
      setAskName(false);
    },
    [key, score],
  );

  return { entries, highlightId, askName, rank, initialName: lastName(), save, skip: () => setAskName(false) };
}

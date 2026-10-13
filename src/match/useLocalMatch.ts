// ============================================================
// useLocalMatch.ts — Ett parti på samma telefon (skicka mellan er)
// ============================================================
// Håller MatchState och tar emot actions via dispatch(). Partiet sparas
// i localStorage efter varje drag (och var 5:e sekund för klockan), så
// det går att fortsätta om appen stängs eller laddas om.
//
// Online senare: en useOnlineMatch() med samma gränssnitt (state +
// dispatch) skickar i stället actionen till servern och får tillbaka
// sin vy (viewFor). Spelets UI behöver då inte ändras.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { applyAction, MatchError, parseMatch, type MatchAction, type MatchState } from './match';

const KEY = 'ofc-duel-match';

export interface SavedMatch {
  state: MatchState;
  elapsedMs: number;
}

export function loadSavedMatch(): SavedMatch | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { state?: unknown; elapsedMs?: unknown } | null;
    if (!raw) return null;
    const state = parseMatch(JSON.stringify(raw.state));
    if (!state || state.finished) return null;
    return { state, elapsedMs: typeof raw.elapsedMs === 'number' ? raw.elapsedMs : 0 };
  } catch {
    return null;
  }
}

export function clearSavedMatch() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* privat läge */
  }
}

function save(state: MatchState, elapsedMs: number) {
  try {
    if (state.finished) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify({ state, elapsedMs }));
  } catch {
    /* privat läge / fullt — partiet fungerar ändå, det sparas bara inte */
  }
}

export function useLocalMatch(initial: MatchState, elapsedMs: number) {
  const [state, setState] = useState(initial);
  // Senaste state utan att vänta på omrendering (två snabba actions i rad)
  const ref = useRef(initial);

  /** Utför en action. Returnerar felet som text om den inte var tillåten. */
  const dispatch = useCallback((a: MatchAction): string | null => {
    try {
      const next = applyAction(ref.current, a);
      ref.current = next;
      setState(next);
      return null;
    } catch (e) {
      if (e instanceof MatchError) return e.message;
      throw e;
    }
  }, []);

  // Spara efter varje ändring, och klockan var 5:e sekund
  const tick = Math.floor(elapsedMs / 5000);
  const elapsedRef = useRef(elapsedMs);
  useEffect(() => {
    elapsedRef.current = elapsedMs;
  });
  useEffect(() => save(state, elapsedRef.current), [state, tick]);

  return { state, dispatch };
}

// ============================================================
// session.ts — Inställningar och slutregler för "Hel hand mot datorn"
// ============================================================
// En session är flera händer i rad. Längden väljs som
//   - antal händer (t.ex. 10),
//   - antal minuter (pågående hand spelas alltid klart), eller
//   - fritt spel (man avslutar själv).
// FL i slutet: "playout" = Fantasy Land som någon har vunnit (även
// repeat-FL) spelas ut innan sessionen tar slut, "stop" = man får
// sluta direkt även om någon står på FL.
// Allt här är ren logik utan React, så det går att testa.
// ============================================================

export type SessionLength = { kind: 'hands'; n: number } | { kind: 'minutes'; n: number } | { kind: 'free' };
export type FlEnd = 'playout' | 'stop';

export interface HandSettings {
  length: SessionLength;
  flEnd: FlEnd;
  coach: boolean;
}

export const HAND_PRESETS = [5, 10, 20] as const;
export const MINUTE_PRESETS = [10, 20, 30] as const;
export const HANDS_RANGE = { min: 1, max: 99, step: 1 };
export const MINUTES_RANGE = { min: 5, max: 180, step: 5 };

export const DEFAULT_HAND_SETTINGS: HandSettings = { length: { kind: 'hands', n: 10 }, flEnd: 'playout', coach: true };

const clamp = (n: number, r: { min: number; max: number }) => Math.min(r.max, Math.max(r.min, Math.round(n)));

/** Läser sparade inställningar säkert (okända/trasiga värden → standard) */
export function sanitizeHandSettings(v: unknown): HandSettings {
  const d = DEFAULT_HAND_SETTINGS;
  if (!v || typeof v !== 'object') return d;
  const o = v as Partial<HandSettings>;
  const l = o.length as Partial<{ kind: string; n: number }> | undefined;
  let length: SessionLength = d.length;
  if (l?.kind === 'free') length = { kind: 'free' };
  else if (l?.kind === 'hands' && typeof l.n === 'number') length = { kind: 'hands', n: clamp(l.n, HANDS_RANGE) };
  else if (l?.kind === 'minutes' && typeof l.n === 'number') length = { kind: 'minutes', n: clamp(l.n, MINUTES_RANGE) };
  return {
    length,
    flEnd: o.flEnd === 'stop' ? 'stop' : 'playout',
    coach: typeof o.coach === 'boolean' ? o.coach : d.coach,
  };
}

/** Har sessionen nått sin längd? (Fritt spel når den aldrig) */
export function targetReached(len: SessionLength, handsPlayed: number, elapsedMs: number): boolean {
  if (len.kind === 'hands') return handsPlayed >= len.n;
  if (len.kind === 'minutes') return elapsedMs >= len.n * 60_000;
  return false;
}

/** Måste nästa hand spelas för att någon har Fantasy Land som ska spelas ut? */
export function flPending(flEnd: FlEnd, nextFl: [number, number]): boolean {
  return flEnd === 'playout' && (nextFl[0] > 0 || nextFl[1] > 0);
}

/**
 * Är sessionen slut efter den hand som just spelats?
 * Längden nådd och inget FL kvar att spela ut.
 */
export function sessionOver(s: HandSettings, handsPlayed: number, elapsedMs: number, nextFl: [number, number]): boolean {
  return targetReached(s.length, handsPlayed, elapsedMs) && !flPending(s.flEnd, nextFl);
}

/** "10 händer", "20 min", "Fritt spel" */
export function lengthLabel(len: SessionLength): string {
  if (len.kind === 'hands') return `${len.n} ${len.n === 1 ? 'hand' : 'händer'}`;
  if (len.kind === 'minutes') return `${len.n} min`;
  return 'Fritt spel';
}

/** Topplista finns bara för antal händer (då är sessionerna jämförbara) */
export function leaderboardCount(len: SessionLength): number | null {
  return len.kind === 'hands' ? len.n : null;
}

/** 754 000 ms → "12:34" */
export function clockText(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

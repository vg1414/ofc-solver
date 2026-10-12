// ============================================================
// cardStyle.ts — Delade hjälpfunktioner för kortens utseende
// ============================================================

import type { Card, Suit } from '../../engine/types';

/** Fyrfärgslek: varje färg har egen bakgrund, teckenfärg och kant (CSS-variabler i index.css) */
const SUIT_VAR: Record<Suit, string> = {
  spades: 'spade',
  hearts: 'heart',
  diamonds: 'diamond',
  clubs: 'club',
};

export function suitVars(card: Card) {
  const key = card.kind === 'joker' ? 'joker' : SUIT_VAR[card.suit];
  return {
    bg: `var(--${key}-bg)`,
    fg: `var(--${key}-fg)`,
    line: `var(--${key}-line)`,
  };
}

/** "T" visas som "10" på korten — så ser riktiga kort ut */
export function rankLabel(card: Card): string {
  if (card.kind === 'joker') return '★';
  return card.rank === 'T' ? '10' : card.rank;
}

export const SUIT_NAME: Record<Suit, string> = {
  spades: 'spader',
  hearts: 'hjärter',
  diamonds: 'ruter',
  clubs: 'klöver',
};

/** Läsbart namn för skärmläsare, t.ex. "Q ruter" */
export function cardAriaLabel(card: Card): string {
  if (card.kind === 'joker') return 'Joker';
  return `${rankLabel(card)} ${SUIT_NAME[card.suit]}`;
}

/** Två kort är "samma" om valör och färg stämmer (alla jokrar räknas som lika) */
export function sameCard(a: Card | null | undefined, b: Card | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.kind === 'joker' || b.kind === 'joker') return a.kind === b.kind;
  return a.rank === b.rank && a.suit === b.suit;
}

/** Vibrera lätt om telefonen stöder det (Android; iPhone ignorerar tyst) */
export function haptic(pattern: number | number[] = 8) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ingen haptik — inget problem */
  }
}

// ============================================================
// CardGrid.tsx — Kompakt kortväljare: 4 rader (färger) × 13 valörer
// ============================================================
// Varje ruta har färgens pastellton, så man hittar rätt rad direkt.
// Tryck = välj (lyft) kortet. I Normal-läget kan man också dra en ruta
// direkt till en rad på brädet. Kort som redan ligger ute är gråade.
// ============================================================

import type { Card, Rank, Suit } from '../../engine/types';
import SuitIcon from './SuitIcon';
import { suitVars, rankLabel, cardAriaLabel } from './cardStyle';
import { useDraggable } from '../dnd/useDraggable';

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

export type TileState = 'free' | 'used' | 'marked' | 'held';

interface TileProps {
  card: Card;
  state: TileState;
  draggable: boolean;
  onTap: (card: Card) => void;
}

function Tile({ card, state, draggable, onTap }: TileProps) {
  const v = suitVars(card);
  const used = state === 'used';
  const drag = useDraggable(draggable && !used ? card : null, () => !used && onTap(card), used);
  const held = state === 'held';
  const marked = state === 'marked';

  return (
    <button
      type="button"
      aria-label={cardAriaLabel(card)}
      aria-pressed={held || marked}
      disabled={used}
      {...drag}
      className={`relative aspect-[5/7] w-full rounded-[7px] flex flex-col items-center justify-center leading-none transition-[transform,opacity,box-shadow] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-90 ${
        used ? 'opacity-[0.18]' : ''
      } ${held ? 'scale-110 z-10' : ''}`}
      style={{
        ...drag.style,
        background: held ? 'var(--grad)' : v.bg,
        color: held ? '#fff' : v.fg,
        boxShadow: held
          ? `0 0 0 2px var(--surface), var(--glow)`
          : marked
            ? `inset 0 0 0 2px var(--accent)`
            : `inset 0 0 0 1px ${v.line}, 0 1px 2px rgb(80 50 20 / 0.08)`,
      }}
    >
      <span className="font-card font-bold text-[clamp(13px,4.2vw,18px)] tracking-[-0.04em]">{rankLabel(card)}</span>
      <SuitIcon suit={(card as { suit: Suit }).suit} className="w-[38%] h-auto mt-[1px] opacity-80" />
      {marked && (
        <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full text-white text-[8px] flex items-center justify-center font-bold shadow-[var(--glow)] animate-badge-in" style={{ background: 'var(--grad)' }}>
          ✓
        </span>
      )}
    </button>
  );
}

interface CardGridProps {
  stateOf: (card: Card) => TileState;
  onTap: (card: Card) => void;
  draggable?: boolean;
}

export default function CardGrid({ stateOf, onTap, draggable = false }: CardGridProps) {
  return (
    <div className="grid grid-cols-13 gap-[3px]" style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}>
      {SUITS.flatMap((suit) =>
        RANKS.map((rank) => {
          const card: Card = { kind: 'card', rank, suit };
          return <Tile key={rank + suit} card={card} state={stateOf(card)} draggable={draggable} onTap={onTap} />;
        }),
      )}
    </div>
  );
}

/** Jokerknapp med räknare (2 jokrar i leken) */
export function JokerButton({
  left,
  state,
  draggable,
  onTap,
}: {
  left: number;
  state: TileState;
  draggable: boolean;
  onTap: (card: Card) => void;
}) {
  const card: Card = { kind: 'joker' };
  const used = left <= 0 && state !== 'held' && state !== 'marked';
  const drag = useDraggable(draggable && !used ? card : null, () => !used && onTap(card), used);
  const held = state === 'held';

  return (
    <button
      type="button"
      aria-label={`Joker, ${left} kvar`}
      disabled={used}
      {...drag}
      className={`relative flex items-center gap-1.5 rounded-full px-4 h-12 font-bold text-[14px] transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-95 ${
        used ? 'opacity-35' : ''
      }`}
      style={{
        ...drag.style,
        background: held ? 'var(--grad-fl)' : 'var(--joker-bg)',
        color: held ? '#fff' : 'var(--joker-fg)',
        boxShadow: held ? 'var(--glow-fl)' : state === 'marked' ? 'inset 0 0 0 2px var(--accent)' : 'inset 0 0 0 1px var(--joker-line)',
      }}
    >
      <SuitIcon suit="star" className="w-4 h-4" style={{ color: 'var(--joker-star)' }} />
      Joker
      <span className="tabular text-[11px] font-semibold opacity-75">×{left}</span>
    </button>
  );
}

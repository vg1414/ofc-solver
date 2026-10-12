// ============================================================
// HandTray.tsx — "Din hand": korten som väntar på att läggas ut
// ============================================================
// Visar valda kort plus tomma platser upp till `capacity`.
// Tryck på ett kort → onTapCard (lyft / ta bort beroende på läge).
// I Normal-läget kan korten dras direkt till brädet.
// ============================================================

import type { Card } from '../../engine/types';
import PlayingCard from './PlayingCard';
import { useDraggable, useDragContext } from '../dnd/useDraggable';

function HandCard({
  card,
  held,
  draggable,
  onTap,
}: {
  card: Card;
  held: boolean;
  draggable: boolean;
  onTap: () => void;
}) {
  const drag = useDraggable(draggable ? card : null, onTap);
  return (
    <button type="button" {...drag} className="rounded-[calc(var(--card-w)*0.14)] active:scale-95 transition-transform">
      <PlayingCard card={card} lifted={held} snap />
    </button>
  );
}

interface HandTrayProps {
  cards: Card[];
  capacity: number;
  heldIndex?: number;
  draggable?: boolean;
  onTapCard: (index: number) => void;
  cardWidth?: string;
  wrap?: boolean;
  /** Handen tar emot kort som dras dit */
  dropZone?: boolean;
}

export default function HandTray({ cards, capacity, heldIndex = -1, draggable = false, onTapCard, cardWidth = '40px', wrap = false, dropZone = false }: HandTrayProps) {
  const empty = Math.max(0, capacity - cards.length);
  const drag = useDragContext();
  // Lys upp när ett kort dras: svagt när något dras, starkt när det svävar över handen
  const dragging = dropZone && !!drag?.dragging;
  const over = dragging && !!drag?.over?.hand;
  return (
    <div
      data-drop-hand={dropZone ? '' : undefined}
      className={`flex gap-[calc(var(--card-w)*0.12)] -m-1 p-1 rounded-[12px] transition-[background-color,box-shadow,transform] duration-200 ${wrap ? 'flex-wrap' : ''} ${
        over
          ? 'bg-[rgba(255,214,120,0.3)] shadow-[inset_0_0_0_2px_#e8a828,0_0_18px_rgba(245,184,61,0.5)] scale-[1.03]'
          : dragging
            ? 'shadow-[inset_0_0_0_1.5px_rgba(232,168,40,0.55)]'
            : ''
      }`}
      style={{ '--card-w': cardWidth } as React.CSSProperties}
    >
      {cards.map((c, i) => (
        <HandCard key={`${i}-${c.kind === 'card' ? c.rank + c.suit : 'jk'}`} card={c} held={i === heldIndex} draggable={draggable} onTap={() => onTapCard(i)} />
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <div
          key={`e${i}`}
          className="w-[var(--card-w)] h-[calc(var(--card-w)*1.4)] rounded-[calc(var(--card-w)*0.14)] shadow-[inset_0_0_0_1.5px_var(--line-strong)] [background:repeating-linear-gradient(135deg,transparent_0_5px,var(--sunken)_5px_10px)]"
        />
      ))}
    </div>
  );
}

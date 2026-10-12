// ============================================================
// HandTray.tsx — "Din hand": korten som väntar på att läggas ut
// ============================================================
// Visar valda kort plus tomma platser upp till `capacity`.
// Tryck på ett kort → onTapCard (lyft / ta bort beroende på läge).
// I Normal-läget kan korten dras direkt till brädet.
// ============================================================

import type { Card } from '../../engine/types';
import PlayingCard from './PlayingCard';
import { useDraggable } from '../dnd/useDraggable';

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
}

export default function HandTray({ cards, capacity, heldIndex = -1, draggable = false, onTapCard, cardWidth = '40px', wrap = false }: HandTrayProps) {
  const empty = Math.max(0, capacity - cards.length);
  return (
    <div
      className={`flex gap-[calc(var(--card-w)*0.12)] ${wrap ? 'flex-wrap' : ''}`}
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

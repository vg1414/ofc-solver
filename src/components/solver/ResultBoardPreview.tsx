// ============================================================
// ResultBoardPreview.tsx — Minibild av ett bräde (read-only)
// ============================================================
// Används i resultatlistan (öppning/FL) och som förhandsvisning av
// motståndarens bräde. Royalties räknas med appens egna regler.
// ============================================================

import type { Board, Card } from '../../engine/types';
import PlayingCard from '../cards/PlayingCard';
import { calcTopRoyalty, calcRowRoyalty5, calcAllRoyalties } from '../../engine/royalties';

interface MiniRowProps {
  label: string;
  cards: (Card | null)[];
  royalty?: number;
  cardWidth: number;
}

function MiniRow({ label, cards, royalty, cardWidth }: MiniRowProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-9 shrink-0 text-[9px] font-bold uppercase tracking-wide text-ink-3">{label}</span>
      <div className="flex gap-[2px]">
        {cards.map((card, i) =>
          card ? (
            <PlayingCard key={i} card={card} width={cardWidth} compact />
          ) : (
            <div
              key={i}
              className="rounded-[3px] bg-sunken shadow-[inset_0_0_0_1px_var(--line)]"
              style={{ width: cardWidth, height: cardWidth * 1.4 }}
            />
          ),
        )}
      </div>
      {royalty != null && royalty > 0 && <span className="ml-0.5 text-[10px] font-bold text-gold tabular">+{royalty}p</span>}
    </div>
  );
}

interface ResultBoardPreviewProps {
  board: Board;
  showRoyalties?: boolean;
  cardWidth?: number;
}

export default function ResultBoardPreview({ board, showRoyalties, cardWidth = 22 }: ResultBoardPreviewProps) {
  const topCards = board.top.cards.filter((c): c is Card => c !== null);
  const midCards = board.middle.cards.filter((c): c is Card => c !== null);
  const botCards = board.bottom.cards.filter((c): c is Card => c !== null);

  const full = topCards.length === 3 && midCards.length === 5 && botCards.length === 5;
  const all = full ? calcAllRoyalties(topCards, midCards, botCards) : null;
  const topRoy = !showRoyalties ? 0 : all ? all.top : topCards.length === 3 ? calcTopRoyalty(topCards) : 0;
  const midRoy = !showRoyalties ? 0 : all ? all.middle : midCards.length === 5 ? calcRowRoyalty5(midCards, 'middle') : 0;
  const botRoy = !showRoyalties ? 0 : all ? all.bottom : botCards.length === 5 ? calcRowRoyalty5(botCards, 'bottom') : 0;
  const totalRoy = topRoy + midRoy + botRoy;

  return (
    <div className="inline-flex flex-col gap-[3px]">
      <MiniRow label="Topp" cards={board.top.cards} royalty={showRoyalties ? topRoy : undefined} cardWidth={cardWidth} />
      <MiniRow label="Mitt" cards={board.middle.cards} royalty={showRoyalties ? midRoy : undefined} cardWidth={cardWidth} />
      <MiniRow label="Botten" cards={board.bottom.cards} royalty={showRoyalties ? botRoy : undefined} cardWidth={cardWidth} />
      {showRoyalties && totalRoy > 0 && (
        <div className="text-[10px] font-bold text-gold">Royalties totalt: +{totalRoy}p</div>
      )}
    </div>
  );
}

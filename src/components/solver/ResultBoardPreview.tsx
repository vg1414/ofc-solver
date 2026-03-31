// ============================================================
// ResultBoardPreview.tsx — Kompakt read-only bräde för solver-resultat
// ============================================================
//
// Visar ett helt OFC-bräde (topp/mitten/botten) med små kort.
// Används i SolverPanel för att förhandsgranska vart korten hamnar.
// Read-only — inga klick-handlers.
// ============================================================

import type { Board, Card as CardType } from '../../engine/types';
import Card from '../cards/Card';
import { calcTopRoyalty, calcRowRoyalty5 } from '../../engine/royalties';

// ============================================================
// Mini-kortrad
// ============================================================

interface MiniRowProps {
  label: string;
  cards: (CardType | null)[];
  royalty?: number;
}

function MiniRow({ label, cards, royalty }: MiniRowProps) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] text-slate-500 uppercase tracking-wider w-10 text-right shrink-0">
        {label}
      </span>
      <div className="flex gap-0.5">
        {cards.map((card, i) =>
          card ? (
            <Card key={i} card={card} size="xs" />
          ) : (
            <div
              key={i}
              className="w-6 h-8 rounded border border-dashed border-slate-700/50 bg-slate-800/20"
            />
          )
        )}
      </div>
      {royalty != null && royalty > 0 && (
        <span className="text-[9px] text-amber-400 font-bold ml-1">+{royalty}p</span>
      )}
    </div>
  );
}

// ============================================================
// Huvud-komponent
// ============================================================

interface ResultBoardPreviewProps {
  board: Board;
  showRoyalties?: boolean;
}

export default function ResultBoardPreview({ board, showRoyalties }: ResultBoardPreviewProps) {
  const topCards = board.top.cards.filter((c): c is CardType => c !== null);
  const midCards = board.middle.cards.filter((c): c is CardType => c !== null);
  const botCards = board.bottom.cards.filter((c): c is CardType => c !== null);

  const topRoy = showRoyalties && topCards.length === 3 ? calcTopRoyalty(topCards) : 0;
  const midRoy = showRoyalties && midCards.length === 5 ? calcRowRoyalty5(midCards, 'middle') : 0;
  const botRoy = showRoyalties && botCards.length === 5 ? calcRowRoyalty5(botCards, 'bottom') : 0;
  const totalRoy = topRoy + midRoy + botRoy;

  return (
    <div className="bg-[#0a1a20] border border-[#1a3040]/60 rounded-lg px-2.5 py-2 flex flex-col gap-1">
      <MiniRow label="Topp" cards={board.top.cards} royalty={showRoyalties ? topRoy : undefined} />
      <MiniRow label="Mitten" cards={board.middle.cards} royalty={showRoyalties ? midRoy : undefined} />
      <MiniRow label="Botten" cards={board.bottom.cards} royalty={showRoyalties ? botRoy : undefined} />
      {showRoyalties && totalRoy > 0 && (
        <div className="text-[9px] text-amber-300 font-bold text-right">Totalt: +{totalRoy}p</div>
      )}
    </div>
  );
}

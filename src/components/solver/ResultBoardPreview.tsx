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

// ============================================================
// Mini-kortrad
// ============================================================

interface MiniRowProps {
  label: string;
  cards: (CardType | null)[];
}

function MiniRow({ label, cards }: MiniRowProps) {
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
    </div>
  );
}

// ============================================================
// Huvud-komponent
// ============================================================

interface ResultBoardPreviewProps {
  board: Board;
}

export default function ResultBoardPreview({ board }: ResultBoardPreviewProps) {
  return (
    <div className="bg-[#0a1a20] border border-[#1a3040]/60 rounded-lg px-2.5 py-2 flex flex-col gap-1">
      <MiniRow label="Topp" cards={board.top.cards} />
      <MiniRow label="Mitten" cards={board.middle.cards} />
      <MiniRow label="Botten" cards={board.bottom.cards} />
    </div>
  );
}

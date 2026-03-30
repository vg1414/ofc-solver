import type { Row, RowName } from '../../engine/types';
import CardSlot from './CardSlot';

interface RowSlotsProps {
  row: Row;
  label: string;
  royalty?: number;
  highlightedSlots?: number[];
  onSlotClick?: (row: RowName, slotIndex: number) => void;
}

export default function RowSlots({ row, label, royalty, highlightedSlots = [], onSlotClick }: RowSlotsProps) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Etikett */}
      <div className="w-12 sm:w-16 text-right shrink-0">
        <span className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider">{label}</span>
        {royalty !== undefined && royalty > 0 && (
          <div className="text-yellow-400 text-[10px] sm:text-xs font-bold">+{royalty}p</div>
        )}
      </div>

      {/* Kortplatser */}
      <div className="flex gap-1 sm:gap-1.5">
        {row.cards.map((card, i) => (
          <CardSlot
            key={i}
            card={card}
            row={row.name}
            slotIndex={i}
            highlighted={highlightedSlots.includes(i)}
            onClick={onSlotClick}
          />
        ))}
      </div>
    </div>
  );
}

import type { Board, RowName } from '../../engine/types';
import RowSlots from './RowSlots';

interface BoardViewProps {
  board: Board;
  label?: string;
  royalties?: { top: number; middle: number; bottom: number };
  highlightedSlots?: { row: RowName; slots: number[] }[];
  onSlotClick?: (row: RowName, slotIndex: number) => void;
  isFouled?: boolean;
  isActive?: boolean;
  onActivate?: () => void;
}

export default function BoardView({
  board,
  label,
  royalties,
  highlightedSlots = [],
  onSlotClick,
  isFouled = false,
  isActive = false,
  onActivate,
}: BoardViewProps) {
  const getHighlightedForRow = (row: RowName) =>
    highlightedSlots.find((h) => h.row === row)?.slots ?? [];

  return (
    <div className={`
      bg-[#0d2218] border rounded-xl p-4 flex flex-col gap-3 transition-all duration-150
      ${isFouled ? 'border-red-600/60' : isActive ? 'border-green-500/70 shadow-green-900/30 shadow-md' : 'border-[#1a3d2a]'}
    `}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <button
            onClick={onActivate}
            className={`text-sm font-semibold tracking-wide uppercase transition-colors ${
              isActive
                ? 'text-green-400'
                : 'text-slate-500 hover:text-slate-300 cursor-pointer'
            }`}
          >
            {label}
            {isActive && <span className="ml-2 text-xs normal-case font-normal text-green-600">● aktiv</span>}
          </button>
          {isFouled && (
            <span className="text-red-400 text-xs font-bold bg-red-900/30 px-2 py-0.5 rounded">
              FOULED
            </span>
          )}
        </div>
      )}

      <RowSlots
        row={board.top}
        label="Topp"
        royalty={royalties?.top}
        highlightedSlots={getHighlightedForRow('top')}
        onSlotClick={onSlotClick}
      />
      <RowSlots
        row={board.middle}
        label="Mitten"
        royalty={royalties?.middle}
        highlightedSlots={getHighlightedForRow('middle')}
        onSlotClick={onSlotClick}
      />
      <RowSlots
        row={board.bottom}
        label="Botten"
        royalty={royalties?.bottom}
        highlightedSlots={getHighlightedForRow('bottom')}
        onSlotClick={onSlotClick}
      />
    </div>
  );
}

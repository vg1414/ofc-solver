import type { Card as CardType, RowName } from '../../engine/types';
import Card from '../cards/Card';

interface CardSlotProps {
  card: CardType | null;
  row: RowName;
  slotIndex: number;
  highlighted?: boolean;
  onClick?: (row: RowName, slotIndex: number) => void;
}

export default function CardSlot({ card, row, slotIndex, highlighted = false, onClick }: CardSlotProps) {
  const isEmpty = card === null;

  const handleClick = () => {
    if (onClick) onClick(row, slotIndex);
  };

  if (!isEmpty) {
    return <Card card={card} size="md" animate />;
  }

  return (
    <div
      onClick={handleClick}
      className={`
        w-9 h-12 sm:w-12 sm:h-16 rounded-md border-2 border-dashed flex items-center justify-center
        transition-all duration-150 select-none
        ${highlighted
          ? 'border-green-400 bg-green-900/20 shadow-green-400/30 shadow-md cursor-pointer hover:bg-green-900/40 hover:shadow-green-400/50 hover:scale-105 active:scale-95'
          : onClick
          ? 'border-slate-600 bg-slate-800/30 cursor-pointer hover:border-slate-400 hover:bg-slate-700/30 hover:scale-105'
          : 'border-slate-700 bg-slate-800/20'
        }
      `}
    >
      {highlighted && (
        <span className="text-green-400 text-base sm:text-lg opacity-60">+</span>
      )}
    </div>
  );
}

import type { Card as CardType } from '../../engine/types';
import { SUIT_SYMBOL } from '../../engine/constants';

interface CardProps {
  card: CardType;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  dimmed?: boolean;
  selected?: boolean;
  animate?: boolean;
  onClick?: () => void;
}

const SIZE_CLASSES = {
  xs: 'w-6 h-8 text-[9px]',
  sm: 'w-8 h-11 text-xs',
  md: 'w-9 h-12 sm:w-12 sm:h-16 text-xs sm:text-sm',
  lg: 'w-16 h-22 text-base',
};

export default function Card({ card, size = 'md', dimmed = false, selected = false, animate = false, onClick }: CardProps) {
  const isJoker = card.kind === 'joker';

  const suitSymbol = isJoker ? '★' : SUIT_SYMBOL[card.suit];
  const rankLabel = isJoker ? 'JKR' : card.rank;
  const isRed = !isJoker && (card.suit === 'hearts' || card.suit === 'diamonds');

  const textColor = isJoker
    ? 'text-purple-300'
    : isRed
    ? 'text-red-400'
    : 'text-slate-100';

  const borderColor = selected
    ? 'border-yellow-400 shadow-yellow-400/40 shadow-md'
    : isJoker
    ? 'border-purple-500'
    : 'border-slate-500';

  const bgColor = isJoker ? 'bg-[#2a1a3e]' : 'bg-[#1e2d3d]';
  const opacity = dimmed ? 'opacity-30' : 'opacity-100';
  const cursor = onClick ? 'cursor-pointer hover:border-slate-300 hover:scale-110 hover:shadow-md hover:shadow-slate-900/50 active:scale-95' : '';

  return (
    <div
      onClick={onClick}
      className={`
        ${SIZE_CLASSES[size]} ${bgColor} ${borderColor} ${textColor} ${opacity} ${cursor}
        border-2 rounded-md flex flex-col items-center justify-center
        select-none transition-all duration-150 font-bold
        ${selected ? 'scale-105' : ''}
        ${animate ? 'animate-card-place' : ''}
      `}
    >
      {isJoker ? (
        <>
          <span className="text-purple-300 leading-none">★</span>
          <span className="text-[9px] text-purple-400 leading-none mt-0.5">JKR</span>
        </>
      ) : (
        <>
          <span className="leading-none">{rankLabel}</span>
          <span className="leading-none">{suitSymbol}</span>
        </>
      )}
    </div>
  );
}

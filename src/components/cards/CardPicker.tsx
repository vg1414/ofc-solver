import type { Card as CardType, Suit } from '../../engine/types';
import { ALL_RANKS, SUIT_SYMBOL, SUIT_COLOR } from '../../engine/constants';
import Card from './Card';

interface CardPickerProps {
  /** Kort som redan är använda (grås ut) */
  usedCards: CardType[];
  /** Antal jokrar som redan är placerade (0, 1 eller 2) */
  usedJokers: number;
  /** Vilket kort som är valt just nu (null = inget) */
  selectedCard: CardType | null;
  onCardSelect: (card: CardType) => void;
}

function isCardUsed(card: CardType, usedCards: CardType[]): boolean {
  if (card.kind === 'joker') return false; // hanteras separat
  return usedCards.some(
    (u) => u.kind === 'card' && u.rank === card.rank && u.suit === card.suit
  );
}

function isSelected(card: CardType, selected: CardType | null): boolean {
  if (!selected) return false;
  if (card.kind === 'joker' && selected.kind === 'joker') return true;
  if (card.kind === 'card' && selected.kind === 'card') {
    return card.rank === selected.rank && card.suit === selected.suit;
  }
  return false;
}

export default function CardPicker({
  usedCards,
  usedJokers,
  selectedCard,
  onCardSelect,
}: CardPickerProps) {
  const SUIT_ORDER: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

  return (
    <div className="bg-[#111c28] border border-slate-700 rounded-xl p-3 sm:p-4">
      <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-2 sm:mb-3">Välj kort</h3>

      {/* Vanliga kort — en rad per färg */}
      <div className="flex flex-col gap-1 sm:gap-1.5">
        {SUIT_ORDER.map((suit) => {
          const isRedSuit = SUIT_COLOR[suit] === 'red';
          return (
            <div key={suit} className="flex items-center gap-1">
              {/* Färgsymbol */}
              <span className={`w-4 sm:w-5 text-xs sm:text-sm font-bold shrink-0 ${isRedSuit ? 'text-red-400' : 'text-slate-300'}`}>
                {SUIT_SYMBOL[suit]}
              </span>

              {/* Kort */}
              <div className="flex gap-0.5 sm:gap-1 flex-wrap">
                {ALL_RANKS.map((rank) => {
                  const card: CardType = { kind: 'card', rank, suit };
                  const used = isCardUsed(card, usedCards);
                  const sel = isSelected(card, selectedCard);
                  return (
                    <Card
                      key={`${rank}-${suit}`}
                      card={card}
                      size="sm"
                      dimmed={used}
                      selected={sel}
                      onClick={used ? undefined : () => onCardSelect(card)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Jokrar */}
      <div className="flex items-center gap-2 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-slate-700">
        <span className="text-slate-400 text-xs uppercase tracking-widest w-14 sm:w-16">Jokrar</span>
        {[0, 1].map((jokerIndex) => {
          const jokerCard: CardType = { kind: 'joker' };
          const used = jokerIndex < usedJokers;
          const sel = !used && isSelected(jokerCard, selectedCard);
          return (
            <Card
              key={`joker-${jokerIndex}`}
              card={jokerCard}
              size="sm"
              dimmed={used}
              selected={sel}
              onClick={used ? undefined : () => onCardSelect(jokerCard)}
            />
          );
        })}
        <span className="text-slate-600 text-xs ml-1">({2 - usedJokers} kvar)</span>
      </div>
    </div>
  );
}

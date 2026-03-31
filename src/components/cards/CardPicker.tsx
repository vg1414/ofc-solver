import type { Card as CardType, Suit } from '../../engine/types';
import { ALL_RANKS, SUIT_SYMBOL, SUIT_COLOR } from '../../engine/constants';
import Card from './Card';

interface CardPickerProps {
  /** Kort som redan är använda (grås ut) */
  usedCards: CardType[];
  /** Antal jokrar som redan är placerade (0, 1 eller 2) */
  usedJokers: number;
  /** Vilket kort som är valt just nu (null = inget) — används i normalt läge */
  selectedCard: CardType | null;
  onCardSelect: (card: CardType) => void;
  /** Multi-select-läge (opening / FL) */
  multiSelect?: boolean;
  /** Valda kort i multi-select-läge */
  selectedCards?: CardType[];
  /** Toggle-callback för multi-select */
  onToggleCard?: (card: CardType) => void;
  /** Max antal kort som kan väljas */
  maxCards?: number;
  /** Ta bort ett enskilt valt kort (X-knapp i strip) */
  onRemoveSelectedCard?: (card: CardType) => void;
  /** Rensa alla valda kort */
  onClearSelectedCards?: () => void;
}

function isCardUsed(card: CardType, usedCards: CardType[]): boolean {
  if (card.kind === 'joker') return false;
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

function isMultiSelected(card: CardType, selectedCards: CardType[]): boolean {
  return selectedCards.some((c) => {
    if (card.kind === 'joker' && c.kind === 'joker') return true;
    if (card.kind === 'card' && c.kind === 'card') return c.rank === card.rank && c.suit === card.suit;
    return false;
  });
}

function cardLabel(card: CardType): string {
  if (card.kind === 'joker') return 'Jkr';
  return `${card.rank}${SUIT_SYMBOL[card.suit]}`;
}

function cardLabelColor(card: CardType): string {
  if (card.kind === 'joker') return 'text-yellow-400';
  return SUIT_COLOR[card.suit] === 'red' ? 'text-red-400' : 'text-slate-200';
}

export default function CardPicker({
  usedCards,
  usedJokers,
  selectedCard,
  onCardSelect,
  multiSelect = false,
  selectedCards = [],
  onToggleCard,
  maxCards = 5,
  onRemoveSelectedCard,
  onClearSelectedCards,
}: CardPickerProps) {
  const SUIT_ORDER: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
  const atMax = multiSelect && selectedCards.length >= maxCards;

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

                  if (multiSelect) {
                    const sel = isMultiSelected(card, selectedCards);
                    const disabled = used || (!sel && atMax);
                    return (
                      <Card
                        key={`${rank}-${suit}`}
                        card={card}
                        size="sm"
                        dimmed={disabled}
                        selected={sel}
                        onClick={disabled ? undefined : () => onToggleCard?.(card)}
                      />
                    );
                  }

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

          if (multiSelect) {
            // Räkna hur många jokrar som redan är valda
            const jokersSelected = selectedCards.filter((c) => c.kind === 'joker').length;
            const thisJokerSelected = jokerIndex < jokersSelected;
            const disabled = used || (!thisJokerSelected && (atMax || jokersSelected > jokerIndex));
            return (
              <Card
                key={`joker-${jokerIndex}`}
                card={jokerCard}
                size="sm"
                dimmed={disabled}
                selected={thisJokerSelected}
                onClick={disabled ? undefined : () => onToggleCard?.(jokerCard)}
              />
            );
          }

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

      {/* Valda kort-strip (visas bara i multi-select-läge) */}
      {multiSelect && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs uppercase tracking-widest">
              Valda kort{' '}
              <span className={`font-bold ${atMax ? 'text-emerald-400' : 'text-slate-300'}`}>
                {selectedCards.length}/{maxCards}
              </span>
            </span>
            {selectedCards.length > 0 && (
              <button
                onClick={onClearSelectedCards}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Rensa alla
              </button>
            )}
          </div>

          {selectedCards.length === 0 ? (
            <p className="text-slate-600 text-xs italic">Inga kort valda ännu</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selectedCards.map((card, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5"
                >
                  <span className={`text-xs font-bold ${cardLabelColor(card)}`}>
                    {cardLabel(card)}
                  </span>
                  <button
                    onClick={() => onRemoveSelectedCard?.(card)}
                    className="text-slate-500 hover:text-red-400 transition-colors leading-none"
                    aria-label={`Ta bort ${cardLabel(card)}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// PlayingCard.tsx — Det nya spelkortet
// ============================================================
// Hela kortet har färgens pastellton (ruter = ljusblå osv.), en stor
// valör uppe till vänster och en färgsymbol nere till höger.
//
// Storleken styrs av CSS-variabeln --card-w (bredd i px). Allt inuti
// kortet mäts i `em` och `font-size` sätts till kortets bredd, så
// valör och symbol skalar automatiskt när kortet blir större/mindre.
// ============================================================

import type { Card } from '../../engine/types';
import SuitIcon from './SuitIcon';
import { suitVars, rankLabel, cardAriaLabel } from './cardStyle';

export interface PlayingCardProps extends React.HTMLAttributes<HTMLDivElement> {
  card: Card;
  /** Bredd i px. Utelämnas → ärver --card-w från föräldern */
  width?: number;
  /** Solverns förslag: genomskinligt med streckad ram */
  ghost?: boolean;
  /** Upplyft (valt kort) */
  lifted?: boolean;
  /** Lagt i senaste draget: röd, streckad, blinkande ram (eget lager .recent-ring) */
  recent?: boolean;
  /** Del av öppningshanden: fast mörk ram */
  opening?: boolean;
  /** Spela "snäpp"-animation när kortet dyker upp */
  snap?: boolean;
  /** Ta bort valör-text på jokern (för mycket små kort) */
  compact?: boolean;
}

export default function PlayingCard({
  card,
  width,
  ghost = false,
  lifted = false,
  recent = false,
  opening = false,
  snap = false,
  compact = false,
  className = '',
  style,
  ...rest
}: PlayingCardProps) {
  const v = suitVars(card);
  const isJoker = card.kind === 'joker';
  const label = rankLabel(card);

  const cssVars = {
    ...(width ? { '--card-w': `${width}px` } : {}),
    background: v.bg,
    color: v.fg,
    boxShadow: ghost
      ? 'none'
      : lifted
        ? `inset 0 0 0 1px ${v.line}, 0 0 0 2px var(--accent), var(--shadow-lift)`
        : `inset 0 0 0 1px ${v.line}, var(--shadow-card)`,
    outline: ghost ? '2px dashed var(--accent)' : opening ? '2px solid var(--ink)' : undefined,
    outlineOffset: ghost || opening ? '-1px' : undefined,
    ...style,
  } as React.CSSProperties;

  return (
    <div
      role="img"
      aria-label={cardAriaLabel(card) + (ghost ? ' (förslag)' : '')}
      {...rest}
      className={`
        relative shrink-0 overflow-hidden select-none
        w-[var(--card-w,44px)] h-[calc(var(--card-w,44px)*1.4)] text-[length:var(--card-w,44px)]
        rounded-[0.14em] transition-transform duration-150 ease-out
        ${lifted ? '-translate-y-[0.12em] scale-[1.04]' : ''}
        ${ghost ? 'animate-ghost' : ''}
        ${snap ? 'animate-card-snap' : ''}
        ${className}
      `}
      style={cssVars}
    >
      {recent && !ghost && <span className="recent-ring" aria-hidden="true" />}
      {/* Vattenstämpel: stor, svag färgsymbol centrerad bakom allt */}
      <SuitIcon
        suit={isJoker ? 'star' : card.suit}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[0.92em] h-[0.92em] opacity-[0.12] pointer-events-none"
      />
      {/* Mjuk glans överst, som på ett laminerat kort */}
      <span
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(165deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 42%)' }}
      />
      {isJoker ? (
        <>
          <SuitIcon
            suit="star"
            className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 w-[0.78em] h-[0.78em]"
            style={{ color: 'var(--joker-star)', filter: 'drop-shadow(0 0 0.02em var(--joker-fg))' }}
          />
          {!compact && (
            <span className="absolute inset-x-0 bottom-[0.1em] text-center font-card font-bold leading-none tracking-[0.06em] text-[0.21em]">
              JOKER
            </span>
          )}
        </>
      ) : (
        <>
          <span
            className="absolute left-[0.08em] top-[0.02em] font-card font-bold leading-none"
            style={{
              fontSize: label === '10' ? '0.74em' : '0.86em',
              letterSpacing: label === '10' ? '-0.06em' : '-0.02em',
            }}
          >
            {label}
          </span>
          <SuitIcon suit={card.suit} className="absolute right-[0.08em] bottom-[0.08em] w-[0.46em] h-[0.46em]" />
        </>
      )}
    </div>
  );
}

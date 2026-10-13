// ============================================================
// SuitIcon.tsx — Färgsymboler ritade som SVG
// ============================================================
// Vi ritar ♠♥♦♣ själva i stället för att använda tecknen, eftersom
// vissa telefoner (särskilt iPhone) visar ♥ och ♦ som färgade emojis.
// SVG blir skarpt i alla storlekar och tar färgen från `currentColor`.
// ============================================================

import type { Suit } from '../../engine/types';
import { SUIT_PATHS as PATHS } from './suitPaths';

interface SuitIconProps {
  suit: Suit | 'star';
  className?: string;
  style?: React.CSSProperties;
}

export default function SuitIcon({ suit, className, style }: SuitIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden="true" fill="currentColor">
      <path d={PATHS[suit]} />
    </svg>
  );
}

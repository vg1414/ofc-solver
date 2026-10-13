// Delad kontext + typer för dra-och-släpp (egen fil så att Fast Refresh fungerar)
import { createContext } from 'react';
import type { Card, RowName } from '../../engine/types';

export interface DropTarget {
  /** Rad på brädet (null = inte över brädet) */
  row: RowName | null;
  slot: number | null;
  /** true = över "Din hand" (handen tar emot kort) */
  hand?: boolean;
  /** Plats där det redan ligger ett kort (för att byta plats) */
  filled?: number;
  /** true = över brädet men mellan raderna (räknas inte som "utanför") */
  board?: boolean;
}

/** En plats på brädet — varifrån ett lagt kort dras */
export interface BoardSlot {
  row: RowName;
  slot: number;
}

export interface DragContextValue {
  /** Kortet som dras just nu (null = inget drag) */
  dragging: Card | null;
  /** Lagt kort som dras: platsen det kom från (null = kortet kommer från handen) */
  source: BoardSlot | null;
  /** Rad/plats som kortet svävar över */
  over: DropTarget | null;
  begin: (card: Card, e: React.PointerEvent, source?: BoardSlot) => void;
  move: (e: React.PointerEvent) => void;
  end: (e: React.PointerEvent) => boolean;
  cancel: () => void;
}

export const DragCtx = createContext<DragContextValue | null>(null);

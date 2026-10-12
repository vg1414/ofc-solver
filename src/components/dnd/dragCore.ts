// Delad kontext + typer för dra-och-släpp (egen fil så att Fast Refresh fungerar)
import { createContext } from 'react';
import type { Card, RowName } from '../../engine/types';

export interface DropTarget {
  row: RowName;
  slot: number | null;
}

export interface DragContextValue {
  /** Kortet som dras just nu (null = inget drag) */
  dragging: Card | null;
  /** Rad/plats som kortet svävar över */
  over: DropTarget | null;
  begin: (card: Card, e: React.PointerEvent) => void;
  move: (e: React.PointerEvent) => void;
  end: (e: React.PointerEvent) => boolean;
  cancel: () => void;
}

export const DragCtx = createContext<DragContextValue | null>(null);

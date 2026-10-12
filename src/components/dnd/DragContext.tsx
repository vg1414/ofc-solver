// ============================================================
// DragContext.tsx — Dra-och-släpp för kort (touch + mus)
// ============================================================
//
// Hur det fungerar under huven:
//  1. Ett kort som går att dra får `useDraggable()`-handlers. Vid
//     pointerdown sparas startpunkten och pekaren "fångas" (pointer capture)
//     så att vi får alla rörelser även om fingret lämnar kortet.
//  2. Rör sig fingret mer än 8 px räknas det som ett drag. Då visas en
//     flytande kopia av kortet som följer fingret. På touch ritas den en bit
//     OVANFÖR fingret, så att man ser kortet och raden man siktar på.
//  3. Vid varje rörelse frågar vi webbläsaren vilket element som ligger
//     under kortet (elementFromPoint). Släppytor är märkta med
//     data-drop-row / data-drop-slot. Bara när målet ändras uppdateras
//     React-state — positionen sätts direkt på DOM-elementet, så det är
//     smidigt även på långsamma telefoner.
//  4. Släpper man över en rad/plats anropas onDrop. Rörde sig fingret
//     knappt räknas det i stället som ett vanligt tryck (onTap).
// ============================================================

import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Card, RowName } from '../../engine/types';
import PlayingCard from '../cards/PlayingCard';
import { haptic } from '../cards/cardStyle';
import { DragCtx as Ctx, type DropTarget } from './dragCore';


const TOUCH_LIFT = 46; // px ovanför fingret
const CARD_W = 52;

function hitTest(x: number, y: number): DropTarget | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el) return null;
  const slotEl = el.closest<HTMLElement>('[data-drop-slot]');
  if (slotEl) {
    return { row: slotEl.dataset.dropRow as RowName, slot: Number(slotEl.dataset.dropSlot) };
  }
  const rowEl = el.closest<HTMLElement>('[data-drop-row]');
  if (rowEl) return { row: rowEl.dataset.dropRow as RowName, slot: null };
  return null;
}

interface DragProviderProps {
  children: React.ReactNode;
  /** Returnerar true om kortet faktiskt placerades */
  onDrop: (card: Card, target: DropTarget) => boolean;
}

export function DragProvider({ children, onDrop }: DragProviderProps) {
  const [dragging, setDragging] = useState<Card | null>(null);
  const [over, setOver] = useState<DropTarget | null>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const liftRef = useRef(0);
  const overRef = useRef<DropTarget | null>(null);
  const draggingRef = useRef<Card | null>(null);

  const position = useCallback((x: number, y: number) => {
    const el = floatRef.current;
    if (el) el.style.transform = `translate3d(${x - CARD_W / 2}px, ${y - liftRef.current - CARD_W * 0.7}px, 0) rotate(-3deg)`;
  }, []);

  const begin = useCallback((card: Card, e: React.PointerEvent) => {
    liftRef.current = e.pointerType === 'mouse' ? 0 : TOUCH_LIFT;
    draggingRef.current = card;
    setDragging(card);
    haptic(6);
    // Positionera direkt efter att portalen ritats
    requestAnimationFrame(() => position(e.clientX, e.clientY));
  }, [position]);

  const move = useCallback((e: React.PointerEvent) => {
    position(e.clientX, e.clientY);
    const t = hitTest(e.clientX, e.clientY - liftRef.current);
    const prev = overRef.current;
    if (t?.row !== prev?.row || t?.slot !== prev?.slot) {
      overRef.current = t;
      setOver(t);
      if (t) haptic(3);
    }
  }, [position]);

  const reset = useCallback(() => {
    overRef.current = null;
    draggingRef.current = null;
    setOver(null);
    setDragging(null);
  }, []);

  const end = useCallback((e: React.PointerEvent) => {
    const t = hitTest(e.clientX, e.clientY - liftRef.current) ?? overRef.current;
    const card = draggingRef.current;
    let placed = false;
    if (t && card) placed = onDrop(card, t);
    reset();
    return placed;
  }, [onDrop, reset]);

  const value = useMemo(
    () => ({ dragging, over, begin, move, end, cancel: reset }),
    [dragging, over, begin, move, end, reset],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {dragging &&
        createPortal(
          <div
            ref={floatRef}
            className="fixed left-0 top-0 z-[100] pointer-events-none will-change-transform"
            style={{ transform: 'translate3d(-200px,-200px,0)' }}
          >
            <PlayingCard card={dragging} width={CARD_W} lifted className="!translate-y-0" />
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  );
}

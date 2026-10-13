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
//  5. Ett kort som redan ligger på brädet kan också dras. Då följer
//     platsen det kom ifrån med (source). Släpps det utanför brädet
//     anropas onDrop med målet null — det betyder "ta bort kortet".
//     Släpps det mellan raderna (data-drop-board) händer ingenting.
//     Medan ett lagt kort hålls utanför brädet blir det rött med ✕,
//     så att man ser att det tas bort om man släpper där.
// ============================================================

import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Card, RowName } from '../../engine/types';
import PlayingCard from '../cards/PlayingCard';
import { haptic } from '../cards/cardStyle';
import { DragCtx as Ctx, type BoardSlot, type DropTarget } from './dragCore';


const TOUCH_LIFT = 46; // px ovanför fingret
const CARD_W = 52;

function hitTest(x: number, y: number): DropTarget | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el) return null;
  if (el.closest('[data-drop-hand]')) return { row: null, slot: null, hand: true };
  const filledEl = el.closest<HTMLElement>('[data-drop-filled]');
  if (filledEl) {
    return { row: filledEl.dataset.dropRow as RowName, slot: null, filled: Number(filledEl.dataset.dropFilled) };
  }
  const slotEl = el.closest<HTMLElement>('[data-drop-slot]');
  if (slotEl) {
    return { row: slotEl.dataset.dropRow as RowName, slot: Number(slotEl.dataset.dropSlot) };
  }
  const rowEl = el.closest<HTMLElement>('[data-drop-row]');
  if (rowEl) return { row: rowEl.dataset.dropRow as RowName, slot: null };
  if (el.closest('[data-drop-board]')) return { row: null, slot: null, board: true };
  return null;
}

interface DragProviderProps {
  children: React.ReactNode;
  /**
   * Returnerar true om kortet faktiskt placerades.
   * `source` finns när ett lagt kort flyttas; då kan `target` vara null
   * (släppt utanför brädet = ta bort kortet).
   */
  onDrop: (card: Card, target: DropTarget | null, source?: BoardSlot) => boolean;
}

export function DragProvider({ children, onDrop }: DragProviderProps) {
  const [dragging, setDragging] = useState<Card | null>(null);
  const [over, setOver] = useState<DropTarget | null>(null);
  const [source, setSource] = useState<BoardSlot | null>(null);
  const sourceRef = useRef<BoardSlot | null>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const liftRef = useRef(0);
  const overRef = useRef<DropTarget | null>(null);
  const draggingRef = useRef<Card | null>(null);

  const position = useCallback((x: number, y: number) => {
    const el = floatRef.current;
    if (el) el.style.transform = `translate3d(${x - CARD_W / 2}px, ${y - liftRef.current - CARD_W * 0.7}px, 0) rotate(-3deg)`;
  }, []);

  const begin = useCallback((card: Card, e: React.PointerEvent, from?: BoardSlot) => {
    liftRef.current = e.pointerType === 'mouse' ? 0 : TOUCH_LIFT;
    draggingRef.current = card;
    sourceRef.current = from ?? null;
    setDragging(card);
    setSource(from ?? null);
    haptic(6);
    // Positionera direkt efter att portalen ritats
    requestAnimationFrame(() => position(e.clientX, e.clientY));
  }, [position]);

  const move = useCallback((e: React.PointerEvent) => {
    position(e.clientX, e.clientY);
    const t = hitTest(e.clientX, e.clientY - liftRef.current);
    const prev = overRef.current;
    if (t?.row !== prev?.row || t?.slot !== prev?.slot || t?.hand !== prev?.hand || t?.filled !== prev?.filled || t?.board !== prev?.board) {
      overRef.current = t;
      setOver(t);
      if (t) haptic(3);
    }
  }, [position]);

  const reset = useCallback(() => {
    overRef.current = null;
    draggingRef.current = null;
    sourceRef.current = null;
    setOver(null);
    setDragging(null);
    setSource(null);
  }, []);

  const end = useCallback((e: React.PointerEvent) => {
    const card = draggingRef.current;
    const from = sourceRef.current;
    let placed = false;
    if (from) {
      // Lagt kort: målet där det släpps gäller (null = utanför brädet)
      if (card) placed = onDrop(card, hitTest(e.clientX, e.clientY - liftRef.current), from);
    } else {
      const t = hitTest(e.clientX, e.clientY - liftRef.current) ?? overRef.current;
      if (t && card) placed = onDrop(card, t);
    }
    reset();
    return placed;
  }, [onDrop, reset]);

  // Lagt kort som hålls utanför brädet (eller över handen) → tas bort vid släpp
  const removing = !!source && (!over || (!over.row && !over.board));

  const value = useMemo(
    () => ({ dragging, source, over, begin, move, end, cancel: reset }),
    [dragging, source, over, begin, move, end, reset],
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
            <div className={`relative transition-transform duration-150 ${removing ? 'scale-90' : ''}`}>
              <PlayingCard card={dragging} width={CARD_W} lifted className="!translate-y-0" />
              <span
                aria-hidden
                className={`absolute inset-0 scale-[1.04] flex items-center justify-center rounded-[7px] bg-[rgba(208,68,63,0.8)] text-[22px] font-bold text-white shadow-[0_0_0_2px_#d0443f,0_6px_18px_rgba(208,68,63,0.45)] transition-opacity duration-150 ${
                  removing ? 'opacity-100' : 'opacity-0'
                }`}
              >
                ✕
              </span>
            </div>
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  );
}

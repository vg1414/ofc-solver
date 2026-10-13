// Hooks för dra-och-släpp — se DragContext.tsx för hur det fungerar
import { useContext, useRef } from 'react';
import type { Card } from '../../engine/types';
import { DragCtx as Ctx, type BoardSlot } from './dragCore';

export function useDragContext() {
  return useContext(Ctx);
}

/**
 * Gör ett element dragbart. `onTap` körs vid vanligt tryck/klick.
 * `source` = platsen på brädet om kortet redan ligger där (flytta/ta bort).
 * Returnerar props att sprida på elementet.
 */
export function useDraggable(card: Card | null, onTap: () => void, disabled = false, source?: BoardSlot) {
  const ctx = useContext(Ctx);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const active = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || e.button > 0) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    active.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    if (!active.current) {
      if (!ctx || !card || Math.hypot(e.clientX - s.x, e.clientY - s.y) < 8) return;
      active.current = true;
      ctx.begin(card, e, source);
    }
    ctx?.move(e);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || s.id !== e.pointerId) return;
    if (active.current) {
      active.current = false;
      ctx?.end(e);
    } else {
      onTap();
    }
  };

  const onPointerCancel = () => {
    start.current = null;
    if (active.current) ctx?.cancel();
    active.current = false;
  };

  // Tangentbord (Enter/Mellanslag) ger click med detail 0
  const onClick = (e: React.MouseEvent) => {
    if (e.detail === 0 && !disabled) onTap();
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClick, style: { touchAction: 'none' as const } };
}

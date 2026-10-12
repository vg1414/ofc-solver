// ============================================================
// useSwipeDown.ts — "Svep ner för att stänga" för ark och paneler
// ============================================================
//
// Under huven:
//  - Vid pointerdown sparas startpunkt och tid. Om användaren börjar i en
//    scrollbar lista som inte står högst upp ignoreras svepet (då ska
//    listan scrollas i stället).
//  - När fingret rör sig nedåt flyttas elementet lika mycket (translateY),
//    utan transition — rutan "följer fingret".
//  - Vid släpp räknas hastigheten ut. Långt drag (> 28 % av höjden eller
//    > 120 px) eller snabbt svep (> 0,55 px/ms) → stäng. Annars fjädrar
//    rutan tillbaka med en kort transition.
// ============================================================

import { useRef } from 'react';

interface Options {
  onClose: () => void;
  enabled?: boolean;
}

export function useSwipeDown<T extends HTMLElement>({ onClose, enabled = true }: Options) {
  const ref = useRef<T>(null);
  const s = useRef<{ y: number; t: number; id: number; dy: number; dragging: boolean } | null>(null);

  const setY = (y: number, animate: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
    el.style.transform = y ? `translateY(${y}px)` : '';
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!enabled || e.button > 0) return;
    // Starta inte svep inifrån en lista som är nedscrollad, eller i formulärfält
    const target = e.target as HTMLElement;
    if (target.closest('input, select, textarea, [data-no-swipe]')) return;
    let n: HTMLElement | null = target;
    while (n && n !== ref.current) {
      if (n.scrollTop > 0 && n.scrollHeight > n.clientHeight) return;
      n = n.parentElement;
    }
    s.current = { y: e.clientY, t: performance.now(), id: e.pointerId, dy: 0, dragging: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const st = s.current;
    if (!st || st.id !== e.pointerId) return;
    const dy = e.clientY - st.y;
    if (!st.dragging) {
      if (dy < 6) {
        if (dy < -6) s.current = null; // uppåt = scroll, inte svep
        return;
      }
      st.dragging = true;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    st.dy = Math.max(0, dy);
    setY(st.dy, false);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const st = s.current;
    s.current = null;
    if (!st || !st.dragging || st.id !== e.pointerId) return;
    const h = ref.current?.offsetHeight ?? 400;
    const v = st.dy / Math.max(1, performance.now() - st.t);
    if (st.dy > Math.min(120, h * 0.28) || v > 0.55) {
      setY(h + 40, true);
      window.setTimeout(onClose, 200);
    } else {
      setY(0, true);
    }
  };

  const onPointerCancel = () => {
    if (s.current?.dragging) setY(0, true);
    s.current = null;
  };

  /** Återställ läget (t.ex. när panelen öppnas igen) */
  const reset = () => setY(0, false);

  return { ref, reset, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } };
}

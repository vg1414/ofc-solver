// ============================================================
// BottomSheet.tsx — Ark som glider upp underifrån
// ============================================================
// - Svep ner (följer fingret) eller tryck/svep på den mörka ytan → stäng
// - Esc stänger på desktop
// - På breda skärmar visas arket som en centrerad dialog
// ============================================================

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSwipeDown } from '../../hooks/useSwipeDown';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  // `mounted` håller arket kvar i DOM:en under ut-animationen
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [scrollable, setScrollable] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { ref, handlers, reset } = useSwipeDown<HTMLDivElement>({ onClose });

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), 260);
    return () => window.clearTimeout(t);
  }, [open]);

  useLayoutEffect(() => {
    if (!mounted) return;
    reset();
    const b = bodyRef.current;
    if (b) setScrollable(b.scrollHeight > b.clientHeight + 1);
    // reset är stabil nog — vi vill bara köra när arket monteras
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Mörk yta — tryck eller svep stänger */}
      <div
        className={`absolute inset-0 bg-[rgba(42,30,20,0.42)] backdrop-blur-[6px] transition-opacity duration-300 ${shown ? 'opacity-100' : 'opacity-0'}`}
        style={{ touchAction: 'none' }}
        onPointerUp={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative w-full sm:w-[420px] transition-transform duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          shown ? 'translate-y-0' : 'translate-y-full sm:translate-y-8 sm:scale-95'
        } ${shown ? '' : 'sm:opacity-0'}`}
      >
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          {...handlers}
          className="bg-surface/95 backdrop-blur-xl text-ink rounded-t-[28px] sm:rounded-[28px] shadow-[0_30px_80px_-20px_rgba(60,30,10,0.45)] max-h-[85dvh] flex flex-col pb-[env(safe-area-inset-bottom)]"
          style={{ touchAction: scrollable ? 'pan-y' : 'none' }}
        >
          <div className="pt-2.5 pb-1 shrink-0" style={{ touchAction: 'none' }}>
            <div className="mx-auto h-1.5 w-10 rounded-full bg-line-strong" />
            {title && <h2 className="title-serif px-5 pt-3 text-[24px]">{title}</h2>}
          </div>
          <div ref={bodyRef} className="overflow-y-auto overscroll-contain px-5 pb-5 pt-2">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ============================================================
// DockLayout.tsx — Samma layout som Solvern: innehåll + fast panel
// ============================================================
// Mobil: panelen ("docken") ligger fast längst ner, nåbar med tummen.
// Sidan får lika mycket luft i botten som docken är hög (mäts med
// ResizeObserver), så inget hamnar bakom den.
// Desktop / liggande telefon ("wide"): två kolumner, docken till höger.
// ============================================================

import { useLayoutEffect, useRef, useState } from 'react';
import Footer from '../layout/Footer';

interface DockLayoutProps {
  children: React.ReactNode;
  dock: React.ReactNode;
}

export default function DockLayout({ children, dock }: DockLayoutProps) {
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockH, setDockH] = useState(200);

  useLayoutEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDockH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className="wide:grid wide:grid-cols-[minmax(0,1fr)_minmax(300px,420px)] wide:gap-5 wide:items-start"
      style={{ '--dock-h': `${dockH}px` } as React.CSSProperties}
    >
      <section className="flex flex-col gap-3 pb-[calc(var(--dock-h)+16px)] wide:pb-0 min-w-0">
        {children}
        {/* På mobil ligger signaturen i panelen längst ner */}
        <Footer className="hidden wide:block" />
      </section>
      <aside
        ref={dockRef}
        data-dock
        className="fixed inset-x-2 bottom-[max(8px,env(safe-area-inset-bottom))] z-30 wide:sticky wide:inset-x-auto wide:bottom-auto wide:top-[84px] wide:z-0"
      >
        <div className="glass mx-auto max-w-xl wide:max-w-none rounded-[28px] !shadow-[var(--shadow-big)] overflow-hidden wide:max-h-[calc(100dvh-100px)] wide:overflow-y-auto">
          <div className="max-h-[62dvh] wide:max-h-none overflow-y-auto overscroll-contain px-3 pt-3 pb-2">{dock}</div>
          <div className="wide:hidden pb-2 text-center text-[10px] text-ink-3">Made by: David Hefner</div>
        </div>
      </aside>
    </div>
  );
}

// ============================================================
// DockLayout.tsx — Samma layout som Solvern: innehåll + fast panel
// ============================================================
// Mobil: panelen ("docken") ligger fast längst ner, nåbar med tummen.
// Sidan får lika mycket luft i botten som docken är hög (mäts med
// ResizeObserver), så inget hamnar bakom den.
// Desktop / liggande telefon ("wide"): två kolumner, docken till höger.
// `side` (t.ex. draglistan): under docken i högerkolumnen på bred skärm,
// under innehållet på stående telefon. Renderas på båda ställena och
// döljs med CSS, så att inget behöver mäta skärmen.
// Flera flikar kan ha en DockLayout samtidigt (de dolda finns kvar i
// sidan). Leta därför upp panelen via `dockFor(el)`, inte med en global
// querySelector — då kan man få en dold flik panel.
// ============================================================

import { useLayoutEffect, useRef, useState } from 'react';
import Footer from '../layout/Footer';

interface DockLayoutProps {
  children: React.ReactNode;
  dock: React.ReactNode;
  side?: React.ReactNode;
}

/** Panelen ([data-dock]) i samma DockLayout som `el` */
export function dockFor(el: Element | null): Element | null {
  return el?.closest('[data-dock-layout]')?.querySelector('[data-dock]') ?? null;
}

export default function DockLayout({ children, dock, side }: DockLayoutProps) {
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
      data-dock-layout
      className="wide:grid wide:grid-cols-[minmax(0,1fr)_minmax(300px,420px)] wide:gap-5 wide:items-start"
      style={{ '--dock-h': `${dockH}px` } as React.CSSProperties}
    >
      <section className="flex flex-col gap-3 pb-[calc(var(--dock-h)+16px)] wide:pb-0 min-w-0">
        {children}
        {side && <div className="mt-2 wide:hidden">{side}</div>}
        {/* På mobil ligger signaturen i panelen längst ner */}
        <Footer className="hidden wide:block" />
      </section>
      <aside
        ref={dockRef}
        data-dock
        className="fixed inset-x-2 bottom-[max(8px,env(safe-area-inset-bottom))] z-30 wide:sticky wide:inset-x-auto wide:bottom-auto wide:top-[84px] wide:z-0 wide:flex wide:max-h-[calc(100dvh-100px)] wide:flex-col wide:gap-3"
      >
        <div className="glass mx-auto max-w-xl wide:max-w-none wide:w-full wide:min-h-0 rounded-[28px] !shadow-[var(--shadow-big)] overflow-hidden wide:max-h-[calc(100dvh-100px)] wide:overflow-y-auto">
          <div className="max-h-[62dvh] wide:max-h-none overflow-y-auto overscroll-contain px-3 pt-3 pb-2">{dock}</div>
          <div className="wide:hidden pb-2 text-center text-[10px] text-ink-3">Made by: David Hefner</div>
        </div>
        {side && <div className="hidden wide:block shrink-0 max-h-[45dvh] overflow-y-auto overscroll-contain rounded-[28px] glass px-3 py-3">{side}</div>}
      </aside>
    </div>
  );
}

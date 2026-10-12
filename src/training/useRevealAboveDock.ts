// ============================================================
// useRevealAboveDock.ts — Scrolla så att brädet syns ovanför panelen
// ============================================================
// Samma knep som i Solvern: mät brädets underkant mot panelens
// ([data-dock]) överkant och scrolla mellanskillnaden mjukt.
// Görs bara på mobil — på desktop ligger panelen bredvid brädet.
// ============================================================

import { useEffect, type RefObject } from 'react';

export function useRevealAboveDock(ref: RefObject<HTMLElement | null>, trigger: unknown) {
  useEffect(() => {
    if (!trigger) return;
    const t = window.setTimeout(() => {
      const b = ref.current?.getBoundingClientRect();
      const d = document.querySelector('[data-dock]')?.getBoundingClientRect();
      if (!b || !d || d.height === 0 || window.matchMedia('(min-width: 1024px)').matches) return;
      const overlap = b.bottom - d.top + 10;
      if (overlap > 0) window.scrollBy({ top: overlap, behavior: 'smooth' });
    }, 120);
    return () => window.clearTimeout(t);
  }, [ref, trigger]);
}

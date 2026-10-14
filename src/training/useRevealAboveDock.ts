// ============================================================
// useRevealAboveDock.ts — Scrolla så att brädet syns ovanför panelen
// ============================================================
// Samma knep som i Solvern: mät brädets underkant mot panelens
// ([data-dock]) överkant och scrolla mellanskillnaden mjukt.
// Görs bara på mobil — på desktop ligger panelen bredvid brädet.
//
// Panelen kan växa efter att turen börjat (coachens bricka dyker upp,
// tipstexten blir två rader …). Därför följer en ResizeObserver panelen
// så länge `trigger` är satt: växer den, kollas brädet igen. Vi scrollar
// bara när panelen växer — aldrig när du själv har scrollat.
// ============================================================

import { useEffect, type RefObject } from 'react';
import { dockFor } from '../components/training/DockLayout';

export function useRevealAboveDock(ref: RefObject<HTMLElement | null>, trigger: unknown) {
  useEffect(() => {
    if (!trigger) return;
    const reveal = () => {
      const b = ref.current?.getBoundingClientRect();
      const d = dockFor(ref.current)?.getBoundingClientRect();
      if (!b || !d || d.height === 0 || window.matchMedia('(min-width: 1024px)').matches) return;
      const overlap = b.bottom - d.top + 10;
      if (overlap > 0) window.scrollBy({ top: overlap, behavior: 'smooth' });
    };
    const t = window.setTimeout(reveal, 120);

    const dock = dockFor(ref.current);
    let lastH = dock?.getBoundingClientRect().height ?? 0;
    let grow = 0;
    const ro = dock
      ? new ResizeObserver(() => {
          const h = dock.getBoundingClientRect().height;
          if (h > lastH + 1) {
            window.clearTimeout(grow);
            grow = window.setTimeout(reveal, 60);
          }
          lastH = h;
        })
      : null;
    if (dock) ro?.observe(dock);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(grow);
      ro?.disconnect();
    };
  }, [ref, trigger]);
}

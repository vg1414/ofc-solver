// ============================================================
// useFitBoards.ts — Båda brädena + panelen får plats på telefonens skärm
// ============================================================
// Används i Hel hand och Spela. Brädenas kortbredd styrs av CSS-variabeln
// --card-h-cap (BoardView tar min(maxCardWidth, skärmbredd, --card-h-cap)).
// Den här hooken räknar ut ett tak per bräde så att allt från brädesytans
// överkant ner till panelen ryms utan att man behöver scrolla.
//
// Så räknas det:
//  - Ett brädes höjd är linjär i kortbredden w: 3 rader à (1,4w + 8 px),
//    två mellanrum à 0,12w och 24 px kant → h(w) = 4,44w + 48.
//  - Tillgänglig höjd = skärmens höjd − ytans överkant (räknat från sidans
//    topp, alltså som om sidan inte är scrollad) − panelens höjd − luft.
//  - "Övrigt" i ytan (etiketter, mellanrum) mäts: ytans höjd minus de två
//    brädenas höjd. Det beror inte på w, så det räknas om varje gång.
//  - Resten delas så att motståndarens kort är RATIO av dina:
//    4,44 · w · (1 + RATIO) + 96 = brädesbudget.
//  - Panelens höjd mäts bara när det är din tur (`measureDock`) och
//    sparas. Annars skulle brädena växa när datorn tänker (liten panel)
//    och krympa igen på din tur — det skulle hoppa varje drag.
// På bred skärm (desktop / liggande telefon) görs inget: där ligger
// panelen bredvid brädena.
// ============================================================

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { dockFor } from '../components/training/DockLayout';

const RATIO = 0.66;
const H_PER_W = 4.44;
const H_FIXED = 48;
const MIN_ME = 34;
const MAX_ME = 84;
const MAX_OPP = 44;

export interface FitCaps {
  me: number;
  opp: number;
}

export function useFitBoards(
  areaRef: RefObject<HTMLElement | null>,
  meRef: RefObject<HTMLElement | null>,
  oppRef: RefObject<HTMLElement | null>,
  measureDock: boolean,
): FitCaps | null {
  const [caps, setCaps] = useState<FitCaps | null>(null);
  const dockReserve = useRef<number | null>(null);

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const wide = window.matchMedia('(min-width: 1024px), (orientation: landscape) and (max-height: 540px)');
    const dock = dockFor(area);

    const calc = () => {
      if (wide.matches) return setCaps(null);
      if (measureDock && dock) {
        const h = window.innerHeight - dock.getBoundingClientRect().top;
        if (h > 0) dockReserve.current = h;
      }
      const reserve = dockReserve.current ?? 170;
      const top = area.getBoundingClientRect().top + window.scrollY;
      const avail = window.innerHeight - top - reserve - 8;
      const boards = (meRef.current?.offsetHeight ?? 0) + (oppRef.current?.offsetHeight ?? 0);
      const other = area.offsetHeight - boards;
      const w = (avail - other - 2 * H_FIXED) / (H_PER_W * (1 + RATIO));
      const me = Math.round(Math.max(MIN_ME, Math.min(MAX_ME, w)) * 2) / 2;
      const opp = Math.round(Math.min(MAX_OPP, me * RATIO) * 2) / 2;
      setCaps((c) => (c && c.me === me && c.opp === opp ? c : { me, opp }));
    };

    calc();
    // Ytan ändras (t.ex. FL-chip, dold öppning) → räkna om. Samma tak ger
    // samma state, så det blir ingen evig loop.
    const ro = new ResizeObserver(calc);
    ro.observe(area);
    if (measureDock && dock) ro.observe(dock);
    window.addEventListener('resize', calc);
    wide.addEventListener('change', calc);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', calc);
      wide.removeEventListener('change', calc);
    };
  }, [areaRef, meRef, oppRef, measureDock]);

  return caps;
}

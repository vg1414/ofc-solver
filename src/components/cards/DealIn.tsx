// ============================================================
// DealIn.tsx — Nytt kort: visas stort mitt på skärmen, flyger ner i handen
// ============================================================
// Används av PlayDock när du får ett enda kort att lägga, så att man
// direkt ser vilket kort det är och var på skärmen det hamnar.
//
// Så fungerar det:
//  1. När ett nytt kort delas ut mäts platsen i handen (`target`).
//  2. Ett stort kort (CARD_W px) ritas i en portal, fast mitt på skärmen.
//  3. Web Animations API kör en tidslinje på transform: poppar upp
//     (0 → 22 %), står still en stund (→ 50 %), och flyger sedan med en
//     liten överstuds till handens plats, där det krymps till samma
//     storlek som kortet i handen (translate + scale från mitten).
//  4. Under tiden är kortet i handen osynligt (PlayDock döljer det tills
//     `onLanded` anropas). När flygningen är klar tas det stora kortet
//     bort och handens kort visas.
// Mätningen görs i useEffect (inte useLayoutEffect): då har React satt
// alla ref:ar, även handens som ligger efter DealIn i trädet.
// Kortet ritas stort och krymps (inte tvärtom), så att det är skarpt
// när det är som störst. "Minska rörelse" hoppar över animationen.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Card } from '../../engine/types';
import PlayingCard from './PlayingCard';

const CARD_W = 120;
const DURATION = 1150;

interface DealInProps {
  /** Kortet som delas ut */
  card: Card;
  /** Elementet i handen där kortet landar */
  target: () => HTMLElement | null;
  /** Kortet har landat (eller animationen hoppades över) */
  onLanded: () => void;
}

export default function DealIn({ card, target, onLanded }: DealInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = ref.current;
    const t = target()?.getBoundingClientRect();
    if (!el || !t || t.width === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDone(true);
      onLanded();
      return;
    }
    // Stora kortets mittpunkt: mitt i sidled, lite ovanför mitten i höjdled
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.42;
    const h = CARD_W * 1.4;
    el.style.left = `${cx - CARD_W / 2}px`;
    el.style.top = `${cy - h / 2}px`;
    const dx = t.left + t.width / 2 - cx;
    const dy = t.top + t.height / 2 - cy;
    const k = t.width / CARD_W;
    const anim = el.animate(
      [
        { offset: 0, transform: 'scale(0.4) rotate(-10deg)', opacity: 0, easing: 'cubic-bezier(.2,.9,.3,1.3)' },
        { offset: 0.22, transform: 'scale(1) rotate(0deg)', opacity: 1 },
        { offset: 0.5, transform: 'scale(1) rotate(0deg)', opacity: 1, easing: 'cubic-bezier(.55,0,.25,1.12)' },
        { offset: 1, transform: `translate(${dx}px, ${dy}px) scale(${k}) rotate(0deg)`, opacity: 1 },
      ],
      { duration: DURATION, fill: 'both' },
    );
    anim.onfinish = () => {
      setDone(true);
      onLanded();
    };
    return () => {
      anim.onfinish = null;
      anim.cancel();
    };
    // Körs en gång per kort (komponenten får en ny key för varje utdelning)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (done) return null;
  return createPortal(
    <div ref={ref} aria-hidden="true" className="pointer-events-none fixed z-[60] drop-shadow-[0_18px_30px_rgba(0,0,0,0.35)]" style={{ opacity: 0 }}>
      <PlayingCard card={card} width={CARD_W} />
    </div>,
    document.body,
  );
}

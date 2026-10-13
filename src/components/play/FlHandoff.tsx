// ============================================================
// FlHandoff.tsx — Stor nedräkning innan någon lägger sin Fantasy Land
// ============================================================
// Täcker HELA skärmen (ogenomskinligt), så att den som just tryckt Klar
// inte ser FL-korten medan telefonen lämnas över. Räknar ner från
// FL_COUNTDOWN sekunder; när den når 0 anropas onDone() och korten visas.
// FL-spelaren kan hoppa över med "visa nu" när hen har telefonen.
//
// Tiden räknas mot en fast sluttid (inte "minus 1 varje sekund"), så att
// nedräkningen inte påverkas av att partiet ritas om (klockan tickar
// fyra gånger i sekunden). onDone ligger i en ref av samma skäl.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import type { SeatId } from '../../training/game';
import { haptic } from '../cards/cardStyle';

export const FL_COUNTDOWN = 5;

interface Props {
  seat: SeatId;
  name: string;
  /** Den som lämnar över (null = ingen, t.ex. ny hand) */
  from: string | null;
  cards: number;
  onDone: () => void;
}

export default function FlHandoff({ seat, name, from, cards, onDone }: Props) {
  const [end] = useState(() => performance.now() + FL_COUNTDOWN * 1000);
  const [left, setLeft] = useState(FL_COUNTDOWN);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      const s = Math.max(0, Math.ceil((end - performance.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        window.clearInterval(id);
        haptic([10, 40, 10]);
        done.current();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [end]);

  // Liten vibration vid varje ny siffra
  useEffect(() => {
    if (left > 0) haptic(6);
  }, [left]);

  const p = `p${seat + 1}`;
  const R = 92;
  const C = 2 * Math.PI * R;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-page px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-center animate-fade-in"
      role="alertdialog"
      aria-modal="true"
      aria-label={`Ge telefonen till ${name}`}
    >
      <div>
        <div className="text-[13px] font-extrabold uppercase tracking-[0.1em]" style={{ color: `var(--${p}-ink)` }}>
          ★ Fantasy Land · {cards} kort
        </div>
        <div className="mt-1 font-serif text-[32px] font-extrabold leading-tight text-ink">Ge telefonen till {name}</div>
        {from && <div className="mt-1 text-[14px] font-semibold text-ink-2">{from} — titta bort nu</div>}
      </div>

      {/* Ring som töms + stor siffra */}
      <div className="relative h-[220px] w-[220px]">
        <svg viewBox="0 0 220 220" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="110" cy="110" r={R} fill="none" stroke="var(--line)" strokeWidth="12" />
          <circle
            cx="110"
            cy="110"
            r={R}
            fill="none"
            stroke={`var(--${p})`}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - left / FL_COUNTDOWN)}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute inset-[26px] flex items-center justify-center rounded-full text-white" style={{ background: `var(--grad-${p})`, boxShadow: `var(--glow-${p})` }}>
          <span key={left} className="font-serif text-[96px] font-extrabold leading-none tabular animate-grade-pop" aria-live="assertive">
            {left}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          haptic([8, 30, 8]);
          done.current();
        }}
        className="h-12 rounded-full bg-surface px-6 text-[14px] font-bold text-ink-2 shadow-[var(--shadow-soft)] transition-transform active:scale-95"
      >
        Jag är {name} — visa nu
      </button>
    </div>
  );
}

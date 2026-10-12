// ============================================================
// TrainingBits.tsx — Små delade delar för träningsläget
// ============================================================

import { useEffect, useRef, useState } from 'react';
import type { Board } from '../../engine/types';
import type { Grade } from '../../training/moves';
import { countPlaced } from '../../training/moves';
import SuitIcon from '../cards/SuitIcon';
import ResultBoardPreview from '../solver/ResultBoardPreview';

/**
 * Räknar upp ett tal mot `target` (ease-out, ~700 ms).
 * Startar från förra värdet, så totalpoängen "rullar" vidare.
 */
export function useCountUp(target: number, duration = 700, start?: number) {
  const [v, setV] = useState(start ?? target);
  const from = useRef(start ?? target);
  useEffect(() => {
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const x = start + (target - start) * (1 - Math.pow(1 - t, 3));
      setV(x);
      from.current = x;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

/** Rad överst: "Scenario 3 / 10", prickar för gjorda scenarion, poäng och Avsluta */
export function RunHeader({
  label,
  index,
  count,
  dots,
  score,
  scoreLabel,
  onExit,
}: {
  label: string;
  index: number;
  count: number;
  dots?: (Grade | null)[];
  score: React.ReactNode;
  scoreLabel: string;
  onExit: () => void;
}) {
  return (
    <div className="glass flex items-center gap-3 rounded-[22px] px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-extrabold text-ink tabular">
          {label} {Math.min(index + 1, count)} <span className="text-ink-3">/ {count}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-[3px]">
          {Array.from({ length: count }, (_, i) => {
            const g = dots?.[i] ?? null;
            const bg = g === 'perfect' ? 'var(--grad-gold)' : g === 'good' ? 'var(--grad)' : g === 'miss' ? 'var(--danger)' : i < index ? 'var(--ink-3)' : i === index ? 'var(--accent)' : 'var(--line-strong)';
            return (
              <span
                key={i}
                className={`h-[6px] rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${i === index && !g ? 'w-4' : 'w-[6px]'}`}
                style={{ background: bg, opacity: i > index ? 0.6 : 1 }}
              />
            );
          })}
        </div>
      </div>
      <div className="text-right leading-none">
        <div className="text-[20px] font-extrabold tabular text-gold">{score}</div>
        <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">{scoreLabel}</div>
      </div>
      <button type="button" onClick={onExit} aria-label="Avsluta" className="btn-ghost flex h-9 w-9 items-center justify-center rounded-full">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

/** Motståndarens bräde i litet format */
export function OpponentMini({ board, label = 'Motståndaren' }: { board: Board; label?: string }) {
  const n = countPlaced(board);
  if (n === 0) return null;
  return (
    <div className="glass flex items-center gap-3 self-start rounded-[20px] px-3 py-2 animate-fade-in">
      <ResultBoardPreview board={board} cardWidth={17} />
      <span className="text-[11px] font-semibold leading-tight text-ink-3">
        {label}
        <br />
        <span className="tabular">{n} kort</span>
      </span>
    </div>
  );
}

/** Snurrande logga + bar (samma stil som Solverns progress) */
export function Spinner({ title, sub, progress }: { title: string; sub?: string; progress?: number | null }) {
  const p = progress == null ? null : Math.min(100, Math.max(0, progress));
  return (
    <div className="flex flex-col gap-3 py-1 animate-fade-in" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-[var(--glow)] animate-logo-spin" style={{ background: 'var(--grad)' }}>
          <SuitIcon suit="spades" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="title-serif text-[19px]">{title}</div>
          {sub && <div className="text-[12px] font-medium text-ink-3">{sub}</div>}
        </div>
        {p != null && <span className="text-[20px] font-extrabold tabular text-accent-ink">{Math.round(p)}%</span>}
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-sunken">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
          style={{ width: p == null ? '35%' : `${Math.max(4, p)}%`, background: 'var(--grad)' }}
        />
        <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
      </div>
    </div>
  );
}

/** Liten status-pill: solvern räknar i bakgrunden / klar */
export function SolverChip({ ready, progress }: { ready: boolean; progress: number | null }) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-[11px] font-bold tabular transition-colors duration-300 ${
        ready ? 'bg-accent-soft text-accent-ink' : 'bg-sunken text-ink-3'
      }`}
    >
      {ready ? (
        <>✓ Solvern är klar</>
      ) : (
        <>
          <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
          Solvern räknar i bakgrunden{progress != null ? ` · ${Math.round(progress)}%` : '…'}
        </>
      )}
    </div>
  );
}

export const GRADE_STYLE: Record<Grade, { bg: string; glow: string; icon: string; text: string }> = {
  perfect: { bg: 'var(--grad-gold)', glow: 'var(--glow-gold)', icon: '★', text: '#3a2600' },
  good: { bg: 'var(--grad)', glow: 'var(--glow)', icon: '✓', text: '#fff' },
  miss: { bg: 'linear-gradient(135deg,#ff9a8f 0%,#e2554d 55%,#b8352f 100%)', glow: '0 8px 22px -6px rgba(208,68,63,0.5)', icon: '✕', text: '#fff' },
};

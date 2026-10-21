// ============================================================
// SessionHeader.tsx — Rad överst under en session mot datorn
// ============================================================
// Ser olika ut beroende på sessionens längd:
//  - Händer:  "Hand 3 / 10" + en prick per hand (i vinnarens färg: blå = du / spelare 1, orange = datorn / spelare 2).
//             FL-händer som spelas ut efter sista handen blir lila prickar.
//  - Minuter: "Hand 4" + nedräkning och en mätare som töms. Sista minuten
//             pulserar den, och när tiden är ute står det "Sista handen".
//  - Fritt:   "Hand 7" + ett stoppur som räknar uppåt.
// ============================================================

import type { SessionLength } from '../../training/session';
import { clockText } from '../../training/session';

/** good = grön, miss = röd. Mot datorn / 2 spelare: p1 = du / spelare 1 vann (blå), p2 = datorn / spelare 2 vann (orange) */
export type Dot = 'good' | 'miss' | 'p1' | 'p2' | null;

interface Props {
  length: SessionLength;
  handNo: number;
  dots: Dot[];
  /** Speltid i ms */
  elapsed: number;
  /** Den här handen spelas bara för att FL ska spelas ut */
  extra: boolean;
  score: React.ReactNode;
  onExit: () => void;
  /** Tryck på poängen → ställningen */
  onScore?: () => void;
}

export default function SessionHeader({ length, handNo, dots, elapsed, extra, score, onExit, onScore }: Props) {
  return (
    <div className="glass flex items-center gap-3 rounded-[20px] px-3.5 py-1.5">
      <div className="min-w-0 flex-1">
        {length.kind === 'hands' ? (
          <HandsProgress n={length.n} handNo={handNo} dots={dots} extra={extra} />
        ) : length.kind === 'minutes' ? (
          <Countdown total={length.n * 60_000} elapsed={elapsed} handNo={handNo} extra={extra} />
        ) : (
          <div className="flex items-center gap-2 text-[13px] font-extrabold text-ink tabular">
            Hand {handNo}
            <span className="flex items-center gap-1 rounded-full bg-sunken px-2 py-[1px] text-[11.5px] text-ink-2">
              <ClockIcon /> {clockText(elapsed)}
            </span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onScore}
        aria-label="Visa ställningen"
        className="-my-1 rounded-[14px] px-2 py-1 text-right leading-none transition-[background,transform] duration-200 hover:bg-sunken/70 active:scale-95"
      >
        <div className="text-[18px] font-extrabold tabular text-gold">{score}</div>
        <div className="mt-0.5 flex items-center justify-end gap-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">
          poäng <span className="text-[11px]">›</span>
        </div>
      </button>
      <button type="button" onClick={onExit} aria-label="Avsluta" className="btn-ghost flex h-9 w-9 items-center justify-center rounded-full">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

function HandsProgress({ n, handNo, dots, extra }: { n: number; handNo: number; dots: Dot[]; extra: boolean }) {
  const shown = Math.max(n, handNo);
  const index = handNo - 1;
  return (
    <>
      <div className="flex items-center gap-2 text-[13px] font-extrabold text-ink tabular">
        <span>
          Hand {handNo} <span className="text-ink-3">/ {n}</span>
        </span>
        {extra && <FlExtraChip />}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-[3px]">
        {Array.from({ length: shown }, (_, i) => {
          const g = dots[i] ?? null;
          const over = i >= n; // FL-hand efter sista handen
          const bg = g === 'good' ? 'var(--grad)' : g === 'p1' ? 'var(--grad-p1)' : g === 'p2' ? 'var(--grad-p2)' : g === 'miss' ? 'var(--danger)' : i < index ? 'var(--ink-3)' : i === index ? (over ? 'var(--fl)' : 'var(--accent)') : 'var(--line-strong)';
          return (
            <span
              key={i}
              className={`h-[6px] rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${i === index && !g ? 'w-4' : 'w-[6px]'} ${over ? 'ring-1 ring-fl ring-offset-1 ring-offset-transparent' : ''}`}
              style={{ background: bg, opacity: i > index ? 0.6 : 1 }}
            />
          );
        })}
      </div>
    </>
  );
}

function Countdown({ total, elapsed, handNo, extra }: { total: number; elapsed: number; handNo: number; extra: boolean }) {
  const left = Math.max(0, total - elapsed);
  const out = left <= 0;
  const urgent = !out && left <= 60_000;
  const frac = left / total;
  return (
    <>
      <div className="flex items-center gap-2 text-[13px] font-extrabold text-ink tabular">
        <span>Hand {handNo}</span>
        {extra ? (
          <FlExtraChip />
        ) : out ? (
          <span className="rounded-full px-2 py-[1px] text-[11px] text-[#3a2600] shadow-[var(--glow-gold)] animate-badge-in" style={{ background: 'var(--grad-gold)' }}>
            ⏱ Sista handen
          </span>
        ) : (
          <span className={`flex items-center gap-1 rounded-full px-2 py-[1px] text-[11.5px] ${urgent ? 'bg-danger-soft text-danger animate-pulse' : 'bg-sunken text-ink-2'}`}>
            <ClockIcon /> {clockText(left)} kvar
          </span>
        )}
      </div>
      <div className="relative mt-1.5 h-[6px] overflow-hidden rounded-full bg-sunken">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-linear"
          style={{ width: `${frac * 100}%`, background: urgent ? 'var(--danger)' : 'var(--grad)' }}
        />
      </div>
    </>
  );
}

function FlExtraChip() {
  return (
    <span className="rounded-full px-2 py-[1px] text-[10.5px] font-extrabold text-white shadow-[var(--glow-fl)] animate-badge-in" style={{ background: 'var(--grad-fl)' }}>
      ★ FL spelas ut
    </span>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9.5 2.5h5" />
    </svg>
  );
}

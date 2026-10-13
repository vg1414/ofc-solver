// SortButtons.tsx — Knapparna Färg / Värde (logiken finns i handSort.ts)
import { haptic } from './cardStyle';
import type { SortMode } from './handSort';

/** Två små knappar: Färg / Värde. Valt läge trycks igen → osorterat. */
export default function SortButtons({ mode, onChange }: { mode: SortMode; onChange: (m: SortMode) => void }) {
  const btn = (m: Exclude<SortMode, 'dealt'>, label: string) => {
    const on = mode === m;
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => {
          haptic(4);
          onChange(on ? 'dealt' : m);
        }}
        className={`h-7 rounded-full px-3 text-[11.5px] font-bold transition-[background-color,color,box-shadow,transform] duration-200 active:scale-95 ${
          on ? 'text-white [background:var(--grad)] shadow-[var(--glow)]' : 'bg-sunken text-ink-2'
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Sortera korten">
      <span className="text-[11px] font-semibold text-ink-3">Sortera</span>
      {btn('suit', 'Färg')}
      {btn('rank', 'Värde')}
    </div>
  );
}

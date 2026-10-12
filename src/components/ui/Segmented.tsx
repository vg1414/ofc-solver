// ============================================================
// Segmented.tsx — Segmenterad väljare
// ============================================================
// En "puck" glider fjädrande bakom det valda alternativet. Positionen
// räknas ut från index (translateX i procent av puckens egen bredd),
// så animationen är ren CSS och kostar nästan ingenting.
//  - variant "brand": glödande grön gradient-pill (huvudval)
//  - variant "soft":  vit puck (underval)
// ============================================================

interface Option<T extends string | number> {
  value: T;
  label: React.ReactNode;
  sub?: string;
}

interface SegmentedProps<T extends string | number> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  variant?: 'brand' | 'soft';
  ariaLabel?: string;
}

export default function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  disabled,
  size = 'md',
  variant = 'soft',
  ariaLabel,
}: SegmentedProps<T>) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const brand = variant === 'brand';

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`glass relative flex rounded-full p-[4px] ${disabled ? 'opacity-55' : ''}`}
    >
      <div
        className="absolute top-[4px] bottom-[4px] rounded-full transition-transform duration-[450ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          width: `calc((100% - 8px) / ${options.length})`,
          left: 4,
          transform: `translateX(${idx * 100}%)`,
          background: brand ? 'var(--grad)' : 'var(--surface)',
          boxShadow: brand ? 'var(--glow)' : 'var(--shadow-soft)',
        }}
        aria-hidden="true"
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`relative z-10 flex-1 flex flex-col items-center justify-center rounded-full font-bold leading-tight transition-[color,transform] duration-300 active:scale-95
              ${size === 'sm' ? 'py-1.5 text-[12.5px]' : 'py-2.5 text-[14px]'}
              ${active ? (brand ? 'text-white' : 'text-ink') : 'text-ink-2 hover:text-accent-ink'}`}
          >
            <span>{o.label}</span>
            {o.sub && (
              <span className={`text-[10px] font-semibold ${active ? (brand ? 'text-white/80' : 'text-ink-2') : 'text-ink-3'}`}>{o.sub}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

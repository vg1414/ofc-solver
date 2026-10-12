// ============================================================
// HandSettingsSheet.tsx — Inställningar för "Hel hand mot datorn"
// ============================================================
// Öppnas från kugghjulet på startsidan. Ändringar sparas direkt
// (TrainingView lägger dem i localStorage), så "Klar" stänger bara.
//  - Längd: Händer / Minuter / Fritt. Snabbval + en stegare för eget värde.
//  - Fantasy Land i slutet: spelas ut eller får sluta i FL.
//  - Datorns styrka (Snabb / Normal / Noggrann) och coach-läge.
// SettingsSummary är raden på startsidan som visar valen och öppnar arket.
// ============================================================

import { useRef } from 'react';
import BottomSheet from '../ui/BottomSheet';
import Segmented from '../ui/Segmented';
import { haptic } from '../cards/cardStyle';
import {
  HAND_PRESETS,
  HANDS_RANGE,
  MINUTE_PRESETS,
  MINUTES_RANGE,
  lengthLabel,
  CPU_LEVELS,
  type CpuLevel,
  type FlEnd,
  type HandSettings,
  type SessionLength,
} from '../../training/session';

type Kind = SessionLength['kind'];

interface Props {
  open: boolean;
  onClose: () => void;
  value: HandSettings;
  onChange: (s: HandSettings) => void;
}

export default function HandSettingsSheet({ open, onClose, value, onChange }: Props) {
  // Kom ihåg senaste antal händer/minuter när man växlar läge fram och tillbaka
  const memory = useRef({ hands: value.length.kind === 'hands' ? value.length.n : 10, minutes: value.length.kind === 'minutes' ? value.length.n : 20 });
  const len = value.length;
  const set = (patch: Partial<HandSettings>) => {
    haptic(4);
    onChange({ ...value, ...patch });
  };
  const setKind = (k: Kind) => {
    if (k === 'free') set({ length: { kind: 'free' } });
    else set({ length: { kind: k, n: memory.current[k] } });
  };
  const setN = (n: number) => {
    if (len.kind === 'free') return;
    memory.current[len.kind] = n;
    set({ length: { kind: len.kind, n } });
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Inställningar">
      <div className="flex flex-col gap-4">
        <Section label="Sessionens längd">
          <Segmented<Kind>
            variant="brand"
            ariaLabel="Sessionens längd"
            value={len.kind}
            onChange={setKind}
            options={[
              { value: 'hands', label: 'Händer' },
              { value: 'minutes', label: 'Minuter' },
              { value: 'free', label: 'Fritt' },
            ]}
          />
          <div key={len.kind} className="mt-2.5 animate-fade-in">
            {len.kind === 'free' ? (
              <p className="rounded-[18px] bg-sunken/70 px-3.5 py-3 text-[12.5px] text-ink-2">
                Spela så länge du vill. Avsluta när du vill efter en hand — speltid och poäng räknas hela tiden.
              </p>
            ) : (
              <NumberPicker
                value={len.n}
                presets={len.kind === 'hands' ? HAND_PRESETS : MINUTE_PRESETS}
                range={len.kind === 'hands' ? HANDS_RANGE : MINUTES_RANGE}
                unit={len.kind === 'hands' ? (len.n === 1 ? 'hand' : 'händer') : 'minuter'}
                onChange={setN}
              />
            )}
            {len.kind === 'minutes' && <p className="mt-2 px-1 text-[11.5px] text-ink-3">När tiden är ute spelas handen som pågår klart. Klockan står still när appen inte syns.</p>}
            {len.kind !== 'hands' && <p className="mt-1 px-1 text-[11.5px] text-ink-3">Topplistan gäller bara antal händer.</p>}
          </div>
        </Section>

        <Section label="Fantasy Land i slutet">
          <div className="grid grid-cols-2 gap-2">
            <FlOption
              active={value.flEnd === 'playout'}
              onClick={() => set({ flEnd: 'playout' as FlEnd })}
              title="Spelas ut"
              sub="Som vid bordet: FL och repeat-FL spelas klart först"
            />
            <FlOption active={value.flEnd === 'stop'} onClick={() => set({ flEnd: 'stop' as FlEnd })} title="Får sluta i FL" sub="Sessionen slutar direkt, FL går förlorat" />
          </div>
        </Section>

        <Section label="Datorns styrka">
          <Segmented<CpuLevel>
            size="sm"
            ariaLabel="Datorns styrka"
            value={value.cpuLevel}
            onChange={(cpuLevel) => set({ cpuLevel })}
            options={(['fast', 'normal', 'thorough'] as const).map((l) => ({
              value: l,
              label: CPU_LEVELS[l].label,
              sub: `${CPU_LEVELS[l].simulations} sim · ≤ ${CPU_LEVELS[l].maxMs / 1000} s`,
            }))}
          />
          <p className="mt-1.5 px-1 text-[11.5px] text-ink-3">Gäller bara datorn här. Solver-flikens nivå ändras inte.</p>
        </Section>

        <Section label="Hjälp">
          <Switch
            on={value.coach}
            onToggle={() => set({ coach: !value.coach })}
            title="Coach-läge"
            sub="Visar EV-förlusten och solverns bästa drag efter varje drag"
          />
        </Section>

        <button type="button" onClick={onClose} className="btn-primary h-12 rounded-full text-[15px] font-bold">
          Klar
        </button>
      </div>
    </BottomSheet>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 px-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-3">{label}</div>
      {children}
    </div>
  );
}

/** Stort tal med − / +, och snabbval under */
function NumberPicker({
  value,
  presets,
  range,
  unit,
  onChange,
}: {
  value: number;
  presets: readonly number[];
  range: { min: number; max: number; step: number };
  unit: string;
  onChange: (n: number) => void;
}) {
  const step = (d: number) => {
    // Minuter: hoppa till närmaste femtal i den riktningen
    const next = d > 0 ? Math.floor(value / range.step) * range.step + range.step : Math.ceil(value / range.step) * range.step - range.step;
    onChange(Math.min(range.max, Math.max(range.min, next)));
  };
  return (
    <div className="flex flex-col gap-2 rounded-[22px] bg-sunken/60 p-2.5">
      <div className="flex items-center gap-2">
        <StepButton label="Minska" disabled={value <= range.min} onClick={() => step(-1)}>
          −
        </StepButton>
        <div className="flex-1 text-center leading-none">
          <div key={value} className="font-serif text-[40px] font-extrabold tabular text-ink animate-badge-in">
            {value}
          </div>
          <div className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">{unit}</div>
        </div>
        <StepButton label="Öka" disabled={value >= range.max} onClick={() => step(1)}>
          +
        </StepButton>
      </div>
      <div className="flex gap-1.5">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`h-9 flex-1 rounded-full text-[13px] font-bold transition-all duration-300 active:scale-95 ${
              value === p ? 'text-white shadow-[var(--glow)]' : 'bg-surface text-ink-2 shadow-[var(--shadow-soft)]'
            }`}
            style={value === p ? { background: 'var(--grad)' } : undefined}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-[24px] font-bold text-accent-ink shadow-[var(--shadow-soft)] transition-transform duration-200 active:scale-90 disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function FlOption({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex flex-col gap-0.5 rounded-[18px] px-3 py-2.5 text-left transition-all duration-300 active:scale-[0.97] ${
        active ? 'text-white shadow-[var(--glow-fl)]' : 'bg-sunken/70 text-ink'
      }`}
      style={active ? { background: 'var(--grad-fl)' } : undefined}
    >
      <span className="text-[14px] font-extrabold">{active ? '★ ' : ''}{title}</span>
      <span className={`text-[11px] font-medium leading-snug ${active ? 'text-white/85' : 'text-ink-3'}`}>{sub}</span>
    </button>
  );
}

export function Switch({ on, onToggle, title, sub }: { on: boolean; onToggle: () => void; title: string; sub: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onToggle} className="flex w-full items-center gap-3 rounded-[18px] px-1 py-1 text-left">
      <div className="flex-1">
        <div className="text-[14px] font-bold text-ink">{title}</div>
        <div className="text-[12px] text-ink-3">{sub}</div>
      </div>
      <span
        className="relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300"
        style={{ background: on ? 'var(--grad)' : 'var(--line-strong)', boxShadow: on ? 'var(--glow)' : undefined }}
      >
        <span
          className="absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.2)] transition-transform duration-[400ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={{ transform: `translateX(${on ? 23 : 3}px)` }}
        />
      </span>
    </button>
  );
}

/** Raden på startsidan: visar valen som små pills, ett tryck öppnar arket */
export function SettingsSummary({ value, onOpen }: { value: HandSettings; onOpen: () => void }) {
  const pills = [lengthLabel(value.length), value.flEnd === 'playout' ? '★ FL spelas ut' : 'Får sluta i FL', `Dator: ${CPU_LEVELS[value.cpuLevel].label}`, value.coach ? 'Coach på' : 'Coach av'];
  return (
    <button
      type="button"
      onClick={() => {
        haptic(4);
        onOpen();
      }}
      className="group flex w-full items-center gap-3 rounded-[20px] bg-sunken/60 px-3 py-2.5 text-left transition-transform duration-200 active:scale-[0.98]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-accent-ink shadow-[var(--shadow-soft)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:rotate-90 group-active:rotate-90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold text-ink">Inställningar</span>
        <span className="mt-1 flex flex-wrap gap-1">
          {pills.map((p) => (
            <span key={p} className="rounded-full bg-surface px-2 py-[1px] text-[11px] font-bold text-ink-2 shadow-[var(--shadow-soft)]">
              {p}
            </span>
          ))}
        </span>
      </span>
      <span className="text-[18px] font-bold text-ink-3" aria-hidden="true">›</span>
    </button>
  );
}

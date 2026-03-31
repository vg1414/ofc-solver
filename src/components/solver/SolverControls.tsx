// ============================================================
// SolverControls.tsx — Kontroller för OFC Solver
// ============================================================

import { useState } from 'react';
import type { GameVariant, SolverMode, FLCardCount } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';

// ============================================================
// Typer
// ============================================================

interface SolverControlsProps {
  isLoading: boolean;
  onRunSolver: (simulations: number) => void;
  onCancelSolver: () => void;
}

// ============================================================
// Lägesväljare
// ============================================================

interface ModeSelectorProps {
  mode: SolverMode;
  onChange: (m: SolverMode) => void;
  disabled?: boolean;
}

const MODE_LABELS: Record<SolverMode, string> = {
  normal: 'Normal',
  opening: 'Öppningshand',
  fantasyLand: 'Fantasy Land',
};

function ModeSelector({ mode, onChange, disabled }: ModeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500 text-xs">Läge:</span>
      <div className="flex rounded-lg overflow-hidden border border-[#1e3a50]">
        {(['normal', 'opening', 'fantasyLand'] as SolverMode[]).map((m) => (
          <button
            key={m}
            onClick={() => onChange(m)}
            disabled={disabled}
            className={`
              px-3 py-1.5 text-xs font-semibold transition-colors
              ${mode === m
                ? 'bg-green-700 text-white'
                : 'bg-[#0d1f2d] text-slate-400 hover:text-slate-200 hover:bg-[#142a3a]'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// FL-kortantal-väljare
// ============================================================

const FL_PRESETS: { label: string; value: FLCardCount }[] = [
  { label: '13 (QQ)', value: 13 },
  { label: '14 (KK)', value: 14 },
  { label: '15 (AA)', value: 15 },
  { label: '16 (Triss)', value: 16 },
];

interface FLCardCountPickerProps {
  value: FLCardCount;
  onChange: (n: FLCardCount) => void;
  disabled?: boolean;
}

function FLCardCountPicker({ value, onChange, disabled }: FLCardCountPickerProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500 text-xs">Antal kort:</span>
      <div className="flex rounded-lg overflow-hidden border border-[#1e3a50]">
        {FL_PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => onChange(p.value)}
            disabled={disabled}
            className={`
              px-3 py-1 text-xs transition-colors
              ${value === p.value
                ? 'bg-slate-600 text-slate-100'
                : 'bg-[#0d1f2d] text-slate-500 hover:text-slate-300 hover:bg-[#142a3a]'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Variant-väljare
// ============================================================

interface VariantSelectorProps {
  variant: GameVariant;
  onChange: (v: GameVariant) => void;
  disabled?: boolean;
}

function VariantSelector({ variant, onChange, disabled }: VariantSelectorProps) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-[#1e3a50]">
      {(['regular', 'pineapple'] as GameVariant[]).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          disabled={disabled}
          className={`
            px-4 py-1.5 text-xs font-semibold transition-colors
            ${variant === v
              ? 'bg-green-700 text-white'
              : 'bg-[#0d1f2d] text-slate-400 hover:text-slate-200 hover:bg-[#142a3a]'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          {v === 'regular' ? 'Vanlig OFC' : 'Pineapple'}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// Simuleringsväljare
// ============================================================

const SIM_PRESETS = [
  { label: 'Snabb', value: 200 },
  { label: 'Normal', value: 1000 },
  { label: 'Noggrann', value: 3000 },
];

interface SimPresetPickerProps {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}

function SimPresetPicker({ value, onChange, disabled }: SimPresetPickerProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500 text-xs">Simuleringar:</span>
      <div className="flex rounded-lg overflow-hidden border border-[#1e3a50]">
        {SIM_PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => onChange(p.value)}
            disabled={disabled}
            className={`
              px-3 py-1 text-xs transition-colors
              ${value === p.value
                ? 'bg-slate-600 text-slate-100'
                : 'bg-[#0d1f2d] text-slate-500 hover:text-slate-300 hover:bg-[#142a3a]'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {p.label}
          </button>
        ))}
      </div>
      <span className="text-slate-600 text-xs tabular-nums">{value.toLocaleString()}</span>
    </div>
  );
}

// ============================================================
// Huvud-komponent
// ============================================================

export default function SolverControls({
  isLoading,
  onRunSolver,
  onCancelSolver,
}: SolverControlsProps) {
  const {
    variant, setVariant, resetGame,
    selectedCard, currentCards,
    solverMode, setSolverMode,
    selectedCards, flCardCount, setFLCardCount,
  } = useGameStore();
  const [simulations, setSimulations] = useState(1000);

  const hasCards =
    solverMode === 'normal'
      ? selectedCard !== null || currentCards.length > 0
      : selectedCards.length > 0;

  const canRun = hasCards && !isLoading;

  // Knapp-text per läge
  const runButtonLabel =
    solverMode === 'opening' ? 'Analysera öppningshand'
    : solverMode === 'fantasyLand' ? 'Analysera Fantasy Land'
    : 'Kör solver';

  // Info-text per läge
  const infoText = () => {
    if (hasCards) {
      if (solverMode === 'opening')
        return `${selectedCards.length}/5 kort valda — klicka "Analysera öppningshand" för att se bästa start.`;
      if (solverMode === 'fantasyLand')
        return `${selectedCards.length}/${flCardCount} kort valda — klicka "Analysera Fantasy Land" för bästa placering.`;
      return 'Kort valt — klicka "Kör solver" för att beräkna bästa placering.';
    }
    if (solverMode === 'opening')
      return `Välj 5 kort i kortväljaren för att analysera öppningshand.`;
    if (solverMode === 'fantasyLand')
      return `Välj ${flCardCount} kort i kortväljaren för Fantasy Land-analys.`;
    return 'Välj ett kort i kortväljaren — kör sedan solver för att se var det bör placeras.';
  };

  return (
    <div className="bg-[#0d1f2d] border border-[#1a3d2a] rounded-xl px-3 sm:px-4 py-3 flex flex-col gap-2 sm:gap-3">
      {/* Rad 1: Lägesväljare */}
      <ModeSelector
        mode={solverMode}
        onChange={setSolverMode}
        disabled={isLoading}
      />

      {/* Rad 2: Variant + simuleringar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <VariantSelector
          variant={variant}
          onChange={setVariant}
          disabled={isLoading}
        />
        <SimPresetPicker
          value={simulations}
          onChange={setSimulations}
          disabled={isLoading}
        />
      </div>

      {/* Rad 3: FL-kortantal (visas bara i FL-läge) */}
      {solverMode === 'fantasyLand' && (
        <FLCardCountPicker
          value={flCardCount}
          onChange={setFLCardCount}
          disabled={isLoading}
        />
      )}

      {/* Rad 4: Åtgärdsknappar */}
      <div className="flex items-center gap-2">
        {/* Kör / Avbryt */}
        {isLoading ? (
          <button
            onClick={onCancelSolver}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-900/40 border border-red-700/50 text-red-300 text-sm font-semibold hover:bg-red-900/60 transition-colors cursor-pointer"
          >
            <span className="w-3 h-3 bg-red-400 rounded-sm shrink-0" />
            Avbryt
          </button>
        ) : (
          <button
            onClick={() => onRunSolver(simulations)}
            disabled={!canRun}
            title={!hasCards ? 'Välj kort i kortväljaren först' : undefined}
            className={`
              flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all
              ${canRun
                ? 'bg-green-700 hover:bg-green-600 text-white shadow-md shadow-green-900/30 cursor-pointer'
                : 'bg-slate-700/40 text-slate-500 cursor-not-allowed'
              }
            `}
          >
            <span className="text-base leading-none">★</span>
            {runButtonLabel}
          </button>
        )}

        {/* Återställ hand */}
        <button
          onClick={resetGame}
          disabled={isLoading}
          className={`
            px-4 py-2 rounded-lg text-sm transition-colors border
            ${isLoading
              ? 'border-slate-700/40 text-slate-600 cursor-not-allowed'
              : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 cursor-pointer'
            }
          `}
        >
          Ny hand
        </button>
      </div>

      {/* Info */}
      <p className={`text-xs ${hasCards ? 'text-slate-500' : 'text-slate-600'}`}>
        {infoText()}
      </p>
    </div>
  );
}

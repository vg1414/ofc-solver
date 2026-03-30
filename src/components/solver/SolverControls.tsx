// ============================================================
// SolverControls.tsx — Kontroller för OFC Solver
// ============================================================

import { useState } from 'react';
import type { GameVariant } from '../../engine/types';
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
  const { variant, setVariant, resetGame, selectedCard, currentCards } = useGameStore();
  const [simulations, setSimulations] = useState(1000);

  const hasCards = selectedCard !== null || currentCards.length > 0;
  const canRun = hasCards && !isLoading;

  return (
    <div className="bg-[#0d1f2d] border border-[#1a3d2a] rounded-xl px-4 py-3 flex flex-col gap-3">
      {/* Rad 1: Variant + simuleringar */}
      <div className="flex flex-wrap items-center gap-3">
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

      {/* Rad 2: Åtgärdsknappar */}
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
            title={!hasCards ? 'Välj ett kort i kortväljaren först' : undefined}
            className={`
              flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all
              ${canRun
                ? 'bg-green-700 hover:bg-green-600 text-white shadow-md shadow-green-900/30 cursor-pointer'
                : 'bg-slate-700/40 text-slate-500 cursor-not-allowed'
              }
            `}
          >
            <span className="text-base leading-none">★</span>
            Kör solver
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
      {!hasCards && (
        <p className="text-slate-600 text-xs">
          Välj ett kort i kortväljaren — kör sedan solver för att se var det bör placeras.
        </p>
      )}
      {selectedCard && (
        <p className="text-slate-500 text-xs">
          Kort valt — klicka "Kör solver" för att beräkna bästa placering.
        </p>
      )}
    </div>
  );
}

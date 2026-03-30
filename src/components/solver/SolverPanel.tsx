// ============================================================
// SolverPanel.tsx — Visar EV-rankade placeringsalternativ
// ============================================================
//
// Tar emot solver-state från useSolver och visar:
//   - Loading-spinner med animering under beräkning
//   - Rankad lista med placeringsalternativ (EV-värden)
//   - Bästa alternativ markerat med grön highlight
//   - Progressbar per alternativ (relativ EV)
//   - Felmeddelande om något gick fel
// ============================================================

import type { DetailedSolverResult } from '../../solver/solver';
import type { Card, RowName } from '../../engine/types';
import { cardToDisplay } from '../../engine/card';


// ============================================================
// Hjälpfunktioner
// ============================================================

const ROW_LABEL: Record<RowName, string> = {
  top: 'Topp',
  middle: 'Mitten',
  bottom: 'Botten',
};

function formatCard(card: Card): string {
  return cardToDisplay(card);
}

function formatEV(ev: number): string {
  if (ev >= 0) return `+${ev.toFixed(2)}`;
  return ev.toFixed(2);
}

function getEVColor(ev: number, isFirst: boolean): string {
  if (isFirst) return 'text-green-400';
  if (ev >= 0) return 'text-slate-200';
  return 'text-red-400';
}

function getBarWidth(ev: number, maxAbsEV: number): number {
  if (maxAbsEV === 0) return 0;
  // Normalisera till 0–100%, ta EV relativt till max
  const normalized = (ev + maxAbsEV) / (2 * maxAbsEV);
  return Math.max(5, Math.round(normalized * 100));
}

// ============================================================
// Beskrivning av en placering
// ============================================================

interface PlacementDescriptionProps {
  placements: { row: RowName; slotIndex: number; card: Card }[];
  discards: Card[];
}

function PlacementDescription({ placements, discards }: PlacementDescriptionProps) {
  if (placements.length === 0) return <span className="text-slate-500">–</span>;

  // Gruppera kort per rad
  const byRow: Partial<Record<RowName, Card[]>> = {};
  for (const p of placements) {
    if (!byRow[p.row]) byRow[p.row] = [];
    byRow[p.row]!.push(p.card);
  }

  const parts: string[] = [];
  for (const row of ['bottom', 'middle', 'top'] as RowName[]) {
    const cards = byRow[row];
    if (cards && cards.length > 0) {
      parts.push(`${cards.map(formatCard).join(', ')} → ${ROW_LABEL[row]}`);
    }
  }

  return (
    <span className="text-slate-300 text-xs">
      {parts.join('  |  ')}
      {discards.length > 0 && (
        <span className="text-slate-500 ml-2">
          (kasta: {discards.map(formatCard).join(', ')})
        </span>
      )}
    </span>
  );
}

// ============================================================
// Loading-spinner
// ============================================================

function LoadingSpinner({ simulations }: { simulations?: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-green-500/30 border-t-green-400 rounded-full animate-spin" />
        <span className="text-green-400 text-sm font-medium">Solver beräknar…</span>
      </div>
      {simulations !== undefined && simulations > 0 && (
        <span className="text-slate-500 text-xs">{simulations.toLocaleString()} simuleringar</span>
      )}
    </div>
  );
}

// ============================================================
// Huvud-komponent
// ============================================================

interface SolverPanelProps {
  result: DetailedSolverResult | null;
  isLoading: boolean;
  error: string | null;
  lastSimulations?: number;
  /** Hur många alternativ att visa (default: 5) */
  maxOptions?: number;
  /** Callback när användaren klickar på ett alternativ */
  onSelectOption?: (optionIndex: number) => void;
}

export default function SolverPanel({
  result,
  isLoading,
  error,
  lastSimulations = 0,
  maxOptions = 5,
  onSelectOption,
}: SolverPanelProps) {
  const options = result?.options.slice(0, maxOptions) ?? [];
  const evValues = options.map((o) => o.ev);
  const maxAbsEV = Math.max(...evValues.map(Math.abs), 0.01);

  return (
    <div className="bg-[#0d1f2d] border border-[#1a3d2a] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0a1a25] border-b border-[#1a3d2a]">
        <div className="flex items-center gap-2">
          <span className="text-green-500 text-base">★</span>
          <span className="text-slate-200 text-sm font-semibold tracking-wide uppercase">
            Solver rekommenderar
          </span>
        </div>
        {result && (
          <span className="text-slate-500 text-xs">
            {result.simulations.toLocaleString()} sim
            {result.timedOut && (
              <span className="ml-1 text-yellow-600" title="Tidsgräns nåddes">⚠</span>
            )}
          </span>
        )}
      </div>

      {/* Innehåll */}
      <div className="p-3">
        {isLoading && <LoadingSpinner simulations={lastSimulations} />}

        {!isLoading && error && (
          <div className="text-red-400 text-sm px-1 py-3 flex items-center gap-2">
            <span className="text-red-500">✕</span>
            <span>{error}</span>
          </div>
        )}

        {!isLoading && !error && options.length === 0 && (
          <div className="text-slate-500 text-sm text-center py-4">
            Välj kort och klicka "Kör solver" för att se rekommendationer.
          </div>
        )}

        {!isLoading && !error && options.length > 0 && (
          <div className="flex flex-col gap-2">
            {options.map((opt, idx) => {
              const isFirst = idx === 0;
              const barWidth = getBarWidth(opt.ev, maxAbsEV);
              const evColor = getEVColor(opt.ev, isFirst);

              return (
                <button
                  key={idx}
                  onClick={() => onSelectOption?.(idx)}
                  className={`
                    group relative rounded-lg px-3 py-2.5 text-left transition-all duration-100
                    ${isFirst
                      ? 'bg-green-900/25 border border-green-700/50 hover:border-green-500/60'
                      : 'bg-[#0f2535] border border-[#1e3a50] hover:border-slate-600/60'
                    }
                    ${onSelectOption ? 'cursor-pointer' : 'cursor-default'}
                  `}
                >
                  {/* Rank-badge + beskrivning */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`
                      text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0
                      ${isFirst
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-700 text-slate-400'
                      }
                    `}>
                      {opt.rank}
                    </span>
                    <PlacementDescription
                      placements={opt.placements}
                      discards={opt.discards}
                    />
                    {isFirst && (
                      <span className="ml-auto text-[10px] text-green-600 font-semibold uppercase tracking-wide shrink-0">
                        BÄST
                      </span>
                    )}
                  </div>

                  {/* EV-bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isFirst ? 'bg-green-500' : opt.ev >= 0 ? 'bg-slate-500' : 'bg-red-700'
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className={`text-xs font-mono font-bold tabular-nums w-14 text-right ${evColor}`}>
                      EV {formatEV(opt.ev)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

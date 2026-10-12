// ============================================================
// ResultsPanel.tsx — Solverns förslag
// ============================================================
// - Det förhandsvisade alternativet (först: bästa) står överst i ett
//   glaskort. Bästa draget har en skimrande guldlist, guldbricka och
//   en EV-siffra som "räknas upp" när resultatet dyker upp.
// - Övriga alternativ fälls ut i en lista. Tryck på ett → det visas
//   som spökkort på brädet och får en egen "Lägg så här"-knapp.
// - Öppning/FL: minibild av brädet med royalties.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import type { Card, RowName, SolverMode } from '../../engine/types';
import type { DetailedPlacementOption, DetailedSolverResult } from '../../solver/solver';
import PlayingCard from '../cards/PlayingCard';
import SuitIcon from '../cards/SuitIcon';
import ResultBoardPreview from './ResultBoardPreview';

const ROW_LABEL: Record<RowName, string> = { top: 'Topp', middle: 'Mitt', bottom: 'Botten' };

const evFmt = new Intl.NumberFormat('sv-SE', { signDisplay: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function pct(p: number) {
  const v = p * 100;
  return v > 0 && v < 1 ? '<1' : String(Math.round(v));
}

/**
 * Räknar upp ett tal från 0 till `target` på ~650 ms.
 * requestAnimationFrame + "ease-out" (1 - (1-t)³) gör att siffran
 * rusar iväg först och bromsar mjukt in mot slutvärdet.
 */
function useCountUp(target: number, duration = 650) {
  const [v, setV] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      setV(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return v;
}

function Chip({ children, tone, title, small }: { children: React.ReactNode; tone: 'fl' | 'danger' | 'muted' | 'good'; title?: string; small?: boolean }) {
  const tones = {
    fl: 'bg-fl-soft text-fl border-[color:color-mix(in_srgb,var(--fl)_22%,transparent)]',
    danger: 'bg-danger-soft text-danger border-[color:color-mix(in_srgb,var(--danger)_22%,transparent)]',
    muted: 'bg-surface/80 text-ink-2 border-line',
    good: 'bg-accent-soft text-accent-ink border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)]',
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border font-bold tabular whitespace-nowrap ${small ? 'px-2 py-[1px] text-[10.5px]' : 'px-2.5 py-0.5 text-[12px]'} ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function Badges({ opt, small = false }: { opt: DetailedPlacementOption; small?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {opt.flProbability !== undefined && (
        <Chip tone="fl" small={small} title="Chans att nå Fantasy Land">
          FL {pct(opt.flProbability)}%
        </Chip>
      )}
      {opt.foulProbability !== undefined && (
        <Chip tone={opt.foulProbability >= 0.25 ? 'danger' : 'muted'} small={small} title="Risk att handen slutar i foul">
          Foul {pct(opt.foulProbability)}%
        </Chip>
      )}
      {opt.repeatFL !== undefined && (
        <Chip tone={opt.repeatFL ? 'good' : 'muted'} small={small} title={opt.repeatFL ? 'Ger Fantasy Land igen' : 'Ger inte Fantasy Land igen'}>
          {opt.repeatFL ? '↻ FL igen' : '↻ Ej FL igen'}
        </Chip>
      )}
    </div>
  );
}

/** "Q♦ → Topp" som små kort per rad. discardsOnly = visa bara kastade kort */
function PlacementSummary({ opt, cardWidth = 20, discardsOnly = false }: { opt: DetailedPlacementOption; cardWidth?: number; discardsOnly?: boolean }) {
  const byRow: Partial<Record<RowName, Card[]>> = {};
  if (!discardsOnly) for (const p of opt.placements) (byRow[p.row] ??= []).push(p.card);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {(['top', 'middle', 'bottom'] as RowName[]).map((row) =>
        byRow[row] ? (
          <span key={row} className="inline-flex items-center gap-1.5">
            <span className="flex gap-[3px]">
              {byRow[row]!.map((c, i) => (
                <PlayingCard key={i} card={c} width={cardWidth} compact />
              ))}
            </span>
            <span className="text-[13px] font-bold text-ink-2">→ {ROW_LABEL[row]}</span>
          </span>
        ) : null,
      )}
      {opt.discards.length > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <span className="flex gap-[3px] opacity-60 grayscale-[0.4]">
            {opt.discards.map((c, i) => (
              <PlayingCard key={i} card={c} width={cardWidth} compact />
            ))}
          </span>
          <span className="text-[13px] font-bold text-danger">kastas</span>
        </span>
      )}
    </div>
  );
}

interface ResultsPanelProps {
  result: DetailedSolverResult;
  mode: SolverMode;
  previewIndex: number;
  onPreview: (i: number) => void;
  onApply?: (opt: DetailedPlacementOption) => void;
  onClose?: () => void;
  usedOpponentBoard?: boolean;
  maxOptions?: number;
}

export default function ResultsPanel({
  result,
  mode,
  previewIndex,
  onPreview,
  onApply,
  onClose,
  usedOpponentBoard,
  maxOptions = 6,
}: ResultsPanelProps) {
  const options = result.options.slice(0, maxOptions);
  const best = options[0];
  // I Normal-läget syns förslaget som spökkort på brädet → ingen minibild behövs.
  // Listan börjar då ihopfälld så att brädet syns ovanför panelen.
  const showBoards = mode !== 'normal';
  const [expanded, setExpanded] = useState(mode !== 'normal');
  const featured = options[previewIndex] ?? best;
  const isBest = previewIndex === 0;
  const ev = useCountUp(featured.ev);

  return (
    <div className="flex flex-col gap-2 animate-rise-in">
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="eyebrow">
          {result.method === 'exact' ? 'Exakt uträknat' : `${result.simulations.toLocaleString('sv-SE')} simuleringar`}
          {result.timedOut && <span className="ml-1 normal-case tracking-normal text-gold" title="Tidsgränsen nåddes — resultatet är ungefärligt">· tidsgräns</span>}
        </span>
        <div className="flex items-center gap-1.5">
          {usedOpponentBoard && (
            <Chip tone="muted" small title="EV räknat mot motståndarens faktiska kort">
              ↕ Motståndaren inräknad
            </Chip>
          )}
          {onClose && (
            <button type="button" onClick={onClose} className="btn-ghost rounded-full px-3 py-1 text-[12px] font-bold">
              Stäng
            </button>
          )}
        </div>
      </div>

      {/* Det förhandsvisade alternativet (bästa från början) */}
      <div
        key={previewIndex}
        className={`relative overflow-hidden rounded-[24px] animate-rise-in ${
          isBest
            ? 'bg-gradient-to-br from-gold-soft to-surface shadow-[0_0_0_1.5px_var(--gold-line),var(--shadow-soft)]'
            : 'glass !shadow-[0_0_0_1.5px_var(--accent),var(--shadow-soft)]'
        }`}
      >
        {isBest && <div className="gold-strip" />}
        <div className="p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {isBest ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#3a2600] shadow-[var(--glow-gold)] animate-badge-in"
                  style={{ background: 'var(--grad-gold)' }}
                >
                  ★ Bästa drag
                </span>
              ) : (
                <span className="eyebrow">Alternativ {previewIndex + 1}</span>
              )}
              <div className="mt-2">
                <PlacementSummary opt={featured} cardWidth={24} discardsOnly={showBoards} />
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-[32px] font-extrabold leading-none tabular tracking-[-0.03em] ${isBest ? 'text-gold' : 'text-ink'}`}>
                {evFmt.format(ev)}
              </div>
              <div className={`mt-1 text-[11px] font-bold tabular ${isBest ? 'text-ink-3' : 'text-danger'}`}>
                {isBest ? 'EV i poäng' : `${evFmt.format(featured.ev - best.ev)} mot bästa`}
              </div>
            </div>
          </div>
          <div className="mt-2.5">
            <Badges opt={featured} />
          </div>
          {showBoards && featured.resultBoard && (
            <div className="mt-3 rounded-[18px] bg-surface/75 p-2.5 shadow-[inset_0_0_0_1px_var(--line)]">
              <ResultBoardPreview board={featured.resultBoard} showRoyalties cardWidth={24} />
            </div>
          )}
          {onApply && (
            <button
              type="button"
              onClick={() => onApply(featured)}
              className="btn-primary mt-2.5 h-11 w-full rounded-full text-[15px] font-bold"
            >
              Lägg så här
            </button>
          )}
        </div>
      </div>

      {options.length > 1 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="btn-ghost self-center rounded-full px-4 py-1.5 text-[12.5px] font-bold"
        >
          Visa alla {options.length} alternativ ▾
        </button>
      )}

      {/* Alla alternativ */}
      {options.length > 1 && expanded && (
        <div className="glass overflow-hidden rounded-[22px] divide-y divide-line animate-fade-in">
          {options.map((opt, i) => {
            const active = previewIndex === i;
            return (
              <div
                key={i}
                role="button"
                tabIndex={0}
                aria-pressed={active}
                onClick={() => {
                  onPreview(i);
                  if (mode === 'normal') setExpanded(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && onPreview(i)}
                className={`px-3.5 py-3 transition-colors duration-200 ${active ? 'bg-accent-soft/70' : 'hover:bg-sunken/60'}`}
                style={{ animation: `fade-in 0.3s var(--ease) ${i * 0.04}s both` }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-6 w-6 shrink-0 rounded-full text-[11px] font-extrabold flex items-center justify-center ${
                      i === 0 ? 'text-[#3a2600] shadow-[var(--glow-gold)]' : 'bg-sunken text-ink-2'
                    }`}
                    style={i === 0 ? { background: 'var(--grad-gold)' } : undefined}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    {showBoards && opt.resultBoard ? (
                      <ResultBoardPreview board={opt.resultBoard} cardWidth={15} />
                    ) : (
                      <PlacementSummary opt={opt} />
                    )}
                    <div className="mt-1.5">
                      <Badges opt={opt} small />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[16px] font-extrabold tabular">{evFmt.format(opt.ev)}</div>
                    {i > 0 && <div className="text-[10.5px] font-bold text-danger tabular">{evFmt.format(opt.ev - best.ev)}</div>}
                    {active && <div className="text-[10.5px] font-bold text-accent-ink">visas</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Progress under beräkning, med avbryt-knapp */
export function SolverProgress({ progress, onCancel, maxSeconds }: { progress: number | null; onCancel: () => void; maxSeconds: number }) {
  // Solvern rapporterar progress som aldrig går bakåt, så värdet kan visas direkt
  const p = Math.min(100, Math.max(0, progress ?? 0));
  return (
    <div className="flex flex-col gap-3 py-1 animate-fade-in" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-[var(--glow)] animate-logo-spin"
          style={{ background: 'var(--grad)' }}
        >
          <SuitIcon suit="spades" className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <div className="title-serif text-[20px]">Räknar…</div>
          <div className="text-[12px] font-medium text-ink-3">Spelar ut tusentals händer · max ca {maxSeconds} s</div>
        </div>
        <span className="text-[20px] font-extrabold tabular text-accent-ink">{Math.round(p)}%</span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--accent)_12%,transparent)]">
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${Math.max(3, p)}%`, background: 'var(--grad)' }}
        />
        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
      </div>
      <button type="button" onClick={onCancel} className="btn-ghost self-end rounded-full px-4 py-2 text-[13px] font-bold !text-danger">
        Avbryt
      </button>
    </div>
  );
}

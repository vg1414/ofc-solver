// ============================================================
// DuelSummary.tsx — Slutresultatet för ett parti mellan 2 spelare
// ============================================================
// Vinnaren stort i sin färg, båda spelarnas poäng, vunna händer,
// speltid och listan med alla händer (tryck för att se slutbrädena).
// ============================================================

import type { Openings } from '../../training/useRecentSlots';
import type { MatchState } from '../../match/match';
import { totals } from '../../match/match';
import { clockText, lengthLabel } from '../../training/session';
import { useCountUp } from '../training/TrainingBits';
import { HandList } from '../training/Scoreboard';
import Footer from '../layout/Footer';

interface Props {
  state: MatchState;
  elapsed: number;
  onRestart: () => void;
  onExit: () => void;
  /** Öppningshandens platser per hand (mörk ram i handlistan) */
  openings?: Openings;
}

export default function DuelSummary({ state, elapsed, onRestart, onExit, openings }: Props) {
  const [n1, n2] = state.config.names;
  const [t1, t2] = totals(state);
  const lead = Math.abs(t1);
  const shown = useCountUp(lead, 1100, 0);
  const winner = t1 > 0 ? 0 : t1 < 0 ? 1 : null;
  const won = [state.records.filter((r) => r.net > 0).length, state.records.filter((r) => r.net < 0).length];
  const incomplete = state.finished && !state.finished.complete;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 pb-4">
      <div
        className="relative overflow-hidden rounded-[28px] px-5 py-6 text-center text-white animate-rise-in"
        style={{
          background: winner === null ? 'var(--grad-gold)' : `var(--grad-p${winner + 1})`,
          boxShadow: winner === null ? 'var(--glow-gold)' : `var(--glow-p${winner + 1})`,
        }}
      >
        <div className="text-[44px] leading-none animate-floaty">{winner === null ? '🤝' : '🏆'}</div>
        <div className="mt-2 font-serif text-[30px] font-extrabold leading-tight">{winner === null ? 'Oavgjort!' : `${winner === 0 ? n1 : n2} vinner!`}</div>
        {winner !== null && <div className="mt-0.5 text-[15px] font-bold text-white/90 tabular">med {Math.round(shown)} p</div>}
        <div className="mt-1 text-[12px] font-semibold text-white/75">
          {state.records.length} {state.records.length === 1 ? 'hand' : 'händer'} · {lengthLabel(state.config.length)} · {state.config.variant === 'regular' ? 'Vanlig' : 'Pineapple'} · {clockText(elapsed)}
          {incomplete && ' · avbrutet'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {([0, 1] as const).map((i) => {
          const t = i === 0 ? t1 : t2;
          return (
            <div key={i} className={`glass rounded-[22px] px-3 py-3 text-center ${i === 0 ? 'bg-p1-soft/40' : 'bg-p2-soft/40'}`}>
              <div className={`truncate text-[11.5px] font-extrabold uppercase tracking-[0.08em] ${i === 0 ? 'text-p1-ink' : 'text-p2-ink'}`}>{i === 0 ? n1 : n2}</div>
              <div className={`font-serif text-[34px] font-extrabold leading-none tabular ${t > 0 ? (i === 0 ? 'text-p1-ink' : 'text-p2-ink') : 'text-ink-2'}`}>
                {t > 0 ? '+' : ''}
                {t}
              </div>
              <div className="mt-1 text-[11px] font-bold text-ink-3">{won[i]} {won[i] === 1 ? 'vunnen hand' : 'vunna händer'}</div>
            </div>
          );
        })}
      </div>

      {state.records.length > 0 && (
        <div className="glass overflow-hidden rounded-[24px]">
          <div className="flex items-center gap-3 px-3.5 pt-3 text-[10px] font-extrabold uppercase tracking-[0.06em] text-ink-3">
            <span className="w-7">#</span>
            <span className="flex-1">Resultat</span>
            <span className="w-10 text-right">Hand</span>
            <span className="w-11 text-right">Totalt</span>
            <span className="w-[7px]" />
          </div>
          <HandList records={state.records} names={state.config.names} openings={openings} cpu={!!state.config.cpu} />
          <p className="pb-3 text-center text-[11px] text-ink-3">
            {state.config.cpu ? 'Poäng från ditt håll: blått = du vann, rött = datorn vann.' : `Grön = ${n1} vann, blå = ${n2} vann.`} Tryck på en hand för slutbrädena.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onExit} className="btn-ghost h-12 flex-1 rounded-full text-[14px] font-bold">
          Till start
        </button>
        <button type="button" onClick={onRestart} className="btn-primary h-12 flex-[2] rounded-full text-[15px] font-bold">
          ★ Spela igen
        </button>
      </div>
      <Footer />
    </div>
  );
}

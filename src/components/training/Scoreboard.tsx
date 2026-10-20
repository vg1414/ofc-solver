// ============================================================
// Scoreboard.tsx — Ställningen under en session mot datorn
// ============================================================
//  - ScoreSheet: ark med "Du mot Datorn" (poängen är nollsumma: det du
//    vinner förlorar datorn) och listan med alla händer.
//  - HandList: en rad per hand med resultat, royalties, FL, handens
//    poäng och totalen efter handen. Tryck på en rad för att se båda
//    slutbrädena. Används även i slutresultatet (HandSummary).
//  - HandStrip: små brickor med varje hands poäng, under poängraden.
// 2 spelare: alla tar `names` ([spelare 1, spelare 2]). Då visas poängen
// för den som vann handen i dennes färg i stället för +/− från ditt håll.
// Spela mot datorn (`cpu`): +/− från ditt håll, blått när du är plus och
// rött när datorn är plus.
// ============================================================

import { useState } from 'react';
import type { Board } from '../../engine/types';
import type { HandOutcome } from '../../training/game';
import BottomSheet from '../ui/BottomSheet';
import ResultBoardPreview from '../solver/ResultBoardPreview';
import type { Openings } from '../../training/useRecentSlots';
import { haptic } from '../cards/cardStyle';

export interface HandRecord {
  no: number;
  net: number;
  outcome: HandOutcome;
  /** FL-kort denna hand [du, datorn] */
  fl: [number, number];
  /** Slutbräden [du, datorn] */
  boards?: [Board, Board];
}

export const sign = (n: number) => `${n > 0 ? '+' : ''}${n}`;
const tone = (n: number) => (n > 0 ? 'text-accent-ink' : n < 0 ? 'text-danger' : 'text-ink-3');

type Names = [string, string];
const CPU_NAMES: Names = ['Du', 'Datorn'];
/** 2 spelare: den som är plus får sin färg (grön/blå), annars dämpat */
const duelTone = (n: number, seat: 0 | 1) => (n > 0 ? (seat === 0 ? 'text-p1-ink' : 'text-p2-ink') : 'text-ink-3');
/** Spela mot datorn: blått = du är plus, rött = datorn är plus */
export const cpuTone = (n: number) => (n > 0 ? 'text-p2-ink' : n < 0 ? 'text-danger' : 'text-ink-3');
const cpuChip = (n: number) => (n > 0 ? 'bg-p2-soft text-p2-ink' : n < 0 ? 'bg-danger-soft text-danger' : 'bg-sunken text-ink-3');
/** Poäng från ditt håll: "+3", "−2", "±0" */
export const signed = (n: number) => (n === 0 ? '±0' : n > 0 ? `+${n}` : `−${-n}`);

function resultText(r: HandRecord, [n1, n2]: Names): string {
  const s = r.outcome.score;
  if (s.p1Foul && s.p2Foul) return 'Båda foulade';
  if (s.p1Foul) return `${n1} foulade`;
  if (s.p2Foul) return `${n2} foulade`;
  if (s.p1Scoop) return n1 === 'Du' ? 'Scoop!' : `${n1} scoopade`;
  if (s.p2Scoop) return `${n2} scoopade`;
  return `${s.p1RowWins}–${s.p2RowWins} i rader`;
}

export function HandList({ records, names, openings, cpu }: { records: HandRecord[]; names?: Names; openings?: Openings; cpu?: boolean }) {
  const duel = !!names && !cpu;
  const nm = names ?? CPU_NAMES;
  const [open, setOpen] = useState<number | null>(null);
  let run = 0;
  const rows = records.map((r) => ({ r, total: (run += r.net) }));
  return (
    <div className="divide-y divide-line">
      {rows.map(({ r, total }) => {
        const s = r.outcome.score;
        const isOpen = open === r.no && !!r.boards;
        return (
          <div key={r.no}>
            <button
              type="button"
              disabled={!r.boards}
              onClick={() => {
                haptic(4);
                setOpen(isOpen ? null : r.no);
              }}
              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
              aria-expanded={isOpen}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sunken text-[12px] font-extrabold text-ink-2 tabular">{r.no}</span>
              <div className="min-w-0 flex-1 text-[12.5px] text-ink-2">
                <span className={s.p1Foul ? 'font-bold text-danger' : s.p1Scoop ? 'font-bold text-accent-ink' : ''}>{resultText(r, nm)}</span>
                {duel ? (
                  <>
                    {(s.p1Royalties.total > 0 || s.p2Royalties.total > 0) && (
                      <span className="text-gold">
                        {' '}
                        · roy {s.p1Royalties.total}–{s.p2Royalties.total}
                      </span>
                    )}
                    {r.fl[0] > 0 && <span className="font-bold text-fl"> · ★ {nm[0]} FL</span>}
                    {r.fl[1] > 0 && <span className="font-bold text-fl"> · ★ {nm[1]} FL</span>}
                  </>
                ) : (
                  <>
                    {s.p1Royalties.total > 0 && <span className="text-gold"> · +{s.p1Royalties.total} roy</span>}
                    {r.fl[0] > 0 && <span className="font-bold text-fl"> · ★ FL</span>}
                    {r.fl[1] > 0 && <span className="text-fl"> · datorn FL</span>}
                  </>
                )}
              </div>
              {cpu ? (
                <>
                  <span className={`w-10 text-right text-[16px] font-extrabold tabular ${cpuTone(r.net)}`}>{signed(r.net)}</span>
                  <span className={`w-11 text-right text-[11.5px] font-bold tabular ${cpuTone(total)}`}>{signed(total)}</span>
                </>
              ) : duel ? (
                <>
                  <span className={`w-10 text-right text-[16px] font-extrabold tabular ${r.net > 0 ? 'text-p1-ink' : r.net < 0 ? 'text-p2-ink' : 'text-ink-3'}`}>{r.net === 0 ? '±0' : `+${Math.abs(r.net)}`}</span>
                  <span className={`w-11 text-right text-[11.5px] font-bold tabular ${total > 0 ? 'text-p1-ink' : total < 0 ? 'text-p2-ink' : 'text-ink-3'}`}>{total === 0 ? '±0' : `+${Math.abs(total)}`}</span>
                </>
              ) : (
                <>
                  <span className={`w-10 text-right text-[16px] font-extrabold tabular ${tone(r.net)}`}>{sign(r.net)}</span>
                  <span className="w-11 text-right text-[11.5px] font-bold tabular text-ink-3">{sign(total)}</span>
                </>
              )}
              {r.boards && (
                <span className={`text-[12px] text-ink-3 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} aria-hidden="true">
                  ›
                </span>
              )}
            </button>
            {isOpen && r.boards && (
              <div className="grid grid-cols-2 gap-2 px-3.5 pb-3 animate-fade-in">
                {nm.map((who, i) => (
                  <div key={who} className="overflow-hidden rounded-[14px] bg-sunken/60 p-2">
                    <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">
                      {who}
                      {(i === 0 ? s.p1Foul : s.p2Foul) && <span className="text-danger"> · foul</span>}
                    </div>
                    <ResultBoardPreview board={r.boards![i]} cardWidth={13} opening={openings?.[r.no]?.[i]} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Brickor med varje spelad hands poäng — syns under sessionen, tryck öppnar ställningen */
export function HandStrip({ records, onOpen, names, cpu }: { records: HandRecord[]; onOpen: () => void; names?: Names; cpu?: boolean }) {
  const duel = !!names && !cpu;
  if (!records.length) return null;
  return (
    <button type="button" onClick={onOpen} aria-label="Visa ställningen" className="flex w-full flex-wrap items-center gap-1 px-1 text-left">
      {records.map((r) => (
        <span
          key={r.no}
          className={`rounded-full px-1.5 py-[1px] text-[11px] font-extrabold tabular animate-badge-in ${
            cpu
              ? cpuChip(r.net)
              : duel
              ? r.net > 0 ? 'bg-p1-soft text-p1-ink' : r.net < 0 ? 'bg-p2-soft text-p2-ink' : 'bg-sunken text-ink-3'
              : r.net > 0 ? 'bg-accent-soft text-accent-ink' : r.net < 0 ? 'bg-danger-soft text-danger' : 'bg-sunken text-ink-3'
          }`}
          title={duel ? `Hand ${r.no}: ${r.net > 0 ? names![0] : r.net < 0 ? names![1] : 'oavgjort'}` : `Hand ${r.no}`}
        >
          {(duel ? r.fl[0] > 0 || r.fl[1] > 0 : r.fl[0] > 0) && '★'}
          {cpu ? signed(r.net) : duel ? (r.net === 0 ? '±0' : `+${Math.abs(r.net)}`) : sign(r.net)}
        </span>
      ))}
      <span className="ml-0.5 text-[11px] font-bold text-ink-3">Ställning ›</span>
    </button>
  );
}

export function ScoreSheet({
  open,
  onClose,
  records,
  current,
  names,
  openings,
  cpu,
}: {
  open: boolean;
  onClose: () => void;
  records: HandRecord[];
  current: number;
  names?: Names;
  /** Öppningshandens platser per hand (mörk ram på minibräden) */
  openings?: Openings;
  /** Spela mot datorn: +/− från ditt håll */
  cpu?: boolean;
}) {
  const nm = names ?? CPU_NAMES;
  const total = records.reduce((n, r) => n + r.net, 0);
  const wins = records.filter((r) => r.net > 0).length;
  const losses = records.filter((r) => r.net < 0).length;
  return (
    <BottomSheet open={open} onClose={onClose} title="Ställning">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[22px] bg-sunken/60 px-3 py-3 text-center">
          <div>
            <div className="truncate text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-3">{nm[0]}</div>
            <div className={`font-serif text-[34px] font-extrabold leading-none tabular ${cpu ? cpuTone(total) : names ? duelTone(total, 0) : tone(total)}`}>{cpu ? signed(total) : sign(total)}</div>
          </div>
          <div className="text-[12px] font-bold text-ink-3 tabular">
            {wins}–{losses}
            <div className="text-[10px] font-semibold">vinster</div>
          </div>
          <div>
            <div className="truncate text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-3">{nm[1]}</div>
            <div className={`font-serif text-[34px] font-extrabold leading-none tabular ${cpu ? cpuTone(total) : names ? duelTone(-total, 1) : tone(-total)}`}>{cpu ? signed(-total) : sign(-total)}</div>
          </div>
        </div>
        {records.length ? (
          <div className="overflow-hidden rounded-[20px] bg-surface/60 shadow-[inset_0_0_0_1px_var(--line)]">
            <div className="flex items-center gap-3 px-3.5 pt-2 text-[10px] font-extrabold uppercase tracking-[0.06em] text-ink-3">
              <span className="w-7">#</span>
              <span className="flex-1">Resultat</span>
              <span className="w-10 text-right">Hand</span>
              <span className="w-11 text-right">Totalt</span>
              <span className="w-[7px]" />
            </div>
            <HandList records={records} names={names} openings={openings} cpu={cpu} />
          </div>
        ) : (
          <p className="py-4 text-center text-[13px] font-semibold text-ink-3">Inga färdiga händer än — hand {current} pågår.</p>
        )}
        {records.length > 0 && <p className="-mt-1 text-center text-[11px] text-ink-3">Tryck på en hand för att se slutbrädena.</p>}
      </div>
    </BottomSheet>
  );
}
